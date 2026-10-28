import { expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function checkStoryEditor(page, languageNames, onUnsafeHtml = () => {}) {
  const article = page.frameLocator('iframe').locator('article.diary-preview');
  for (const [locale, label] of Object.entries(languageNames)) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    const panel = page.getByRole('tabpanel');
    const source = panel.getByRole('textbox', { name: 'Story Markdown source', exact: true });
    const word = { uk: 'Мрія', en: 'Dream', ja: '夢' }[locale];
    const actions = {
      Bold: [`**${word}**`, 'strong'], Italic: [`*${word}*`, 'em'],
      H1: [`# ${word}`, 'h1'], H2: [`## ${word}`, 'h2'], H3: [`### ${word}`, 'h3'], H4: [`#### ${word}`, 'h4'],
      Link: [`[${word}](https://)`, null], Blockquote: [`> ${word}`, 'blockquote'],
      'Ordered list': [`1. ${word}`, 'ol li'], 'Unordered list': [`- ${word}`, 'ul li'],
      'Inline code': [`\`${word}\``, 'code'], 'Code block': [`\`\`\`\n${word}\n\`\`\``, 'pre code']
    };
    for (const [button, [expected, selector]] of Object.entries(actions)) {
      await source.fill(word);
      await source.evaluate(element => { element.focus(); element.setSelectionRange(0, element.value.length); });
      await expect(panel.getByRole('button', { name: button, exact: true })).toBeEnabled();
      await panel.getByRole('button', { name: button, exact: true }).click();
      await expect(source).toHaveValue(expected);
      await expect(article).toHaveAttribute('lang', locale);
      if (selector) await expect(article.locator(selector).filter({ hasText: word }).first()).toBeVisible();
    }
    await source.fill(`[${word}](https://example.com/)`);
    await expect(article.getByRole('link', { name: word, exact: true })).toHaveAttribute('href', 'https://example.com/');
    const html = `<details open>\n<summary>${word}</summary>\n<p><mark>UA EN 日本語</mark> <kbd>Ctrl</kbd></p>\n</details>\n\n**${word}**\n\n<script>window.__storyXSS = true</script>\n<img src="/missing-test-image" onerror="window.__storyXSS = true">\n<a href="javascript:window.__storyXSS=true">unsafe</a>`;
    onUnsafeHtml(true);
    await page.evaluate(() => { window.testingStoryAttack = true; });
    await source.fill(html);
    await panel.getByRole('button', { name: 'Rendered preview', exact: true }).click();
    await expect(panel.locator('details summary')).toHaveText(word);
    await expect(panel.locator('mark')).toHaveText('UA EN 日本語');
    assert.equal(await panel.locator('script, [onerror], a[href^="javascript:"]').count(), 0);
    assert.equal(await article.locator('script, [onerror], a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.__storyXSS)), false);
    assert.equal(await page.frameLocator('iframe').locator('body').evaluate(() => Boolean(window.__storyXSS)), false);
    await panel.getByRole('button', { name: 'Source / Code', exact: true }).click();
    await expect(source).toHaveValue(html);
    await source.fill(word);
    await expect(article).toContainText(word);
    await page.waitForTimeout(100);
    await page.evaluate(() => { window.testingStoryAttack = false; });
    onUnsafeHtml(false);
    await source.evaluate(element => { element.focus(); element.setSelectionRange(0, element.value.length); });
    await source.press('Control+b');
    await expect(source).toHaveValue(`**${word}**`);
    await panel.getByRole('button', { name: 'Image', exact: true }).click();
    await panel.getByRole('button', { name: 'Choose an image', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: `qa-inline-${locale}.png`, mimeType: 'image/png', buffer: await readFile('public/favicon.png') });
    await page.getByRole('button', { name: /choose selected/i }).click();
    await expect(source).toHaveValue(new RegExp(`!\\[${word}\\]\\(/images/blog/qa-inline-${locale}\\.webp\\)`));
    await expect.poll(() => article.locator(`img[alt="${word}"]`).evaluate(image => image.naturalWidth), { message: 'Unpublished inline image must resolve through its Blob proxy', timeout: 10000 }).toBeGreaterThan(0);
  }
  console.log('Story checks passed: all toolbar actions in UA/EN/JA, keyboard shortcut, source/preview HTML preservation, safe HTML sanitization, nested partial live preview and inline repository images.');
}

export async function checkSanitizerWithoutCsp(browser, origin, config) {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'The isolated sanitizer check must use a local test server');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/cms-status', route => route.fulfill({ json: { enabled: true } }));
    await page.route('**/admin/config.yml', route => route.fulfill({ json: config }));
    await page.route('https://api.github.com/**', () => { throw new Error('The sanitizer test must not access GitHub'); });
    await page.addInitScript(() => { window.repoFiles = { 'src/content/articles': {}, src: { content: { articles: {} } } }; });
    const response = await page.goto(origin + '/admin/');
    assert.equal(response.headers()['content-security-policy'], undefined, 'Astro test preview must not inject CSP in this isolated context');
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByRole('link', { name: /Article$/ }).click();
    await page.getByRole('textbox', { name: /^Article ID/ }).fill('qa-sanitizer');
    const panel = page.getByRole('tabpanel');
    const source = panel.getByRole('textbox', { name: 'Story Markdown source', exact: true });
    const html = '<details open><summary>UA EN 日本語</summary><mark>safe</mark></details>\n\n<script>window.__storyXSS=true</script><img src="/missing-sanitizer-test" onerror="window.__storyXSS=true"><a href="javascript:window.__storyXSS=true">unsafe</a>';
    await source.fill(html);
    await panel.getByRole('button', { name: 'Rendered preview', exact: true }).click();
    await expect(panel.locator('details summary')).toHaveText('UA EN 日本語');
    await page.waitForTimeout(500);
    assert.equal(await panel.locator('script, [onerror], a[href^="javascript:"]').count(), 0);
    assert.equal(await page.frameLocator('iframe').locator('article').locator('script, [onerror], a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => Boolean(window.__storyXSS)), false);
    assert.equal(await page.frameLocator('iframe').locator('body').evaluate(() => Boolean(window.__storyXSS)), false);
    await panel.getByRole('button', { name: 'Source / Code', exact: true }).click();
    await expect(source).toHaveValue(html);
    assert.deepEqual(errors, []);
    console.log('Isolated sanitizer check passed without simulated CSP: no script/event-handler execution, unsafe DOM removed and original source preserved. No Save/Publish or live GitHub calls.');
  } finally { await context.close(); }
}
