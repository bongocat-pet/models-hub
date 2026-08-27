import catalog from '../data/models.json' with { type: 'json' };

const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
if (!publicBase) throw new Error('Missing R2_PUBLIC_BASE_URL repository variable');

if (!catalog.models.length) throw new Error('No model packages were built');

await Promise.all(catalog.models.map(async (model) => {
  const url = `${publicBase}/models/${encodeURIComponent(model.repositoryKey)}/${encodeURIComponent(model.downloadFilename)}`;
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/zip')) {
    throw new Error(`${url} does not have an application/zip content type`);
  }
}));

console.log(`Verified ${catalog.models.length} public R2 packages.`);
