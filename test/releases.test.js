import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDesktopReleaseManifest, inferPlatform, inferVariant } from '../scripts/desktop/sync-release.mjs';
import { createDesktopReleaseManifest } from '../src/desktop/release-manifest.js';

test('classifies desktop release asset names', () => {
  assert.equal(inferPlatform('BongoCat-1.4.0-windows-x64-setup.exe'), 'windows');
  assert.equal(inferPlatform('BongoCat-1.4.0-macos-arm64.zip'), 'macos');
  assert.equal(inferPlatform('BongoCat-1.4.0-linux-x64.tar.gz'), 'linux');
  assert.equal(inferVariant('BongoCat-1.4.0-windows-x64-setup.exe'), 'windows-x64-setup.exe');
});

test('builds an immutable R2 object path for every release asset', () => {
  const manifest = buildDesktopReleaseManifest(
    {
      tag_name: 'v2.0.0',
      html_url: 'https://github.com/vladelaina/BongoCat/releases/tag/v2.0.0',
      published_at: '2026-09-03T00:00:00.000Z',
    },
    [{ filename: 'BongoCat-2.0.0-linux-x64.tar.gz', size: 123, sha256: 'a'.repeat(64) }],
    '2026-09-03T00:00:00.000Z',
  );
  assert.equal(manifest.assets[0].r2Path, 'desktop/v2.0.0/BongoCat-2.0.0-linux-x64.tar.gz');
  assert.equal(manifest.assets[0].size, 123);
});

test('expands R2 paths into public download URLs', () => {
  const manifest = createDesktopReleaseManifest('https://cdn.example/');
  assert.match(manifest.assets[0].downloadUrl, /^https:\/\/cdn\.example\/desktop\/v1\.4\.0\//);
});
