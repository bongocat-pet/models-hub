import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildRepositoryCatalog, createCatalog, parseAuthorLinks, parseAuthorName, parseModelLinks, parseRepositoryDetails } from './catalog-builder.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = resolve(process.env.MODELS_SOURCE_ROOT || projectRoot, process.env.MODELS_SOURCE_REPOSITORY || '../yuhen');
const repositoryName = basename(sourceRoot);
const run = promisify(execFile);
const [{ stdout: listing }, { stdout: commit }, { stdout: commitDate }] = await Promise.all([
  run('git', ['-C', sourceRoot, 'ls-tree', '-r', '-l', '-z', 'HEAD'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }),
  run('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }),
  run('git', ['-C', sourceRoot, 'show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8' }),
]);
const files = listing.toString('utf8').split('\0').filter(Boolean).map(record => {
  const [metadata, path] = record.split('\t');
  const [, type, sha, rawSize] = metadata.trim().split(/\s+/);
  return { path, type, sha, size: Number(rawSize) || 0 };
});
const generated = new Date().toISOString();
const tree = { sha: commit.trim(), tree: files };
const readme = await readFile(resolve(sourceRoot, 'README.md'), 'utf8');
const modelLinks = parseModelLinks(await readOptional(resolve(sourceRoot, 'models/webp/links.json')));
const record = buildRepositoryCatalog({
  repository: {
    name: repositoryName,
    html_url: `https://github.com/${process.env.MODELS_GITHUB_ORG || 'bongocat-pet'}/${repositoryName}`,
    default_branch: 'main',
    pushed_at: commitDate.trim(),
  },
  tree,
  authorLinks: parseAuthorLinks(readme),
  authorName: parseAuthorName(readme),
  ...parseRepositoryDetails(readme),
  modelLinks,
  generated,
});
await writeFile(resolve(projectRoot, 'data/models.json'), `${JSON.stringify(createCatalog([record], generated), null, 2)}\n`);
console.log(`Cataloged ${record.models.length} models from ${repositoryName}.`);

async function readOptional(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) {
    if (error?.code === 'ENOENT') return '{}';
    throw error;
  }
}
