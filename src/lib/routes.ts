import { getCollection } from 'astro:content';
import { posts, allTags, postUrl, isPublished, slugify } from './blog';
import { locales, localePath, type Locale } from './i18n';
export const sections = ['', 'blog', 'diary', 'anime', 'cosplay', 'gaming', 'writing', 'about', 'archive', 'tags'] as const;
export const legacyEntries = async () => (await getCollection('blog')).filter(post => !post.id.startsWith('__i18n/') && isPublished(post));
export const legacyTarget = (post: Awaited<ReturnType<typeof legacyEntries>>[number]) => postUrl(post);
export async function pageAlternates(path: string): Promise<Partial<Record<Locale, string>>> {
  const relative = path.replace(/^\/(uk|en|ja)(?=\/|$)/, '').replace(/^\/|\/$/g, '');
  const post = (await posts()).find(post => postUrl(post) === path);
  if (post) return Object.fromEntries((await posts()).filter(other => other.data.translationKey === post.data.translationKey).map(other => [other.data.language, postUrl(other)]));
  if (relative.startsWith('blog/')) return {};
  const result: Partial<Record<Locale, string>> = {};
  for (const locale of locales) {
    if (relative.startsWith('tags/') && !(await allTags(locale)).some(tag => `tags/${slugify(tag)}` === relative)) continue;
    if (relative === '404') continue;
    result[locale] = localePath(locale, relative);
  }
  return result;
}
