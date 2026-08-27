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
