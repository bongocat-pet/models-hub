import catalog from '../data/models.json' with { type: 'json' };

const baseUrl = (process.env.MODELS_HUB_URL || 'https://models.bongocat.pet').replace(/\/$/, '');
const response = await fetch(`${baseUrl}/models.json`, { headers: { 'Cache-Control': 'no-cache' } });
if (!response.ok) throw new Error(`Manifest returned ${response.status}`);
const manifest = await response.json();
if (manifest.revision !== catalog.revision) throw new Error(`Deployment revision ${manifest.revision} is not ${catalog.revision}`);
if (!Array.isArray(manifest.models) || manifest.models.length !== catalog.models.length) {
  throw new Error('Deployment model count does not match the catalog');
}
for (const model of manifest.models) {
  const preview = await fetch(model.preview, { method: 'HEAD' });
  if (!preview.ok) throw new Error(`${model.id} preview returned ${preview.status}`);
}
console.log(`Verified ${manifest.models.length} deployed models at ${baseUrl}.`);
