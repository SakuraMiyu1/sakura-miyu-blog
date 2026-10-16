import type { Post } from './blog';

export const categories = ['Diary', 'Anime', 'Cosplay', 'Gaming', 'Writing', 'Gothic Kawaii', 'University', 'Creative Writing', 'Fanfiction'] as const;
export const normalizeText = (value: string) => value.normalize('NFKC').toLowerCase();
export const slugify = (value: string) => normalizeText(value).trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
export const postUrl = (post: Post) => `/blog/${post.id}/`;
export const tagUrl = (tag: string) => `/tags/${slugify(tag)}/`;
export const categoryUrl = (category: string) => `/categories/${slugify(category)}/`;
export const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
export const languageLabel = (language: string) => ({ multilingual: 'UA · EN · JP', uk: 'Українська', en: 'English', ja: '日本語' })[language] || language;
export const languageCodes = (language: string) => language === 'multilingual' ? ['uk', 'en', 'ja'] : [language];
export const readingTime = (post: Post) => Math.max(1, Math.ceil((post.body || '').split(/\s+/).length / 200));
export const comparePosts = (a: Post, b: Post) => b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.id.localeCompare(b.id);
export const isPublished = (post: Post, now = Date.now()) => !post.data.draft && post.data.pubDate.getTime() <= now;
export const hasTag = (post: Post, tag: string) => post.data.tags.some(value => slugify(value) === slugify(tag));
export const matchesCategory = (post: Post, category: string) => slugify(post.data.category) === slugify(category) || hasTag(post, category);

export function tagNames(entries: Post[], includeMain = true) {
  const names = new Map<string, string>();
  for (const tag of [...(includeMain ? categories : []), ...entries.flatMap(post => post.data.tags)]) {
    const slug = slugify(tag);
    if (slug && !names.has(slug)) names.set(slug, tag);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'en'));
}

export function relatedPosts(post: Post, entries: Post[], limit = 3) {
  const tags = new Set(post.data.tags.map(slugify));
  const unique = new Map(entries.filter(other => other.id !== post.id).map(other => [other.id, other]));
  return [...unique.values()].map(other => ({
    post: other,
    score: new Set(other.data.tags.map(slugify).filter(tag => tags.has(tag))).size * 2 + Number(slugify(other.data.category) === slugify(post.data.category))
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || comparePosts(a.post, b.post)).slice(0, limit).map(item => item.post);
}

export function archiveGroups(entries: Post[]) {
  const years = new Map<number, Map<number, Post[]>>();
  for (const post of [...entries].sort(comparePosts)) {
    const year = post.data.pubDate.getUTCFullYear();
    const month = post.data.pubDate.getUTCMonth();
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(post);
  }
  return [...years].map(([year, months]) => ({ year, months: [...months].map(([month, posts]) => ({
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month))),
    posts
  })) }));
}
