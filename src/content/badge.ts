import type { OwnedCard } from '../core/collection';
import type { Placement } from './types';

export const BADGE_ATTR = 'data-rbcl-badge';

export type BadgeStatus = 'complete' | 'partial' | 'missing' | 'owned' | 'none';

export interface BadgeState {
  text: string;
  status: BadgeStatus;
  title: string;
}

const STYLE = `
  :host { all: initial; }
  .pill {
    position: relative; display: inline-flex; align-items: center;
    padding: 1px 6px; border-radius: 999px;
    font: 700 11px/16px system-ui, -apple-system, "Segoe UI", sans-serif;
    letter-spacing: .01em; white-space: nowrap; color: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.35);
    cursor: default; user-select: none;
  }
  .complete { background: #1f8a4c; }
  .partial  { background: #b7791f; }
  .missing  { background: #b83a32; }
  .owned    { background: #2f6fb3; }
  .none     { background: #4a4f57; color: #d6d9de; }
`;

export interface Badge {
  host: HTMLElement;
  placement: Placement;
  /** The breakdown shown on hover. */
  readonly title: string;
  /** Whether the badge takes pointer events itself (inline badges); others are click-through. */
  readonly interactive: boolean;
  /** Where the pill is drawn on screen. */
  bounds(): DOMRect;
  update(state: BadgeState): void;
}

export function isInline(placement: Placement): boolean {
  return placement === 'after';
}

/**
 * The badge lives in a closed shadow root so the host site's CSS can't restyle it and ours can't leak out.
 * Content scripts run in an isolated world without `customElements`, so the host is a plain <span>.
 */
export function createBadge(placement: Placement): Badge {
  const host = document.createElement('span');
  host.setAttribute(BADGE_ATTR, '');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const pill = document.createElement('span');
  shadow.append(style, pill);

  // Float placements are styled by FloatLayer. Only inline badges receive the pointer: the others sit on top of
  // card images, where they would steal the site's own hover effects (HoverTip shows their breakdown instead).
  const interactive = isInline(placement);
  host.style.cssText =
    placement === 'overlay'
      ? 'position:absolute;top:6px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;line-height:0;'
      : 'display:inline-block;vertical-align:middle;margin:0 4px;line-height:0;flex:none;';

  let last = '';
  let title = '';
  return {
    host,
    placement,
    interactive,
    get title() {
      return title;
    },
    bounds: () => pill.getBoundingClientRect(),
    update(state) {
      const key = `${state.status}|${state.text}|${state.title}`;
      if (key === last) return;
      last = key;
      title = state.title;
      pill.className = `pill ${state.status}`;
      pill.textContent = state.text;
      if (interactive) host.title = state.title;
    },
  };
}

export function badgeState(card: OwnedCard | undefined, needed: number | undefined, displayName: string): BadgeState {
  const owned = card ? card.normal + card.foil : 0;
  const lines = [displayName];
  if (needed !== undefined) lines.push(`Needed in this deck: ${needed}`);
  lines.push(`Owned: ${owned}${card?.foil ? ` (${card.normal} normal, ${card.foil} foil)` : ''}`);
  if (card) {
    const printings = Object.entries(card.printings).sort(([a], [b]) => a.localeCompare(b));
    for (const [code, [n, f]] of printings) lines.push(`  ${code}: ${n}${f ? ` + ${f} foil` : ''}`);
    const sources = Object.entries(card.sources);
    if (sources.length > 1) lines.push(`Sources: ${sources.map(([s, c]) => `${s} ${c}`).join(', ')}`);
  }
  const title = lines.join('\n');

  if (needed === undefined) return { text: `×${owned}`, status: owned > 0 ? 'owned' : 'none', title };
  const status: BadgeStatus = owned >= needed ? 'complete' : owned > 0 ? 'partial' : 'missing';
  return { text: `${owned}/${needed}`, status, title };
}
