import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile('public/admin/editor.js', 'utf8');
const handlers = {};
const widgets = {};
let preview;
const h = (type, props, ...children) => ({ type, props: props || {}, children });
class Data {
  constructor(value) { this.value = value; }
  get(key, fallback) { return this.value[key] === undefined ? fallback : this.value[key]; }
  set(key, value) { return new Data({ ...this.value, [key]: value }); }
}
class Component {
  constructor(props) { this.props = props; }
  setState(value, callback) { this.state = { ...this.state, ...value }; callback?.(); }
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
  getWidget: name => ['object', 'markdown', 'richtext'].includes(name) ? baseWidget : widgets[name],
  registerWidget: widget => { widgets[widget.name] = widget; },
  registerPreviewStyle() {},
  registerPreviewTemplate: (_name, callback) => { preview = callback; },
  registerEventListener: event => { handlers[event.name] = event.handler; }
};
const createClass = methods => class extends Component {
  constructor(props) { super(props); Object.assign(this, methods); this.state = this.getInitialState?.() || {}; }
};
const formatStory = runInNewContext(source + '\nformatStory;', { window: { CMS, h, createClass, location: { origin: 'https://sakura-miyu-blog.pages.dev' } }, requestAnimationFrame: callback => callback() });
const entry = (data, { slug, newRecord = true } = {}) => ({ get: key => ({ data: new Data(data), slug, newRecord })[key] });
const complete = overrides => ({ title: 'A dream', slug: 'a-dream', description: 'A diary thought', body: 'A little story.', ...overrides });
const article = overrides => ({ translationKey: 'a-dream', pubDate: '2026-10-17', updatedDate: '', category: 'Diary', tags: ['Anime'], featured: false, draft: false, translations: { uk: complete() }, ...overrides });
const save = (data, options) => handlers.preSave({ entry: entry(data, options) });

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

test('Preview follows selected language and renders nested Story before publication fields are complete', () => {
  const localizedFields = ['uk', 'en', 'ja'].map(name => new Data({ name, fields: [new Data({ name: 'body' })] }));
  const input = article({ image: '/images/test.webp', translations: { en: { body: '**A little story.**', imageAlt: 'A blossom' }, ja: complete({ title: 'Not complete yet', body: ' \n ' }) } });
  const bodies = [];
  const instance = new preview({ entry: entry(input), fields: [new Data({ name: 'translations', fields: localizedFields })], widgetFor: (name, _fields, value) => { bodies.push({ name, value }); return h('markdown', {}, value.get('body')); }, getAsset: () => 'blob:test-image' });
  instance.componentDidMount();
  const tabs = new widgets['translation-tabs'].controlComponent({});
  tabs.selectLocale('en');
  const rendered = instance.render();
  assert.equal(rendered.props.lang, 'en');
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].name, 'body');
  assert.equal(bodies[0].value.get('body'), '**A little story.**');
  assert.equal(rendered.children.find(child => child?.type === 'img').props.src, 'blob:test-image');
  tabs.selectLocale('ja');
  assert.equal(instance.render().props.lang, 'ja');
  assert.equal(bodies.length, 1, 'An empty Story does not render another language');
  instance.componentWillUnmount();
});

test('Source formatting preserves Unicode and text outside the selection', () => {
  for (const [command, expected] of Object.entries({ bold: '**夢**', italic: '*夢*', code: '`夢`', link: '[夢](https://)', 'code-block': '```\n夢\n```' })) {
    assert.equal(formatStory('до 夢 після', 3, 4, command).value, `до ${expected} після`);
  }
  for (const [command, prefix] of Object.entries({ h1: '# ', h2: '## ', h3: '### ', h4: '#### ', quote: '> ', 'ordered-list': '1. ', 'unordered-list': '- ' })) {
    assert.equal(formatStory('α\nмрія\nω', 3, 4, command).value, `α\n${prefix}мрія\nω`);
  }
  assert.equal(formatStory('one\ntwo\nthree', 0, 7, 'ordered-list').value, '1. one\n2. two\nthree');
  assert.equal(formatStory('# Dream', 0, 7, 'h2').value, '## Dream');
  assert.equal(formatStory('\nDream', 0, 0, 'h1').value, '# \nDream');
  assert.equal(formatStory('`dream`', 0, 7, 'code').value, '`` `dream` ``');
  assert.equal(formatStory('```', 0, 3, 'code-block').value, '````\n```\n````');
});

test('Source and rendered views never serialize or strip stored HTML', () => {
  const value = '<details open>\n<summary>夢</summary>\n<strong>Мрія</strong>\n</details>\n\n**Dream**';
  const changes = [];
  const control = new widgets['sakura-story'].controlComponent({ value, field: new Data({}), onChange: next => changes.push(next) });
  control.render();
  control.setState({ mode: 'preview' });
  control.render();
  control.setState({ mode: 'source' });
  control.render();
  assert.deepEqual(changes, []);
  assert.equal(control.props.value, value);
  assert.equal(save(article({ translations: { uk: complete({ body: value }) } })).value.translations.uk.body, value);
});

test('Async image insertion uses the original selection even if the textarea ref is temporarily detached', () => {
  let value;
  const control = new widgets['sakura-story'].controlComponent({ value: 'before 夢 after', onChange: next => { value = next; } });
  control.imageSelection = { start: 7, end: 8 };
  control.source = null;
  control.insertImage('/images/blog/dream.webp');
  assert.equal(value, 'before ![夢](/images/blog/dream.webp) after');
});

test('Sanitized preview resolves local inline images only to same-origin Blob proxies', () => {
  const original = '/images/blog/dream.webp';
  const image = { src: original, getAttribute: () => original };
  const instance = new widgets['sakura-story'].previewComponent({ field: new Data({}), getAsset: () => 'javascript:alert(1)' });
  instance.container = { querySelectorAll: () => [image] };
  for (const asset of ['javascript:alert(1)', 'blob:https://example.com/foreign', 'blob:https://sakura-miyu-blog.pages.dev.evil/foreign']) {
    instance.props.getAsset = () => asset;
    instance.componentDidUpdate();
    assert.equal(image.src, original);
  }
  instance.props.getAsset = () => 'blob:https://sakura-miyu-blog.pages.dev/local';
  instance.componentDidMount();
  assert.equal(image.src, 'blob:https://sakura-miyu-blog.pages.dev/local');
});
