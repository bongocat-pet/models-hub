import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../data/models.json' with { type: 'json' };

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checkoutRoot = resolve(projectRoot, '.cache/package-repositories');
const outputRoot = resolve(projectRoot, 'release-assets');
await rm(checkoutRoot, { recursive: true, force: true });
await rm(outputRoot, { recursive: true, force: true });
await mkdir(checkoutRoot, { recursive: true });
await mkdir(outputRoot, { recursive: true });

for (const repository of catalog.repositories) {
  const destination = resolve(checkoutRoot, repository.key);
  await run('git', ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--branch', repository.branch, repository.repository, destination]);
  for (const model of catalog.models.filter(item => item.repositoryKey === repository.key)) {
    await run('git', [
      '-C', destination, 'archive', '--format=zip', `--prefix=${model.name}/`,
      `--output=${resolve(outputRoot, model.downloadFilename)}`, `HEAD:${model.sourcePath}`,
    ]);
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
