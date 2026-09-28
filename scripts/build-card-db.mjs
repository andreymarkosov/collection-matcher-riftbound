// Fetches the full Riftbound card list from Riftcodex and writes the bundled offline snapshot.
import { writeFile } from 'node:fs/promises';
import { importTs } from './load-ts.mjs';

const { fetchRiftcodexCards } = await importTs('src/shared/riftcodex.ts');
const data = await fetchRiftcodexCards(fetch);
await writeFile('src/data/cards.snapshot.json', JSON.stringify(data) + '\n');
console.log(`Wrote ${data.cards.length} printings (${data.fetchedAt}) to src/data/cards.snapshot.json`);
