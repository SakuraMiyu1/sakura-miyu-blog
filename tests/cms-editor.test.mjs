import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile('public/admin/editor.js', 'utf8');
const handlers = {};
const widgets = {};
const previews = {};
const h = (type, props, ...children) => ({ type, props: props || {}, children });
class Data {
  constructor(value) { this.value = value; }
  get(key, fallback) { return this.value[key] === undefined ? fallback : this.value[key]; }
  set(key, value) { return new Data({ ...this.value, [key]: value }); }
}
class ObjectControl {
  constructor(props) { this.props = props; this.state = { collapsed: false }; this.renderFields = fields => fields.map(field => this.controlFor(field, field.get('name'))); }
  setState(value, callback) { this.state = { ...this.state, ...value }; callback?.(); }
  controlFor(field, key) { return h('control', { key, name: field.get('name') }); }
  render() { return h('object', {}, this.renderFields(this.props.field.get('fields'))); }
  focus(path) { this.focusedPath = path; }
}
const baseWidget = { control: ObjectControl, preview() {}, schema: { properties: { collapsed: { type: 'boolean' } } } };
const CMS = {
  getWidget: name => name === 'object' ? baseWidget : widgets[name],
  registerWidget: widget => { widgets[widget.name] = widget; },
  registerPreviewStyle() {},
  registerPreviewTemplate: (name, callback) => { previews[name] = callback; },
  registerEventListener: event => { handlers[event.name] = event.handler; }
};
runInNewContext(source, { window: { CMS, h } });
const entry = (data, { slug, newRecord = true } = {}) => ({ get: key => ({ data: new Data(data), slug, newRecord })[key] });
const complete = overrides => ({ title: 'A dream', slug: 'a-dream', description: 'A diary thought', body: 'A little story.', ...overrides });
const article = overrides => ({ translationKey: 'a-dream', pubDate: '2026-10-17', updatedDate: '', category: 'Diary', tags: ['Anime'], featured: false, draft: false, translations: { uk: complete() }, ...overrides });
const save = (data, options) => handlers.preSave({ entry: entry(data, options) });
const saveComic = (data, options) => handlers.preSave({ entry: entry(data, options), collection: new Data({ name: 'comics' }) });
const publishComic = (data, options) => handlers.prePublish({ entry: entry(data, options), collection: new Data({ name: 'comics' }) });
const localized = value => ({ uk: value + ' UK', en: value + ' EN', ja: value + ' JA' });
const comic = overrides => ({
  id: 'mist-story', slug: 'mist-story', titles: localized('Title'), descriptions: localized('Description'), genres: [localized('Fantasy')],
  cover: { src: '/comics-media/cover.webp', width: 1600, height: 2400, alt: localized('Cover') }, socialImage: '/comics-media/social.webp',
  status: 'coming-soon', publicationStatus: 'draft', approved: false, announcement: { approved: false, published: false }, fanContent: 'dead-by-daylight', chapters: [], ...overrides
});
const page = (id, kind, locale) => ({ id, kind, src: `/comics-media/${locale}-${id}.webp`, width: 1600, height: 2400, alt: `${locale} ${id}` });

test('One article retains all language versions and shared settings through a JSON roundtrip', () => {
  const input = article({ image: '/images/blog/ribbon.webp', featured: true, translations: { uk: complete({ title: 'Мрія', body: 'Я зберегла маленьку мрію.', imageAlt: 'Рожева стрічка' }), en: complete({ imageAlt: 'A pink ribbon', tags: [] }), ja: complete({ title: '小さな夢', body: '日記の小さな物語。', imageAlt: 'ピンクのリボン', tags: ['物語'] }) } });
  const saved = save(input).value;
  const reloaded = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(save(reloaded, { slug: 'a-dream', newRecord: false }).value, input);
  assert.equal(Object.hasOwn(reloaded.translations.uk, 'tags'), false, 'Untouched locale tags inherit the shared list');
  assert.deepEqual(reloaded.translations.en.tags, [], 'Explicit empty locale tags are preserved');
  assert.deepEqual(reloaded.translations.ja.tags, ['物語']);
  assert.deepEqual(reloaded.tags, ['Anime']);
});

test('Article ID is required, ASCII and immutable after its filename is created', () => {
  for (const translationKey of ['', undefined, '../escape', 'UPPERCASE', 'Українська']) assert.throws(() => save(article({ translationKey })), /Article ID/);
  assert.throws(() => save(article({ translationKey: 'renamed' }), { slug: 'a-dream', newRecord: false }), /cannot change/);
  assert.equal(save(article(), { slug: 'a-dream', newRecord: false }).get('translationKey'), 'a-dream');
});

test('Partial and empty translations stay saved without requiring a primary language', () => {
  const translations = { uk: {}, en: { title: 'Still writing', body: 'An unfinished draft' }, ja: {} };
  assert.deepEqual(save(article({ translations })).value.translations, translations);
  assert.deepEqual(save(article({ translations: {} })).value.translations, {});
  for (const locale of ['uk', 'en', 'ja']) assert.deepEqual(save(article({ translations: { [locale]: complete() } })).value.translations, { [locale]: complete() });
});

test('Only complete translations require alt text when the shared image is set', () => {
  assert.throws(() => save(article({ image: '/images/test.webp' })), /Українська.*alternative text/);
  assert.doesNotThrow(() => save(article({ image: '/images/test.webp', translations: { en: { title: 'Work in progress' } } })));
  assert.doesNotThrow(() => save(article({ image: '/images/test.webp', translations: { en: complete({ imageAlt: 'A blossom' }) } })));
  assert.throws(() => save(article({ image: 'https://example.com/test.webp' })), /uploaded image/);
});

test('Dates, localized slugs and tags reject invalid values without deleting partial content', () => {
  for (const pubDate of ['', '2025-02-29', '17/10/2026', '2026-13-01', 20261017]) assert.throws(() => save(article({ pubDate })), /Publication date/);
  assert.doesNotThrow(() => save(article({ pubDate: '2024-02-29', updatedDate: '2026-10-18T00:00:00.000Z' })));
  assert.throws(() => save(article({ updatedDate: '2026-02-30' })), /Updated date/);
  assert.throws(() => save(article({ translations: { en: { slug: '../escape' } } })), /URL slug/);
  assert.throws(() => save(article({ tags: ['🌸'] })), /Shared tags/);
  assert.throws(() => save(article({ translations: { ja: { tags: ['🌸'] } } })), /日本語.*tag/);
  assert.throws(() => save(article({ translations: { en: { body: 42 } } })), /body must be text/);
  assert.throws(() => save(article({ translations: { en: { seoTitle: 'x'.repeat(101) } } })), /SEO title/);
});

test('Tabs keep all three language controls mounted and support keyboard selection and error focus', () => {
  const widget = widgets['translation-tabs'];
  assert.equal(widget.schema, baseWidget.schema);
  assert.equal(widget.allowMapValue, true);
  const control = new widget.controlComponent({ forID: 'translations-field-1', field: new Data({ fields: ['uk', 'en', 'ja'].map(name => new Data({ name })) }) });
  let panels = control.renderFields(control.props.field.get('fields'));
  assert.equal(panels.length, 3);
  assert.equal(panels.filter(panel => !panel.props.hidden).length, 1);
  assert.equal(panels[0].props.role, 'tabpanel');
  assert.equal(panels[0].children[0].props.name, 'uk');
  let focused = false;
  let prevented = false;
  control.tabButtons.en = { focus: () => { focused = true; } };
  control.handleTabKey({ key: 'ArrowRight', preventDefault: () => { prevented = true; } }, 'uk');
  assert.equal(control.state.activeLocale, 'en');
  assert.equal(focused, true);
  assert.equal(prevented, true);
  panels = control.renderFields(control.props.field.get('fields'));
  assert.equal(panels.length, 3);
  assert.equal(panels[0].props.hidden, true);
  assert.equal(panels[1].props.hidden, false);
  control.handleTabKey({ key: 'End', preventDefault() {} }, 'en');
  assert.equal(control.state.activeLocale, 'ja');
  control.handleTabKey({ key: 'Home', preventDefault() {} }, 'ja');
  assert.equal(control.state.activeLocale, 'uk');
  control.handleTabKey({ key: 'ArrowLeft', preventDefault() {} }, 'uk');
  assert.equal(control.state.activeLocale, 'ja');
  control.focus('en.body');
  assert.equal(control.state.activeLocale, 'en');
  assert.equal(control.focusedPath, 'en.body');
  const rendered = control.render();
  const buttons = rendered.children[0].children;
  assert.equal(buttons.filter(button => button.props.tabIndex === 0).length, 1);
  assert.equal(buttons[1].props['aria-controls'], 'translations-field-1-panel-en');
});

test('Preview shows complete language versions and resolves nested body widgets and shared media', () => {
  const localizedFields = ['uk', 'en', 'ja'].map(name => new Data({ name, fields: [new Data({ name: 'body' })] }));
  const input = article({ image: '/images/test.webp', translations: { en: complete({ imageAlt: 'A blossom' }), ja: complete({ title: 'Not complete yet', body: ' \n ' }) } });
  const bodies = [];
  const rendered = previews.blog({ entry: entry(input), fields: [new Data({ name: 'translations', fields: localizedFields })], widgetFor: (name, _fields, value) => { bodies.push({ name, value }); return h('markdown', {}, value.body); }, getAsset: () => 'blob:test-image' });
  const section = rendered.children.find(child => child?.type === 'section');
  assert.equal(section.props.lang, 'en');
  assert.equal(rendered.children.filter(child => child?.type === 'section').length, 1);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].name, 'body');
  assert.equal(bodies[0].value.body, 'A little story.');
  assert.equal(section.children.find(child => child?.type === 'img').props.src, 'blob:test-image');
});

test('Comic drafts, preview mode and multilingual metadata save without publishing issues', () => {
  assert.doesNotThrow(() => saveComic(comic({ titles: { uk: 'Чернетка' }, descriptions: {}, cover: undefined, socialImage: undefined })));
  assert.deepEqual(saveComic(comic({ chapters: [{ publicationStatus: 'draft', approved: false, pages: {}, titles: {} }] })).get('chapters'), []);
  assert.equal(saveComic(comic({ publicationStatus: 'preview' })).get('publicationStatus'), 'preview');
  assert.throws(() => saveComic(comic({ publicationStatus: 'published' })), /explicit series publication confirmation/);
  assert.doesNotThrow(() => saveComic(comic({ publicationStatus: 'published', approved: true })));
});

test('Published issues require approval, pages and matching multilingual page order', () => {
  const issue = { id: 'issue-01', slug: 'issue-01', order: 1, pubDate: '2026-11-10', titles: localized('Issue'), publicationStatus: 'published', approved: true, pages: { uk: [page('cover', 'cover', 'uk'), page('page-01', 'page', 'uk')] } };
  assert.doesNotThrow(() => saveComic(comic({ chapters: [issue] })));
  const intrinsicSize = { ...page('cover', 'cover', 'uk') };
  delete intrinsicSize.width;
  delete intrinsicSize.height;
  assert.doesNotThrow(() => saveComic(comic({ chapters: [{ ...issue, pages: { uk: [intrinsicSize] } }] })));
  assert.throws(() => saveComic(comic({ chapters: [{ ...issue, pages: { uk: [{ ...intrinsicSize, width: 1600 }] } }] })), /both image dimensions/);
  assert.throws(() => saveComic(comic({ chapters: [{ ...issue, approved: false }] })), /explicit publication confirmation/);
  assert.throws(() => saveComic(comic({ chapters: [{ ...issue, pages: {} }] })), /cannot be empty/);
  assert.throws(() => saveComic(comic({ chapters: [{ ...issue, pages: { uk: issue.pages.uk, en: [page('cover', 'cover', 'en'), page('page-02', 'page', 'en')] } }] })), /matching Page IDs/);
  assert.throws(() => saveComic(comic({ chapters: [{ ...issue, pages: { uk: [page('page-01', 'page', 'uk')] } }] })), /one cover first/);
});

test('Publishing a comic record to main requires complete UA, EN and JP metadata', () => {
  assert.throws(() => publishComic(comic({ titles: { uk: 'Лише українська' } })), /Comic titles/);
  assert.throws(() => publishComic(comic({ genres: [] })), /at least one genre/);
  assert.doesNotThrow(() => publishComic(comic()));
});

test('Comic preview renders every language and uploaded issue page', () => {
  const issue = { id: 'issue-01', slug: 'issue-01', order: 1, titles: localized('Issue'), publicationStatus: 'preview', approved: false, pages: { en: [page('cover', 'cover', 'en')] } };
  const rendered = previews.comics({ entry: entry(comic({ chapters: [issue] })), getAsset: asset => `blob:${asset}` });
  assert.equal(rendered.props.className, 'comic-preview');
  assert.equal(rendered.children.filter(child => child?.type === 'section').length, 3);
  const english = rendered.children.filter(child => child?.type === 'section')[1];
  assert.ok(JSON.stringify(english).includes('blob:/comics-media/en-cover.webp'));
  assert.ok(JSON.stringify(english).includes('preview'));
});
