import { findQtyElement, findTextElement, imageUrl, parseQty, urlPath } from '../dom';
import type { CardHit, SiteAdapter } from '../types';

const CARD_IMG = 'img[src*="piltoverarchive.com/cards/"], img[srcset*="piltoverarchive.com/cards/"]';
const DECK_SECTION_HEADING = /^(legend|runes?|battlefields?|main deck|sideboard|champions?)\b/i;
/** List rows use small thumbnails next to the name; gallery tiles are big card images. */
const THUMBNAIL_MAX_WIDTH = 80;
const TILE_MAX_DEPTH = 6;

export const piltoverAdapter: SiteAdapter = {
  id: 'piltover',
  isDeckPage: () => /^\/(decks\/view|deckbuilder|decks\/[^/]+\/edit)/.test(location.pathname),
  scan(doc) {
    const deckSections = new Set(
      [...doc.querySelectorAll('section')].filter((s) =>
        DECK_SECTION_HEADING.test(s.querySelector('h2, h3, h4')?.textContent?.trim() ?? ''),
      ),
    );
    // Skip the blurred hero background and anything in the page header.
    const imgs = [...doc.querySelectorAll<HTMLImageElement>(CARD_IMG)].filter(
      (img) => !img.closest('header') && !img.classList.contains('blur-sm'),
    );
    const cardsInside = countCardsPerAncestor(imgs);

    return imgs.map((img): CardHit => {
      const tile = cardTile(img, cardsInside);
      const section = img.closest('section');
      const inDeckList = !!section && deckSections.has(section);
      const nameEl = !isGalleryImage(img) && img.alt ? findTextElement(tile, img.alt) : null;
      return {
        anchor: nameEl ?? img.parentElement ?? img,
        placement: nameEl ? 'after' : 'overlay',
        code: urlPath(imageUrl(img)),
        name: img.alt || null,
        // Gallery view renders one tile per copy (runes show "×N" instead).
        deckQty: inDeckList ? (parseQty(findQtyElement(tile)?.textContent) ?? 1) : undefined,
        // Only deck galleries repeat a tile per copy; in the card library each tile is a different printing.
        group: nameEl || !inDeckList ? undefined : (tile.parentElement ?? undefined),
      };
    });
  },
};

/**
 * Gallery images sit in an aspect-ratio box (`aspect-[63/88]`). That class is checked first because lazy
 * images can still have zero width when we scan.
 */
function isGalleryImage(img: HTMLImageElement): boolean {
  if (/\baspect-/.test(img.parentElement?.className ?? '')) return true;
  return img.getBoundingClientRect().width > THUMBNAIL_MAX_WIDTH;
}

/** How many card images each ancestor (up to the tile depth) contains, computed once per scan. */
function countCardsPerAncestor(imgs: HTMLImageElement[]): Map<Element, number> {
  const counts = new Map<Element, number>();
  for (const img of imgs) {
    let el = img.parentElement;
    for (let depth = 0; el && depth <= TILE_MAX_DEPTH + 1; depth++, el = el.parentElement) {
      counts.set(el, (counts.get(el) ?? 0) + 1);
    }
  }
  return counts;
}

/** Largest ancestor of `img` that contains no other card image (the tile or list row). */
function cardTile(img: HTMLImageElement, cardsInside: Map<Element, number>): Element {
  let tile: Element = img.parentElement ?? img;
  for (let depth = 0; depth < TILE_MAX_DEPTH; depth++) {
    const parent = tile.parentElement;
    if (!parent || (cardsInside.get(parent) ?? 0) > 1) break;
    tile = parent;
  }
  return tile;
}
