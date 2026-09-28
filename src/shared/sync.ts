import type { Source } from '../core/collection';
import { parseCollection } from '../core/formats';

/** riftbound.gg "Permanent export link" (Settings → Collection). Returns the collection as CSV, no login. */
export const DOTGG_EXPORT_PREFIX = 'https://api.dotgg.gg/cgfw/exportcollection';

export function isDotggExportLink(url: string): boolean {
  return url.startsWith(`${DOTGG_EXPORT_PREFIX}?`) && /[?&]token=/.test(url);
}

/** Fetches one export link and returns the source with fresh rows (or the old rows plus lastError). */
export async function syncLinkSource(source: Source, fetchFn: typeof fetch = fetch): Promise<Source> {
  if (!source.url) return { ...source, lastError: 'No link configured' };
  try {
    const res = await fetchFn(source.url, { cache: 'no-store', credentials: 'omit' });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}${text ? `: ${text.trim().slice(0, 120)}` : ''}`);
    const parsed = parseCollection(text);
    if (parsed.rows.length === 0) throw new Error('The link returned no cards — is the token still valid?');
    return {
      ...source,
      format: parsed.format,
      rows: parsed.rows,
      updatedAt: new Date().toISOString(),
      lastError: undefined,
    };
  } catch (e) {
    return { ...source, lastError: e instanceof Error ? e.message : String(e) };
  }
}
