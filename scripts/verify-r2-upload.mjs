import catalog from '../data/models.json' with { type: 'json' };

const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
if (!publicBase) throw new Error('Missing R2_PUBLIC_BASE_URL repository variable');

if (!catalog.models.length) throw new Error('No model packages were built');

const urls = catalog.models.map(model =>
  `${publicBase}/models/${encodeURIComponent(model.repositoryKey)}/${encodeURIComponent(model.downloadFilename)}`
);

await Promise.all(urls.map(async (url) => {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/zip')) {
    throw new Error(`${url} does not have an application/zip content type`);
  }
}));

console.log(`Verified ${catalog.models.length} named R2 packages.`);
