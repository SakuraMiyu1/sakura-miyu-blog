const CMS = window.CMS;
const React = window.h ? null : window.React;

CMS.registerPreviewStyle('/admin/preview.css');
CMS.registerPreviewTemplate('blog', ({ entry, widgetFor, getAsset }) => {
  const h = window.h || React.createElement;
  const data = entry.get('data');
  const image = data.get('image');
  return h('article', { className: 'diary-preview' },
    h('p', null, 'Sakura Miyu · ', data.get('category'), ' · ', data.get('language')),
    h('h1', null, data.get('title')),
    h('p', null, data.get('description')),
    image ? h('img', { src: String(getAsset(image)), alt: data.get('imageAlt') || '' }) : null,
    widgetFor('body')
  );
});

CMS.registerEventListener({
  name: 'preSave',
  handler: ({ entry }) => {
    let data = entry.get('data');
    const existingSlug = entry.get('slug');
    if (!entry.get('newRecord') && existingSlug) data = data.set('slug', existingSlug);
    if (entry.get('newRecord') && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.get('slug') || '')) throw new Error('Enter a unique URL slug using lowercase English letters, numbers and hyphens.');
    if (data.get('image') && !data.get('imageAlt')?.trim()) throw new Error('Please add alternative text for the featured image.');
    if (data.get('image') && !/^\/images\/[a-zA-Z0-9/_.-]+$/.test(data.get('image'))) throw new Error('Use an uploaded image with a filename containing English letters, numbers, hyphens or underscores.');
    if (data.get('tags')?.some(tag => typeof tag !== 'string' || !/[\p{L}\p{N}]/u.test(tag))) throw new Error('Each tag must contain a letter or number.');
    const body = data.get('body') || '';
    if (data.get('language') === 'multilingual') {
      for (const [language, anchor] of [['uk', 'ukrainian'], ['en', 'english'], ['ja', 'japanese']]) {
        if (!new RegExp(`lang=["']${language}["']`).test(body) || !new RegExp(`id=["']${anchor}["']`).test(body)) throw new Error('Keep the three language sections and their anchor IDs, or select a single language. See the writing guide.');
      }
    }
    return data;
  }
});
