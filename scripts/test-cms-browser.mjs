import { chromium, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = process.env.TEST_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
const languageNames = { uk: '🇺🇦 Українська (UA)', en: '🇬🇧 English (EN)', ja: '🇯🇵 日本語 (JP)' };
const translations = {
  uk: { title: 'Маленька мрія', slug: 'qa-cms-dream', description: 'Я зберегла маленьку мрію у щоденнику.', imageAlt: 'Рожева сакура з чорним бантом', seoTitle: 'Маленька мрія — Sakura Miyu', seoDescription: 'Українська історія про маленьку мрію.', body: 'Я зберегла маленьку мрію.\n\nМагія живе у щоденнику.' },
  en: { title: 'A little dream', slug: 'qa-cms-dream', description: 'A small dream in my diary.', imageAlt: 'A pink sakura blossom and black ribbon', seoTitle: 'A little dream — Sakura Miyu', seoDescription: 'An English story about a little dream.', body: 'A small dream in my diary.\n\nA little magic stays with me.' },
  ja: { title: '小さな夢', slug: 'qa-cms-dream', description: '小さな夢を日記に残します。', imageAlt: '黒いリボンとピンクの桜', seoTitle: '小さな夢 — Sakura Miyu', seoDescription: '小さな夢についての日本語のお話。', body: '小さな夢を日記に残します。\n\n小さな魔法をそばに。' },
};
const selectLanguage = async (page, locale) => {
  await page.getByRole('tab', { name: languageNames[locale], exact: true }).click();
  return page.getByRole('tabpanel');
};
const fillTranslation = async (page, locale, values) => {
  const panel = await selectLanguage(page, locale);
  for (const [field, label] of Object.entries({ title: 'Title', slug: 'URL slug', description: 'Description', imageAlt: 'Featured image alt text', seoTitle: 'SEO title', seoDescription: 'SEO description' })) {
    await panel.getByRole('textbox', { name: new RegExp('^' + label + '(?: |$)') }).fill(values[field]);
  }
  await panel.locator('[contenteditable="true"]').first().fill(values.body);
};
const assertTranslations = actual => {
  assert.deepEqual(Object.keys(actual.translations).sort(), ['en', 'ja', 'uk']);
  for (const [locale, expected] of Object.entries(translations)) {
    for (const [field, value] of Object.entries(expected)) assert.equal(actual.translations[locale][field], value, `${locale}.${field}`);
    assert.equal(Object.hasOwn(actual.translations[locale], 'tags'), false, 'Missing language tags must inherit shared tags');
  }
  assert.equal(actual.translationKey, 'qa-cms-dream');
  assert.equal(actual.pubDate, '2026-10-17');
  assert.equal(Object.hasOwn(actual, 'language'), false);
  assert.equal(Object.hasOwn(actual, 'title'), false);
  assert.equal(Object.hasOwn(actual, 'body'), false);
};
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);
  const headerFile = await readFile('public/_headers', 'utf8');
  const csp = headerFile.match(/Content-Security-Policy: ([^\r\n]+)/)[1];
  await page.route(origin + '/admin/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'Content-Security-Policy': csp } });
  });
  const errors = [];
  const backupErrors = [];
  const confirmations = [];
  let restoreBackup = true;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/persistLocalDraftBackup|Failed to persist entry|violates the following Content Security Policy/.test(message.text())) backupErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
  });
  page.on('dialog', async dialog => { confirmations.push(dialog.message()); if (!restoreBackup && /backup/i.test(dialog.message())) await dialog.dismiss(); else await dialog.accept(); });
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
  const welcome = await readFile('src/content/articles/welcome.json', 'utf8');
  await page.route('**/api/cms-status', route => route.fulfill({ json: { enabled: true } }));
  await page.route('**/admin/config.yml', route => route.fulfill({ json: config }));
  await page.route('https://api.github.com/**', () => { throw new Error('The local editor test must never call GitHub.'); });
  await page.addInitScript(content => {
    const articles = { 'welcome.json': { content, path: 'src/content/articles/welcome.json' } };
    window.repoFiles = { 'src/content/articles': articles, src: { content: { articles } } };
  }, welcome);
  await page.goto(origin + '/admin/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /login/i }).click();
  for (const width of [375, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Collection list overflow at ${width}px`);
  }
  await page.getByRole('link', { name: /Article$/ }).click();
  await page.getByRole('textbox', { name: /^Article ID/ }).fill('qa-cms-dream');
  await page.getByLabel('Publication date', { exact: true }).fill('2026-10-17');
  for (const [locale, values] of Object.entries(translations)) await fillTranslation(page, locale, values);
  await selectLanguage(page, 'uk');
  await page.getByRole('button', { name: 'Choose an image', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'qa-ribbon.png', mimeType: 'image/png', buffer: await readFile('public/favicon.png') });
  await page.getByRole('button', { name: /choose selected/i }).click();
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
  assertTranslations(JSON.parse((await backup()).raw));
  await page.reload({ waitUntil: 'networkidle' });
  await expect((await selectLanguage(page, 'uk')).getByRole('textbox', { name: /^Title(?: |$)/ })).toHaveValue(translations.uk.title);
  assert.ok(confirmations.some(message => /backup/i.test(message)), 'Reload offers to restore the local backup');
  await expect.poll(() => featuredImage.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByLabel('Publication date', { exact: true })).toHaveValue('2026-10-17');
  await expect(page.getByLabel(/^Updated date/)).toHaveValue('');
  for (const [locale, values] of Object.entries(translations)) {
    const panel = await selectLanguage(page, locale);
    await expect(panel.getByRole('textbox', { name: /^Title(?: |$)/ })).toHaveValue(values.title);
    await expect(panel.locator('[contenteditable="true"]').first()).toHaveText(values.body);
  }
  await selectLanguage(page, 'uk');
  for (const width of [375, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Editor overflow at ${width}px`);
    assert.ok(await page.getByRole('tabpanel').getByRole('textbox', { name: /^Title(?: |$)/ }).isVisible());
    if (width <= 800) {
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: /^Title(?: |$)/ }).first().isVisible(), false);
      assert.equal(await page.locator('iframe').isVisible(), true);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      assert.equal(await page.getByRole('tabpanel').getByRole('textbox', { name: /^Title(?: |$)/ }).isVisible(), true);
    }
    await page.screenshot({ path: `test-results/cms-editor-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: /save/i }).first().click();
  await page.waitForFunction(() => !!window.repoFilesUnpublished?.['blog/qa-cms-dream']);
  await page.waitForURL(/#\/collections\/blog\/entries\/qa-cms-dream$/);
  const saved = await page.evaluate(() => window.repoFilesUnpublished['blog/qa-cms-dream']);
  const articleDiffs = saved.diffs.filter(file => file.path.endsWith('.json'));
  assert.equal(articleDiffs.length, 1, 'One Save creates exactly one article JSON');
  assert.equal(articleDiffs[0].path, 'src/content/articles/qa-cms-dream.json');
  assertTranslations(JSON.parse(articleDiffs[0].content));
  assert.ok(saved.diffs.some(file => file.path.startsWith('public/images/blog/')), 'Image stored in the configured repository folder');
  assert.equal(await page.evaluate(() => !!window.repoFiles.src.content.articles['qa-cms-dream.json']), false, 'Save draft must not publish');
  assert.equal(await page.evaluate(() => Object.keys(window.repoFilesUnpublished).filter(key => key.startsWith('blog/')).length), 1);
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Status:/ }).click();
  await page.getByText(/^(Set )?Ready$/i).click();
  await page.waitForFunction(() => window.repoFilesUnpublished['blog/qa-cms-dream']?.status === 'pending_publish');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByText('Publish now', { exact: true }).click();
  await page.waitForFunction(() => !!window.repoFiles.src.content.articles['qa-cms-dream.json']);
  assert.ok(confirmations.some(message => /publish/i.test(message)), 'Publishing requires confirmation');
  assert.equal(await page.evaluate(() => !!window.repoFilesUnpublished['blog/qa-cms-dream']), false);
  assertTranslations(JSON.parse(await page.evaluate(() => window.repoFiles.src.content.articles['qa-cms-dream.json'].content)));
  assert.equal(await page.getByRole('button', { name: /^Delete/ }).count(), 0, 'Published article deletion is disabled');
  for (const width of [375, 390, 430, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Saved entry overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  assert.equal(await page.evaluate(() => window.repoFiles.src.content.articles['welcome.json'].content), welcome);
  restoreBackup = false;
  await page.goto('about:blank');
  await page.goto(origin + '/admin/#/collections/blog/entries/welcome', { waitUntil: 'networkidle' });
  await expect(page.getByRole('textbox', { name: /^Article ID/ })).toHaveValue('welcome');
  await expect((await selectLanguage(page, 'uk')).getByRole('textbox', { name: /^Title(?: |$)/ })).toHaveValue(JSON.parse(welcome).translations.uk.title);
  await page.getByLabel(/^Updated date/).fill('2026-10-28');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() => !!window.repoFilesUnpublished?.['blog/welcome']);
  const welcomeDraft = await page.evaluate(() => window.repoFilesUnpublished['blog/welcome']);
  const welcomeJSON = welcomeDraft.diffs.find(file => file.path === 'src/content/articles/welcome.json');
  assert.deepEqual(JSON.parse(welcomeJSON.content), { ...JSON.parse(welcome), updatedDate: '2026-10-28' }, 'Changing only the shared updated date preserves every other field and inherited tags');
  for (const locale of Object.keys(JSON.parse(welcome).translations)) assert.equal(Object.hasOwn(JSON.parse(welcomeJSON.content).translations[locale], 'tags'), false);
  assert.equal(await readFile('src/content/articles/welcome.json', 'utf8'), welcome, 'Local migrated source is untouched');
  assert.deepEqual(errors, []);
  assert.deepEqual(backupErrors, []);
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  console.log('CMS browser checks passed with production CSP: one article / three translation tabs, every language field, Unicode content, WebP Blob backup and restore, responsive Edit/Preview, one JSON draft and one Publish, inherited-tag semantic round-trip for migrated welcome, deletion disabled. No CSP violations or backup errors. Only an in-memory backend was used.');
} catch (error) {
  console.error('Original CMS test failure:', error);
  const pages = browser.contexts().flatMap(context => context.pages());
  for (const page of pages) {
    try {
      console.error('Memory workflow entries:', JSON.stringify(await page.evaluate(() => Object.entries(window.repoFilesUnpublished || {}).map(([key, value]) => ({ key, diffs: value.diffs?.map(file => ({ path: file.path, content: typeof file.content === 'string' ? file.content.slice(0, 500) : '[asset]' })) })))));
      console.error((await page.locator('body').innerText()).slice(0, 6000));
      await page.screenshot({ path: 'test-results/cms-failure.png', fullPage: true });
    } catch (diagnosticError) { console.error('Diagnostic unavailable:', diagnosticError.message); }
  }
  throw error;
} finally { await browser.close(); }
