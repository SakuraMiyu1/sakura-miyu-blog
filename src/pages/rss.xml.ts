import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { posts, postUrl, languageCodes } from '../lib/blog';
import { site } from '../lib/site';
export async function GET(context: APIContext) {
  return rss({ title: site.title, description: site.description, site: context.site!, xmlns: { dc: 'http://purl.org/dc/elements/1.1/' }, items: (await posts()).map(post => ({ title: post.data.title, pubDate: post.data.pubDate, description: post.data.description, link: postUrl(post), categories: [...new Set([post.data.category, ...post.data.tags])], customData: languageCodes(post.data.language).map(language => `<dc:language>${language}</dc:language>`).join('') })), customData: '<language>en</language>' });
}
