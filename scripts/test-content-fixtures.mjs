import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const cwd = process.cwd();
const astroPackage = JSON.parse(await readFile(path.join(cwd, 'node_modules/astro/package.json'), 'utf8'));
const astro = path.resolve(cwd, 'node_modules/astro', typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin.astro);
const contentDir = path.join(cwd, 'src/content/blog');
const output = path.resolve(cwd, '.qa-dist');
assert.ok(output.startsWith(cwd + path.sep) && path.basename(output) === '.qa-dist');
const original = await readFile(path.join(contentDir, 'welcome.md'));
const created = [];
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [astro, ...args], { cwd, stdio: 'inherit', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Astro exited ${code}`)));
});
const fixtures = [
  ['a', '2025-05-01', 'Diary', ['Anime', '共通'], 'Зачарована алея'],
  ['b', '2025-04-01', 'Diary', ['anime', '共通'], 'Moonlit notebook'],
  ['c', '2025-03-01', 'Anime', ['共通'], '春の記憶'],
  ['d', '2025-02-01', 'Diary', ['共通'], 'A quiet little test'],
  ['e', '2025-01-01', 'Gaming', ['Ｃａｆｅ', 'Cafe'], 'A small save point'],
  ['f', '2024-12-01', 'Cosplay', ['Ribbons'], 'A ribbon in a notebook'],
  ['g', '2024-11-01', 'Writing', ['Creative Writing'], 'A story seed'],
  ['h', '2024-10-01', 'Gothic Kawaii', ['Other'], 'An older page'],
  ['draft', '2026-10-15', 'Diary', ['QA Hidden Draft'], 'QA_PRIVATE_DRAFT_SENTINEL', true],
  ['future', '2999-01-01', 'Diary', ['QA Hidden Future'], 'QA_PRIVATE_FUTURE_SENTINEL']
];
let server;
let browser;
try {
  for (const [id, date, category, tags, body, draft = false] of fixtures) {
    const filename = path.join(contentDir, `qa-fixture-${id}.md`);
    const text = `---\ntitle: "QA ${id}"\ndescription: "Temporary local QA entry"\npubDate: ${date}\ncategory: ${category}\ntags: ${JSON.stringify(tags)}\nlanguage: en\ndraft: ${draft}\n---\n\n${body}\n`;
    await writeFile(filename, text, { flag: 'wx' });
    created.push(filename);
  }
  await run(['build', '--outDir', output]);
  const index = JSON.parse(await readFile(path.join(output, 'search-index.json'), 'utf8'));
  assert.equal(index.length, 9);
  assert.ok(!index.some(post => /draft|future/.test(post.id)));
  const rss = await readFile(path.join(output, 'rss.xml'), 'utf8');
  assert.equal((rss.match(/<item>/g) || []).length, 9);
  assert.ok(!rss.includes('QA_PRIVATE_'));
  const sitemap = await readFile(path.join(output, 'sitemap-0.xml'), 'utf8');
  assert.ok(!sitemap.includes('qa-fixture-draft') && !sitemap.includes('qa-fixture-future'));
  assert.ok(!sitemap.includes('qa-hidden-draft') && !sitemap.includes('qa-hidden-future'));
  await assert.rejects(access(path.join(output, 'blog/qa-fixture-draft/index.html')));
  await assert.rejects(access(path.join(output, 'blog/qa-fixture-future/index.html')));
  const origin = 'http://127.0.0.1:4399';
  server = spawn(process.execPath, [astro, 'preview', '--outDir', output, '--host', '127.0.0.1', '--port', '4399'], { cwd, stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('QA preview did not start')), 30000);
    server.stdout.on('data', chunk => { if (String(chunk).includes('4399')) { clearTimeout(timer); resolve(); } });
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`QA preview exited ${code}`)); });
  });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage();
  await page.goto(origin + '/blog/', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-post-id]:visible').count(), 6);
  await page.locator('#load-more').click();
  assert.equal(await page.locator('[data-post-id]:visible').count(), 9);
  assert.equal(await page.locator('#load-more').isVisible(), false);
  assert.equal(await page.locator('[data-post-id="qa-fixture-f"] h2 a').evaluate(link => link === document.activeElement), true);
  for (const [word, id] of [['зачарована', 'a'], ['MOONLIT NOTEBOOK', 'b'], ['春の記憶', 'c']]) {
    await page.locator('#post-search').fill(word);
    assert.equal(await page.locator('[data-post-id]:visible').count(), 1);
    assert.equal(await page.locator(`[data-post-id="qa-fixture-${id}"]`).isVisible(), true);
  }
  await page.locator('#post-search').fill('anime');
  assert.equal(await page.locator('[data-post-id="qa-fixture-c"]').isVisible(), true, 'Category-only term is searchable');
  await page.goto(origin + '/tags/anime/');
  assert.equal(await page.locator('.main-column .post-card').count(), 3, 'Tag case variants share a page');
  await page.goto(origin + '/tags/cafe/');
  assert.equal(await page.locator('.main-column .post-card').count(), 1, 'NFKC tag variants share a page');
  await page.goto(origin + '/categories/anime/');
  assert.equal(await page.locator('.main-column .post-card').count(), 4, 'Category and matching tagged entries are relevant');
  await page.goto(origin + '/blog/qa-fixture-a/');
  assert.equal(await page.locator('.post-pagination [rel="prev"]').getAttribute('href'), '/blog/qa-fixture-b/');
  assert.equal(await page.locator('.post-pagination [rel="next"]').getAttribute('href'), '/blog/welcome/');
  const related = await page.locator('.related .post-card :is(h2,h3) a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  assert.equal(related.length, 3);
  assert.equal(new Set(related).size, 3);
  assert.equal(related[0], '/blog/qa-fixture-b/');
  assert.ok(!related.includes('/blog/qa-fixture-a/'));
  await page.goto(origin + '/blog/qa-fixture-h/');
  assert.equal(await page.locator('.post-pagination [rel="prev"]').count(), 0);
  assert.equal(await page.locator('.post-pagination [rel="next"]').count(), 1);
  assert.equal(await page.locator('.related').count(), 0);
  await page.goto(origin + '/archive/');
  assert.deepEqual(await page.locator('.archive-year > h2').allTextContents(), ['2026', '2025', '2024']);
  assert.equal(await page.locator('.archive-month li').count(), 9);
  assert.equal(await page.locator('#month-2025-05').textContent(), 'May');
  assert.ok(!(await page.locator('.archive').textContent()).includes('QA draft'));
  console.log('Content fixture checks passed: pagination, category full-text search, Unicode tags, related ranking, chronological neighbours, year/month archives, drafts and future exclusion.');
} finally {
  await browser?.close();
  server?.kill();
  for (const filename of created) await unlink(filename);
  assert.deepEqual(await readFile(path.join(contentDir, 'welcome.md')), original, 'Original diary entry remains byte-for-byte unchanged');
}
