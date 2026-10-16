import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { posts, postUrl } from '../lib/blog';
import { site } from '../lib/site';
export async function GET(context: APIContext) {
  return rss({ title: site.title, description: site.description, site: context.site!, items: (await posts()).map(post => ({ title: post.data.title, pubDate: post.data.pubDate, description: post.data.description, link: postUrl(post), categories: post.data.tags })), customData: '<language>en</language>' });
}
