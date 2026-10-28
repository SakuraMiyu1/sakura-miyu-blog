import { z } from 'astro/zod';
import { contentLocales, type ContentLocale } from './content-languages.ts';
import { categories } from './post-utils.ts';

const emptyValue = (value: unknown) => value === null ? undefined : value;
const optionalText = z.preprocess(emptyValue, z.string().default(''));
const slug = z.preprocess(emptyValue, z.string().refine(value => value === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), 'Use lowercase letters, numbers and hyphens.').default(''));
const tags = z.array(z.string().trim().min(1).regex(/[\p{L}\p{N}]/u));
const translation = z.object({
  title: optionalText,
  slug,
  description: optionalText,
  imageAlt: optionalText,
  seoTitle: z.preprocess(emptyValue, z.string().max(100).default('')),
  seoDescription: z.preprocess(emptyValue, z.string().max(200).default('')),
  body: optionalText,
  tags: z.preprocess(emptyValue, tags.optional())
});
const emptyDate = z.preprocess(value => value === null || value === '' ? undefined : value, z.coerce.date().optional());
const recordSchema = z.object({
  translationKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  pubDate: z.preprocess(emptyValue, z.coerce.date()),
  updatedDate: emptyDate,
  category: z.enum(categories).default('Diary'),
  image: z.preprocess(value => value === null || value === '' ? undefined : value, z.string().regex(/^\/images\/[a-zA-Z0-9/_.-]+$/).optional()),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  tags: z.preprocess(emptyValue, tags.default([])),
  translations: z.preprocess(emptyValue, z.object({ uk: z.preprocess(emptyValue, translation.optional()), en: z.preprocess(emptyValue, translation.optional()), ja: z.preprocess(emptyValue, translation.optional()) }).default({}))
});
export type ArticleRecord = z.infer<typeof recordSchema>;
export type ArticleTranslation = z.infer<typeof translation>;
export function completeTranslation(value?: Partial<ArticleTranslation>): value is ArticleTranslation {
  return Boolean(value && ['title', 'slug', 'description', 'body'].every(key => typeof value[key as keyof ArticleTranslation] === 'string' && String(value[key as keyof ArticleTranslation]).trim()));
}
export function parseArticle(value: unknown, filename: string) {
  const article = recordSchema.parse(value);
  if (article.translationKey !== filename) throw new Error(`Article ID ${article.translationKey} must match filename ${filename}.json.`);
  return article;
}
export function articleVersions(article: ArticleRecord) {
  const { translations, ...shared } = article;
  return contentLocales.flatMap(language => {
    const value = translations[language];
    if (!completeTranslation(value)) return [];
    if (shared.image && !value.imageAlt.trim()) throw new Error(`Add ${language} image alternative text to ${article.translationKey}.`);
    const { body, tags: localizedTags, ...metadata } = value;
    return [{ language: language as ContentLocale, body, data: { ...shared, ...metadata, tags: localizedTags ?? shared.tags, language, legacyOnly: false } }];
  });
}
