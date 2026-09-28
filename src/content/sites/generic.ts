import { parseCardCode } from '../../core/cardId';
import { imageUrl, urlPath } from '../dom';
import type { CardHit, SiteAdapter } from '../types';

const MIN_CARD_SIZE = 60;

/**
 * Any page the user opted into: badges card images whose file name or alt text carries a printing code.
 * The markup is unknown, so badges float above each image rather than being inserted into the page
 * (sibling images often share a parent, which would otherwise get a single badge).
 */
export const genericAdapter: SiteAdapter = {
  id: 'generic',
  isDeckPage: () => false,
  scan(doc) {
    const hits: CardHit[] = [];
    for (const img of doc.querySelectorAll<HTMLImageElement>('img')) {
      const rect = img.getBoundingClientRect();
      if (rect.width < MIN_CARD_SIZE || rect.height < MIN_CARD_SIZE) continue;
      const path = urlPath(imageUrl(img));
      const code = parseCardCode(path) ? path : parseCardCode(img.alt) ? img.alt : null;
      hits.push({ anchor: img, placement: 'float', code, name: img.alt || null });
    }
    return hits;
  },
};
