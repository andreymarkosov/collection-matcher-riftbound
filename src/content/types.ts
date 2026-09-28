/**
 * after: inline sibling right after the anchor (e.g. a card name).
 * overlay: absolutely positioned child of the anchor (e.g. a card image container).
 * float / float-end: in a separate layer above the page (for sites that strip foreign nodes), at the top-center
 * of the anchor or just past its right edge.
 */
export type Placement = 'after' | 'overlay' | 'float' | 'float-end';

export interface CardHit {
  /** Element the badge is placed relative to (never modified, only gets a sibling or an extra child). */
  anchor: Element;
  placement: Placement;
  code?: string | null;
  name?: string | null;
  /** Copies this hit represents in the deck list; undefined when the hit doesn't count towards "needed". */
  deckQty?: number;
  /** Part of the deck display without adding to "needed" (visual decklists, hover previews). */
  inDeck?: boolean;
  /** Hits with the same card inside one group get a single badge (e.g. one-tile-per-copy galleries). */
  group?: Element;
}

export interface SiteAdapter {
  id: string;
  /** Deck pages show owned/needed; other pages show owned only. */
  isDeckPage(doc: Document): boolean;
  scan(doc: Document): CardHit[];
}
