import { parseCardCode } from '../cardId';
import { parseCsv } from '../csv';

export interface CollectionRow {
  /** Printing code as written in the file (normalised later). */
  code?: string;
  name?: string;
  normal: number;
  foil: number;
}

export interface ParseResult {
  format: string;
  rows: CollectionRow[];
  /** Data rows that had neither a code nor a name, or no positive quantity. */
  skipped: number;
}

interface ColumnSpec {
  id?: string[];
  name?: string[];
  /** Summed into normal copies. */
  normal?: string[];
  /** Summed into foil copies. */
  foil?: string[];
  /** One quantity column; `foilFlag` / `finish` / a `-Foil` code suffix decides which bucket it goes to. */
  quantity?: string[];
  foilFlag?: string[];
  finish?: string[];
  /** `normal` / `foil` list alternative names for one column rather than columns to add up. */
  aliasesOnly?: boolean;
}

interface CsvFormat {
  id: string;
  label: string;
  /** Receives lower-cased, trimmed header cells. */
  detect: (header: string[]) => boolean;
  columns: ColumnSpec;
}

const has = (header: string[], ...cols: string[]) => cols.every((c) => header.includes(c));

// Aliases mirror the ones riftbound.gg's own importer accepts.
const GENERIC_ID_COLUMNS = ['cardid', 'card id', 'id', 'card', 'variant number', 'riotid', 'card number', 'collector number', 'number'];
const GENERIC_NAME_COLUMNS = ['name', 'cardname', 'card name'];
const GENERIC_COLUMNS: ColumnSpec = {
  id: GENERIC_ID_COLUMNS,
  name: GENERIC_NAME_COLUMNS,
  normal: ['normal', 'standard', 'count', 'qty', 'quantity', 'amount', 'owned', 'regular', 'normal count', 'normal qty', 'standard qty'],
  foil: ['foil', 'foils', 'foil count', 'foils count', 'foil qty', 'foil quantity'],
  aliasesOnly: true,
};

const GENERIC_FORMAT: CsvFormat = {
  id: 'generic',
  label: 'Generic CSV',
  detect: (h) => [...GENERIC_ID_COLUMNS, ...GENERIC_NAME_COLUMNS].some((c) => h.includes(c)),
  columns: GENERIC_COLUMNS,
};

export const CSV_FORMATS: CsvFormat[] = [
  {
    id: 'piltover',
    label: 'Piltover Archive',
    detect: (h) => has(h, 'variant number', 'quantity'),
    columns: { id: ['variant number'], name: ['card name'], quantity: ['quantity'], foilFlag: ['foil'] },
  },
  {
    id: 'riftmana',
    label: 'RiftMana',
    detect: (h) => has(h, 'normal qty', 'foil qty'),
    columns: { id: ['card id'], name: ['card name'], normal: ['normal qty'], foil: ['foil qty'] },
  },
  {
    id: 'riftcore',
    label: 'RiftCore',
    detect: (h) => has(h, 'standard qty', 'foil qty'),
    columns: {
      id: ['card id'],
      name: ['card name'],
      normal: ['standard qty', 'proving grounds qty'],
      foil: ['foil qty'],
    },
  },
  {
    id: 'openrift',
    label: 'OpenRift',
    detect: (h) => has(h, 'art variant', 'quantity'),
    columns: { id: ['card id'], name: ['card name'], quantity: ['quantity'], finish: ['finish'] },
  },
  {
    id: 'cardnexus',
    label: 'CardNexus',
    detect: (h) => has(h, 'totalqtyowned'),
    columns: { id: ['riotid'], name: ['name'], quantity: ['totalqtyowned'], finish: ['finish'] },
  },
  {
    id: 'riftboundgg',
    label: 'riftbound.gg',
    detect: (h) => has(h, 'cardid', 'normal', 'foil'),
    columns: { id: ['cardid'], name: ['name'], normal: ['normal'], foil: ['foil'] },
  },
  GENERIC_FORMAT,
];

const HEADER_SCAN_ROWS = 10;

export function parseCollection(text: string): ParseResult {
  const table = parseCsv(text);
  for (let h = 0; h < Math.min(HEADER_SCAN_ROWS, table.length); h++) {
    const header = (table[h] ?? []).map((c) => c.trim().toLowerCase());
    const format = CSV_FORMATS.find((f) => f.detect(header));
    if (format) return parseTable(format, header, table.slice(h + 1));
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.filter((l) => TEXT_LINE.test(l.trim())).length >= Math.ceil(lines.length / 2)) return parseTextList(lines);
  // No header — riftbound.gg's importer assumes `id, normal, foil, name`.
  return parseTable(GENERIC_FORMAT, ['cardid', 'normal', 'foil', 'name'], table);
}

function parseTable(format: CsvFormat, header: string[], body: string[][]): ParseResult {
  const cols = format.columns;
  const firstIndex = (names?: string[]) => (names ?? []).map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const allIndexes = (names?: string[]) => [...new Set((names ?? []).map((n) => header.indexOf(n)).filter((i) => i >= 0))];

  const idCol = firstIndex(cols.id);
  const nameCol = firstIndex(cols.name);
  const pick = (names?: string[]) => (cols.aliasesOnly ? [firstIndex(names)].filter((i) => i >= 0) : allIndexes(names));
  const normalCols = pick(cols.normal);
  const foilCols = pick(cols.foil).filter((i) => !normalCols.includes(i));
  const qtyCol = firstIndex(cols.quantity);
  const foilFlagCol = firstIndex(cols.foilFlag);
  const finishCol = firstIndex(cols.finish);

  const rows: CollectionRow[] = [];
  let skipped = 0;
  for (const cells of body) {
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '');
    let code = cell(idCol) || undefined;
    let name = cell(nameCol) || undefined;
    // Generic "card"/"id" columns (and header-less files) often hold the card name, not a printing code.
    if (code && !parseCardCode(code)) {
      name ??= code;
      code = undefined;
    }
    let normal = normalCols.reduce((sum, i) => sum + toInt(cell(i)), 0);
    let foil = foilCols.reduce((sum, i) => sum + toInt(cell(i)), 0);
    if (qtyCol >= 0) {
      const qty = toInt(cell(qtyCol));
      const isFoil =
        isTruthy(cell(foilFlagCol)) || /foil/i.test(cell(finishCol)) || (!!code && !!parseCardCode(code)?.foil);
      if (isFoil) foil += qty;
      else normal += qty;
    }
    if ((!code && !name) || normal + foil <= 0) {
      skipped++;
      continue;
    }
    rows.push({ code, name, normal, foil });
  }
  return { format: format.id, rows, skipped };
}

const TEXT_LINE = /^\d+\s*x?\s+\S|\S\s+x?\d+$/i;

/** Plain-text lists: "3 Jinx, Rebel", "3x Jinx - Rebel (OGN-202)", "Jinx - Rebel x3", "3 OGN-202". */
function parseTextList(lines: string[]): ParseResult {
  const rows: CollectionRow[] = [];
  let skipped = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^(#|\/\/)/.test(line) || /^[A-Za-z ]+(\(\d+\))?:?$/.test(line)) continue;
    const lead = /^(\d+)\s*x?\s+(.+)$/i.exec(line);
    const trail = lead ? null : /^(.+?)\s+x?(\d+)$/i.exec(line);
    const qty = toInt(lead?.[1] ?? trail?.[2] ?? '');
    let rest = (lead?.[2] ?? trail?.[1] ?? '').trim();
    let code: string | undefined;
    const paren = /\(([^)]+)\)\s*$/.exec(rest);
    if (paren?.[1] && parseCardCode(paren[1])) {
      code = paren[1];
      rest = rest.slice(0, paren.index).trim();
    } else if (/^[A-Za-z]{2,4}-\S+$/.test(rest) && parseCardCode(rest)) {
      code = rest;
      rest = '';
    }
    if (qty <= 0 || (!code && !rest)) {
      skipped++;
      continue;
    }
    rows.push({ code, name: rest || undefined, normal: qty, foil: 0 });
  }
  return { format: 'text', rows, skipped };
}

/** Whole copies from cells like "3", " 2.0 ", "x4"; anything else (including negatives) counts as 0. */
function toInt(v: string): number {
  const m = /^\D*?(-?\d+(?:\.\d+)?)/.exec(v.trim());
  const n = m?.[1] ? Math.floor(parseFloat(m[1])) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isTruthy(v: string): boolean {
  return /^(true|yes|y|1|foil)$/i.test(v.trim());
}
