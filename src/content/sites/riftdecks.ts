import { imageUrl, urlPath } from '../dom';
import type { CardHit, SiteAdapter } from '../types';

/** riftdecks.com is server-rendered with stable markup: `tr.card-list-item[data-quantity][data-image-src]`. */
export const riftdecksAdapter: SiteAdapter = {
  id: 'riftdecks',
  isDeckPage: (doc) => doc.querySelector('tr.card-list-item[data-quantity]') !== null,
  scan(doc) {
    const hits: CardHit[] = [];
    for (const row of doc.querySelectorAll<HTMLElement>('tr.card-list-item')) {
      const link = row.querySelector('a[href*="/cards/details-"]') ?? row.querySelector('a');
      if (!link) continue;
      const qty = parseInt(row.dataset.quantity ?? '', 10);
      hits.push({
        anchor: link,
        placement: 'after',
        code: row.dataset.imageSrc ?? null,
        name: link.textContent?.trim() || null,
        deckQty: Number.isFinite(qty) ? qty : undefined,
      });
    }
    // Visual decklist and hover preview on deck pages; card galleries elsewhere.
    const deckPage = riftdecksAdapter.isDeckPage(doc);
    for (const img of doc.querySelectorAll<HTMLImageElement>('.card-image img, .decklist-card-image img')) {
      hits.push({
        anchor: img.parentElement ?? img,
        placement: 'overlay',
        code: urlPath(imageUrl(img)),
        name: img.alt || null,
        inDeck: deckPage,
      });
    }
    return hits;
  },
};
