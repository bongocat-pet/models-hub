import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

test('serves the public manifest with CORS and cache controls', async () => {
  const response = await worker.fetch(new Request('https://models.example/models.json'));
  const manifest = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(response.headers.get('Cache-Control'), /stale-while-revalidate/);
  assert.ok(Array.isArray(manifest.models));
  assert.match(manifest.models.find(model => model.fullVersionUrl)?.fullVersionUrl || '', /^https:\/\//);
  assert.match(manifest.models[0].downloadUrl, /^https:\/\/models\.example\/download\/yuhen-/);
  assert.equal(manifest.models[0].downloadCount, 0);
  assert.equal(manifest.models[0].workshopClickCount, 0);
  assert.match(manifest.models[0].fallbackDownloadUrl, /^https:\/\/github\.com\/bongocat-pet\/models-hub\/releases\//);
});

test('supports a configured R2 public origin', async () => {
  const response = await worker.fetch(new Request('https://models.example/models.json'), {
    R2_PUBLIC_BASE_URL: 'https://cdn.example/',
  });
  const manifest = await response.json();
  assert.match(manifest.models[0].downloadUrl, /^https:\/\/models\.example\/download\/yuhen-/);
});

test('tracks downloads and workshop clicks before redirecting', async () => {
  const events = [];
  const db = {
    prepare(sql) {
      return {
        bind(modelId) {
          return {
            async run() { events.push({ sql, modelId }); },
          };
        },
      };
    },
  };
  const manifestResponse = await worker.fetch(new Request('https://models.example/models.json'));
  const manifest = await manifestResponse.json();
  const model = manifest.models.find(model => model.fullVersionUrl);
  const download = await worker.fetch(new Request(model.downloadUrl), { DB: db });
  const workshop = await worker.fetch(new Request(model.fullVersionTrackUrl), { DB: db });
  assert.equal(download.status, 302);
  assert.match(download.headers.get('Location'), /^https:\/\/downloads\.bongocat\.pet\/models\//);
  assert.equal(workshop.status, 302);
  assert.match(workshop.headers.get('Location'), /^https:\/\/gf\.bilibili\.com\//);
  assert.equal(events.length, 2);
  assert.match(events[0].sql, /downloads/);
  assert.match(events[1].sql, /workshop_clicks/);
});

test('supports HEAD, preflight, and rejects mutations', async () => {
  const head = await worker.fetch(new Request('https://models.example/models.json', { method: 'HEAD' }));
  const options = await worker.fetch(new Request('https://models.example/models.json', { method: 'OPTIONS' }));
  const post = await worker.fetch(new Request('https://models.example/models.json', { method: 'POST' }));
  assert.equal(await head.text(), '');
  assert.equal(options.status, 204);
  assert.equal(post.status, 405);
});

test('passes preview assets through the static binding', async () => {
  const response = await worker.fetch(new Request('https://models.example/previews/yuhen/a.webp'), {
    ASSETS: { fetch: async () => new Response('webp', { headers: { 'Content-Type': 'image/webp' } }) },
  });
  assert.equal(await response.text(), 'webp');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
});
