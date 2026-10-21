import { getCollection, type CollectionEntry } from 'astro:content';
import { comparePosts, isPublished, tagNames } from './post-utils';
import type { Locale } from './i18n';

export type Post = CollectionEntry<'blog'>;
export * from './post-utils';
export async function posts(locale?: Locale) {
  const entries = (await getCollection('blog')).filter(post => post.data.language !== 'multilingual' && isPublished(post));
  const keys = new Set<string>();
  const urls = new Set<string>();
  for (const post of entries) {
    const key = `${post.data.language}:${post.data.translationKey}`;
    const url = `${post.data.language}:${post.data.slug || post.id}`;
    if (keys.has(key) || urls.has(url)) throw new Error(`Duplicate translation or URL for ${post.id}: ${key} / ${url}. Each language needs a unique translationKey and URL slug.`);
    keys.add(key); urls.add(url);
  }
  return entries.filter(post => !locale || post.data.language === locale).sort(comparePosts);
}
export const allTags = async (locale?: Locale) => tagNames(await posts(locale));
export const translations = async (post: Post) => (await posts()).filter(other => other.data.translationKey === post.data.translationKey);
