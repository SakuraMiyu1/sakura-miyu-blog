import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

let server;
const origin = process.env.TEST_URL || 'http://127.0.0.1:4396';
if (!process.env.TEST_URL) {
  server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--outDir', path.resolve('dist'), '--host', '127.0.0.1', '--port', '4396'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NODE_DISABLE_COMPILE_CACHE: '1' }
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Preview startup timeout: ' + output)), 90000);
    server.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes(origin)) { clearTimeout(timeout); resolve(); }
    });
    server.stderr.on('data', chunk => { output += chunk; });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited with ${code}: ${output}`)); });
  });
}
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
const source = await readFile('public/favicon.png');
const uploads = {
  png: { name: 'qa-comic-cover.png', mimeType: 'image/png', buffer: source },
  jpg: { name: 'qa-comic-social.jpg', mimeType: 'image/jpeg', buffer: await sharp(source).jpeg().toBuffer() },
  webp: { name: 'qa-comic-page.webp', mimeType: 'image/webp', buffer: await sharp(source).webp().toBuffer() },
  avif: { name: 'qa-comic-issue-cover.avif', mimeType: 'image/avif', buffer: await sharp(source).avif().toBuffer() }
};

async function chooseImage(page, button, upload) {
  await button.click();
  await page.locator('input[type=file]').setInputFiles(upload);
  await page.getByRole('button', { name: /choose selected/i }).click();
}

async function fillLanguage(page, label, occurrence, locale, value) {
  const list = page.getByRole('tablist', { name: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' language$', 'i') }).nth(occurrence);
  const tab = list.getByRole('tab', { name: new RegExp(locale, 'i') });
  const panelId = await tab.getAttribute('aria-controls');
  await tab.click();
  await page.locator('#' + panelId).getByRole('textbox').fill(value);
}

await mkdir('test-results/comics', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const config = JSON.parse(await readFile('public/admin/config.yml', 'utf8'));
  const comicsCollection = JSON.parse(await readFile('public/admin/comics-collection.json', 'utf8'));
  config.backend = { name: 'test-repo' };
  config.logo_url = origin + '/favicon.png';
  await page.route('**/api/cms-status', route => route.fulfill({ json: { enabled: true } }));
  await page.route('**/admin/config.yml', route => route.fulfill({ json: config }));
  await page.route('**/admin/comics-collection.json', route => route.fulfill({ json: comicsCollection }));
  await page.route('https://api.github.com/**', () => { throw new Error('The local Comics CMS test must never call GitHub.'); });
  await page.addInitScript(() => { window.repoFiles = { src: { data: { comics: {} } } }; });
  await page.goto(origin + '/admin/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /login/i }).click();
  await page.goto(origin + '/admin/#/collections/comics/new', { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: /^Comic ID/ }).fill('qa-comic-cms');
  await page.getByRole('textbox', { name: /^URL slug/ }).first().fill('qa-comic-cms');
  for (const [locale, title, description, alt] of [
    ['Українська', 'Тестовий комікс', 'Український опис.', 'Тестова обкладинка'],
    ['English', 'Test comic', 'English description.', 'Test cover'],
    ['日本語', 'テストコミック', '日本語の説明。', 'テスト表紙']
  ]) {
    await fillLanguage(page, 'Titles · Назви · タイトル', 0, locale, title);
    await fillLanguage(page, 'Descriptions · Описи · 説明', 0, locale, description);
    await fillLanguage(page, 'Alternative text', 0, locale, alt);
  }
  await chooseImage(page, page.getByRole('button', { name: 'Choose an image', exact: true }).first(), uploads.png);
  await chooseImage(page, page.getByRole('button', { name: 'Choose an image', exact: true }).first(), uploads.jpg);
  await page.getByRole('button', { name: /Add issues/ }).click();
  while (await page.getByRole('textbox', { name: /^Issue ID/ }).count() === 0) await page.getByRole('button', { name: 'Expand' }).last().click();
  await page.getByRole('textbox', { name: /^Issue ID/ }).last().fill('issue-01');
  await page.getByRole('textbox', { name: /^URL slug/ }).last().fill('issue-01');
  await page.getByRole('spinbutton', { name: /^Issue number/ }).last().fill('1');
  for (const [locale, title] of [['Українська', 'Випуск 1'], ['English', 'Issue 1'], ['日本語', '第1話']]) await fillLanguage(page, 'Titles · Назви · タイトル', 1, locale, title);
  const pagesTabs = page.getByRole('tablist', { name: /^Pages .* language$/i });
  await pagesTabs.getByRole('tab', { name: /Українська/ }).click();
  await page.getByRole('button', { name: /Add українська/i }).click();
  await page.getByRole('button', { name: /Add українська/i }).click();
  const pageIds = page.getByRole('textbox', { name: /^Page ID/ });
  await pageIds.nth(0).fill('page-01');
  await pageIds.nth(1).fill('cover');
  const kinds = page.getByRole('combobox', { name: /^Kind/ });
  await kinds.nth(0).click();
  await page.getByRole('option', { name: 'Page', exact: true }).click();
  await kinds.nth(1).click();
  await page.getByRole('option', { name: 'Cover', exact: true }).click();
  const alternatives = page.getByRole('textbox', { name: /^Alternative text/ });
  await alternatives.nth(alternatives.count ? (await alternatives.count()) - 2 : 0).fill('Перша сторінка тестового випуску');
  await alternatives.last().fill('Обкладинка тестового випуску');
  const pageImageButtons = page.getByRole('button', { name: 'Choose an image', exact: true });
  await chooseImage(page, pageImageButtons.nth((await pageImageButtons.count()) - 2), uploads.webp);
  await chooseImage(page, page.getByRole('button', { name: 'Choose an image', exact: true }).last(), uploads.avif);
  const pageItem = index => pageIds.nth(index).locator('xpath=ancestor::div[.//*[@role="button" and @aria-roledescription="sortable"]][1]');
  const firstHandle = pageItem(0).locator('[role=button][aria-roledescription=sortable]').first();
  const secondHandle = pageItem(1).locator('[role=button][aria-roledescription=sortable]').first();
  await expect(firstHandle).toBeVisible();
  await expect(secondHandle).toBeVisible();
  const from = await secondHandle.boundingBox();
  const to = await firstHandle.boundingBox();
  assert.ok(from && to, 'Page drag handles are visible');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 12, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 20 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await expect(pageIds.nth(0)).toHaveValue('cover');
  await expect(pageIds.nth(1)).toHaveValue('page-01');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const frame = page.locator('iframe').contentFrame();
  await expect(frame.getByText('Sakura Miyu Comics', { exact: false }).first()).toBeVisible();
  await expect(frame.getByText('Тестовий комікс', { exact: true })).toBeVisible();
  await expect(frame.getByText('Test comic', { exact: true })).toBeVisible();
  await expect(frame.getByText('テストコミック', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() => !!window.repoFilesUnpublished?.['comics/qa-comic-cms']);
  const saved = await page.evaluate(() => window.repoFilesUnpublished['comics/qa-comic-cms']);
  const json = saved.diffs.find(file => file.path === 'src/data/comics/qa-comic-cms.json');
  assert.ok(json, 'One comic JSON is saved');
  const data = JSON.parse(json.content);
  assert.equal(data.publicationStatus, 'draft');
  assert.equal(data.approved, false);
  assert.deepEqual(data.chapters[0].pages.uk.map(item => item.id), ['cover', 'page-01']);
  const media = saved.diffs.filter(file => file.path.startsWith('src/content/comics-media/'));
  assert.ok(media.length >= 4, `PNG, JPG, WebP and AVIF uploads are processed into repository media: ${JSON.stringify(saved.diffs.map(file => file.path))}`);
  assert.ok(media.every(file => /\.(?:webp|avif)$/i.test(file.path)), 'Browser processing stores optimized WebP or AVIF reader copies');
  assert.ok(saved.diffs.every(file => !file.path.startsWith('public/images/comics/')), 'Draft images never enter the public comics directory');
  assert.equal(await page.getByRole('button', { name: 'Delete', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'test-results/comics/cms-draft-mobile.png', fullPage: true });
  console.log('Comics CMS checks passed: one multilingual draft, PNG/JPG/WebP/AVIF optimization, source-gated media, issue page drag order, live preview, 0 publication flags and no GitHub calls.');
} finally {
  await browser.close();
  if (server?.exitCode === null) {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await stopped;
  }
}
