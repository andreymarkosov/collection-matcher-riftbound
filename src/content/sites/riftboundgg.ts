import { parseCardCode } from '../../core/cardId';
import { isOurs, findQtyElement, imageUrl, parseQty, urlPath } from '../dom';
import type { CardHit, SiteAdapter } from '../types';

/** A text node that is just a printing code, optionally followed by a separator: "SFD-187 ·". */
const CODE_TEXT = /^\s*([A-Za-z]{2,4}-[A-Za-z0-9*]{2,6}(?:-[A-Za-z]+)?)\s*[·•|]?\s*$/;
const CARD_IMG = 'img[src*="/riftbound/cards/"]';

/**
 * riftbound.gg uses styled-components (hashed class names), so we anchor on content instead:
 * each deck tile prints its code ("SFD-187 ·") under a "name | x2" row.
 */
export const riftboundggAdapter: SiteAdapter = {
  id: 'riftboundgg',
  isDeckPage: () => /^\/(decks|deck-builder|deckbuilder)\/[^/]+/.test(location.pathname),
  scan(doc) {
    const hits: CardHit[] = [];
    const covered = new Set<Element>();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const match = CODE_TEXT.exec(node.textContent ?? '');
      const codeEl = node.parentElement;
      // parseCardCode requires a real collector number, so hyphenated words ("Top-16", "Co-op") don't match.
      if (!match?.[1] || !parseCardCode(match[1]) || !codeEl || isOurs(codeEl) || codeEl.closest('script, style')) continue;
      const info = codeEl.parentElement?.parentElement;
      if (!info) continue;
      const qtyEl = findQtyElement(info);
      const nameEl = qtyEl?.previousElementSibling ?? info.firstElementChild?.firstElementChild;
      if (!nameEl || nameEl === codeEl) continue;
      covered.add(info.parentElement ?? info);
      // Tiles are re-rendered constantly and foreign children get stripped, so badges float above the page:
      // over the card image when the tile has one, otherwise just past the name.
      const image = info.previousElementSibling;
      const hasImage = !!image && image.getBoundingClientRect().height > 40;
      hits.push({
        anchor: hasImage ? image : nameEl,
        placement: hasImage ? 'float' : 'float-end',
        code: match[1],
        name: nameEl.textContent?.trim() || null,
        deckQty: qtyEl ? (parseQty(qtyEl.textContent) ?? undefined) : undefined,
        // Tiles without "xN" on deck pages are the hover preview of a deck card.
        inDeck: true,
      });
    }
    // Card images without a printed code (galleries, tier lists).
    for (const img of doc.querySelectorAll<HTMLImageElement>(CARD_IMG)) {
      if ([...covered].some((c) => c.contains(img))) continue;
      hits.push({ anchor: img, placement: 'float', code: urlPath(imageUrl(img)), name: img.alt || null });
    }
    return hits;
  },
};
