import { cardDbFromRiftcodex, type CardDbData, type RiftcodexCard } from '../core/cardDb';

export const RIFTCODEX_API = 'https://api.riftcodex.com';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

interface Page {
  items: RiftcodexCard[];
  pages: number;
}

/** Downloads every card from the public Riftcodex API (https://riftcodex.com/docs). */
export async function fetchRiftcodexCards(fetchFn: typeof fetch = fetch): Promise<CardDbData> {
  const items: RiftcodexCard[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchFn(`${RIFTCODEX_API}/cards?page=${page}&size=${PAGE_SIZE}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Riftcodex returned HTTP ${res.status}`);
    const body = (await res.json()) as Page;
    items.push(...body.items);
    if (page >= body.pages) break;
  }
  return cardDbFromRiftcodex(items, new Date().toISOString());
}
