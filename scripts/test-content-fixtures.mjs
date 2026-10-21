import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink, access, mkdir, rmdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const cwd = process.cwd();
const temporary = path.resolve(cwd, '_tmp');
await mkdir(temporary, { recursive: true });
process.env.TMP = temporary;
process.env.TEMP = temporary;
const environment = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NODE_DISABLE_COMPILE_CACHE: '1' };
const astroPackage = JSON.parse(await readFile(path.join(cwd, 'node_modules/astro/package.json'), 'utf8'));
const astro = path.resolve(cwd, 'node_modules/astro', typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin.astro);
const contentDir = path.join(cwd, 'src/content/blog');
const output = path.resolve(cwd, '.qa-dist');
assert.ok(output.startsWith(cwd + path.sep) && path.basename(output) === '.qa-dist');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const originals = new Map();
async function recordOriginals(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) await recordOriginals(filename);
    else if (/\.mdx?$/.test(item.name)) originals.set(filename, hash(await readFile(filename)));
  }
}
await recordOriginals(contentDir);
assert.ok(originals.size >= 5, 'Record every existing original article before creating fixtures');
const created = [];
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [astro, ...args], { cwd, stdio: 'inherit', env: environment });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Astro exited ${code}`)));
});
const fixtures = [
  { id: 'a', date: '2025-05-01T00:30:00+14:00', category: 'Diary', tags: ['Anime', '共通'], body: 'Зачарована алея. QAENONLYSENTINEL.', slug: 'qa-english-dream', translationKey: 'qa-fixture-shared-dream' },
  { id: 'b', date: '2025-04-01', category: 'Diary', tags: ['anime', '共通'], body: 'Moonlit notebook', image: true },
  { id: 'c', date: '2025-03-01', category: 'Anime', tags: ['共通'], body: '春の記憶' },
  { id: 'd', date: '2025-02-01', category: 'Diary', tags: ['共通'], body: 'A quiet little test' },
  { id: 'e', date: '2025-01-01', category: 'Gaming', tags: ['Ｃａｆｅ', 'Cafe'], body: 'A small save point' },
  { id: 'f', date: '2024-12-01', category: 'Cosplay', tags: ['Ribbons'], body: 'A ribbon in a notebook' },
  { id: 'g', date: '2024-11-01', category: 'Writing', tags: ['Creative Writing'], body: 'A story seed' },
  { id: 'h', date: '2024-10-01', category: 'Gothic Kawaii', tags: ['Other'], body: 'An older page' },
  { id: 'ukrainian', language: 'uk', date: '2025-04-30', category: 'Diary', tags: ['Anime', '共通'], body: 'QAUKONLYSENTINEL. Я зберегла українську історію.', slug: 'qa-fixture-b' },
  { id: 'japanese', language: 'ja', date: '2025-04-30', category: 'Diary', tags: ['Anime', '共通'], body: 'QAJAONLYSENTINEL。日本語の小さな物語です。', slug: 'qa-japanese-dream', translationKey: 'qa-fixture-shared-dream' },
  { id: 'draft', date: '2025-06-01', category: 'Diary', tags: ['QA Hidden Draft'], body: 'QAPRIVATEDRAFTSENTINEL', draft: true },
  { id: 'future', date: '2999-01-01', category: 'Diary', tags: ['QA Hidden Future'], body: 'QAPRIVATEFUTURESENTINEL' }
].map(fixture => ({ language: 'en', slug: `qa-fixture-${fixture.id}`, translationKey: `qa-fixture-${fixture.id}`, ...fixture }));
const fixtureUrl = fixture => `/${fixture.language}/blog/${fixture.slug}/`;
const byId = id => fixtures.find(fixture => fixture.id === id);
const [englishDream, imageEntry, oldest, ukrainianDream, japaneseDream] = ['a', 'b', 'h', 'ukrainian', 'japanese'].map(byId);
let server;
let browser;
let mediaCreated = false;
const mediaDir = path.resolve(cwd, 'public/images/blog/qa-fixture-b');
assert.ok(mediaDir.startsWith(path.join(cwd, 'public/images/blog') + path.sep));
const normalizeTag = value => value.normalize('NFKC').toLowerCase();
try {
  for (const fixture of fixtures) await assert.rejects(access(path.join(contentDir, `qa-fixture-${fixture.id}.md`)), { code: 'ENOENT' });
  await assert.rejects(access(mediaDir), { code: 'ENOENT' });
  await mkdir(mediaDir);
  mediaCreated = true;
  const image = path.join(mediaDir, 'qa-image.webp');
  await writeFile(image, await readFile('public/images/avatar.webp'), { flag: 'wx' });
  created.push(image);
  for (const fixture of fixtures) {
    const filename = path.join(contentDir, `qa-fixture-${fixture.id}.md`);
    const overrides = fixture.id === 'a' ? 'seoTitle: CMS test SEO title\nseoDescription: CMS test SEO description\nupdatedDate: ""\nimage: ""\n' : fixture.image ? 'image: /images/blog/qa-fixture-b/qa-image.webp\nimageAlt: Temporary test image\n' : '';
    const text = `---\ntitle: "QA ${fixture.id}"\ndescription: "Temporary local QA entry"\nslug: ${fixture.slug}\ntranslationKey: ${fixture.translationKey}\npubDate: ${fixture.date}\ncategory: ${fixture.category}\ntags: ${JSON.stringify(fixture.tags)}\nlanguage: ${fixture.language}\ndraft: ${fixture.draft || false}\n${overrides}---\n\n${fixture.body}\n`;
    await writeFile(filename, text, { flag: 'wx' });
    created.push(filename);
  }
  await run(['build', '--outDir', output]);
  const indexes = {};
  for (const locale of ['uk', 'en', 'ja']) {
    const index = JSON.parse(await readFile(path.join(output, locale, 'search-index.json'), 'utf8'));
    indexes[locale] = index;
    assert.ok(index.every(post => post.language === locale && post.url.startsWith(`/${locale}/blog/`)), `${locale} search index contains only its own language`);
    assert.ok(!JSON.stringify(index).includes('QAPRIVATE'));
    const expected = fixtures.filter(fixture => fixture.language === locale && !fixture.draft && fixture.id !== 'future');
    assert.equal(index.filter(post => /^QA /.test(post.title)).length, expected.length);
    for (const fixture of expected) assert.equal(index.filter(post => post.url === fixtureUrl(fixture)).length, 1);
    const rss = await readFile(path.join(output, locale, 'rss.xml'), 'utf8');
    assert.equal((rss.match(/<item>/g) || []).length, index.length);
    assert.ok(rss.includes(`<language>${locale}</language>`));
    assert.ok(!rss.includes('QAPRIVATE'));
    assert.ok(!rss.includes(`/blog/${locale === 'ja' ? englishDream.slug : japaneseDream.slug}/`), 'RSS does not leak another language translation');
    await assert.rejects(access(path.join(output, locale, 'blog/qa-fixture-draft/index.html')), { code: 'ENOENT' });
    await assert.rejects(access(path.join(output, locale, 'blog/qa-fixture-future/index.html')), { code: 'ENOENT' });
  }
  assert.ok(indexes.en.length >= 8);
  assert.notEqual(indexes.en.find(post => post.url === fixtureUrl(imageEntry)).id, indexes.uk.find(post => post.url === fixtureUrl(ukrainianDream)).id, 'Equal URL slugs in different languages retain distinct collection IDs');
  const rootIndex = JSON.parse(await readFile(path.join(output, 'search-index.json'), 'utf8'));
  assert.deepEqual(rootIndex, indexes.uk, 'Root compatibility search stays Ukrainian');
  const sitemap = await readFile(path.join(output, 'sitemap-0.xml'), 'utf8');
  assert.ok(!/qa-fixture-(draft|future)|qa-hidden-(draft|future)/.test(sitemap));
  for (const fixture of [englishDream, ukrainianDream, japaneseDream]) assert.ok(sitemap.includes(fixtureUrl(fixture)));
  const origin = 'http://127.0.0.1:4399';
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(4399, '127.0.0.1', () => probe.close(error => error ? reject(error) : resolve()));
  });
  server = spawn(process.execPath, [astro, 'preview', '--outDir', output, '--host', '127.0.0.1', '--port', '4399'], { cwd, stdio: ['ignore', 'pipe', 'inherit'], env: environment });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('QA preview did not start on its dedicated port 4399')), 90000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('127.0.0.1:4399')) { clearTimeout(timer); resolve(); } });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`QA preview exited ${code}`)); });
  });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage();
  const entry = fixture => indexes[fixture.language].find(post => post.url === fixtureUrl(fixture));
  const card = fixture => page.locator('[data-post-id]').filter({ has: page.locator(`a[href="${fixtureUrl(fixture)}"]`) });
  await page.goto(origin + '/en/blog/', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-post-id]:visible')).toHaveCount(6);
  while (await page.locator('#load-more').isVisible()) await page.locator('#load-more').click();
  assert.equal(await page.locator('[data-post-id]:visible').count(), indexes.en.length);
  assert.equal(await page.locator('#load-more').isVisible(), false);
  assert.ok(await page.locator('[data-post-id] h2 a').evaluateAll(links => links.some(link => link === document.activeElement)), 'Load more moves keyboard focus to a revealed entry');
  for (const [word, id] of [['зачарована', 'a'], ['MOONLIT NOTEBOOK', 'b'], ['春の記憶', 'c']]) {
    await page.locator('#post-search').fill(word);
    await expect(page.locator('[data-post-id]:visible')).toHaveCount(1);
    assert.equal(await card(byId(id)).isVisible(), true);
  }
  await page.locator('#post-search').fill('anime');
  await expect(card(byId('c'))).toBeVisible();
  await page.locator('#post-search').fill('');
  await page.locator('#category-filter').selectOption('Gaming');
  await expect(page.locator('[data-post-id]:visible')).toHaveCount(indexes.en.filter(post => post.category === 'Gaming').length);
  await page.locator('#category-filter').selectOption('');
  const cafeOption = await page.locator('#tag-filter option').evaluateAll(options => options.find(option => option.value.normalize('NFKC').toLowerCase() === 'cafe')?.value);
  assert.ok(cafeOption);
  await page.locator('#tag-filter').selectOption(cafeOption);
  await expect(page.locator('[data-post-id]:visible')).toHaveCount(indexes.en.filter(post => post.tags.some(tag => normalizeTag(tag) === 'cafe')).length);
  for (const [locale, ownSentinel, foreignSentinel] of [['en', 'QAENONLYSENTINEL', 'QAJAONLYSENTINEL'], ['uk', 'QAUKONLYSENTINEL', 'QAENONLYSENTINEL'], ['ja', 'QAJAONLYSENTINEL', 'QAUKONLYSENTINEL']]) {
    await page.goto(`${origin}/${locale}/blog/`, { waitUntil: 'networkidle' });
    await page.locator('#post-search').fill(ownSentinel);
    await expect(page.locator('[data-post-id]:visible')).toHaveCount(1);
    await page.locator('#post-search').fill(foreignSentinel);
    await expect(page.locator('[data-post-id]:visible')).toHaveCount(0);
    assert.equal(await page.locator('[data-post-listing]').getAttribute('data-index-url'), `/${locale}/search-index.json`);
  }
  await page.goto(origin + '/en/tags/anime/');
  assert.equal(await page.locator('.main-column .post-card').count(), indexes.en.filter(post => post.tags.some(tag => normalizeTag(tag) === 'anime')).length, 'Tag case variants share a page');
  await page.goto(origin + '/en/tags/cafe/');
  assert.equal(await page.locator('.main-column .post-card').count(), indexes.en.filter(post => post.tags.some(tag => normalizeTag(tag) === 'cafe')).length, 'NFKC tag variants share a page');
  await page.goto(origin + '/en/categories/anime/');
  assert.equal(await page.locator('.main-column .post-card').count(), indexes.en.filter(post => post.category === 'Anime' || post.tags.some(tag => normalizeTag(tag) === 'anime')).length);
  await page.goto(origin + fixtureUrl(englishDream));
  assert.match(await page.title(), /^CMS test SEO title/);
  assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), 'CMS test SEO description');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://sakura-miyu-blog.pages.dev${fixtureUrl(englishDream)}`);
  const jsonLd = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  assert.equal(jsonLd.inLanguage, 'en');
  assert.equal(jsonLd.datePublished, '2025-04-30T10:30:00.000Z');
  assert.equal(await page.locator('.post-pagination [rel="prev"]').getAttribute('href'), fixtureUrl(imageEntry));
  const neighbours = await page.locator('.post-pagination a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  assert.ok(neighbours.every(url => url.startsWith('/en/blog/')));
  const related = await page.locator('.related .post-card :is(h2,h3) a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  assert.equal(related.length, 3);
  assert.equal(new Set(related).size, 3);
  assert.equal(related[0], fixtureUrl(imageEntry));
  assert.ok(related.every(url => url.startsWith('/en/blog/') && url !== fixtureUrl(englishDream)));
  assert.equal(await page.locator('.language-picker a[data-locale="ja"]').getAttribute('href'), fixtureUrl(japaneseDream), 'Shared Translation Key links to a different translated slug');
  assert.equal(await page.locator('link[rel="alternate"][hreflang="ja"]').getAttribute('href'), `https://sakura-miyu-blog.pages.dev${fixtureUrl(japaneseDream)}`);
  await page.locator('.language-picker summary').click();
  await page.locator('.language-picker a[data-locale="ja"]').click();
  await page.waitForURL(origin + fixtureUrl(japaneseDream));
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
  assert.equal(await page.locator('.language-picker a[data-locale="en"]').getAttribute('href'), fixtureUrl(englishDream));
  assert.ok((await page.locator('.post-detail .prose').textContent()).includes('QAJAONLYSENTINEL'));
  assert.ok(!(await page.locator('.post-detail .prose').textContent()).includes('QAENONLYSENTINEL'));
  await page.goto(origin + fixtureUrl(oldest));
  assert.equal(await page.locator('.post-pagination [rel="prev"]').count(), 0);
  assert.equal(await page.locator('.post-pagination [rel="next"]').count(), 1);
  await page.goto(origin + fixtureUrl(imageEntry));
  await expect.poll(() => page.locator('.post-cover').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  const imageResponse = await page.request.get(origin + '/images/blog/qa-fixture-b/qa-image.webp');
  assert.equal(imageResponse.status(), 200);
  assert.deepEqual(await imageResponse.body(), await readFile(image));
  await page.goto(origin + '/en/archive/');
  assert.equal(await page.locator('.archive-month li').count(), indexes.en.length);
  assert.ok((await page.locator('.archive-year > h2').allTextContents()).includes('2024'));
  const april = page.locator('.archive-month').filter({ has: page.locator('#month-2025-04') });
  assert.equal(await page.locator('#month-2025-04').textContent(), 'April');
  assert.equal(await april.locator(`a[href="${fixtureUrl(englishDream)}"]`).count(), 1, 'Archive groups the offset date by UTC month, April rather than May');
  const archiveLinks = await page.locator('.archive-month li a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  assert.ok(archiveLinks.every(url => url.startsWith('/en/blog/')));
  assert.ok(!(await page.locator('.archive').textContent()).includes('QA draft'));
  assert.ok(entry(englishDream).id !== entry(japaneseDream).id, 'Translated entries retain distinct identities');
  console.log(`Content fixture checks passed: ${originals.size} original articles protected; scoped UA/EN/JP search and RSS; English load more; Unicode search, categories and tags; shared-key translation switching with distinct slugs; same-language related entries and neighbours; UTC archives; SEO overrides; uploaded image; draft and future exclusion. Temporary output uses .qa-dist only.`);
} finally {
  try { await browser?.close(); } finally {
    if (server?.pid && server.exitCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await stopped;
    }
    try {
      const removed = await Promise.allSettled(created.map(filename => unlink(filename)));
      const failures = removed.filter(result => result.status === 'rejected').map(result => result.reason);
      if (mediaCreated) {
        try { await rmdir(mediaDir); } catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, 'Could not remove all explicitly created QA fixtures');
    } finally {
      for (const [filename, originalHash] of originals) assert.equal(hash(await readFile(filename)), originalHash, `Original remains byte-for-byte unchanged: ${path.relative(cwd, filename)}`);
    }
  }
}
