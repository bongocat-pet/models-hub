import catalog from '../data/models.json' with { type: 'json' };

const RELEASE_BASE = 'https://github.com/bongocat-pet/models-hub/releases/download/models';

export function createManifest(origin) {
  const repositories = Object.fromEntries(catalog.repositories.map(repository => [repository.key, {
    repository: repository.repository,
    branch: repository.branch,
    avatar: assetUrl(origin, 'avatars', repository.key, repository.avatarSource, repository.avatarFingerprint),
    authorLinks: repository.authorLinks,
    updated: repository.updated,
  }]));
  const models = catalog.models.map(model => ({
    id: model.id,
    name: model.name,
    format: 'Bongo-Cat-Mver',
    repositoryKey: model.repositoryKey,
    repository: model.repository,
    sourceUrl: `${model.repository}/tree/${encodeURIComponent(model.branch)}/${encodePath(model.sourcePath)}`,
    preview: assetUrl(origin, 'previews', model.repositoryKey, `${model.name}.webp`, model.previewFingerprint),
    downloadUrl: `${RELEASE_BASE}/${encodeURIComponent(model.downloadFilename)}`,
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

function assetUrl(origin, prefix, repositoryKey, filename, fingerprint) {
  const url = new URL(`/${prefix}/${encodeURIComponent(repositoryKey)}/${encodePath(filename)}`, origin);
  if (fingerprint) url.searchParams.set('v', fingerprint.slice(0, 12));
  return url.toString();
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}
