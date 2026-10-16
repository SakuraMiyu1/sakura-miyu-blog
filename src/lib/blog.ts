import { getCollection, type CollectionEntry } from 'astro:content';
import { comparePosts, isPublished, tagNames } from './post-utils';

export type Post = CollectionEntry<'blog'>;
export * from './post-utils';
export const posts = async () => (await getCollection('blog')).filter(post => isPublished(post)).sort(comparePosts);
export const allTags = async () => tagNames(await posts());
