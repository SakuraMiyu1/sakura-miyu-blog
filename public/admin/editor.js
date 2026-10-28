const CMS = window.CMS;
const h = window.h || window.React.createElement;
const languages = ['uk', 'en', 'ja'];
const languageNames = { uk: '🇺🇦 Українська (UA)', en: '🇬🇧 English (EN)', ja: '🇯🇵 日本語 (JP)' };
const objectWidget = CMS.getWidget('object');
const fieldValue = (value, key) => value?.get ? value.get(key) : value?.[key];
const hasText = value => typeof value === 'string' && value.trim().length > 0;

class TranslationTabsControl extends objectWidget.control {
  constructor(props) {
    super(props);
    this.state = { ...this.state, activeLocale: 'uk' };
    this.tabButtons = {};
  }

  selectLocale(locale, focus = false) {
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
    if (languages.includes(locale)) this.setState({ activeLocale: locale }, () => super.focus(path));
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
CMS.registerPreviewTemplate('blog', ({ entry, fields, fieldsMetaData, widgetFor, getAsset }) => {
  const data = entry.get('data');
  const image = data.get('image');
  const translations = data.get('translations');
  const translationFields = fields.find(field => field.get('name') === 'translations').get('fields');
  const previews = languages.map(locale => {
    const translation = fieldValue(translations, locale);
    if (!translation || !['title', 'slug', 'description', 'body'].every(name => hasText(fieldValue(translation, name)))) return null;
    const localeFields = translationFields.find(field => field.get('name') === locale).get('fields');
    const metadata = fieldsMetaData?.getIn?.(['translations', locale]) || fieldsMetaData;
    return h('section', { key: locale, lang: locale },
      h('p', null, languageNames[locale]),
      h('h2', null, fieldValue(translation, 'title')),
      h('p', null, fieldValue(translation, 'description')),
      image ? h('img', { src: String(getAsset(image)), alt: fieldValue(translation, 'imageAlt') || '' }) : null,
      widgetFor('body', localeFields, translation, metadata),
      h('hr')
    );
  }).filter(Boolean);
  return h('article', { className: 'diary-preview' },
    h('p', null, `Sakura Miyu · ${data.get('category') || ''} · ${data.get('translationKey') || ''}`),
    h('h1', null, 'Article preview'),
    ...previews,
    previews.length ? null : h('p', null, 'Complete Title, URL slug, Description and Story in any language to preview its public version. Partial translations remain saved.')
  );
});

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
