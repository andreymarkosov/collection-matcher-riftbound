import { formatBase, formatPrinting, parseCardCode } from './cardId';
import { nameKey, stripPrintingSuffix } from './names';

/** Compact card list: [printing code (normalised), full name incl. printing suffix, card type]. */
export type CardTuple = [code: string, name: string, type: string];

export interface CardDbData {
  source: string;
  fetchedAt: string;
  cards: CardTuple[];
}

/** Shape of one item of `https://api.riftcodex.com/cards` (only the fields we use). */
export interface RiftcodexCard {
  name: string;
  riftbound_id: string;
  classification?: { type?: string | null } | null;
  metadata?: { clean_name?: string | null } | null;
}

/**
 * Promo sets reuse the numbering of the base set they reprint (opp-001-298 is OGN's Blazing Scorcher,
 * opp-001-219 is UNL's Arena Kingpin), so their codes are ambiguous without the total. Every promo is a
 * reprint of a base-set card, so leaving them out loses no card names.
 */
const PROMO_SETS = new Set(['OPP', 'PR', 'JDG']);

export function cardDbFromRiftcodex(items: RiftcodexCard[], fetchedAt: string): CardDbData {
  const byCode = new Map<string, CardTuple>();
  for (const item of items) {
    const parsed = parseCardCode(item.riftbound_id);
    if (!parsed || PROMO_SETS.has(parsed.set)) continue;
    const code = formatPrinting(parsed);
    const existing = byCode.get(code);
    // Riftcodex has duplicate rows (VEN re-imports with clean_name: null) — keep the curated one.
    if (existing && !item.metadata?.clean_name) continue;
    byCode.set(code, [code, item.name, item.classification?.type ?? '']);
  }
  const cards = [...byCode.values()].sort((a, b) => a[0].localeCompare(b[0]));
  return { source: 'riftcodex', fetchedAt, cards };
}

export interface ResolvedCard {
  key: string;
  name: string;
}

export class CardDb {
  private readonly byPrinting = new Map<string, ResolvedCard>();
  private readonly byBase = new Map<string, ResolvedCard>();
  private readonly byKey = new Map<string, ResolvedCard>();
  readonly sets = new Set<string>();

  constructor(data?: CardDbData) {
    for (const [code, name] of data?.cards ?? []) this.add(code, name, false);
  }

  /** Registers a printing. `learned` entries (from collection files) never override card-DB entries. */
  add(rawCode: string, fullName: string, learned = true): void {
    const parsed = parseCardCode(rawCode);
    const displayName = stripPrintingSuffix(fullName);
    const key = nameKey(displayName);
    if (!key) return;
    const card = this.byKey.get(key) ?? { key, name: displayName };
    this.byKey.set(key, card);
    if (!parsed) return;
    this.sets.add(parsed.set);
    const printing = formatPrinting(parsed);
    const base = formatBase(parsed);
    if (!learned || !this.byPrinting.has(printing)) this.byPrinting.set(printing, card);
    // The base code (no alt letter / signature) belongs to the standard printing when there is one.
    const isStandard = !parsed.alt && !parsed.signed && !parsed.promo;
    if (!this.byBase.has(base) || (isStandard && !learned)) this.byBase.set(base, card);
  }

  resolveCode(rawCode: string): ResolvedCard | null {
    const parsed = parseCardCode(rawCode);
    if (!parsed) return null;
    return this.byPrinting.get(formatPrinting(parsed)) ?? this.byBase.get(formatBase(parsed)) ?? null;
  }

  resolveName(name: string): ResolvedCard | null {
    return this.byKey.get(nameKey(name)) ?? null;
  }

  printingEntries(): [string, ResolvedCard][] {
    return [...this.byPrinting.entries()];
  }

  baseEntries(): [string, ResolvedCard][] {
    return [...this.byBase.entries()];
  }
}
