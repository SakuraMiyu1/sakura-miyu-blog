import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
const files = await walk(root);
const htmlFiles = files.filter(file => file.endsWith('.html'));
const errors = [];
const ids = new Map();
const titles = new Set();
const home = await readFile(path.join(root, 'index.html'), 'utf8');
const origin = new URL(home.match(/rel="canonical" href="([^"]+)"/)?.[1] || 'https://invalid.test').origin;
if (new URL(origin).hostname.endsWith('.pages.dev') && new URL(origin).hostname.split('.').length > 3) errors.push('Preview origin must not be used for canonical metadata.');
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  ids.set(file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])));
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`Missing title: ${file}`);
  if (!html.includes('name="description"')) errors.push(`Missing description: ${file}`);
  if (!html.includes('rel="canonical"')) errors.push(`Missing canonical: ${file}`);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  if (titles.has(title)) errors.push(`Duplicate page title: ${title}`);
  titles.add(title);
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical?.startsWith(origin + '/')) errors.push(`Incorrect canonical origin: ${file}`);
  for (const property of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image']) {
    if (!html.includes(`property="${property}"`)) errors.push(`Missing ${property}: ${file}`);
  }
  for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!html.includes(`name="${name}"`)) errors.push(`Missing ${name}: ${file}`);
  }
  if (html.match(/property="og:url" content="([^"]+)"/)?.[1] !== canonical) errors.push(`Open Graph and canonical disagree: ${file}`);
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(match[1]); } catch { errors.push(`Invalid structured data: ${file}`); }
  }
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
if (!rss.includes('<dc:language>uk</dc:language>') || !rss.includes('<dc:language>ja</dc:language>')) errors.push('Multilingual RSS metadata is missing.');
const sitemap = await readFile(path.join(root, 'sitemap-0.xml'), 'utf8');
if (!sitemap.includes('/blog/welcome/')) errors.push('Welcome post missing from sitemap.');
if (sitemap.includes('/404/')) errors.push('The 404 page must not be in the sitemap.');
const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
if (!robots.includes(`${origin}/sitemap.xml`) || /^Disallow:\s*\/\s*$/m.test(robots)) errors.push('Robots must allow indexing and reference the production sitemap.');
const index = JSON.parse(await readFile(path.join(root, 'search-index.json'), 'utf8'));
if (index.some(post => post.id.startsWith('qa-fixture-'))) errors.push('Temporary QA posts must never be published in the production build.');
if (!index.some(post => post.content.includes('Луїзою') && post.content.includes('ルイズ'))) errors.push('Multilingual full-text search index missing content.');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Verified ${htmlFiles.length} HTML pages, ${checked} internal links/assets/anchors, unique titles, SEO/social metadata, structured data, RSS languages, sitemaps, robots, search index, and privacy checks.`);
