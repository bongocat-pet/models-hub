import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
if (!publicBase) throw new Error('Missing R2_PUBLIC_BASE_URL repository variable');

const filenames = (await readdir(resolve(projectRoot, 'release-assets')))
  .filter(filename => filename.endsWith('.zip'));
if (!filenames.length) throw new Error('No model packages were built');

await Promise.all(filenames.map(async (filename) => {
  const url = `${publicBase}/models/${encodeURIComponent(filename)}`;
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/zip')) {
    throw new Error(`${url} does not have an application/zip content type`);
  }
}));

console.log(`Verified ${filenames.length} public R2 packages.`);
