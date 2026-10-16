import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
const origin = process.env.TEST_URL || 'http://127.0.0.1:4321';
const errors = [];
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  for (const [width, height] of [[1920, 1080], [1366, 900], [1024, 900], [768, 1024], [430, 900], [390, 844], [375, 812], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await page.title(), "Sakura Miyu's Little World");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Horizontal overflow at ${width}px`);
    assert.equal(await page.locator('h1').count(), 1, 'One main heading per page');
    assert.equal(await page.locator('.sidebar .topic-list').count(), 0, 'The full category list is not duplicated in the sidebar');
    assert.equal(await page.locator('.category-grid a').count(), 9, 'All original category links remain available');
    if (width <= 768) assert.equal(await page.locator('.content-grid').evaluate(grid => grid.querySelector('.sidebar').getBoundingClientRect().top >= grid.querySelector('.main-column').getBoundingClientRect().bottom - 1), true, 'Sidebar follows the main content');
    assert.equal(await page.locator('.skip-link').evaluate(link => link.getBoundingClientRect().right < 0), true, 'Skip link remains offscreen until keyboard focused');
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)), [], `Broken images at ${width}px`);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    if (width < 600) {
      assert.equal(await page.locator('.sidebar').evaluate(aside => [...aside.children].every(child => Math.abs(child.getBoundingClientRect().width - aside.getBoundingClientRect().width) < 2)), true, 'Mobile sidebar cards use the available width');
      assert.equal(await page.locator('#main-nav').isVisible(), false);
      await page.locator('.menu-toggle').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#main-nav').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#main-nav').isVisible(), false);
      assert.equal(await page.locator('.menu-toggle').evaluate(button => button === document.activeElement), true);
      await page.locator('.menu-toggle').click();
      await page.locator('h1').click();
      assert.equal(await page.locator('#main-nav').isVisible(), false, 'Outside click closes the mobile menu');
    }
    for (const route of ['/blog/', '/blog/welcome/']) {
      await page.goto(origin + route, { waitUntil: 'networkidle' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route} overflow at ${width}px`);
      assert.equal(await page.locator('h1').count(), 1);
      if (route === '/blog/welcome/') assert.equal(await page.locator('.language-nav a').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44)), true, 'Language links are easy to tap');
    }
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${origin}/blog/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#search-status')?.textContent?.includes('found'));
  await page.locator('#post-search').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#post-search').evaluate(input => input === document.activeElement), true, 'Escape does not steal focus when the menu is closed');
  for (const word of ['Луїзою', 'ルイズ', 'Computer Science', 'anime']) {
    await page.locator('#post-search').fill(word);
    assert.equal(await page.locator('[data-post-id]:visible').count(), 1, `Full content search: ${word}`);
  }
  await page.locator('#post-search').fill('a-word-that-does-not-exist-5678');
  assert.equal(await page.locator('#no-results').isVisible(), true);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  assert.equal(await page.locator('[data-post-id]:visible').count(), 1);
  await page.locator('#category-filter').selectOption('Cosplay');
  assert.equal(await page.locator('#no-results').isVisible(), true);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.locator('#tag-filter').selectOption('Anime');
  assert.equal(await page.locator('[data-post-id]:visible').count(), 1);
  await page.goto(`${origin}/blog/?q=ルイズ&tag=Anime`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#search-status')?.textContent?.includes('found'));
  assert.equal(await page.locator('[data-post-id]:visible').count(), 1);
  await page.goto(`${origin}/blog/welcome/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.language-nav a').count(), 3);
  await page.getByRole('link', { name: '🇯🇵 日本語', exact: true }).click();
  assert.equal(new URL(page.url()).hash, '#japanese');
  assert.equal(await page.locator('#japanese').isVisible(), true);
  assert.equal(await page.locator('.post-pagination').count(), 0);
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  assert.equal(schema.author.name, 'Sakura Miyu');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await page.waitForFunction(() => !!document.querySelector('.share .copy-status')?.textContent);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'A mixed-language page keeps the interface language');
  assert.equal(await page.locator('#ukrainian').evaluate(heading => heading.closest('section').lang), 'uk');
  assert.equal(await page.locator('#japanese').evaluate(heading => heading.closest('section').lang), 'ja');
  const fallbackContext = await browser.newContext();
  await fallbackContext.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Clipboard denied for QA')) } }));
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(origin + '/blog/welcome/');
  for (const [selector, expected] of [['.share', 'https://sakura-miyu-blog.pages.dev/blog/welcome/'], ['.follow-sidebar', 'https://sakura-miyu-blog.pages.dev/']]) {
    await fallbackPage.locator(`${selector} .copy-button`).click();
    const input = fallbackPage.locator(`${selector} .copy-fallback`);
    assert.equal(await input.isVisible(), true);
    assert.equal(await input.inputValue(), expected);
    assert.equal(await input.evaluate(element => document.activeElement === element && element.selectionEnd === element.value.length), true);
  }
  await fallbackContext.close();
  for (const route of ['/rss.xml', '/sitemap-index.xml', '/sitemap-0.xml', '/sitemap.xml']) {
    const response = await page.request.get(origin + route);
    assert.equal(response.status(), 200);
    const xml = await response.text();
    assert.equal(await page.evaluate(source => new DOMParser().parseFromString(source, 'application/xml').querySelector('parsererror') === null, xml), true, `Valid XML: ${route}`);
    if (route === '/rss.xml') {
      const languages = await page.evaluate(source => [...new DOMParser().parseFromString(source, 'application/xml').getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'language')].map(element => element.textContent), xml);
      assert.deepEqual(languages, ['uk', 'en', 'ja']);
    }
  }
  const missing = await page.goto(origin + '/qa-this-page-does-not-exist/');
  assert.equal(missing.status(), 404);
  assert.match(await page.locator('h1').textContent(), /little dream got lost/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/blog/', '/blog/welcome/', '/writing/', '/about/', '/archive/', '/tags/', '/tags/anime/', '/categories/gothic-kawaii/']) {
    const response = await page.goto(origin + route, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, route);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow: ${route}`);
    await page.screenshot({ path: `test-results/${route.split('/').filter(Boolean).join('-') || 'home'}-mobile.png`, fullPage: true });
  }
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1366, height: 900 } });
  const noJs = await context.newPage();
  await noJs.goto(`${origin}/blog/`);
  assert.equal(await noJs.locator('.post-card :is(h2,h3) a').count(), 1, 'Posts remain visible without JavaScript');
  await noJs.setViewportSize({ width: 390, height: 844 });
  assert.equal(await noJs.locator('#main-nav').isVisible(), true, 'Mobile navigation remains available without JavaScript');
  await context.close();
  assert.deepEqual(errors, [], 'Browser console exceptions');
  console.log('Browser checks passed: eight viewport sizes, keyboard and outside-click navigation, images, multilingual full-text search, filters, sharing, anchors, routes, SEO, and no-JS reading.');
} finally { await browser.close(); }
