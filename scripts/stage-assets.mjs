import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../data/models.json' with { type: 'json' };

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = resolve(process.env.MODELS_CHECKOUT_ROOT || resolve(projectRoot, '.cache/repositories'));
for (const folder of ['avatars', 'previews']) {
  await rm(resolve(projectRoot, 'public', folder), { recursive: true, force: true });
}
for (const repository of catalog.repositories) {
  const source = resolve(sourceRoot, repository.key, repository.avatarSource);
  const destination = resolve(projectRoot, 'public/avatars', repository.key, repository.avatarSource);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}
for (const model of catalog.models) {
  const source = resolve(sourceRoot, model.repositoryKey, model.previewSource);
  const destination = resolve(projectRoot, 'public/previews', model.repositoryKey, `${model.name}.webp`);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}
console.log(`Staged ${catalog.models.length} model previews.`);
