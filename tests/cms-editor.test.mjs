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
const newEntry = data => entry({ slug: 'a-dream', language: 'uk', translationKey: 'a-dream', ...data });

test('Editor validates new addresses and preserves existing entry filenames', () => {
  assert.throws(() => handlers.preSave({ entry: entry({ slug: '' }) }), /unique URL slug/);
  assert.throws(() => handlers.preSave({ entry: entry({ slug: '../escape' }) }), /unique URL slug/);
  const saved = handlers.preSave({ entry: entry({ slug: 'changed-url', language: 'en', body: 'A thought' }, { slug: 'welcome', newRecord: false }) });
  assert.equal(saved.get('slug'), 'welcome');
});

test('Editor requires image descriptions and preserves multilingual section anchors', () => {
  assert.throws(() => handlers.preSave({ entry: newEntry({ image: '/images/test.webp' }) }), /alternative text/);
  assert.throws(() => handlers.preSave({ entry: newEntry({ image: 'https://example.com/image.webp', imageAlt: 'A blossom' }) }), /uploaded image/);
  assert.throws(() => handlers.preSave({ entry: newEntry({ tags: ['🌸'] }) }), /letter or number/);
  assert.throws(() => handlers.preSave({ entry: entry({ language: 'multilingual', body: 'No language sections' }, { slug: 'welcome', newRecord: false }) }), /three language sections/);
  const body = '<section lang="uk"><h2 id="ukrainian">Українська</h2></section><section lang="en"><h2 id="english">English</h2></section><section lang="ja"><h2 id="japanese">日本語</h2></section>';
  const saved = handlers.preSave({ entry: entry({ language: 'multilingual', body }, { slug: 'welcome', newRecord: false }) });
  assert.equal(saved.get('body'), body);
  assert.equal(saved.get('translationKey'), undefined);
});

test('New entries require one supported language and a reusable ASCII Translation Key', () => {
  for (const language of ['uk', 'en', 'ja']) {
    const saved = handlers.preSave({ entry: newEntry({ language, body: 'A story', translationKey: 'shared-story' }) });
    assert.equal(saved.get('language'), language);
    assert.equal(saved.get('translationKey'), 'shared-story');
    assert.equal(saved.get('body'), 'A story');
  }
  for (const translationKey of ['', undefined, '../story', 'Українська', 'UPPERCASE']) {
    assert.throws(() => handlers.preSave({ entry: newEntry({ translationKey }) }), /Translation Key/);
  }
  for (const language of [undefined, 'multilingual', 'jp', 'de']) {
    assert.throws(() => handlers.preSave({ entry: newEntry({ language }) }), /Choose Ukrainian, English or Japanese/);
  }
});

test('Editing a prefixed entry keeps its filename identity and normalized URL slug', () => {
  const saved = handlers.preSave({ entry: entry({ slug: 'renamed', language: 'en', translationKey: 'shared-story' }, { slug: 'en--a-dream', newRecord: false }) });
  assert.equal(saved.get('slug'), 'a-dream');
  assert.equal(saved.get('translationKey'), 'shared-story');
  assert.throws(() => handlers.preSave({ entry: entry({ language: 'ja' }, { slug: 'en--a-dream', newRecord: false }) }), /separate translation/);
  const legacy = handlers.preSave({ entry: entry({ slug: 'new-url', language: 'ja', body: '物語' }, { slug: 'old-story', newRecord: false }) });
  assert.equal(legacy.get('slug'), 'old-story');
  assert.equal(legacy.get('translationKey'), undefined);
});
