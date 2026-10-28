import { spawn } from 'node:child_process';
import { readFile, writeFile, readdir, unlink, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const temporary = path.resolve('_tmp');
await mkdir(temporary, { recursive: true });
const environment = { ...process.env, TMP: temporary, TEMP: temporary, ASTRO_TELEMETRY_DISABLED: '1', NODE_DISABLE_COMPILE_CACHE: '1' };
process.env.TMP = temporary; process.env.TEMP = temporary;
const output = path.resolve('.qa-dist');
const directory = path.resolve('src/content/articles');
const astro = path.resolve('node_modules/astro/bin/astro.mjs');
const original = new Map();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const folder of ['src/content/articles', 'src/content/blog']) {
  for (const file of await readdir(folder)) {
    const filename = path.resolve(folder, file);
    original.set(filename, sha(await readFile(filename)));
  }
}
const version = (language, slug) => ({ title: `QA unified ${language}`, slug, description: `QA ${language} description`, body: `## ${language}\n\n${{ uk: 'UKONLY. Я зберегла маленьку мрію.', en: 'ENONLY. A little dream.', ja: 'JAPONLY。小さな夢を残します。' }[language]}`, imageAlt: `QA ${language} sakura`, seoTitle: `QA ${language} SEO`, seoDescription: `QA ${language} SEO description` });
const article = (translationKey, translations, overrides = {}) => ({ translationKey, pubDate: '2025-01-01', updatedDate: '2025-01-02', category: 'Diary', tags: ['Diary'], image: '/images/welcome.webp', featured: false, draft: false, translations, ...overrides });
const full = article('qa-fixture-unified', { uk: version('uk', 'qa-unified-uk'), en: { ...version('en', 'qa-unified-dream'), tags: ['Creative Writing'] }, ja: { ...version('ja', 'qa-unified-dream'), tags: [] } });
const optional = article('qa-fixture-optional', { uk: {}, en: version('en', 'qa-optional-english'), ja: { title: 'Incomplete Japanese', body: 'まだ書いています。' } });
const hidden = article('qa-fixture-hidden', full.translations, { draft: true });
const future = article('qa-fixture-future', full.translations, { pubDate: '2999-01-01' });
const fixtures = [full, optional, hidden, future];
const created = [];
let server;
let browser;
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: environment });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Command exited ${code}`)));
});
try {
  for (const fixture of fixtures) {
    const filename = path.join(directory, `${fixture.translationKey}.json`);
    await writeFile(filename, JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
    created.push(filename);
  }
  await run([astro, 'build', '--outDir', output]);
  await run(['scripts/generate-redirects.mjs', output]);
  const indexes = {};
  for (const locale of ['uk', 'en', 'ja']) {
    indexes[locale] = JSON.parse(await readFile(path.join(output, locale, 'search-index.json'), 'utf8'));
    assert.ok(indexes[locale].every(post => post.language === locale && post.url.startsWith(`/${locale}/`)));
    const actual = indexes[locale].filter(post => post.id.includes('/qa-fixture-'));
    assert.equal(actual.length, locale === 'en' ? 2 : 1);
    const entry = actual.find(post => post.id === `__articles/${locale}/qa-fixture-unified`);
    assert.equal(entry.url, `/${locale}/blog/${full.translations[locale].slug}/`);
    assert.deepEqual(entry.tags, full.translations[locale].tags ?? full.tags);
    assert.ok(!JSON.stringify(indexes[locale]).includes('qa-fixture-hidden'));
    assert.ok(!JSON.stringify(indexes[locale]).includes('qa-fixture-future'));
    for (const other of ['uk', 'en', 'ja'].filter(value => value !== locale)) assert.ok(!entry.content.includes({ uk: 'UKONLY', en: 'ENONLY', ja: 'JAPONLY' }[other]));
    const rss = await readFile(path.join(output, locale, 'rss.xml'), 'utf8');
    assert.ok(rss.includes(`<language>${locale}</language>`));
    assert.ok(rss.includes(entry.url));
    if (locale !== 'en') {
      await assert.rejects(access(path.join(output, locale, 'blog/qa-optional-english/index.html')), { code: 'ENOENT' });
      assert.ok(!rss.includes('qa-optional-english'));
    }
  }
  const sitemap = await readFile(path.join(output, 'sitemap-0.xml'), 'utf8');
  assert.ok(!sitemap.includes('qa-fixture-hidden') && !sitemap.includes('qa-fixture-future'));
  assert.ok(!sitemap.includes('/uk/blog/qa-optional-english/') && !sitemap.includes('/ja/blog/qa-optional-english/'));
  const origin = 'http://127.0.0.1:4398';
  await new Promise((resolve, reject) => {
    const probe = createServer(); probe.once('error', reject);
    probe.listen(4398, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()));
  });
  server = spawn(process.execPath, [astro, 'preview', '--outDir', output, '--host', '127.0.0.1', '--port', '4398'], { stdio: ['ignore', 'pipe', 'pipe'], env: environment });
  await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Unified QA preview startup timed out: ' + log)), 90000);
    server.stdout.on('data', data => { log += data; if (log.includes('127.0.0.1:4398')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => { log += data; });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error('Unified QA preview exited ' + code)); });
  });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['uk', 'en', 'ja']) {
    const translation = full.translations[locale];
    await page.goto(`${origin}/${locale}/blog/${translation.slug}/`);
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    await expect(page.locator('h1')).toHaveText(translation.title);
    assert.ok((await page.locator('.prose').textContent()).includes({ uk: 'UKONLY', en: 'ENONLY', ja: 'JAPONLY' }[locale]));
    assert.equal(await page.title(), `${translation.seoTitle} | Sakura Miyu's Little World · ${{ uk: 'UA', en: 'EN', ja: 'JP' }[locale]}`);
    assert.equal(await page.locator('meta[name=description]').getAttribute('content'), translation.seoDescription);
    assert.equal(await page.locator('head link[hreflang]').count(), 3);
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), `https://sakura-miyu-blog.pages.dev/${locale}/blog/${translation.slug}/`);
    const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    assert.equal(jsonLd.inLanguage, locale);
    for (const href of await page.locator('.post-pagination a, .related .post-card a').evaluateAll(links => links.map(link => link.getAttribute('href')))) assert.ok(href.startsWith(`/${locale}/`));
  }
  await page.locator('.language-picker summary').click();
  await page.locator('.language-picker a[data-locale=uk]').click();
  await expect(page).toHaveURL(origin + '/uk/blog/qa-unified-uk/');
  await page.goto(origin + '/en/blog/qa-optional-english/');
  assert.equal(await page.locator('head link[hreflang]').count(), 1);
  assert.equal(await page.locator('.language-picker a[data-locale=uk]').getAttribute('href'), '/uk/');
  assert.equal(await page.locator('.language-picker a[data-locale=ja]').getAttribute('href'), '/ja/');
  assert.deepEqual(errors, []);
  console.log(`Unified article checks passed: one JSON creates three linked language pages; same cross-language slugs, localized Markdown/SEO/tags, shared dates/media, language-isolated search/RSS and related entries, optional/partial translations, hidden/future exclusion, valid hreflang/canonical and switching. ${original.size} existing source files protected.`);
} finally {
  try { await browser?.close(); } finally {
    if (server && server.exitCode === null) { const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill(); await stopped; }
    const removed = await Promise.allSettled(created.map(filename => unlink(filename)));
    const failed = removed.filter(result => result.status === 'rejected');
    for (const [filename, digest] of original) assert.equal(sha(await readFile(filename)), digest, `Original source intact: ${filename}`);
    if (failed.length) throw new AggregateError(failed.map(result => result.reason), 'Temporary article cleanup failed');
  }
}
