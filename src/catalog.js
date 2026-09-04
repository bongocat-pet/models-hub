import catalog from '../data/models.json' with { type: 'json' };

const DEFAULT_R2_BASE = 'https://downloads.bongocat.pet';
const RELEASE_BASE = 'https://github.com/bongocat-pet/models-hub/releases/download/models';

export function createManifest(origin, r2Base = DEFAULT_R2_BASE) {
  const repositories = Object.fromEntries(catalog.repositories.map(repository => [repository.key, {
    ...(repository.displayName ? { displayName: repository.displayName } : {}),
    ...(repository.about ? { about: repository.about } : {}),
    ...(repository.pricing ? { pricing: repository.pricing } : {}),
    repository: repository.repository,
    branch: repository.branch,
    avatar: assetUrl(origin, 'avatars', repository.key, repository.avatarSource, repository.avatarFingerprint),
    authorLinks: repository.authorLinks,
    updated: repository.updated,
    ...(repository.category ? { category: repository.category } : {}),
  }]));
  const models = catalog.models.map(model => ({
    id: model.id,
    name: model.name,
    format: 'Bongo-Cat-Mver',
    repositoryKey: model.repositoryKey,
    repository: model.repository,
    sourceUrl: `${model.repository}/tree/${encodeURIComponent(model.branch)}/${encodePath(model.sourcePath)}`,
    preview: assetUrl(origin, 'previews', model.repositoryKey, `${model.name}.webp`, model.previewFingerprint),
    ...(model.fullVersionUrl ? { fullVersionUrl: model.fullVersionUrl } : {}),
    ...(model.fullVersionUrl ? { fullVersionTrackUrl: `${origin}/workshop/${encodeURIComponent(model.id)}` } : {}),
    ...(model.repositoryKey.endsWith('-custom') ? {} : {
      downloadUrl: `${origin}/download/${encodeURIComponent(model.id)}`,
    }),
    fallbackDownloadUrl: `${RELEASE_BASE}/${encodeURIComponent(model.packageFilename)}`,
    downloadFilename: model.downloadFilename,
    size: model.size,
    fileCount: model.fileCount,
    checksum: model.sourceHash,
  }));
  return {
    version: catalog.version,
    revision: catalog.revision,
    generated: catalog.generated,
    repositories,
    models,
  };
}

export function findModel(modelId) {
  return catalog.models.find(model => model.id === modelId);
}

export function publicDownloadUrl(base, repositoryKey, filename, section = 'models') {
  const root = String(base).replace(/\/+$/, '');
  return `${root}/${section}/${encodeURIComponent(repositoryKey)}/${encodeURIComponent(filename)}`;
}

function assetUrl(origin, prefix, repositoryKey, filename, fingerprint) {
  const url = new URL(`/${prefix}/${encodeURIComponent(repositoryKey)}/${encodePath(filename)}`, origin);
  if (fingerprint) url.searchParams.set('v', fingerprint.slice(0, 12));
  return url.toString();
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}
