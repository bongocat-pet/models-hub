import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const manifestPath = resolve(projectRoot, 'data/desktop-releases.json');
const repository = process.env.DESKTOP_RELEASE_REPOSITORY || 'vladelaina/BongoCat';
const bucket = process.env.R2_BUCKET_NAME;
const endpoint = process.env.R2_ENDPOINT;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

export function buildDesktopReleaseManifest(release, assets, generated = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    repository: `https://github.com/${repository}`,
    tag: release.tag_name,
    releaseUrl: release.html_url,
    publishedAt: release.published_at || release.created_at || null,
    generated,
    assets: assets.map(asset => ({
      filename: asset.filename,
      r2Path: `desktop/${release.tag_name}/${asset.filename}`,
      platform: inferPlatform(asset.filename),
      variant: inferVariant(asset.filename),
      size: asset.size,
      sha256: asset.sha256,
    })),
  };
}

export function inferPlatform(filename) {
  const normalized = filename.toLowerCase();
  if (normalized.includes('windows') || normalized.endsWith('.exe')) return 'windows';
  if (normalized.includes('macos') || normalized.includes('darwin')) return 'macos';
  if (normalized.includes('linux') || normalized.includes('appimage')) return 'linux';
  return 'other';
}

export function inferVariant(filename) {
  return filename
    .replace(/^BongoCat-(?:v)?\d+\.\d+\.\d+[-_]?/i, '')
    .toLowerCase();
}

async function syncRelease() {
  if (!bucket) throw new Error('R2_BUCKET_NAME is required');
  if (!endpoint) throw new Error('R2_ENDPOINT is required');
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const release = await githubJson(`/repos/${repository}/releases/latest`);
  if (release.draft || release.prerelease) throw new Error(`Latest release ${release.tag_name} is not stable`);
  if (!Array.isArray(release.assets) || release.assets.length === 0) {
    throw new Error(`Release ${release.tag_name} has no assets`);
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'bongocat-desktop-'));
  try {
    const assets = [];
    for (const releaseAsset of release.assets) {
      const filename = basename(releaseAsset.name);
      const destination = join(temporaryRoot, filename);
      await downloadAsset(releaseAsset.browser_download_url, destination);
      const content = await readFile(destination);
      const sha256 = createHash('sha256').update(content).digest('hex');
      if (releaseAsset.digest?.startsWith('sha256:') && releaseAsset.digest.slice(7) !== sha256) {
        throw new Error(`Checksum mismatch for ${filename}`);
      }
      await uploadAsset(destination, `desktop/${release.tag_name}/${filename}`);
      assets.push({ filename, size: content.byteLength, sha256 });
    }

    const previous = await readManifest();
    const generated = manifestsMatch(previous, release, assets)
      ? previous.generated
      : new Date().toISOString();
    const manifest = buildDesktopReleaseManifest(release, assets, generated);
    if (!manifestsMatch(previous, release, assets)) {
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`Updated desktop release manifest to ${release.tag_name}.`);
    } else {
      console.log(`Desktop release ${release.tag_name} is already synchronized.`);
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function githubJson(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'bongocat-models-hub',
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${path} returned ${response.status}`);
  return response.json();
}

async function downloadAsset(url, destination) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/octet-stream',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'bongocat-models-hub',
    },
  });
  if (!response.ok) throw new Error(`Unable to download ${url}: ${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

async function uploadAsset(source, objectPath) {
  const extension = objectPath.toLowerCase();
  const contentType = extension.endsWith('.zip')
    ? 'application/zip'
    : extension.endsWith('.tar.gz')
      ? 'application/gzip'
      : 'application/octet-stream';
  await run('aws', [
    's3', 'cp', source, `s3://${bucket}/${objectPath}`,
    '--endpoint-url', endpoint,
    '--region', 'auto',
    '--only-show-errors',
    '--content-type', contentType,
    '--content-disposition', 'attachment',
    '--cache-control', 'public, max-age=31536000, immutable',
  ]);
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function manifestsMatch(previous, release, assets) {
  if (!previous || previous.tag !== release.tag_name || previous.assets?.length !== assets.length) return false;
  const previousByName = new Map(previous.assets.map(asset => [asset.filename, asset]));
  return assets.every(asset => previousByName.get(asset.filename)?.sha256 === asset.sha256
    && previousByName.get(asset.filename)?.size === asset.size);
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncRelease().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
