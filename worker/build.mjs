import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml' };
const assets = {};
for (const name of await readdir('dist', { recursive: true })) {
  if (name.startsWith('server/')) continue;
  const extension = name.split('.').pop();
  if (!types[extension]) continue;
  const bytes = await readFile('dist/' + name);
  const binary = types[extension].startsWith('image/');
  assets['/' + name] = [types[extension], bytes.toString(binary ? 'base64' : 'utf8'), binary];
}
const seed = JSON.parse(await readFile('dist/effectifs.json', 'utf8'));
const standingsSnapshot = JSON.parse(await readFile('dist/classements.json', 'utf8'));
const fixturesSnapshot = JSON.parse(await readFile('dist/calendriers.json', 'utf8'));
const fixturesParser = (await readFile('worker/fixtures.mjs', 'utf8')).replace('export function', 'function');
const app = (await readFile('worker/app.mjs', 'utf8')).replace("import { assets, seed } from './assets.mjs';", '');
await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', 'const assets = ' + JSON.stringify(assets) + ';\nconst seed = ' + JSON.stringify(seed) + ';\nconst standingsSnapshot = ' + JSON.stringify(standingsSnapshot) + ';\nconst fixturesSnapshot = ' + JSON.stringify(fixturesSnapshot) + ';\n' + fixturesParser + '\n' + app);
