import { CardDb, type CardDbData } from './cardDb';
import { formatBase, formatPrinting, parseCardCode } from './cardId';
import type { CollectionRow } from './formats';
import { nameKey, stripPrintingSuffix } from './names';

export type SourceKind = 'file' | 'link';

/** A named slice of the collection (like a binder): one imported file or one synced export link. */
export interface Source {
  id: string;
  label: string;
  kind: SourceKind;
  format: string;
  enabled: boolean;
  updatedAt: string;
  rows: CollectionRow[];
  /** `link` sources only. */
  url?: string;
  lastError?: string;
}

/** Owned copies of one card (all printings), keyed by nameKey(). */
export interface OwnedCard {
  name: string;
  normal: number;
  foil: number;
  /** printing code → [normal, foil] */
  printings: Record<string, [number, number]>;
  /** source label → copies */
  sources: Record<string, number>;
}

/** Everything a content script needs, precomputed so pages only do map lookups. */
export interface LensIndex {
  builtAt: string;
  /** Normalised printing code (and base code) → card key, for every known printing. */
  codes: Record<string, string>;
  owned: Record<string, OwnedCard>;
  /** nameKey → card key, only where they differ (names learned from collection files). */
  aliases: Record<string, string>;
  sets: string[];
}

export interface UnmatchedRow {
  source: string;
  row: CollectionRow;
}

export function buildIndex(cardDbData: CardDbData | undefined, sources: Source[]): LensIndex {
  const db = new CardDb(cardDbData);
  const enabled = sources.filter((s) => s.enabled);
  // Teach the DB printings it doesn't know yet (new sets, promos) from the files themselves.
  for (const source of enabled) {
    for (const row of source.rows) {
      if (row.code && row.name && !db.resolveCode(row.code)) db.add(row.code, row.name);
    }
  }

  const owned: Record<string, OwnedCard> = {};
  const aliases: Record<string, string> = {};
  for (const source of enabled) {
    for (const row of source.rows) {
      const card = resolveRow(db, row);
      if (!card) continue;
      const rowKey = row.name ? nameKey(row.name) : '';
      if (rowKey && rowKey !== card.key) aliases[rowKey] = card.key;
      const entry = (owned[card.key] ??= { name: card.name, normal: 0, foil: 0, printings: {}, sources: {} });
      entry.normal += row.normal;
      entry.foil += row.foil;
      const parsed = row.code ? parseCardCode(row.code) : null;
      const printing = parsed ? formatPrinting(parsed) : '?';
      const counts = (entry.printings[printing] ??= [0, 0]);
      counts[0] += row.normal;
      counts[1] += row.foil;
      entry.sources[source.label] = (entry.sources[source.label] ?? 0) + row.normal + row.foil;
    }
  }

  const codes: Record<string, string> = {};
  for (const [code, card] of db.baseEntries()) codes[code] = card.key;
  for (const [code, card] of db.printingEntries()) codes[code] = card.key;

  return { builtAt: new Date().toISOString(), codes, owned, aliases, sets: [...db.sets].sort() };
}

export function findUnmatched(cardDbData: CardDbData | undefined, sources: Source[]): UnmatchedRow[] {
  const db = new CardDb(cardDbData);
  const result: UnmatchedRow[] = [];
  for (const source of sources) {
    for (const row of source.rows) {
      const byCode = row.code ? db.resolveCode(row.code) : null;
      const byName = row.name ? db.resolveName(row.name) : null;
      if (!byCode && !byName) result.push({ source: source.label, row });
    }
  }
  return result;
}

function resolveRow(db: CardDb, row: CollectionRow): { key: string; name: string } | null {
  const byCode = row.code ? db.resolveCode(row.code) : null;
  if (byCode) return byCode;
  if (row.name) {
    const byName = db.resolveName(row.name);
    if (byName) return byName;
    const name = stripPrintingSuffix(row.name);
    return { key: nameKey(name), name };
  }
  const parsed = row.code ? parseCardCode(row.code) : null;
  return parsed ? { key: `#${formatBase(parsed)}`, name: formatBase(parsed) } : null;
}

/** Page-side lookup: printing code first, then name. */
export function lookupKey(index: LensIndex, code?: string | null, name?: string | null): string | null {
  const parsed = code ? parseCardCode(code) : null;
  if (parsed) {
    const key = index.codes[formatPrinting(parsed)] ?? index.codes[formatBase(parsed)];
    if (key) return key;
  }
  if (name) {
    const key = nameKey(name);
    if (key) return index.aliases[key] ?? key;
  }
  return parsed ? `#${formatBase(parsed)}` : null;
}
