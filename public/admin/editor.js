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
      h('div', { role: 'tablist', 'aria-label': `${this.props.field.get('label') || 'Content'} language`, 'aria-orientation': 'horizontal', className: 'sakura-language-tabs' },
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

const arrayValue = value => value?.toArray ? value.toArray() : Array.isArray(value) ? value : [];
const plainText = (value, locale) => fieldValue(value, locale) || '';

CMS.registerPreviewTemplate('comics', ({ entry, getAsset }) => {
  const data = entry.get('data');
  const titles = data.get('titles');
  const descriptions = data.get('descriptions');
  const cover = data.get('cover');
  const chapters = arrayValue(data.get('chapters'));
  return h('article', { className: 'comic-preview' },
    h('p', null, `Sakura Miyu Comics · ${data.get('status') || 'coming-soon'} · ${data.get('publicationStatus') || 'draft'}`),
    cover && fieldValue(cover, 'src') ? h('img', { src: String(getAsset(fieldValue(cover, 'src'))), alt: plainText(fieldValue(cover, 'alt'), 'uk') }) : null,
    ...languages.map(locale => h('section', { key: locale, lang: locale },
      h('p', null, languageNames[locale]),
      h('h1', null, plainText(titles, locale) || 'Untitled'),
      h('p', null, plainText(descriptions, locale) || 'Description not added yet.'),
      h('h2', null, 'Issues'),
      chapters.length ? h('ol', null, ...chapters.map(chapter => {
        const pages = arrayValue(fieldValue(fieldValue(chapter, 'pages'), locale));
        return h('li', { key: fieldValue(chapter, 'id') },
          h('strong', null, plainText(fieldValue(chapter, 'titles'), locale) || fieldValue(chapter, 'id') || 'Untitled issue'),
          ` · ${fieldValue(chapter, 'publicationStatus') || 'draft'} · ${pages.length} page(s)`,
          pages.length ? h('div', { className: 'comic-preview-pages' }, ...pages.map(page => h('figure', { key: fieldValue(page, 'id') },
            h('img', { src: String(getAsset(fieldValue(page, 'src'))), alt: fieldValue(page, 'alt') || '' }),
            h('figcaption', null, fieldValue(page, 'id'))
          ))) : null
        );
      })) : h('p', null, 'No issues yet.')
    ))
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

function collectionName(collection, data) {
  if (collection?.get) return collection.get('name');
  if (collection?.name) return collection.name;
  const hasArticleId = data?.has ? data.has('translationKey') : Boolean(data?.value && Object.prototype.hasOwnProperty.call(data.value, 'translationKey'));
  return hasArticleId ? 'blog' : 'comics';
}

function validateArticle(entry) {
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

const safeId = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const safeComicAsset = value => typeof value === 'string' && /^\/(?:images\/comics|comics-media)\/[a-zA-Z0-9/_-]+\.(?:webp|avif)$/.test(value);

function validateLocalized(value, label, complete) {
  const missing = [];
  for (const locale of languages) {
    const text = fieldValue(value, locale);
    if (text !== undefined && text !== null && typeof text !== 'string') throw new Error(`${label} · ${languageNames[locale]} must be text.`);
    if (!hasText(text)) missing.push(locale);
  }
  if (complete && missing.length) throw new Error(`${label}: complete UA, EN and JP before publishing to main.`);
  return missing;
}

function validateComic(entry, publishing = false) {
  const data = entry.get('data');
  const comicId = data.get('id');
  if (!safeId(comicId)) throw new Error('Enter a unique Comic ID using lowercase English letters, numbers and hyphens.');
  if (!entry.get('newRecord') && entry.get('slug') && comicId !== entry.get('slug')) throw new Error('The Comic ID cannot change after creation.');
  if (!safeId(data.get('slug'))) throw new Error('Use lowercase English letters, numbers and hyphens for the comic URL slug.');
  validateLocalized(data.get('titles'), 'Comic titles', publishing);
  validateLocalized(data.get('descriptions'), 'Comic descriptions', publishing);
  const cover = data.get('cover');
  if (publishing && (!cover || !safeComicAsset(fieldValue(cover, 'src')))) throw new Error('Choose an optimized comic cover before publishing to main.');
  if (cover && fieldValue(cover, 'src') && !safeComicAsset(fieldValue(cover, 'src'))) throw new Error('Comic cover must be an uploaded WebP or AVIF image.');
  if (cover) validateLocalized(fieldValue(cover, 'alt'), 'Cover alternative text', publishing);
  const socialImage = data.get('socialImage');
  if (publishing && !safeComicAsset(socialImage)) throw new Error('Choose an optimized social image before publishing to main.');
  if (socialImage && !safeComicAsset(socialImage)) throw new Error('Social image must be an uploaded WebP or AVIF image.');
  const mode = data.get('publicationStatus') || 'draft';
  if (!['draft', 'preview', 'published'].includes(mode)) throw new Error('Choose Draft, Preview or Published for the comic.');
  if (mode === 'published' && data.get('approved') !== true) throw new Error('Turn on the explicit series publication confirmation before choosing Published.');
  const genres = arrayValue(data.get('genres'));
  if (publishing && !genres.length) throw new Error('Add at least one genre before publishing to main.');
  for (const genre of genres) validateLocalized(genre, 'Genre', publishing);
  const chapterIsEmpty = chapter => !hasText(fieldValue(chapter, 'id')) && !hasText(fieldValue(chapter, 'slug')) && !languages.some(locale => hasText(fieldValue(fieldValue(chapter, 'titles'), locale))) && !languages.some(locale => arrayValue(fieldValue(fieldValue(chapter, 'pages'), locale)).length);
  const originalChapters = arrayValue(data.get('chapters'));
  const chapters = originalChapters.filter(chapter => !chapterIsEmpty(chapter));
  const result = chapters.length === originalChapters.length ? data : data.set('chapters', data.get('chapters')?.filter ? data.get('chapters').filter(chapter => !chapterIsEmpty(chapter)) : chapters);
  const ids = new Set();
  const slugs = new Set();
  const orders = new Set();
  for (const chapter of chapters) {
    const chapterId = fieldValue(chapter, 'id');
    const slug = fieldValue(chapter, 'slug');
    const order = fieldValue(chapter, 'order');
    if (!safeId(chapterId) || !safeId(slug)) throw new Error('Every issue needs a lowercase Issue ID and URL slug.');
    if (!Number.isInteger(order) || order < 0 || ids.has(chapterId) || slugs.has(slug) || orders.has(order)) throw new Error('Issue IDs, URL slugs and order numbers must be unique.');
    ids.add(chapterId); slugs.add(slug); orders.add(order);
    validateLocalized(fieldValue(chapter, 'titles'), `Issue ${chapterId} titles`, publishing);
    const pubDate = fieldValue(chapter, 'pubDate');
    if (pubDate && !validDate(pubDate)) throw new Error(`Issue ${chapterId}: choose a valid publication date.`);
    const chapterMode = fieldValue(chapter, 'publicationStatus') || 'draft';
    if (!['draft', 'preview', 'published'].includes(chapterMode)) throw new Error(`Issue ${chapterId}: choose Draft, Preview or Published.`);
    if (chapterMode === 'published' && fieldValue(chapter, 'approved') !== true) throw new Error(`Issue ${chapterId}: turn on its explicit publication confirmation before choosing Published.`);
    const pagesByLanguage = fieldValue(chapter, 'pages');
    let reference = null;
    const missing = [];
    for (const locale of languages) {
      const pages = arrayValue(fieldValue(pagesByLanguage, locale));
      if (!pages.length) { missing.push(locale); continue; }
      const pageIds = [];
      const assets = new Set();
      for (const [index, page] of pages.entries()) {
        const pageId = fieldValue(page, 'id');
        const kind = fieldValue(page, 'kind');
        const src = fieldValue(page, 'src');
        if (!safeId(pageId) || !['cover', 'page'].includes(kind) || !safeComicAsset(src) || !hasText(fieldValue(page, 'alt'))) throw new Error(`Issue ${chapterId} · ${languageNames[locale]}: every page needs a safe ID, image, kind and alternative text.`);
        if ((index === 0 && kind !== 'cover') || (index > 0 && kind === 'cover') || pageIds.includes(pageId) || assets.has(src)) throw new Error(`Issue ${chapterId} · ${languageNames[locale]}: put one cover first and keep page IDs and images unique.`);
        const width = fieldValue(page, 'width');
        const height = fieldValue(page, 'height');
        if ((width != null || height != null) && (!Number.isInteger(width) || width < 1 || width > 2000 || !Number.isInteger(height) || height < 1 || height > 5000)) throw new Error(`Issue ${chapterId} · ${languageNames[locale]}: enter both image dimensions or leave both empty.`);
        pageIds.push(pageId); assets.add(src);
      }
      const signature = pageIds.join('|');
      if (reference === null) reference = signature;
      else if (signature !== reference) throw new Error(`Issue ${chapterId}: every available translation must keep matching Page IDs in the same order.`);
    }
    if (chapterMode === 'published' && reference === null) throw new Error(`Issue ${chapterId}: a Published issue cannot be empty.`);
    if (publishing && chapterMode === 'published' && missing.length && typeof window.confirm === 'function' && !window.confirm(`Issue ${chapterId} has no ${missing.map(locale => languageNames[locale]).join(', ')} pages. Publish the available languages anyway?`)) throw new Error(`Issue ${chapterId}: publication cancelled because a translation is missing.`);
  }
  return result;
}

CMS.registerEventListener({ name: 'preSave', handler: ({ entry, collection }) => collectionName(collection, entry.get('data')) === 'comics' ? validateComic(entry) : validateArticle(entry) });
CMS.registerEventListener({ name: 'prePublish', handler: ({ entry, collection }) => collectionName(collection, entry.get('data')) === 'comics' ? validateComic(entry, true) : entry.get('data') });
