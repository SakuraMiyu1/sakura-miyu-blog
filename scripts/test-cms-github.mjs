import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const languageNames = { uk: '🇺🇦 Українська (UA)', en: '🇬🇧 English (EN)', ja: '🇯🇵 日本語 (JP)' };
const translations = {
  uk: { title: 'Чернетка GitHub', slug: 'qa-github-draft', description: 'Українська історія з маленькою мрією.', imageAlt: 'Рожева сакура', seoTitle: 'Чернетка GitHub — Sakura Miyu', seoDescription: 'Українська перевірка чернетки.', body: 'Я зберегла маленьку мрію у щоденнику.' },
  en: { title: 'GitHub workflow fixture', slug: 'qa-github-draft', description: 'A draft image and date regression check.', imageAlt: 'A sakura blossom', seoTitle: 'GitHub draft — Sakura Miyu', seoDescription: 'An English draft regression check.', body: 'An English diary draft with a sakura blossom.' },
  ja: { title: 'GitHubの下書き', slug: 'qa-github-draft', description: '小さな夢についての下書き。', imageAlt: '桜の花', seoTitle: 'GitHubの下書き — Sakura Miyu', seoDescription: '日本語の下書きの確認。', body: '小さな夢を日記に残します。' },
};
const selectLanguage = async (page, locale) => {
  await page.getByRole('tab', { name: languageNames[locale], exact: true }).click();
  return page.getByRole('tabpanel');
};
const assertDraft = (draft, updated = false) => {
  assert.deepEqual(Object.keys(draft.translations).sort(), ['en', 'ja', 'uk']);
  for (const [locale, values] of Object.entries(translations)) {
    for (const [field, value] of Object.entries(values)) assert.equal(draft.translations[locale][field], updated && locale === 'en' && field === 'description' ? 'Updated GitHub draft.' : value, `${locale}.${field}`);
    assert.equal(Object.hasOwn(draft.translations[locale], 'tags'), false, 'Inherited tags stay absent');
  }
  assert.equal(draft.translationKey, 'qa-github-draft');
  assert.equal(Object.hasOwn(draft, 'language'), false);
  assert.equal(Object.hasOwn(draft, 'title'), false);
  assert.equal(Object.hasOwn(draft, 'body'), false);
};

const origin = process.env.TEST_URL || 'http://127.0.0.1:4321';
const config = JSON.parse(await readFile('public/admin/config.yml', 'utf8'));
config.backend.base_url = origin;
config.logo_url = origin + '/favicon.png';
const csp = (await readFile('public/_headers', 'utf8')).match(/Content-Security-Policy: ([^\r\n]+)/)[1];
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
const blobs = new Map();
const commits = new Map();
const trees = new Map();
const branches = new Map();
const pullRequests = [];
const calls = [];
const errors = [];
const putBlob = buffer => {
  const sha = createHash('sha1').update(buffer).digest('hex');
  blobs.set(sha, Buffer.from(buffer));
  return sha;
};
const welcome = await readFile('src/content/articles/welcome.json');
const legacyWelcome = await readFile('src/content/blog/welcome.md');
const mainFiles = { 'src/content/articles/welcome.json': putBlob(welcome) };
const mainSha = 'a'.repeat(40);
commits.set(mainSha, { sha: mainSha, files: mainFiles, parents: [], commit: { message: 'Fixture main' } });
branches.set('main', mainSha);
let sequence = 1;
const id = () => (sequence++).toString(16).padStart(40, '0');
const head = ref => branches.get(ref.replace(/^SakuraMiyu1:/, '')) || ref;
const prData = pr => ({ ...pr, head: { ...pr.head, sha: branches.get(pr.head.ref) } });
try {
  const context = await browser.newContext();
  await context.route(origin + '/api/auth**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Mock OAuth popup</title>' }));
  await context.route(origin + '/admin/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  await context.route('**/api/cms-status', route => route.fulfill({ json: { enabled: true } }));
  await context.route('**/admin/config.yml', route => route.fulfill({ json: config }));
  await context.route('https://api.github.com/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const fullPath = decodeURIComponent(url.pathname);
    const path = fullPath.replace('/repos/SakuraMiyu1/sakura-miyu-blog', '');
    const method = request.method();
    const body = request.postDataJSON();
    calls.push({ method, path });
    let result;
    if (fullPath === '/user' || fullPath === '/users/SakuraMiyu1') result = { login: 'SakuraMiyu1', name: 'Sakura Miyu' };
    else if (path === '') result = { owner: { login: 'SakuraMiyu1' }, permissions: { push: true }, private: false, default_branch: 'main' };
    else if (path.startsWith('/git/blobs/')) {
      const bytes = blobs.get(path.slice('/git/blobs/'.length));
      assert.ok(bytes, `Known blob: ${path}`);
      result = { content: bytes.toString('base64'), encoding: 'base64', size: bytes.length };
    } else if (path === '/git/blobs' && method === 'POST') result = { sha: putBlob(Buffer.from(body.content, 'base64')) };
    else if (path.startsWith('/git/trees/') && method === 'GET') {
      const ref = path.slice('/git/trees/'.length);
      const colon = ref.indexOf(':');
      const commit = commits.get(head(colon < 0 ? ref : ref.slice(0, colon)));
      const folder = colon < 0 ? '' : ref.slice(colon + 1);
      const prefix = folder ? folder + '/' : '';
      result = { tree: Object.entries(commit.files).filter(([name]) => name.startsWith(prefix)).map(([name, sha]) => ({ path: name.slice(prefix.length), sha, type: 'blob', size: blobs.get(sha).length, mode: '100644' })) };
    } else if (path === '/git/trees' && method === 'POST') {
      const sha = id();
      const files = { ...(commits.get(head(body.base_tree))?.files || {}) };
      for (const item of body.tree) { if (item.sha === null) delete files[item.path]; else files[item.path] = item.sha; }
      trees.set(sha, files);
      result = { sha };
    } else if (path === '/git/commits' && method === 'POST') {
      const sha = id();
      result = { sha, files: trees.get(body.tree), parents: body.parents.map(sha => ({ sha })), commit: { message: body.message } };
      commits.set(sha, result);
    } else if (path.startsWith('/branches/')) {
      const name = path.slice('/branches/'.length);
      assert.ok(branches.has(name));
      result = { name, commit: { sha: branches.get(name) } };
    } else if (path === '/git/refs' && method === 'POST') {
      const name = body.ref.replace('refs/heads/', '');
      branches.set(name, body.sha);
      result = { ref: body.ref, object: { sha: body.sha } };
    } else if (path.startsWith('/git/refs/heads/') && method === 'PATCH') {
      const name = path.slice('/git/refs/heads/'.length);
      assert.ok(name.startsWith('cms/'), 'Draft updates must never change main');
      branches.set(name, body.sha);
      result = { object: { sha: body.sha } };
    } else if (path.startsWith('/compare/')) {
      const [from, to] = path.slice('/compare/'.length).split('...').map(head);
      const base = commits.get(from);
      const tip = commits.get(to);
      const history = [];
      let commit = tip;
      while (commit && commit.sha !== from) { history.unshift(commit); commit = commits.get(commit.parents[0]?.sha); }
      result = { base_commit: base, commits: history, files: Object.entries(tip.files).filter(([name, sha]) => sha !== base.files[name]).map(([filename, sha]) => ({ filename, sha, status: base.files[filename] ? 'modified' : 'added', ...(filename.endsWith('.json') ? { patch: 'fixture article diff' } : {}) })) };
    } else if (path === '/pulls' && method === 'POST') {
      result = { number: pullRequests.length + 1, state: 'open', labels: [], updated_at: '2026-10-17T12:00:00Z', user: { login: 'SakuraMiyu1' }, head: { ref: body.head.replace('SakuraMiyu1:', ''), sha: head(body.head) }, base: { ref: 'main', sha: mainSha } };
      pullRequests.push(result);
    } else if (path === '/pulls') {
      const filter = url.searchParams.get('head')?.replace('SakuraMiyu1:', '');
      result = pullRequests.filter(pr => !filter || pr.head.ref === filter).map(prData);
    } else if (/^\/issues\/\d+\/labels$/.test(path) && method === 'PUT') {
      const pr = pullRequests[Number(path.split('/')[2]) - 1];
      pr.labels = body.labels.map(name => ({ name }));
      result = pr.labels;
    } else if (path === '/labels' && method === 'POST') result = { name: body.name };
    else if (path === '/issues' || path === '/labels' || path === '/commits' || /^\/pulls\/\d+\/commits$/.test(path)) result = [];
    else if (/^\/commits\/[^/]+\/status$/.test(path)) result = { statuses: [] };
    else throw new Error(`Unmocked GitHub endpoint: ${method} ${path}`);
    await route.fulfill({ json: result });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/persistLocalDraftBackup|Failed to persist entry|Content Security Policy/.test(message.text())) errors.push(message.text());
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto(origin + '/admin/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /login/i }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.evaluate(origin => {
    window.qaHandshake = false;
    addEventListener('message', event => { if (event.data === 'authorizing:github') window.qaHandshake = true; });
    opener.postMessage('authorizing:github', origin);
  }, origin);
  await popup.waitForFunction(() => window.qaHandshake);
  await popup.evaluate(origin => opener.postMessage({ unrelated: 'object message' }, origin), origin);
  await page.evaluate(origin => window.postMessage('authorization:github:success:{"token":"WRONG_WINDOW"}', origin), origin);
  const closed = popup.waitForEvent('close');
  await popup.evaluate(origin => opener.postMessage('authorization:github:success:{"token":"QA_FAKE_TOKEN","provider":"github"}', origin), origin);
  await closed;
  await page.getByRole('link').filter({ hasText: /welcome/ }).first().waitFor();
  assert.ok(!errors.some(error => /indexOf/.test(error)));
  await page.getByRole('link', { name: /Article$/ }).click();
  await page.getByRole('textbox', { name: /^Article ID/ }).fill('qa-github-draft');
  await page.getByLabel('Publication date', { exact: true }).fill('2026-10-17');
  for (const [locale, values] of Object.entries(translations)) {
    const panel = await selectLanguage(page, locale);
    for (const [field, label] of Object.entries({ title: 'Title', slug: 'URL slug', description: 'Description', imageAlt: 'Featured image alt text', seoTitle: 'SEO title', seoDescription: 'SEO description' })) {
      await panel.getByRole('textbox', { name: new RegExp('^' + label + '(?: |$)') }).fill(values[field]);
    }
    await panel.locator('[contenteditable=true]').first().fill(values.body);
  }
  await selectLanguage(page, 'uk');
  await page.getByRole('button', { name: 'Choose an image', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'qa-github.png', mimeType: 'image/png', buffer: await readFile('public/favicon.png') });
  await page.getByRole('button', { name: /choose selected/i }).click();
  await expect.poll(() => page.locator('img[role=presentation]').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/#\/collections\/blog\/entries\/qa-github-draft$/);
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  const branch = 'cms/blog/qa-github-draft';
  assert.ok(branches.has(branch));
  assert.equal([...branches.keys()].filter(name => name.startsWith('cms/')).length, 1, 'All languages use one workflow branch');
  assert.equal(pullRequests.length, 1);
  assert.equal(branches.get('main'), mainSha);
  const files = commits.get(branches.get(branch)).files;
  const articlePaths = Object.keys(files).filter(name => name.startsWith('src/content/articles/'));
  assert.deepEqual(articlePaths.sort(), ['src/content/articles/qa-github-draft.json', 'src/content/articles/welcome.json']);
  const firstDraft = JSON.parse(blobs.get(files['src/content/articles/qa-github-draft.json']).toString());
  assertDraft(firstDraft);
  assert.equal(firstDraft.pubDate, '2026-10-17', 'The CMS stores the selected publication date');
  assert.ok(files['public/images/blog/qa-github.webp']);
  const media = blobs.get(files['public/images/blog/qa-github.webp']);
  assert.equal(media.subarray(0, 4).toString(), 'RIFF');
  assert.equal(media.subarray(8, 12).toString(), 'WEBP');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByLabel('Publication date', { exact: true })).toHaveValue('2026-10-17');
  await expect(page.getByLabel(/^Updated date/)).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^Article ID/ })).toHaveValue('qa-github-draft');
  for (const [locale, values] of Object.entries(translations)) {
    const panel = await selectLanguage(page, locale);
    await expect(panel.getByRole('textbox', { name: /^Title(?: |$)/ })).toHaveValue(values.title);
    await expect(panel.getByRole('textbox', { name: /^URL slug(?: |$)/ })).toHaveValue(values.slug);
    await expect(panel.locator('[contenteditable=true]').first()).toHaveText(values.body);
  }
  await expect.poll(() => page.locator('img[role=presentation]').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  const englishPanel = await selectLanguage(page, 'en');
  await englishPanel.getByRole('textbox', { name: /^Description(?: |$)/ }).fill('Updated GitHub draft.');
  await page.getByLabel(/^Updated date/).fill('2026-10-18');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => {
    const updated = commits.get(branches.get(branch)).files;
    return JSON.parse(blobs.get(updated['src/content/articles/qa-github-draft.json']).toString()).translations.en.description;
  }).toBe('Updated GitHub draft.');
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  const updated = commits.get(branches.get(branch)).files;
  const updatedDraft = JSON.parse(blobs.get(updated['src/content/articles/qa-github-draft.json']).toString());
  assertDraft(updatedDraft, true);
  assert.equal(updatedDraft.updatedDate, '2026-10-18');
  assert.equal(updated['public/images/blog/qa-github.webp'], files['public/images/blog/qa-github.webp']);
  assert.deepEqual(Object.keys(updated).filter(name => name.startsWith('src/content/articles/')).sort(), articlePaths.sort(), 'Updating does not split or rename the article');
  assert.equal(branches.get('main'), mainSha);
  assert.equal(pullRequests.length, 1, 'Updating reuses the same PR');
  assert.deepEqual(blobs.get(mainFiles['src/content/articles/welcome.json']), welcome);
  assert.deepEqual(await readFile('src/content/blog/welcome.md'), legacyWelcome);
  assert.deepEqual(errors, []);
  console.log(`GitHub backend checks passed: actual Decap OAuth popup handshake, unrelated message guards, one JSON with all three Unicode translations, base64 WebP upload, one branch + PR, safe route-before-reload, unpublished image and full-language restoration, date fields and one-branch update. ${calls.length} API calls intercepted; no live GitHub writes or real OAuth tokens.`);
} finally { await browser.close(); }
