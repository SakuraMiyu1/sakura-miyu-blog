import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.TEST_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
const reports = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  const routes = ['/', ...['uk', 'en', 'ja'].flatMap(locale => ['', 'blog/', 'blog/welcome/', 'about/', 'writing/', 'archive/', 'tags/', 'categories/gothic-kawaii/', '404/'].map(route => `/${locale}/${route}`))];
  for (const route of routes) {
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    const issues = await page.evaluate(() => {
      const issues = [];
      const seen = new Set();
      document.querySelectorAll('[id]').forEach(element => { if (seen.has(element.id)) issues.push(`Duplicate ID: ${element.id}`); seen.add(element.id); });
      document.querySelectorAll('img').forEach(image => { if (!image.hasAttribute('alt')) issues.push(`Missing alt: ${image.src}`); });
      document.querySelectorAll('input:not([type=hidden]),select').forEach(input => { if (!input.labels?.length && !input.getAttribute('aria-label')) issues.push(`Unlabelled control: ${input.id}`); });
      if (document.querySelectorAll('h1').length !== 1) issues.push('Expected one h1');
      if (document.querySelectorAll('main').length !== 1) issues.push('Expected one main landmark');
      let previousLevel = 0;
      document.querySelectorAll('main :is(h1,h2,h3,h4,h5,h6)').forEach(heading => {
        const level = Number(heading.tagName.slice(1));
        if (level > previousLevel + 1) issues.push(`Skipped heading level: ${heading.textContent.trim()}`);
        previousLevel = level;
      });
      const color = value => {
        const values = value.match(/[\d.]+/g)?.map(Number);
        return values ? [...values.slice(0, 3), values[3] ?? 1] : [0, 0, 0, 0];
      };
      const blend = (front, back) => [0, 1, 2].map(index => front[index] * front[3] + back[index] * (1 - front[3])).concat(1);
      const background = element => {
        const chain = [];
        for (let parent = element; parent; parent = parent.parentElement) chain.push(color(getComputedStyle(parent).backgroundColor));
        return chain.reverse().reduce((back, front) => blend(front, back), [23, 18, 28, 1]);
      };
      const luminance = rgba => rgba.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const checked = new Set();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const element = node.parentElement;
        const text = node.textContent.trim();
        if (!/[\p{L}\p{N}]/u.test(text) || !element || element.closest('script,style,[aria-hidden=true],.sr-only') || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') continue;
        const style = getComputedStyle(element);
        const back = background(element);
        const foreground = blend(color(style.color), back);
        const a = luminance(foreground);
        const b = luminance(back);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700);
        const key = [style.color, style.backgroundColor, style.fontSize, element.className].join('|');
        if (ratio < (large ? 3 : 4.5) && !checked.has(key)) { checked.add(key); issues.push(`Contrast ${ratio.toFixed(2)}: ${element.tagName}.${element.className} — ${text.slice(0, 65)}`); }
      }
      return issues;
    });
    reports.push({ route, issues });
  }
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/accessibility.json', JSON.stringify(reports, null, 2));
  const issues = reports.flatMap(report => report.issues.map(issue => `${report.route}: ${issue}`));
  assert.deepEqual(issues, [], 'Contrast, headings, labels, landmarks, alt attributes, and duplicate IDs');
  console.log(`Accessibility checks passed on ${reports.length} pages: text contrast, headings, labels, landmarks, image alternatives, and unique IDs. Background artwork and screen-reader speech remain manual-review limitations.`);
} finally { await browser.close(); }
