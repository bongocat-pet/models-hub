import { spawn } from 'node:child_process';
import { link, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../data/models.json' with { type: 'json' };

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checkoutRoot = resolve(projectRoot, '.cache/package-repositories');
const outputRoot = resolve(projectRoot, 'release-assets');
const r2OutputRoot = resolve(projectRoot, 'r2-assets');
await rm(checkoutRoot, { recursive: true, force: true });
await rm(outputRoot, { recursive: true, force: true });
await rm(resolve(projectRoot, 'r2-assets'), { recursive: true, force: true });
await mkdir(checkoutRoot, { recursive: true });
await mkdir(outputRoot, { recursive: true });

for (const repository of catalog.repositories) {
  if (repository.key.endsWith('-custom')) continue;
  const destination = resolve(checkoutRoot, repository.key);
  await run('git', ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--branch', repository.branch, repository.repository, destination]);
  for (const model of catalog.models.filter(item => item.repositoryKey === repository.key)) {
    const releasePackage = resolve(outputRoot, model.packageFilename);
    const section = model.repositoryKey.endsWith('-custom') ? 'custom' : 'models';
    const r2Package = resolve(r2OutputRoot, section, model.repositoryKey, model.downloadFilename);
    await mkdir(resolve(r2OutputRoot, section, model.repositoryKey), { recursive: true });
    await run('git', [
      '-C', destination, 'archive', '--format=zip', `--prefix=${model.name}/`,
      `--output=${releasePackage}`, `HEAD:${model.sourcePath}`,
    ]);
    await link(releasePackage, r2Package);
  }
}
console.log(`Packaged ${catalog.models.length} release assets.`);

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}
