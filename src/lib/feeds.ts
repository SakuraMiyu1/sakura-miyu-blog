import rss from '@astrojs/rss';
import { posts, postUrl } from './blog';
import { t, topicLabel, type Locale } from './i18n';
import { site } from './site';
export async function feed(locale: Locale, origin: URL) {
  return rss({ title: `${site.title} · ${locale.toUpperCase()}`, description: t(locale, 'siteDescription'), site: origin, xmlns: { dc: 'http://purl.org/dc/elements/1.1/' }, items: (await posts(locale)).map(post => ({ title: post.data.title, pubDate: post.data.pubDate, description: post.data.description, link: postUrl(post), categories: [...new Set([post.data.category, ...post.data.tags])].map(tag => topicLabel(tag, locale)), customData: `<dc:language>${locale}</dc:language>` })), customData: `<language>${locale}</language>` });
}
export async function searchIndex(locale: Locale) {
  return new Response(JSON.stringify((await posts(locale)).map(post => ({ id: post.id, url: postUrl(post), language: locale, title: post.data.title, description: post.data.description, tags: post.data.tags, category: post.data.category, content: `${topicLabel(post.data.category, locale)} ${post.data.tags.map(tag => topicLabel(tag, locale)).join(' ')} ${(post.body || '').replace(/<[^>]*>/g, ' ').replace(/[#*_`]/g, '')}` }))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
