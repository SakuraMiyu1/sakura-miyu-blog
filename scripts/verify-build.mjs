import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
const files = await walk(root);
const htmlFiles = files.filter(file => file.endsWith('.html'));
const errors = [];
const ids = new Map();
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  ids.set(file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])));
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`Missing title: ${file}`);
  if (!html.includes('name="description"')) errors.push(`Missing description: ${file}`);
  if (!html.includes('rel="canonical"')) errors.push(`Missing canonical: ${file}`);
  if (/lorem ipsum|href="(?:mailto:|tel:)/i.test(html)) errors.push(`Unexpected placeholder text or private contact link: ${file}`);
}
let checked = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const match of html.matchAll(/\b(?:href|src)="([^"<>]+)"/g)) {
    const value = match[1].replace(/&amp;/g, '&');
    if (/^(https?:|data:|mailto:|tel:)/.test(value)) continue;
    const pagePath = '/' + path.relative(root, file).split(path.sep).join('/').replace(/index\.html$/, '');
    const url = new URL(value, 'https://local.test' + pagePath);
    let target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.extname(target) || url.pathname.endsWith('/')) target = path.join(target, 'index.html');
    try { await access(target); checked++; } catch { errors.push(`Broken link in ${path.relative(root, file)}: ${value}`); continue; }
    if (url.hash && target.endsWith('.html') && !ids.get(target)?.has(decodeURIComponent(url.hash.slice(1)))) errors.push(`Broken anchor in ${file}: ${value}`);
  }
}
for (const name of ['rss.xml', 'sitemap.xml', 'sitemap-index.xml', 'sitemap-0.xml', 'robots.txt', 'search-index.json', 'favicon.ico', 'favicon.png', '404.html']) {
  try { await access(path.join(root, name)); } catch { errors.push(`Missing output: ${name}`); }
}
const rss = await readFile(path.join(root, 'rss.xml'), 'utf8');
if (!rss.includes('<rss') || !rss.includes('<item>')) errors.push('RSS must include published entries.');
const sitemap = await readFile(path.join(root, 'sitemap-0.xml'), 'utf8');
if (!sitemap.includes('/blog/welcome/')) errors.push('Welcome post missing from sitemap.');
const index = JSON.parse(await readFile(path.join(root, 'search-index.json'), 'utf8'));
if (!index.some(post => post.content.includes('Луїзою') && post.content.includes('ルイズ'))) errors.push('Multilingual full-text search index missing content.');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Verified ${htmlFiles.length} HTML pages, ${checked} internal links/assets/anchors, RSS, sitemaps, search index, and privacy checks.`);
