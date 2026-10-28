import { getCollection } from 'astro:content';
import { posts, allTags, postUrl, isPublished, slugify } from './blog';
import { locales, localePath, type Locale } from './i18n';
import { migrationForSource, migrationAliases } from './article-migration';
export const sections = ['', 'blog', 'diary', 'anime', 'cosplay', 'gaming', 'writing', 'about', 'archive', 'tags'] as const;
export const legacyEntries = async () => (await getCollection('blog')).filter(post => !post.id.startsWith('__') && isPublished(post));
export async function legacyTarget(post: Awaited<ReturnType<typeof legacyEntries>>[number]) {
  const migrated = migrationForSource(post.id);
  if (!migrated) return postUrl(post);
  const locale = post.data.language === 'multilingual' ? 'uk' : post.data.language;
  const target = (await posts(locale)).find(entry => entry.data.translationKey === migrated.key);
  return target ? postUrl(target) : localePath(locale);
}
export async function localizedLegacyRedirects(locale: Locale) {
  return migrationAliases(locale, await posts(locale));
}
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
