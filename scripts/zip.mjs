// Production build into build/release/ and a Chrome Web Store upload zip in release/.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const outdir = 'build/release';
execFileSync('node', ['scripts/build.mjs', `--outdir=${outdir}`], { stdio: 'inherit' });

await mkdir('release', { recursive: true });
const zipPath = resolve(`release/collection-matcher-${version}.zip`);
await rm(zipPath, { force: true });
execFileSync('zip', ['-r', '-X', zipPath, '.'], { cwd: outdir, stdio: 'inherit' });
console.log(`\nUpload ${zipPath} in the Chrome Web Store Developer Dashboard.`);
