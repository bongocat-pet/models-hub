import assert from 'node:assert/strict';
import test from 'node:test';
import { addModelStats, recordModelEventSafely } from '../src/model-stats.js';

test('adds stored counters to every manifest model', async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /^SELECT model_id/);
      return {
        async all() {
          return { results: [{ model_id: 'model-a', downloads: 12, workshop_clicks: 3 }] };
        },
      };
    },
  };
  const manifest = { models: [{ id: 'model-a' }, { id: 'model-b' }] };
  const result = await addModelStats(manifest, db);

  assert.deepEqual(result.models[0], { id: 'model-a', downloadCount: 12, workshopClickCount: 3 });
  assert.deepEqual(result.models[1], { id: 'model-b', downloadCount: 0, workshopClickCount: 0 });
});

test('writes each event to its dedicated counter', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(modelId) {
          return {
            async run() { statements.push({ sql, modelId }); },
          };
        },
      };
    },
  };

  await recordModelEventSafely(db, 'model-a', 'download');
  await recordModelEventSafely(db, 'model-a', 'workshop');

  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /downloads/);
  assert.doesNotMatch(statements[0].sql, /workshop_clicks/);
  assert.match(statements[1].sql, /workshop_clicks/);
  assert.deepEqual(statements.map(statement => statement.modelId), ['model-a', 'model-a']);
});

test('falls back to zero counters when D1 is unavailable', async () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const db = { prepare() { throw new Error('D1 unavailable'); } };
    const result = await addModelStats({ models: [{ id: 'model-a' }] }, db);
    assert.deepEqual(result.models[0], { id: 'model-a', downloadCount: 0, workshopClickCount: 0 });
    await assert.doesNotReject(recordModelEventSafely(db, 'model-a', 'download'));
  } finally {
    console.error = originalError;
  }
});
