import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { categories } from './lib/post-utils';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.preprocess(value => value === null || value === '' ? undefined : value, z.coerce.date().optional()),
    tags: z.array(z.string().trim().min(1).regex(/[\p{L}\p{N}]/u, 'A tag must contain a letter or number.')).default([]),
    category: z.enum(categories).default('Diary'),
    language: z.enum(['multilingual', 'uk', 'en', 'ja']).default('en'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    image: z.string().regex(/^\/images\/[a-zA-Z0-9/_.-]+$/).optional(),
    imageAlt: z.string().optional()
  })
});

export const collections = { blog };
