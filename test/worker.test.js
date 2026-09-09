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
  const communityModels = manifest.models.filter(model => !model.repositoryKey.endsWith('-custom'));
  assert.ok(communityModels.length > 0, 'catalog must contain community models');
  for (const model of communityModels) {
    assert.equal(model.downloadUrl, `https://models.example/download/${encodeURIComponent(model.id)}`);
    assert.match(model.fallbackDownloadUrl, /^https:\/\/github\.com\/bongocat-pet\/models-hub\/releases\//);
  }
  for (const model of manifest.models) {
    assert.equal(model.downloadCount, 0);
    assert.equal(model.workshopClickCount, 0);
  }
});

test('supports a configured R2 public origin', async () => {
  const response = await worker.fetch(new Request('https://models.example/models.json'), {
    R2_PUBLIC_BASE_URL: 'https://cdn.example/',
  });
  const manifest = await response.json();
  const model = manifest.models.find(model => !model.repositoryKey.endsWith('-custom'));
  assert.ok(model, 'catalog must contain a community model');
  assert.equal(model.downloadUrl, `https://models.example/download/${encodeURIComponent(model.id)}`);
  const download = await worker.fetch(new Request(model.downloadUrl), {
    R2_PUBLIC_BASE_URL: 'https://cdn.example/',
  });
  assert.equal(download.status, 302);
  assert.equal(download.headers.get('Location'),
    `https://cdn.example/models/${encodeURIComponent(model.repositoryKey)}/${encodeURIComponent(model.downloadFilename)}`);
});

test('custom showcase models omit downloads and reject direct download requests', async () => {
  const response = await worker.fetch(new Request('https://models.example/models.json'));
  const manifest = await response.json();
  const models = manifest.models.filter(model => model.repositoryKey.endsWith('-custom'));
  assert.ok(models.length > 0, 'catalog must contain custom showcase models');
  for (const model of models) {
    assert.equal(model.downloadUrl, undefined);
    const download = await worker.fetch(new Request(`https://models.example/download/${encodeURIComponent(model.id)}`));
    assert.equal(download.status, 404);
  }
});

test('serves the desktop release manifest from the configured R2 origin', async () => {
  const response = await worker.fetch(new Request('https://models.example/releases.json'), {
    R2_PUBLIC_BASE_URL: 'https://cdn.example/',
  });
  const manifest = await response.json();
  assert.equal(response.status, 200);
  assert.equal(manifest.tag, 'v1.4.0');
  assert.match(manifest.assets[0].downloadUrl, /^https:\/\/cdn\.example\/desktop\/v1\.4\.0\//);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
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
  const model = manifest.models.find(model => !model.repositoryKey.endsWith('-custom') && model.fullVersionUrl);
  assert.ok(model, 'catalog must contain a community model with a full version');
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
