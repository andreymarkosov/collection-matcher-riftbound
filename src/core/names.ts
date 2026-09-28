/**
 * Card names differ between sites: "Jinx - Rebel" (Riftcodex, DotGG), "Jinx, Rebel" (Piltover, TCGplayer),
 * "Kai'Sa" vs "KaiSa", plus printing suffixes like "(Alternate Art)" or "(Spiritforged Nexus Night Promo)".
 * nameKey() folds all of those into one lookup key.
 */
const PRINTING_SUFFIX =
  /\s*\((?:alternate art|alt art|overnumbered|signature|signed|metal|starter|launch exclusive|gg ez|foil|showcase|[^)]*\bpromo\b[^)]*)\)/gi;

export function stripPrintingSuffix(name: string): string {
  return name.replace(PRINTING_SUFFIX, '').trim();
}

export function nameKey(name: string): string {
  return stripPrintingSuffix(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
