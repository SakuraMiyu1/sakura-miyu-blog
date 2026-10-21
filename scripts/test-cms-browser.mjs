import { chromium, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = process.env.TEST_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const headerFile = await readFile('public/_headers', 'utf8');
  const csp = headerFile.match(/Content-Security-Policy: ([^\r\n]+)/)[1];
  await page.route(origin + '/admin/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'Content-Security-Policy': csp } });
  });
  const errors = [];
  const backupErrors = [];
  const confirmations = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/persistLocalDraftBackup|Failed to persist entry|violates the following Content Security Policy/.test(message.text())) backupErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
  });
  page.on('dialog', async dialog => { confirmations.push(dialog.message()); await dialog.accept(); });
  await page.goto(origin + '/admin/');
  await page.waitForFunction(() => document.querySelector('#setup-status')?.textContent?.includes('not configured') || document.querySelector('#setup-status')?.textContent?.includes('unavailable'));
  assert.equal(await page.evaluate(() => typeof window.CMS), 'undefined', 'No editor is loaded when authentication is disabled');
  for (const width of [375, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  const config = JSON.parse(await readFile('public/admin/config.yml', 'utf8'));
  config.backend = { name: 'test-repo' };
  config.logo_url = origin + '/favicon.png';
  config.collections[0].fields.find(field => field.name === 'language').default = 'en';
  const welcome = await readFile('src/content/blog/welcome.md', 'utf8');
  await page.route('**/api/cms-status', route => route.fulfill({ json: { enabled: true } }));
  await page.route('**/admin/config.yml', route => route.fulfill({ json: config }));
  await page.route('https://api.github.com/**', () => { throw new Error('The local editor test must never call GitHub.'); });
  await page.addInitScript(content => {
    const blog = { 'welcome.md': { content, path: 'src/content/blog/welcome.md' } };
    window.repoFiles = { 'src/content/blog': blog, src: { content: { blog } } };
  }, welcome);
  await page.goto(origin + '/admin/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /login/i }).click();
  for (const width of [375, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Collection list overflow at ${width}px`);
  }
  await page.getByRole('link', { name: /Diary entry/ }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Маленька мрія · A little dream · 小さな夢');
  await page.getByRole('textbox', { name: /^URL slug/ }).fill('qa-cms-dream');
  await page.getByRole('textbox', { name: /^Translation Key/ }).fill('qa-cms-dream');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Українська, English, 日本語 — local editor test.');
  await page.getByLabel('Publication date', { exact: true }).fill('2026-10-17');
  const story = 'A small dream in my diary.\n\nЯ зберегла маленьку мрію.\n\n小さな夢を日記に残します。';
  await page.locator('[contenteditable="true"]').first().fill(story);
  await page.getByRole('button', { name: 'Choose an image', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'qa-ribbon.png', mimeType: 'image/png', buffer: await readFile('public/favicon.png') });
  await page.getByRole('button', { name: /choose selected/i }).click();
  await page.getByRole('textbox', { name: /^Featured image alt text/ }).fill('A pink sakura blossom and black ribbon');
  const featuredImage = page.locator('img[role="presentation"]');
  await expect.poll(() => featuredImage.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  assert.match(await featuredImage.getAttribute('src'), /^blob:/, 'Unpublished media must render from its asset proxy');
  const backup = async () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('localforage');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('keyvaluepairs').objectStore('keyvaluepairs').get('backup.blog');
      read.onsuccess = () => {
        const value = read.result;
        db.close();
        resolve(value ? { raw: value.raw, files: value.mediaFiles.map(media => ({ path: media.path, size: media.file?.size, blob: media.file instanceof Blob })) } : null);
      };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }));
  await expect.poll(async () => (await backup())?.files.some(file => file.blob && file.size > 0 && file.path.endsWith('.webp')), { timeout: 10000 }).toBe(true);
  assert.match((await backup()).raw, /qa-ribbon.webp/);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Маленька мрія · A little dream · 小さな夢');
  assert.ok(confirmations.some(message => /backup/i.test(message)), 'Reload offers to restore the local backup');
  await expect.poll(() => featuredImage.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByLabel('Publication date', { exact: true })).toHaveValue('2026-10-17');
  await expect(page.getByLabel(/^Updated date/)).toHaveValue('');
  for (const width of [375, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Editor overflow at ${width}px`);
    assert.ok(await page.getByRole('textbox', { name: 'Title', exact: true }).isVisible());
    if (width <= 800) {
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: 'Title', exact: true }).isVisible(), false);
      assert.equal(await page.locator('iframe').isVisible(), true);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: 'Title', exact: true }).isVisible(), true);
    }
    await page.screenshot({ path: `test-results/cms-editor-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: /save/i }).first().click();
  await page.waitForFunction(() => !!window.repoFilesUnpublished?.['blog/en--qa-cms-dream']);
  const saved = await page.evaluate(() => window.repoFilesUnpublished['blog/en--qa-cms-dream']);
  assert.equal(saved.diffs[0].path, 'src/content/blog/en--qa-cms-dream.md');
  assert.match(saved.diffs[0].content, /language: en/);
  assert.match(saved.diffs[0].content, /translationKey: qa-cms-dream/);
  assert.match(saved.diffs[0].content, /slug: qa-cms-dream/);
  assert.match(saved.diffs[0].content, /Маленька мрія/);
  assert.match(saved.diffs[0].content, /日本語/);
  assert.match(saved.diffs[0].content, /Я зберегла маленьку мрію/);
  assert.match(saved.diffs[0].content, /小さな夢を日記に残します/);
  assert.ok(saved.diffs.some(file => file.path.startsWith('public/images/blog/')), `Image stored in the configured repository folder: ${JSON.stringify(saved.diffs.map(file => file.path))}`);
  assert.equal(await page.evaluate(() => !!window.repoFiles.src.content.blog['en--qa-cms-dream.md']), false, 'Save draft must not publish');
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Status:/ }).click();
  await page.getByText(/^(Set )?Ready$/i).click();
  await page.waitForFunction(() => window.repoFilesUnpublished['blog/en--qa-cms-dream']?.status === 'pending_publish');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByText('Publish now', { exact: true }).click();
  await page.waitForFunction(() => !!window.repoFiles.src.content.blog['en--qa-cms-dream.md']);
  assert.ok(confirmations.some(message => /publish/i.test(message)), 'Publishing requires confirmation');
  assert.equal(await page.evaluate(() => !!window.repoFilesUnpublished['blog/en--qa-cms-dream']), false, 'Publishing removes the workflow draft');
  for (const width of [375, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Saved entry overflow at ${width}px`);
  }
  const previousConfirmations = confirmations.length;
  await page.getByRole('button', { name: /^Delete/ }).click();
  await page.waitForFunction(() => !window.repoFiles.src.content.blog['en--qa-cms-dream.md']);
  assert.ok(confirmations.length > previousConfirmations, 'Deleting an entry requires confirmation');
  assert.equal(await page.evaluate(() => window.repoFiles.src.content.blog['welcome.md'].content), welcome, 'Existing diary is untouched');
  assert.deepEqual(errors, []);
  assert.deepEqual(backupErrors, []);
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  console.log('CMS browser checks passed with production CSP: disabled sign-in, editor at 375/390/430/768/1366px, Edit/Preview, Unicode text, visible WebP preview, Blob backup in IndexedDB, reload and restore with image/date values, correct repository paths, save draft and publish using only an in-memory test backend. No CSP violations or backup errors. Live GitHub login and publishing are not tested by this script.');
} catch (error) {
  console.error('Original CMS test failure:', error);
  const pages = browser.contexts().flatMap(context => context.pages());
  for (const page of pages) {
    try {
    console.error('Memory workflow entries:', JSON.stringify(await page.evaluate(() => Object.entries(window.repoFilesUnpublished || {}).map(([key, value]) => ({ key, diffs: value.diffs?.map(file => ({ path: file.path, content: typeof file.content === 'string' ? file.content.slice(0, 500) : '[asset]' })) })))));
    console.error((await page.locator('body').innerText()).slice(0, 6000));
    console.error(await page.locator('input,textarea,label').evaluateAll(elements => elements.slice(0, 15).map(element => ({ tag: element.tagName, id: element.id, for: element.getAttribute('for'), label: element.textContent.slice(0, 60) }))));
    console.error(await page.locator('body *').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(element).display !== 'none').slice(0, 16).map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width, right: element.getBoundingClientRect().right }))));
    await page.screenshot({ path: 'test-results/cms-failure.png', fullPage: true });
    } catch (diagnosticError) { console.error('Diagnostic unavailable:', diagnosticError.message); }
  }
  throw error;
} finally { await browser.close(); }
