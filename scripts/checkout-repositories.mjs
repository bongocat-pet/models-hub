import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../data/models.json' with { type: 'json' };

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checkoutRoot = resolve(projectRoot, '.cache/repositories');
await rm(checkoutRoot, { recursive: true, force: true });
await mkdir(checkoutRoot, { recursive: true });
for (const repository of catalog.repositories) {
  const destination = resolve(checkoutRoot, repository.key);
  await run('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', repository.branch, repository.repository, destination]);
  await run('git', [
    '-C', destination, 'sparse-checkout', 'set', '--no-cone', '--',
    `/${repository.avatarSource}`, '/models/webp/',
  ]);
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}
