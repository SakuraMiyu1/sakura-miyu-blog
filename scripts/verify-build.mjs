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
  if (html.includes('data-redirect-target=')) {
    ids.set(file, new Set());
    continue;
  }
  const admin = path.relative(root, file).split(path.sep)[0] === 'admin';
  ids.set(file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])));
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`Missing title: ${file}`);
  if (!html.includes('name="description"')) errors.push(`Missing description: ${file}`);
  if (!html.includes('rel="canonical"')) errors.push(`Missing canonical: ${file}`);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  if (![path.join(root, 'index.html'), path.join(root, '404.html')].includes(file)) {
    if (titles.has(title)) errors.push(`Duplicate page title: ${title}`);
    titles.add(title);
  }
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  if (!canonical?.startsWith(origin + '/')) errors.push(`Incorrect canonical origin: ${file}`);
  for (const property of admin ? [] : ['og:type', 'og:title', 'og:description', 'og:url', 'og:image']) {
    if (!html.includes(`property="${property}"`)) errors.push(`Missing ${property}: ${file}`);
  }
  for (const name of admin ? [] : ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!html.includes(`name="${name}"`)) errors.push(`Missing ${name}: ${file}`);
  }
  if (!admin && html.match(/property="og:url" content="([^"]+)"/)?.[1] !== canonical) errors.push(`Open Graph and canonical disagree: ${file}`);
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
for (const locale of ['uk', 'en', 'ja']) {
  const rss = await readFile(path.join(root, locale, 'rss.xml'), 'utf8');
  if (!rss.includes('<rss') || !rss.includes(`<language>${locale}</language>`)) errors.push(`Invalid ${locale} RSS`);
  if ([...rss.matchAll(/<dc:language>([^<]+)<\/dc:language>/g)].some(match => match[1] !== locale)) errors.push(`Mixed languages in ${locale} RSS`);
  const index = JSON.parse(await readFile(path.join(root, locale, 'search-index.json'), 'utf8'));
  if (index.some(post => post.language !== locale || !post.url.startsWith(`/${locale}/`))) errors.push(`Mixed language search index: ${locale}`);
  if (index.some(post => post.id.startsWith('qa-fixture-'))) errors.push('Temporary QA posts must never be published in the production build.');
  const sourceHome = await readFile(path.join(root, locale, 'index.html'), 'utf8');
  if (!sourceHome.includes(`<html lang="${locale}"`)) errors.push(`Invalid document language: ${locale}`);
  if ([...sourceHome.matchAll(/name="google-site-verification"/g)].length !== 1) errors.push(`Verification meta tag count: ${locale}`);
}
const sitemap = await readFile(path.join(root, 'sitemap-0.xml'), 'utf8');
if (!sitemap.includes('/uk/blog/welcome/') || !sitemap.includes('/en/blog/welcome/') || !sitemap.includes('/ja/blog/welcome/')) errors.push('Localized welcome posts missing from sitemap.');
if ([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].some(match => !/^\/(uk|en|ja)\//.test(new URL(match[1]).pathname))) errors.push('Legacy aliases must not be in sitemap.');
if (sitemap.includes('/404/')) errors.push('The 404 page must not be in the sitemap.');
const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
if (!robots.includes(`${origin}/sitemap.xml`) || /^Disallow:\s*\/\s*$/m.test(robots)) errors.push('Robots must allow indexing and reference the production sitemap.');
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  if (!/^\/(uk|en|ja)\//.test('/' + path.relative(root, file).split(path.sep).join('/'))) continue;
  for (const match of html.matchAll(/hreflang="(uk|en|ja)" href="([^"]+)"/g)) {
    const language = match[1];
    const pathname = new URL(match[2]).pathname;
    if (!pathname.startsWith(`/${language}/`)) errors.push(`Wrong hreflang language: ${file}`);
    try { await access(path.join(root, pathname, 'index.html')); } catch { errors.push(`Nonexistent hreflang target: ${pathname}`); }
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Verified ${htmlFiles.length} HTML pages, ${checked} internal links/assets/anchors, unique titles, SEO/social metadata, structured data, RSS languages, sitemaps, robots, search index, and privacy checks.`);
