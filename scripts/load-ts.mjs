import * as esbuild from 'esbuild';

/** Imports a TypeScript module from src/ inside a plain Node script (bundled in memory by esbuild). */
export async function importTs(entry) {
  const result = await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
