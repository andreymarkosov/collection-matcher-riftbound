import { lookupKey, type LensIndex } from '../core/collection';
import { parseCardCode } from '../core/cardId';
import { getSettings, getStored, type Settings } from '../shared/storage';
import { BADGE_ATTR, badgeState, createBadge, type Badge } from './badge';
import { isOurs } from './dom';
import { FloatLayer } from './float-layer';
import { HoverTip } from './hover-tip';
import type { CardHit, SiteAdapter } from './types';

const RENDER_DEBOUNCE_MS = 250;
/** Pages that mutate non-stop (riftbound.gg) would otherwise push the debounced render back forever. */
const RENDER_MAX_WAIT_MS = 1000;
/** Give SSR frameworks (Next.js on Piltover Archive) time to hydrate before we add nodes. */
const FIRST_RENDER_DELAY_MS = 600;

export function startAnnotator(adapter: SiteAdapter, isEnabled: (s: Settings) => boolean): void {
  let index: LensIndex | undefined;
  let settings: Settings | undefined;
  const badges = new Map<Element, Badge>();
  const floatLayer = new FloatLayer();
  new HoverTip(() => badges.values());
  const groupIds = new WeakMap<Element, number>();
  let nextGroupId = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingSince = 0;

  const schedule = (delay = RENDER_DEBOUNCE_MS) => {
    const now = Date.now();
    if (timer === undefined) pendingSince = now;
    // Past the max wait, let the pending render fire instead of postponing it again.
    else if (now - pendingSince >= RENDER_MAX_WAIT_MS) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      render();
    }, delay);
  };

  const groupId = (el: Element) => {
    let id = groupIds.get(el);
    if (!id) groupIds.set(el, (id = nextGroupId++));
    return id;
  };

  function render(): void {
    const active = !!index && !!settings && isEnabled(settings);
    const deckPage = active && adapter.isDeckPage(document);
    const showAll = !!settings?.showOutsideDecks;
    const hits =
      active && (deckPage || showAll)
        ? adapter.scan(document).filter((h) => (showAll || isInDeck(h)) && isRendered(h.anchor))
        : [];
    const live = new Set<Element>();

    const lens = index;
    if (lens && hits.length) {
      const resolved = hits
        .map((hit) => ({ hit, key: resolveKey(lens, hit) }))
        .filter((r): r is { hit: CardHit; key: string } => r.key !== null);

      const needed = new Map<string, number>();
      for (const { hit, key } of resolved) {
        if (hit.deckQty !== undefined) needed.set(key, (needed.get(key) ?? 0) + hit.deckQty);
      }

      const badged = new Set<string>();
      for (const { hit, key } of resolved) {
        if (hit.group) {
          const dedupe = `${groupId(hit.group)}|${key}`;
          if (badged.has(dedupe)) continue;
          badged.add(dedupe);
        }
        live.add(hit.anchor);
        const owned = lens.owned[key];
        const state = badgeState(owned, deckPage ? needed.get(key) : undefined, hit.name ?? owned?.name ?? key);
        upsertBadge(hit).update(state);
      }
    }

    for (const [anchor, badge] of badges) {
      if (!live.has(anchor) || !anchor.isConnected) {
        badge.host.remove();
        badges.delete(anchor);
      }
    }
    floatLayer.schedule();
    // Our own insertions must not trigger another render.
    observer.takeRecords();
  }

  function upsertBadge(hit: CardHit): Badge {
    const existing = badges.get(hit.anchor);
    if (existing && existing.placement === hit.placement && isPlaced(existing, hit.anchor, floatLayer)) return existing;
    existing?.host.remove();
    const badge = createBadge(hit.placement);
    if (hit.placement === 'float' || hit.placement === 'float-end') {
      floatLayer.add(badge.host, hit.anchor, hit.placement === 'float' ? 'top-center' : 'end');
    } else if (hit.placement === 'overlay') {
      if (getComputedStyle(hit.anchor).position === 'static') {
        // Zero-height block at the top of the anchor, nudged down with `top` (which doesn't affect layout),
        // so the site's layout doesn't shift and its styles stay untouched.
        badge.host.style.cssText =
          'display:block;position:relative;top:6px;height:0;overflow:visible;text-align:center;z-index:30;pointer-events:none;line-height:0;';
        hit.anchor.prepend(badge.host);
      } else {
        hit.anchor.append(badge.host);
      }
    } else {
      hit.anchor.insertAdjacentElement('afterend', badge.host);
    }
    badges.set(hit.anchor, badge);
    return badge;
  }

  const observer = new MutationObserver((records) => {
    const relevant = records.some(
      (r) =>
        !isOurs(r.target) &&
        !(r.target instanceof Element && r.target.closest(`[${BADGE_ATTR}]`)) &&
        // Our own insertions are dropped via takeRecords(), so a removed badge means the site re-rendered it away.
        (r.type !== 'childList' || [...r.addedNodes].some((n) => !isOurs(n)) || r.removedNodes.length > 0),
    );
    if (relevant) schedule();
  });

  const load = async () => {
    [index, settings] = await Promise.all([getStored('lensIndex'), getSettings()]);
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.lensIndex || changes.settings)) void load().then(() => schedule(0));
  });

  const start = () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      // Hover previews swap the image in place; tabs and view switches show/hide pre-rendered content.
      attributes: true,
      attributeFilter: ['src', 'srcset', 'alt', 'data-image-src', 'data-quantity', 'class', 'style', 'hidden'],
    });
    // Lazy images change layout (and adapters' tile detection) without any DOM mutation.
    document.addEventListener(
      'load',
      (e) => {
        if (e.target instanceof HTMLImageElement) schedule();
      },
      { capture: true, passive: true },
    );
    void load().then(() => schedule(FIRST_RENDER_DELAY_MS));
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

/**
 * Sites pre-render alternate views (other tabs, mobile layouts) inside hidden containers; those copies
 * must neither get badges nor count towards "needed".
 */
function isRendered(el: Element): boolean {
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
}

function isInDeck(hit: CardHit): boolean {
  return hit.deckQty !== undefined || !!hit.inDeck;
}

function isPlaced(badge: Badge, anchor: Element, floatLayer: FloatLayer): boolean {
  const host = badge.host;
  if (!host.isConnected) return false;
  if (badge.placement === 'float' || badge.placement === 'float-end') return floatLayer.has(host);
  if (badge.placement === 'overlay') return host.parentElement === anchor;
  return anchor.nextElementSibling === host;
}

const knownKeysCache = new WeakMap<LensIndex, Set<string>>();

function resolveKey(index: LensIndex, hit: CardHit): string | null {
  // Only trust codes from known sets, so random "ABC-123" strings on a page don't get badges.
  const parsed = hit.code ? parseCardCode(hit.code) : null;
  if (parsed && index.sets.includes(parsed.set)) return lookupKey(index, hit.code, hit.name);
  if (!hit.name) return null;
  let known = knownKeysCache.get(index);
  if (!known) {
    known = new Set([...Object.values(index.codes), ...Object.keys(index.owned)]);
    knownKeysCache.set(index, known);
  }
  const key = lookupKey(index, null, hit.name);
  return key && known.has(key) ? key : null;
}
