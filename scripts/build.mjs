import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createManifest } from './manifest.mjs';

const watch = process.argv.includes('--watch');
const dev = watch || process.argv.includes('--dev');
const outdirArg = process.argv.find((a) => a.startsWith('--outdir='));
const outdir = outdirArg ? outdirArg.slice('--outdir='.length) : 'dist';

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const common = {
  bundle: true,
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
  define: { __DEV__: String(dev) },
};

const builds = [
  // Content scripts are classic scripts: IIFE, no imports at runtime.
  { entryPoints: { 'content/main': 'src/content/main.ts', 'content/generic': 'src/content/generic-main.ts' }, format: 'iife' },
  { entryPoints: { background: 'src/background/service-worker.ts' }, format: 'esm' },
  { entryPoints: { 'options/options': 'src/options/options.tsx', 'popup/popup': 'src/popup/popup.tsx' }, format: 'esm' },
];

async function copyStatic() {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const manifest = createManifest(version);
  if (dev) manifest.name += ' (dev)';
  await writeFile(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2));
  await cp('public', outdir, { recursive: true });
  await cp('src/options/options.html', `${outdir}/options/options.html`);
  await cp('src/popup/popup.html', `${outdir}/popup/popup.html`);
  await cp('src/ui/ui.css', `${outdir}/ui.css`);
  if (dev) await cp('fixtures/riftboundgg-collection.csv', `${outdir}/dev/fixture.csv`);
}

if (watch) {
  for (const b of builds) await (await esbuild.context({ ...common, ...b, outdir })).watch();
  await copyStatic();
  console.log('Watching for changes… (static files are copied once; restart to pick up HTML/CSS changes)');
} else {
  await Promise.all(builds.map((b) => esbuild.build({ ...common, ...b, outdir })));
  await copyStatic();
}
