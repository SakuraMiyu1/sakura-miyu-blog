import migration from '../../cms/article-migration.json' with { type: 'json' };
import { postUrl } from './post-utils.ts';
import { localePath, type Locale } from './i18n.ts';
import type { Post } from './blog';

export const migratedArticles = migration.articles;
export const migrationForSource = (id: string) => migratedArticles.find(article => article.sources.some(source => source.id === id));
export function migrationAliases(locale: Locale, entries: Post[]) {
  const canonical = new Set(entries.map(postUrl));
  const redirects: Array<{ path: string; to: string }> = [];
  for (const article of migratedArticles) {
    const original = article.translations[locale as keyof typeof article.translations];
    if (!original) continue;
    const current = entries.find(entry => entry.data.translationKey === article.key);
    const to = current ? postUrl(current) : localePath(locale);
    if (original.url === to) continue;
    if (canonical.has(original.url)) throw new Error(`A new article cannot reuse the legacy URL ${original.url}.`);
    redirects.push({ path: original.url.replace(`/${locale}/`, '').replace(/\/$/, ''), to });
  }
  return redirects;
}
