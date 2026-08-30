import { createHash } from 'node:crypto';

const AVATAR_PATTERN = /^a\.(?:gif|webp|png|jpe?g)$/i;
const README_PATTERN = /^readme\.md$/i;
const CONFIG_PATTERN = /^models\/([^/]+)\/.+\/config\.json$/i;

export function inspectModelRepository(tree) {
  const files = normalizeTree(tree);
  const rootReadmes = files.filter(file => README_PATTERN.test(file.path));
  const avatars = files.filter(file => AVATAR_PATTERN.test(file.path));
  const modelNames = new Set(files.flatMap(file => {
    const match = file.path.match(CONFIG_PATTERN);
    return match ? [match[1]] : [];
  }));
  const previews = new Set(files.flatMap(file => {
    const match = file.path.match(/^models\/webp\/(.+)\.webp$/i);
    return match ? [match[1]] : [];
  }));
  const completeModels = [...modelNames].filter(name => previews.has(name));

  return {
    hasReadme: rootReadmes.length === 1,
    hasAvatar: avatars.length === 1,
    modelCount: completeModels.length,
    shouldInclude: rootReadmes.length === 1 && avatars.length === 1 && completeModels.length > 0,
  };
}

export function buildRepositoryCatalog({ repository, tree, authorLinks = [], authorName = '', modelLinks = {}, generated }) {
  if (!repository?.name || !repository?.html_url || !repository?.default_branch) {
    throw new Error('Repository metadata is incomplete');
  }
  const files = normalizeTree(tree);
  if (tree?.truncated) throw new Error(`${repository.name} returned a truncated Git tree`);
  const inspection = inspectModelRepository(tree);
  if (!inspection.shouldInclude) throw new Error(`${repository.name} does not match the model repository contract`);

  const avatar = files.find(file => AVATAR_PATTERN.test(file.path));
  const names = [...new Set(files.flatMap(file => {
    const match = file.path.match(CONFIG_PATTERN);
    return match ? [match[1]] : [];
  }))].sort(naturalCompare);
  const normalizedModelLinks = normalizeModelLinks(modelLinks);
  const unknownLinks = Object.keys(normalizedModelLinks).filter(name => !names.includes(name));
  if (unknownLinks.length) {
    throw new Error(`${repository.name} links.json references unknown models: ${unknownLinks.join(', ')}`);
  }

  const models = names.flatMap(name => {
    const preview = files.find(file => file.path.toLowerCase() === `models/webp/${name}.webp`.toLowerCase());
    if (!preview) return [];
    const modelFiles = files.filter(file => file.path.startsWith(`models/${name}/`));
    const sourceHash = digest(modelFiles.map(file => `${file.path}\0${file.sha}\0${file.size}`).join('\n'));
    const id = `${slug(repository.name)}-${digest(name).slice(0, 12)}`;
    return [{
      id,
      name,
      repositoryKey: repository.name,
      repository: repository.html_url,
      branch: repository.default_branch,
      sourcePath: `models/${name}`,
      previewSource: preview.path,
      previewFingerprint: preview.sha,
      fullVersionUrl: normalizedModelLinks[name] || '',
      packageFilename: `${id}.zip`,
      downloadFilename: `${name}.zip`,
      size: modelFiles.reduce((total, file) => total + file.size, 0),
      fileCount: modelFiles.length,
      sourceHash,
    }];
  });

  return {
    repository: {
      key: repository.name,
      ...(String(authorName).trim() ? { displayName: String(authorName).trim() } : {}),
      repository: repository.html_url,
      branch: repository.default_branch,
      commit: tree.sha || '',
      avatarSource: avatar.path,
      avatarFingerprint: avatar.sha,
      authorLinks: normalizeLinks(authorLinks),
      updated: repository.pushed_at || generated,
    },
    models,
  };
}

export function parseAuthorName(readme) {
  return String(readme || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
}

export function createCatalog(records, generated = new Date().toISOString()) {
  const repositories = records.map(record => record.repository).sort((a, b) => naturalCompare(a.key, b.key));
  const models = records.flatMap(record => record.models).sort((a, b) => naturalCompare(a.name, b.name));
  const revision = digest(JSON.stringify({ repositories, models })).slice(0, 16);
  return { version: 1, revision, generated, repositories, models };
}

export function parseAuthorLinks(readme) {
  const links = [];
  for (const rawLine of String(readme || '').split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*+]\s+/, '');
    const markdown = line.match(/^\[([^\]]+)]\((https?:\/\/[^\s)]+)\)$/i);
    const plain = line.match(/^(https?:\/\/\S+)$/i);
    if (!markdown && !plain) continue;
    const url = new URL(markdown?.[2] || plain[1]).toString();
    const label = markdown?.[1].trim() || platformLabel(new URL(url));
    if (links.some(link => link.url === url)) continue;
    links.push({ label, url });
  }
  return links;
}

export function parseModelLinks(content, source = 'models/webp/links.json') {
  let parsed;
  try {
    parsed = JSON.parse(String(content || '{}'));
  } catch {
    throw new Error(`${source} must contain valid JSON`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${source} must contain an object of model names and URLs`);
  }
  return normalizeModelLinks(parsed, source);
}

function platformLabel(url) {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'bilibili.com' || host.endsWith('.bilibili.com')) return 'Bilibili';
  if (host === 'pixiv.net' || host.endsWith('.pixiv.net')) return 'Pixiv';
  if (host === 'x.com' || host === 'twitter.com') return 'X';
  return host;
}

function normalizeTree(tree) {
  return (Array.isArray(tree?.tree) ? tree.tree : [])
    .filter(entry => entry?.type === 'blob' && typeof entry.path === 'string')
    .map(entry => ({ path: entry.path, sha: String(entry.sha || ''), size: Number(entry.size) || 0 }));
}

function normalizeLinks(links) {
  return Array.isArray(links) ? links.flatMap(link => {
    try {
      const label = String(link?.label || '').trim();
      const url = new URL(String(link?.url || ''));
      return label && ['http:', 'https:'].includes(url.protocol) ? [{ label, url: url.toString() }] : [];
    } catch { return []; }
  }) : [];
}

function normalizeModelLinks(links, source = 'model links') {
  if (!links || typeof links !== 'object' || Array.isArray(links)) {
    throw new Error(`${source} must be an object`);
  }
  return Object.fromEntries(Object.entries(links).map(([rawName, rawUrl]) => {
    const name = String(rawName).trim();
    let url;
    try { url = new URL(String(rawUrl)); } catch { throw new Error(`${source} contains an invalid URL for ${name || 'an unnamed model'}`); }
    if (!name || url.protocol !== 'https:') throw new Error(`${source} requires model names and HTTPS URLs`);
    return [name, url.toString()];
  }));
}

function slug(value) {
  return String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'models';
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function naturalCompare(left, right) {
  return left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' });
}
