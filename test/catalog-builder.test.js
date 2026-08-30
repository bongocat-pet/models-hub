import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRepositoryCatalog, inspectModelRepository, parseAuthorLinks, parseModelLinks } from '../scripts/catalog-builder.mjs';

const tree = {
  sha: 'commit',
  tree: [
    { type: 'blob', path: 'README.md', sha: 'r', size: 10 },
    { type: 'blob', path: 'a.webp', sha: 'a', size: 20 },
    { type: 'blob', path: 'models/webp/猫-无表情版.webp', sha: 'p', size: 30 },
    { type: 'blob', path: 'models/猫-无表情版/A-猫/config.json', sha: 'c', size: 40 },
    { type: 'blob', path: 'models/猫-无表情版/A-猫/0.png', sha: 'i', size: 50 },
  ],
};

test('recognizes the repository contract and builds stable model metadata', () => {
  assert.deepEqual(inspectModelRepository(tree), {
    hasReadme: true, hasAvatar: true, modelCount: 1, shouldInclude: true,
  });
  const record = buildRepositoryCatalog({
    repository: { name: 'artist', html_url: 'https://github.com/org/artist', default_branch: 'art', pushed_at: 'now' },
    tree,
    authorLinks: [{ label: 'Bilibili', url: 'https://space.bilibili.com/1' }],
    modelLinks: { '猫-无表情版': 'https://mall.bilibili.com/item/1' },
    generated: 'now',
  });
  assert.equal(record.models[0].name, '猫-无表情版');
  assert.equal(record.models[0].size, 90);
  assert.equal(record.models[0].fileCount, 2);
  assert.match(record.models[0].id, /^artist-[a-f0-9]{12}$/);
  assert.equal(record.models[0].fullVersionUrl, 'https://mall.bilibili.com/item/1');
  assert.equal(record.models[0].downloadFilename, '猫-无表情版.zip');
  assert.equal(record.models[0].packageFilename, '猫-无表情版.zip');
});

test('validates optional full-version model links', () => {
  assert.deepEqual(parseModelLinks('{"猫":"https://example.com/full"}'), {
    猫: 'https://example.com/full',
  });
  assert.throws(() => parseModelLinks('{"猫":"http://example.com"}'), /HTTPS/);
  assert.throws(() => parseModelLinks('[]'), /object/);
});

test('requires a matching preview for every discovered model', () => {
  const missingPreview = { ...tree, tree: tree.tree.filter(file => !file.path.includes('/webp/')) };
  assert.equal(inspectModelRepository(missingPreview).shouldInclude, false);
});

test('recognizes config.json placed directly in the model directory', () => {
  const directConfig = {
    ...tree,
    tree: tree.tree.map((file) => file.path === 'models/猫-无表情版/A-猫/config.json'
      ? { ...file, path: 'models/猫-无表情版/config.json' }
      : file.path === 'models/猫-无表情版/A-猫/0.png'
        ? { ...file, path: 'models/猫-无表情版/0.png' }
        : file),
  };
  assert.equal(inspectModelRepository(directConfig).shouldInclude, true);
});

test('reads standalone author links without scraping prose', () => {
  assert.deepEqual(parseAuthorLinks('https://space.bilibili.com/1\n[Home](https://example.com/me)\nSee https://bad.test here'), [
    { label: 'Bilibili', url: 'https://space.bilibili.com/1' },
    { label: 'Home', url: 'https://example.com/me' },
  ]);
});
