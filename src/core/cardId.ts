/**
 * Riftbound printing codes come in many dialects:
 *   OGN-066, OGN-066a, OGN-066A (RiftCore), OGN-066a/298, OGN-301*, OGN-299S (RiftCore signed),
 *   SFD-227-STAR (DotGG), ogn-301-star-298 (Riot), unl-229*-219 (Riftcodex), UNL-107-P (DotGG promo),
 *   OGN-263-Worlds / OGN-001-Nexus (Piltover promos), OGN-001-Foil (old Piltover), VEN-R01, VEN-SP3/006,
 *   SFD-T03, plus image file names like `ogs-019-024_full.png` or `UNL-205-horizontal.webp`.
 * Everything is normalised to `SET-NUM[alt][*][-P]`, e.g. `OGN-066a`, `OGN-301*`, `VEN-SP3`, `UNL-107-P`.
 */
export interface ParsedCode {
  set: string;
  num: string;
  alt: string;
  signed: boolean;
  promo: boolean;
  foil: boolean;
}

const CODE_RE =
  /(?<![A-Za-z0-9])([A-Za-z]{2,4})-(\d{3}|[RrTt]\d{2}|[Ss][Pp]\d{1,2})([A-Za-z])?(\*)?((?:\/\d{2,3})?(?:-[A-Za-z0-9*]+)*)(?![A-Za-z0-9])/;

const IGNORED_SUFFIXES = new Set(['horizontal', 'full', 'cropped', 'small', 'large', 'thumb']);

export function parseCardCode(raw: string): ParsedCode | null {
  const m = CODE_RE.exec(raw);
  if (!m) return null;
  const [, set = '', num = '', altRaw = '', star, rest = ''] = m;
  let alt = altRaw.toLowerCase();
  let signed = star === '*';
  if (alt === 's') {
    // RiftCore marks signature printings with a trailing S.
    alt = '';
    signed = true;
  }
  let promo = false;
  let foil = false;
  for (const seg of rest.replace(/^\/\d+/, '').split('-').filter(Boolean)) {
    const s = seg.toLowerCase().replace(/\*$/, () => {
      signed = true;
      return '';
    });
    if (/^\d+$/.test(s) || s === '' || IGNORED_SUFFIXES.has(s)) continue;
    if (s === 'star') signed = true;
    else if (s === 'foil') foil = true;
    else promo = true;
  }
  return { set: set.toUpperCase(), num: num.toUpperCase(), alt, signed, promo, foil };
}

export function formatPrinting(c: ParsedCode): string {
  return `${c.set}-${c.num}${c.alt}${c.signed ? '*' : ''}${c.promo ? '-P' : ''}`;
}

export function formatBase(c: ParsedCode): string {
  return `${c.set}-${c.num}`;
}

/** Normalised printing code, or null when the input doesn't contain one. */
export function normalizePrinting(raw: string): string | null {
  const c = parseCardCode(raw);
  return c ? formatPrinting(c) : null;
}
