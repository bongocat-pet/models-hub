import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRepositoryCatalog, createCatalog, inspectCustomRepository, inspectModelRepository, parseAuthorLinks, parseAuthorName, parseModelLinks } from './catalog-builder.mjs';

const organization = process.env.MODELS_GITHUB_ORG || 'bongocat-pet';
const token = process.env.GITHUB_TOKEN;
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${organization}/models-hub`,
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};
const generated = new Date().toISOString();
const repositories = (await listRepositories()).filter(repository =>
  repository.name !== 'models-hub' && !repository.archived && !repository.disabled && !repository.fork && repository.default_branch);
const records = (await mapLimit(repositories, 6, async repository => {
  const tree = await api(`/repos/${repository.full_name}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`, [404, 409]);
  const inspection = repository.name.endsWith('-custom')
    ? inspectCustomRepository(tree)
    : inspectModelRepository(tree);
  if (!tree || !inspection.shouldInclude) return null;
  const readme = await api(`/repos/${repository.full_name}/contents/README.md?ref=${encodeURIComponent(repository.default_branch)}`);
  const content = readme?.encoding === 'base64' ? Buffer.from(readme.content, 'base64').toString('utf8') : '';
  const linksFile = await api(`/repos/${repository.full_name}/contents/models/webp/links.json?ref=${encodeURIComponent(repository.default_branch)}`, [404]);
  const linksContent = linksFile?.encoding === 'base64' ? Buffer.from(linksFile.content, 'base64').toString('utf8') : '{}';
  return buildRepositoryCatalog({
    repository,
    tree,
    authorLinks: parseAuthorLinks(content),
    authorName: parseAuthorName(content),
    modelLinks: parseModelLinks(linksContent, `${repository.name}/models/webp/links.json`),
    generated,
  });
})).filter(Boolean);
if (!records.length) throw new Error(`No model repositories found in ${organization}`);
const catalogPath = resolve(projectRoot, 'data/models.json');
const previous = JSON.parse(await readFile(catalogPath, 'utf8'));
const catalog = createCatalog(records, generated);
if (previous.revision === catalog.revision) catalog.generated = previous.generated;
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Discovered ${records.length} repositories containing ${catalog.models.length} models.`);

async function listRepositories() {
  const result = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(`/orgs/${organization}/repos?type=public&per_page=100&page=${page}`);
    result.push(...batch);
    if (batch.length < 100) return result;
  }
}

async function api(path, allowed = []) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (allowed.includes(response.status)) return null;
  if (!response.ok) throw new Error(`GitHub API ${path} returned ${response.status}`);
  return response.json();
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      output[current] = await mapper(items[current]);
    }
  }));
  return output;
}
