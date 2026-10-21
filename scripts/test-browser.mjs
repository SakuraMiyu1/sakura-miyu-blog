import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = process.env.TEST_URL || 'http://127.0.0.1:4321';
const canonicalOrigin = process.env.SITE_URL || 'https://sakura-miyu-blog.pages.dev';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
const names = { uk: 'Українська', en: 'English', ja: '日本語' };
const indexes = {};
const errors = [];
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['uk', 'en', 'ja']) {
    indexes[locale] = await (await page.request.get(origin + '/' + locale + '/search-index.json')).json();
    assert.ok(indexes[locale].every(post => post.language === locale && post.url.startsWith('/' + locale + '/')));
    for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + '/' + locale + '/', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, locale + ' overflow at ' + width);
      assert.equal(await page.locator('.category-grid a').count(), 9);
      assert.equal(await page.locator('.language-picker').count(), 1);
      const picker = page.locator('.language-picker');
      const summary = picker.locator('summary');
      await expect(summary).toContainText(names[locale]);
      await summary.click(); await expect(picker).toHaveAttribute('open', '');
      assert.equal(await picker.locator('a').count(), 3);
      assert.equal(await picker.evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
      await summary.click(); assert.equal(await picker.getAttribute('open'), null);
      await summary.focus(); await page.keyboard.press('ArrowDown');
      await expect(picker.locator('a').first()).toBeFocused();
      await page.keyboard.press('Escape'); await expect(summary).toBeFocused();
      assert.equal(await picker.getAttribute('open'), null);
      await summary.click(); await page.locator('h1').click();
      assert.equal(await picker.getAttribute('open'), null);
      if (width <= 600) {
        const toggle = page.locator('.menu-toggle');
        await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape'); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
      for (const href of await page.locator('.post-card h2 a, .post-card h3 a, .sidebar-post').evaluateAll(links => links.map(a => a.getAttribute('href')))) assert.ok(href.startsWith('/' + locale + '/'));
      for (const image of await page.locator('img').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0), { message: `Image loads: ${await image.getAttribute('src')}` }).toBe(true);
      }
      if ([390, 1366].includes(width)) await page.screenshot({ path: 'test-results/' + locale + '-home-' + width + '.png', fullPage: true });
    }
    await page.goto(origin + '/' + locale + '/blog/', { waitUntil: 'networkidle' });
    const cards = page.locator('[data-post-id]');
    assert.equal(await cards.count(), indexes[locale].length);
    const input = page.locator('#post-search');
    if (indexes[locale].length) {
      await input.fill(indexes[locale][0].title);
      await expect.poll(() => cards.evaluateAll(nodes => nodes.filter(el => !el.hidden).length)).toBe(1);
      await input.fill('NO_MATCH_SAKURA_12345'); await expect(page.locator('#no-results')).toBeVisible();
      await page.locator('button[type=reset]').click(); await expect(page.locator('#no-results')).toBeHidden();
      await page.locator('#category-filter').selectOption(indexes[locale][0].category);
      await expect.poll(() => cards.evaluateAll(nodes => nodes.filter(el => !el.hidden).length)).toBeGreaterThan(0);
    }
    for (const entry of indexes[locale]) {
      await page.goto(origin + entry.url);
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      await expect(page.locator('h1')).toHaveText(entry.title);
      assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), canonicalOrigin + entry.url);
      const prose = await page.locator('.prose').innerHTML();
      for (const foreign of ['uk', 'en', 'ja'].filter(value => value !== locale)) assert.ok(!new RegExp('lang=["\']' + foreign + '["\']').test(prose));
      for (const link of await page.locator('.post-pagination a, .related .post-card h3 a').evaluateAll(links => links.map(a => a.getAttribute('href')))) assert.ok(link.startsWith('/' + locale + '/'));
      for (const alternate of await page.locator('head link[hreflang]').evaluateAll(links => links.map(a => ({ lang: a.hreflang, href: a.href })))) {
        assert.ok(new URL(alternate.href).pathname.startsWith('/' + alternate.lang + '/'));
        assert.equal(new URL(alternate.href).origin, canonicalOrigin);
        assert.equal((await page.request.get(origin + new URL(alternate.href).pathname)).status(), 200);
      }
    }
    const rss = await (await page.request.get(origin + '/' + locale + '/rss.xml')).text();
    assert.ok(rss.includes('<language>' + locale + '</language>'));
    assert.ok(![...rss.matchAll(/<dc:language>([^<]+)<\/dc:language>/g)].some(match => match[1] !== locale));
    for (const section of ['about', 'writing', 'archive', 'tags', 'diary', 'anime', 'gaming', 'cosplay', 'categories/gothic-kawaii']) assert.equal((await page.request.get(origin + '/' + locale + '/' + section + '/')).status(), 200);
  }
  const story = { uk: 'malyenkyi-svit-de-mozhna-buty-soboiu', en: 'a-little-world-where-you-can-be-yourself', ja: 'jibunrashiku-irareru-chiisana-sekai' };
  await page.goto(origin + '/uk/blog/' + story.uk + '/');
  await page.locator('.language-picker summary').click();
  assert.equal(await page.locator('.language-picker a[data-locale=en]').getAttribute('href'), '/en/blog/' + story.en + '/');
  await page.locator('.language-picker a[data-locale=ja]').click();
  await expect(page).toHaveURL(origin + '/ja/blog/' + story.ja + '/');
  await page.reload(); assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
  await page.goto(origin + '/'); await expect(page).toHaveURL(origin + '/ja/');
  await page.goto(origin + '/uk/'); await page.reload(); assert.equal(await page.locator('html').getAttribute('lang'), 'uk');
  await page.goto(origin + '/uk/blog/my-little-anime-world/');
  assert.equal(await page.locator('.language-picker a[data-locale=en]').getAttribute('href'), '/en/');
  assert.equal(await page.locator('head link[hreflang=en]').count(), 0);
  for (const locale of ['uk', 'en', 'ja']) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const noJs = await context.newPage();
    await noJs.goto(origin + '/' + locale + '/blog/');
    assert.equal(await noJs.locator('[data-post-id]').count(), indexes[locale].length);
    await noJs.locator('.language-picker summary').click();
    await expect(noJs.locator('.language-picker ul')).toBeVisible();
    await noJs.locator('.language-picker a[data-locale=en]').click();
    assert.equal(await noJs.locator('html').getAttribute('lang'), 'en');
    await context.close();
  }
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Blocked storage'); }; Storage.prototype.getItem = () => { throw new Error('Blocked storage'); }; });
  const fallback = await blocked.newPage();
  await fallback.goto(origin + '/ja/'); assert.equal(await fallback.locator('html').getAttribute('lang'), 'ja');
  await blocked.close();
  const redirects = (await readFile('dist/_redirects', 'utf8')).trim().split('\n');
  for (const line of redirects) {
    const [from, to, status] = line.split(' ');
    assert.equal(status, '301'); assert.notEqual(from, to);
    assert.ok(/^\/(uk|en|ja)\//.test(to));
    assert.equal((await page.request.get(origin + to)).status(), 200);
    const legacy = await (await page.request.get(origin + from)).text();
    assert.ok(legacy.includes('data-redirect-target="' + to + '"'));
  }
  assert.equal((await page.request.get(origin + '/definitely-not-a-page/')).status(), 404);
  assert.deepEqual(errors, []);
  console.log('Public browser checks passed: 3 locales × 8 widths, picker keyboard/outside-click, scoped content/search/RSS, translation slugs, missing-translation fallback, persistent language, URL priority, blocked storage, no-JS reading, canonical/hreflang and all legacy redirect targets.');
} finally { await browser.close(); }
