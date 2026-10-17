import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile('public/admin/editor.js', 'utf8');
const handlers = {};
const CMS = { registerPreviewStyle() {}, registerPreviewTemplate() {}, registerEventListener: event => { handlers[event.name] = event.handler; } };
runInNewContext(source, { window: { CMS, h() {} } });
class Data {
  constructor(value) { this.value = value; }
  get(key) { return this.value[key]; }
  set(key, value) { return new Data({ ...this.value, [key]: value }); }
}
const entry = (data, { slug, newRecord = true } = {}) => ({ get: key => ({ data: new Data(data), slug, newRecord })[key] });

test('Editor validates new addresses and preserves existing entry filenames', () => {
  assert.throws(() => handlers.preSave({ entry: entry({ slug: '' }) }), /unique URL slug/);
  assert.throws(() => handlers.preSave({ entry: entry({ slug: '../escape' }) }), /unique URL slug/);
  const saved = handlers.preSave({ entry: entry({ slug: 'changed-url', language: 'en', body: 'A thought' }, { slug: 'welcome', newRecord: false }) });
  assert.equal(saved.get('slug'), 'welcome');
});

test('Editor requires image descriptions and preserves multilingual section anchors', () => {
  assert.throws(() => handlers.preSave({ entry: entry({ slug: 'test', image: '/images/test.webp' }) }), /alternative text/);
  assert.throws(() => handlers.preSave({ entry: entry({ slug: 'test', tags: ['🌸'] }) }), /letter or number/);
  assert.throws(() => handlers.preSave({ entry: entry({ slug: 'test', language: 'multilingual', body: 'No language sections' }) }), /three language sections/);
  const body = '<section lang="uk"><h2 id="ukrainian">Українська</h2></section><section lang="en"><h2 id="english">English</h2></section><section lang="ja"><h2 id="japanese">日本語</h2></section>';
  assert.equal(handlers.preSave({ entry: entry({ slug: 'test', language: 'multilingual', body }) }).get('body'), body);
});
