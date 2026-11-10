import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadComics } from '../src/lib/comics.ts';
import { comicPath } from '../src/lib/comics-data.ts';
import { comicText } from '../src/lib/comics-i18n.ts';
import { comicProgressKey } from '../src/lib/comic-reader-state.ts';

if (process.env.CF_PAGES) throw new Error('Comic browser fixtures are local-only; do not run them on Cloudflare.');
const environment = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NODE_DISABLE_COMPILE_CACHE: '1' };
const astro = 'node_modules/astro/bin/astro.mjs';
const locales = ['uk', 'en', 'ja'];
const series = loadComics({ demo: false })[0];
const protectedFiles = (await import('node:child_process')).execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'ls-files', 'src/content', 'public/images/blog', 'public/admin', 'cms/oauth.mjs', 'functions', 'public/_headers'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const before = new Map(await Promise.all(protectedFiles.map(async file => [file, await digest(file)])));
const run = args => new Promise((resolve, reject) => { const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...environment, COMICS_DEMO: '1' } }); child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Fixture build failed: ${code}`))); });
let server;
let browser;
async function stopServer() {
  if (server && server.exitCode === null) { const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill(); await stopped; }
  server = undefined;
}
async function preview(directory, port) {
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [astro, 'preview', '--outDir', path.resolve(directory), '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: environment });
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Preview startup timeout: ' + output)), 90000);
    server.stdout.on('data', chunk => { output += chunk; if (output.includes(origin)) { clearTimeout(timeout); resolve(); } });
    server.stderr.on('data', chunk => { output += chunk; });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error('Preview exit ' + code)); });
  });
  return origin;
}
try {
  await mkdir('test-results/comics', { recursive: true });
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  for (const locale of locales) {
    assert.ok(sitemap.includes(`/${locale}/comics/`));
    assert.ok(sitemap.includes(comicPath(locale, series)));
  }
  assert.ok(!sitemap.includes('reader-demo') && !sitemap.includes('/comics/two-queens-of-the-fog/prologue/'));
  await assert.rejects(access('dist/comics-demo-assets'), { code: 'ENOENT' });
  await assert.rejects(access('dist/uk/comics/reader-demo'), { code: 'ENOENT' });
  browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  let origin = await preview('dist', 4395);
  for (const locale of locales) {
    for (const width of [320, 390, 768, 1366, 1920]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(origin + comicPath(locale));
      await expect(page.locator('main h1')).toHaveText('Sakura Miyu Comics');
      await expect(page.getByRole('button', { name: `${comicText(locale, 'read')} · ${comicText(locale, 'coming-soon')}`, exact: true })).toBeDisabled();
      await expect(page.locator('main h2 a')).toHaveText(series.titles[locale]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${locale} catalog overflow at ${width}`);
      if (width === 390 && locale === 'uk') await page.screenshot({ path: 'test-results/comics/catalog-mobile.png', fullPage: true });
      if (width <= 600) { await page.locator('.menu-toggle').click(); await expect(page.locator(`#main-nav a[href="/${locale}/comics/"]`)).toBeVisible(); }
    }
    await page.goto(origin + comicPath(locale, series));
    await expect(page.locator('main h1')).toHaveText(series.titles[locale]);
    assert.equal(await page.locator('main a[href*="/prologue/"]').count(), 0);
    assert.equal(await page.locator('head link[rel=alternate][hreflang]').count(), 3);
    await expect(page.locator('head meta[property="og:image"]')).toHaveAttribute('content', /two-queens-coming-soon-social.webp$/);
    await expect.poll(() => page.locator('.comic-overview img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    for (const section of ['blog/welcome/', 'about/', 'writing/', 'archive/', 'tags/']) { const response = await page.goto(`${origin}/${locale}/${section}`); assert.equal(response.status(), 200); await expect(page.locator(`#main-nav a[href="/${locale}/comics/"]`)).toHaveCount(1); }
  }
  assert.deepEqual(errors, []);
  await context.close(); await stopServer();
  console.log('Production Comics checks passed: three catalogs/announcements, 0 published issues, no demo assets or draft links, localized SEO/navigation, existing blog routes and mobile layout.');
  await run([astro, 'build', '--outDir', '.qa-dist/comics']);
  origin = await preview('.qa-dist/comics', 4396);
  const readerContext = await browser.newContext();
  const reader = await readerContext.newPage();
  reader.setDefaultTimeout(15000); reader.setDefaultNavigationTimeout(60000);
  reader.on('pageerror', error => errors.push(error.message));
  reader.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const readerUrl = locale => `${origin}/${locale}/comics/reader-demo/prologue/`;
  const active = () => reader.locator('[data-reader-page]:not([hidden])');
  for (const locale of locales) {
    await reader.goto(readerUrl(locale) + '#comic-cover');
    await expect(active()).toHaveCount(1);
    await expect(active()).toHaveAttribute('data-reader-page', 'cover');
    await expect(reader.locator('[data-reader-previous]')).toBeDisabled();
    await expect(reader.locator('.comic-demo')).toBeVisible();
    await reader.locator('[data-reader-next]').click();
    await expect(active()).toHaveAttribute('data-reader-page', 'page-01');
    await reader.locator('[data-reader-stage]').focus();
    await reader.keyboard.press('ArrowRight');
    await expect(active()).toHaveAttribute('data-reader-page', 'page-02');
    await expect(reader.locator('[data-reader-next]')).toBeDisabled();
    await expect.poll(() => active().locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    await reader.reload(); await expect(active()).toHaveAttribute('data-reader-page', 'page-02');
    await reader.goto('about:blank'); await reader.goto(readerUrl(locale)); await expect(active()).toHaveAttribute('data-reader-page', 'page-02');
    await reader.locator('[data-reader-zoom]').selectOption('200');
    assert.equal(await reader.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await reader.locator('[data-zoom-fit]').click();
    await expect(reader.locator('[data-reader-zoom]')).toHaveValue('100');
  }
  await reader.evaluate(() => { location.hash = 'main'; });
  await expect(reader).toHaveURL(/#main$/);
  await expect(active()).toHaveAttribute('data-reader-page', 'page-02');
  await reader.goto(readerUrl('uk') + '#comic-page-01');
  await reader.locator('[data-reader-language][lang=en]').first().click();
  await expect(reader).toHaveURL(/\/en\/comics\/reader-demo\/prologue\/#comic-page-01$/);
  await expect(active()).toHaveAttribute('data-reader-page', 'page-01');
  await expect(active().locator('img')).toHaveAttribute('src', /\/en\/prologue\/page-01.webp$/);
  await reader.locator('.language-picker summary').click();
  await reader.locator('.language-picker a[data-locale=ja]').click();
  await expect(reader).toHaveURL(/\/ja\/comics\/reader-demo\/prologue\/#comic-page-01$/);
  await expect(active()).toHaveAttribute('data-reader-page', 'page-01');
  await expect(active().locator('img')).toHaveAttribute('src', /\/ja\/prologue\/page-01.webp$/);
  for (const width of [320, 390, 768, 1366, 1920]) {
    await reader.setViewportSize({ width, height: 950 });
    assert.equal(await reader.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Reader overflow: ${width}`);
    if (width === 390 || width === 1366) await reader.screenshot({ path: `test-results/comics/reader-${width}.png`, fullPage: true });
  }
  await reader.goto(`${origin}/uk/comics/reader-demo/issue-01/#comic-page-02`);
  await reader.locator('[data-reader-language][lang=ja]').first().click();
  await expect(reader.locator('[data-reader-unavailable]')).toBeVisible();
  await expect(reader.locator('head meta[name=robots]')).toHaveAttribute('content', 'noindex,follow');
  assert.equal(await reader.locator('head link[rel=alternate][hreflang=ja]').count(), 0);
  await reader.locator('[data-reader-unavailable] a[lang=en]').click();
  await expect(active()).toHaveAttribute('data-reader-page', 'page-02');
  await reader.locator('.reader-issues a[href*="prologue"]').first().click();
  await expect(reader).toHaveURL(/\/en\/comics\/reader-demo\/prologue\/#comic-page-01$/);
  assert.equal(await reader.locator('[data-reader-page]').count(), 3);
  await reader.evaluate(key => localStorage.setItem(key, 'corrupt-page-999'), comicProgressKey('reader-demo', 'prologue'));
  await reader.goto('about:blank'); await reader.goto(readerUrl('en')); await expect(active()).toHaveAttribute('data-reader-page', 'cover');
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  const blockedPage = await blocked.newPage(); blockedPage.on('pageerror', error => errors.push(error.message));
  await blockedPage.goto(readerUrl('uk')); await blockedPage.locator('[data-reader-next]').click();
  await expect(blockedPage.locator('[data-reader-page]:not([hidden])')).toHaveAttribute('data-reader-page', 'page-01');
  await blocked.close();
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await noJs.newPage(); await fallback.goto(readerUrl('ja'));
  assert.equal(await fallback.locator('[data-reader-page]:not([hidden])').count(), 3);
  assert.match(await fallback.locator('noscript').evaluate(element => element.textContent || ''), /JavaScript/);
  await expect(fallback.locator('[data-reader-controls]')).toBeHidden();
  await expect.poll(() => fallback.locator('[data-reader-page] img').first().evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await noJs.close();
  const missing = await reader.request.get(`${origin}/uk/comics/reader-demo/unapproved-test/`);
  assert.equal(missing.status(), 404);
  const fixtureSitemap = await readFile('.qa-dist/comics/sitemap-0.xml', 'utf8');
  assert.ok(!fixtureSitemap.includes('reader-demo'));
  await assert.rejects(access('.qa-dist/comics/comics-demo-assets/uk/unapproved-test'), { code: 'ENOENT' });
  assert.deepEqual(errors, []);
  await readerContext.close();
  console.log('Reader checks passed: UA/EN/JA, cover/page order, buttons/arrows, per-issue saved progress, explicit hashes, language/page persistence, unavailable translation, issue switching, zoom, 320–1920px, no-JS and blocked storage. Demo/unapproved routes excluded from sitemap; no console/network errors.');
} finally {
  await browser?.close(); await stopServer();
  for (const [file, hash] of before) assert.equal(await digest(file), hash, `Protected content changed: ${file}`);
}
