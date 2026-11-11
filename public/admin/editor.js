const CMS = window.CMS;
const h = window.h || window.React.createElement;
const languages = ['uk', 'en', 'ja'];
const languageNames = { uk: '🇺🇦 Українська (UA)', en: '🇬🇧 English (EN)', ja: '🇯🇵 日本語 (JP)' };
const objectWidget = CMS.getWidget('object');
const fieldValue = (value, key) => value?.get ? value.get(key) : value?.[key];
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const markdownWidget = CMS.getWidget('markdown');
const storyPreview = CMS.getWidget('richtext').preview;
let previewLocale = 'uk';
const previewListeners = new Set();
const selectPreviewLocale = locale => {
  previewLocale = locale;
  previewListeners.forEach(listener => listener(locale));
};

const SafeStoryPreview = window.createClass({
  getInitialState() {
    this.bindContainer = element => { this.container = element; };
    return {};
  },
  componentDidMount() { this.resolveImages(); },
  componentDidUpdate() { this.resolveImages(); },
  resolveImages() {
    this.container?.querySelectorAll('img[src^="/images/"]').forEach(image => {
      const asset = String(this.props.getAsset(image.getAttribute('src')));
      if (asset.startsWith(`blob:${window.location.origin}/`)) image.src = asset;
    });
  },
  render() {
    return h('div', { ref: this.bindContainer }, h(storyPreview, {
      ...this.props,
      field: this.props.field.set('sanitize_preview', true),
      getEditorComponents: () => this.props.getEditorComponents().filter(() => false)
    }));
  }
});

function formatStory(value, start, end, command) {
  const selected = value.slice(start, end);
  const wrappers = { bold: ['**', '**'], italic: ['*', '*'], code: ['`', '`'], link: ['[', '](https://)'], 'code-block': ['```\n', '\n```'] };
  const ticks = '`'.repeat(Math.max(command === 'code-block' ? 3 : 1, ...[...selected.matchAll(/`+/g)].map(match => match[0].length + 1)));
  if (command === 'code-block') wrappers[command] = [ticks + '\n', '\n' + ticks];
  if (command === 'code') {
    const padding = selected.startsWith('`') || selected.endsWith('`') ? ' ' : '';
    wrappers[command] = [ticks + padding, padding + ticks];
  }
  let text;
  let cursor;
  if (wrappers[command]) {
    const [before, after] = wrappers[command];
    text = before + selected + after;
    cursor = start + before.length;
  } else {
    start = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', Math.max(start, end - (value[end - 1] === '\n' ? 1 : 0)));
    end = lineEnd < 0 ? value.length : lineEnd;
    text = value.slice(start, end).split('\n').map((line, index) => {
      const prefix = command.startsWith('h') ? '#'.repeat(Number(command.slice(1))) + ' ' : command === 'quote' ? '> ' : command === 'ordered-list' ? `${index + 1}. ` : '- ';
      return prefix + (command.startsWith('h') ? line.replace(/^#{1,6}\s+/, '') : command.endsWith('list') ? line.replace(/^(?:[-+*]|\d+\.)\s+/, '') : line);
    }).join('\n');
    cursor = start;
  }
  return { value: value.slice(0, start) + text + value.slice(end), start: cursor, end: wrappers[command] ? cursor + selected.length : start + text.length };
}

const StoryControl = window.createClass({
  getInitialState() {
    this.bindSource = element => { this.source = element; };
    return { mode: 'source', imagePicker: false };
  },
  shouldComponentUpdate() { return true; },

  focus() { this.source?.focus(); },

  format(command) {
    if (!this.source || this.props.isDisabled) return;
    const result = formatStory(this.props.value || '', this.source.selectionStart, this.source.selectionEnd, command);
    this.props.onChange(result.value);
    requestAnimationFrame(() => { this.focus(); this.source?.setSelectionRange(result.start, result.end); });
  },

  insertImage(path) {
    if (!path || this.props.isDisabled) return;
    const value = this.props.value || '';
    const { start, end } = this.imageSelection || { start: value.length, end: value.length };
    const alt = value.slice(start, end).replaceAll(']', '\\]') || 'Image description';
    const url = String(path).replaceAll(' ', '%20').replaceAll('(', '%28').replaceAll(')', '%29');
    this.props.onChange(value.slice(0, start) + `![${alt}](${url})` + value.slice(end));
    this.setState({ imagePicker: false });
  },

  render() {
    const { field, value = '', forID, isDisabled } = this.props;
    const source = this.state.mode === 'source';
    const actions = [['bold', 'Bold'], ['italic', 'Italic'], ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['link', 'Link'], ['quote', 'Blockquote'], ['ordered-list', 'Ordered list'], ['unordered-list', 'Unordered list'], ['code', 'Inline code'], ['code-block', 'Code block']];
    return h('div', { className: 'sakura-story' },
      h('div', { className: 'sakura-story-modes', role: 'group', 'aria-label': 'Story editing mode' },
        ...[['source', 'Source / Code'], ['preview', 'Rendered preview']].map(([mode, label]) => h('button', { key: mode, type: 'button', 'aria-pressed': this.state.mode === mode, onClick: () => this.setState({ mode, imagePicker: false }) }, label))
      ),
      h('div', { hidden: !source },
        h('div', { className: 'sakura-story-toolbar', role: 'group', 'aria-label': 'Markdown formatting' },
          ...actions.map(([command, label]) => h('button', { key: command, type: 'button', disabled: isDisabled, onMouseDown: event => event.preventDefault(), onClick: () => this.format(command) }, label)),
          h('button', { type: 'button', disabled: isDisabled, onMouseDown: event => event.preventDefault(), onClick: () => { this.imageSelection = { start: this.source.selectionStart, end: this.source.selectionEnd }; this.setState({ imagePicker: !this.state.imagePicker }); } }, 'Image')
        ),
        this.state.imagePicker ? h(CMS.getWidget('image').control, { ...this.props, forID: `${forID}-inline-image`, field: field.set('widget', 'image').set('choose_url', false), value: '', onChange: path => this.insertImage(path) }) : null,
        h('textarea', { id: forID, ref: this.bindSource, value, disabled: isDisabled, rows: 16, spellCheck: true, 'aria-label': 'Story Markdown source', onChange: event => this.props.onChange(event.target.value), onKeyDown: event => { if ((event.ctrlKey || event.metaKey) && ['b', 'i'].includes(event.key.toLowerCase())) { event.preventDefault(); this.format(event.key.toLowerCase() === 'b' ? 'bold' : 'italic'); } } }),
        h('p', { className: 'sakura-story-help' }, 'Markdown and HTML source stays unchanged when switching views. Preview removes unsafe HTML; it is a reading view, not a visual HTML editor.')
      ),
      source ? null : h(SafeStoryPreview, { ...this.props, value })
    );
  }
});

CMS.registerWidget({ name: 'sakura-story', controlComponent: StoryControl, previewComponent: SafeStoryPreview, schema: markdownWidget.schema });

class TranslationTabsControl extends objectWidget.control {
  constructor(props) {
    super(props);
    this.state = { ...this.state, activeLocale: 'uk' };
    this.tabButtons = {};
  }

  componentDidMount() {
    super.componentDidMount?.();
    selectPreviewLocale(this.state.activeLocale);
  }

  selectLocale(locale, focus = false) {
    selectPreviewLocale(locale);
    this.setState({ activeLocale: locale }, () => {
      if (focus) this.tabButtons[locale]?.focus();
    });
  }

  handleTabKey(event, locale) {
    const index = languages.indexOf(locale);
    const next = { ArrowRight: (index + 1) % languages.length, ArrowLeft: (index + languages.length - 1) % languages.length, Home: 0, End: languages.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.selectLocale(languages[next], true);
  }

  focus(path) {
    const locale = path?.split('.')[0];
    if (languages.includes(locale)) { selectPreviewLocale(locale); this.setState({ activeLocale: locale }, () => super.focus(path)); }
    else super.focus(path);
  }

  renderFields = (multiFields, singleField) => {
    const fields = multiFields?.toArray ? multiFields.toArray() : multiFields || [singleField];
    return fields.map(field => {
      const locale = field.get('name');
      return h('section', {
        key: locale,
        id: `${this.props.forID}-panel-${locale}`,
        role: 'tabpanel',
        'aria-labelledby': `${this.props.forID}-tab-${locale}`,
        hidden: this.state.activeLocale !== locale,
        tabIndex: 0,
        className: 'sakura-translation-panel'
      }, this.controlFor(field, locale));
    });
  };

  render() {
    return h('div', { className: 'sakura-translations' },
      h('div', { role: 'tablist', 'aria-label': 'Article language', 'aria-orientation': 'horizontal', className: 'sakura-language-tabs' },
        ...languages.map(locale => h('button', {
          key: locale,
          id: `${this.props.forID}-tab-${locale}`,
          type: 'button',
          role: 'tab',
          'aria-controls': `${this.props.forID}-panel-${locale}`,
          'aria-selected': this.state.activeLocale === locale,
          tabIndex: this.state.activeLocale === locale ? 0 : -1,
          ref: button => { this.tabButtons[locale] = button; },
          onClick: () => this.selectLocale(locale),
          onKeyDown: event => this.handleTabKey(event, locale)
        }, languageNames[locale]))
      ),
      super.render()
    );
  }
}

CMS.registerWidget({ name: 'translation-tabs', controlComponent: TranslationTabsControl, previewComponent: objectWidget.preview, schema: objectWidget.schema, allowMapValue: true });
CMS.registerPreviewStyle('/admin/preview.css');
const ArticlePreview = window.createClass({
  getInitialState() {
    this.onLocale = locale => this.setState({ locale });
    return { locale: previewLocale };
  },
  componentDidMount() { previewListeners.add(this.onLocale); this.onLocale(previewLocale); },
  componentWillUnmount() { previewListeners.delete(this.onLocale); },
  render() {
    const { entry, fields, fieldsMetaData, widgetFor, getAsset } = this.props;
    const data = entry.get('data');
    const image = data.get('image');
    const translations = data.get('translations');
    const translationFields = fields.find(field => field.get('name') === 'translations').get('fields');
    const locale = this.state.locale;
    const translation = fieldValue(translations, locale);
    const localeFields = translationFields.find(field => field.get('name') === locale).get('fields');
    const metadata = fieldsMetaData?.getIn?.(['translations', locale]) || fieldsMetaData;
    const body = fieldValue(translation, 'body');
    return h('article', { className: 'diary-preview', lang: locale },
      h('p', null, `Sakura Miyu · ${data.get('category') || ''} · ${data.get('translationKey') || ''}`),
      h('p', null, languageNames[locale]),
      h('h1', null, fieldValue(translation, 'title') || 'Untitled article'),
      h('p', null, fieldValue(translation, 'description')),
      image ? h('img', { src: String(getAsset(image)), alt: fieldValue(translation, 'imageAlt') || '' }) : null,
      hasText(body) ? widgetFor('body', localeFields, data.set('body', body), metadata) : h('p', null, 'Start writing Story in this language to see its preview.')
    );
  }
});
CMS.registerPreviewTemplate('blog', ArticlePreview);

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value)) return false;
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day && Number.isFinite(new Date(value).getTime());
}

function validateTags(value, label) {
  if (value === undefined || value === null) return;
  const tags = value.toArray ? value.toArray() : value;
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !/[\p{L}\p{N}]/u.test(tag))) throw new Error(`${label}: each tag must contain a letter or number.`);
}

CMS.registerEventListener({
  name: 'preSave',
  handler: ({ entry }) => {
    const data = entry.get('data');
    const articleId = data.get('translationKey');
    if (typeof articleId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleId)) throw new Error('Enter a unique Article ID using lowercase English letters, numbers and hyphens.');
    if (!entry.get('newRecord') && entry.get('slug') && articleId !== entry.get('slug')) throw new Error('The Article ID cannot change after creation. Keep the existing filename identity and edit the language fields instead.');
    if (!validDate(data.get('pubDate'))) throw new Error('Choose a valid Publication date in YYYY-MM-DD format.');
    const updatedDate = data.get('updatedDate');
    if (updatedDate !== undefined && updatedDate !== null && updatedDate !== '' && !validDate(updatedDate)) throw new Error('Choose a valid Updated date or leave it empty.');
    const image = data.get('image');
    if (image && (typeof image !== 'string' || !/^\/images\/[a-zA-Z0-9/_.-]+$/.test(image))) throw new Error('Use an uploaded image with a filename containing English letters, numbers, hyphens or underscores.');
    validateTags(data.get('tags'), 'Shared tags');
    const translations = data.get('translations');
    for (const locale of languages) {
      const translation = fieldValue(translations, locale);
      if (!translation) continue;
      for (const name of ['title', 'slug', 'description', 'body', 'imageAlt', 'seoTitle', 'seoDescription']) {
        const value = fieldValue(translation, name);
        if (value !== undefined && value !== null && typeof value !== 'string') throw new Error(`${languageNames[locale]}: ${name} must be text.`);
      }
      const slug = fieldValue(translation, 'slug');
      if (hasText(slug) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${languageNames[locale]}: use lowercase English letters, numbers and hyphens for the URL slug.`);
      validateTags(fieldValue(translation, 'tags'), `${languageNames[locale]} tags`);
      const seoTitle = fieldValue(translation, 'seoTitle');
      const seoDescription = fieldValue(translation, 'seoDescription');
      if (seoTitle?.length > 100 || seoDescription?.length > 200) throw new Error(`${languageNames[locale]}: keep SEO title within 100 characters and SEO description within 200.`);
      const complete = ['title', 'slug', 'description', 'body'].every(name => hasText(fieldValue(translation, name)));
      if (complete && image && !hasText(fieldValue(translation, 'imageAlt'))) throw new Error(`${languageNames[locale]}: please add alternative text for the featured image.`);
    }
    return data;
  }
});
