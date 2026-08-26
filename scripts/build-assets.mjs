import { spawn } from 'node:child_process';

if (!process.env.MODELS_CHECKOUT_ROOT) {
  await run(process.execPath, ['scripts/checkout-repositories.mjs']);
}
await run(process.execPath, ['scripts/stage-assets.mjs']);

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}
