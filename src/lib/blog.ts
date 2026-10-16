import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export const categories = ['Diary', 'Anime', 'Cosplay', 'Gaming', 'Writing', 'Gothic Kawaii', 'University', 'Creative Writing', 'Fanfiction'];
export const slugify = (value: string) => value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
export const postUrl = (post: Post) => `/blog/${post.id}/`;
export const tagUrl = (tag: string) => `/tags/${slugify(tag)}/`;
export const categoryUrl = (category: string) => `/categories/${slugify(category)}/`;
export const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
export const languageLabel = (language: string) => ({ multilingual: 'UA · EN · JP', uk: 'Українська', en: 'English', ja: '日本語' })[language] || language;
export const posts = async () => (await getCollection('blog', ({ data }) => !data.draft && data.pubDate.getTime() <= Date.now()))
  .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.id.localeCompare(b.id));
export const allTags = async () => [...new Set([...(await posts()).flatMap(post => post.data.tags), ...categories])].sort();
export const readingTime = (post: Post) => Math.max(1, Math.ceil((post.body || '').split(/\s+/).length / 200));
