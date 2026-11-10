import { z } from 'astro/zod';

export const comicLocales = ['uk', 'en', 'ja'] as const;
export type ComicLocale = typeof comicLocales[number];
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const localizedText = z.object({ uk: z.string().trim().min(1), en: z.string().trim().min(1), ja: z.string().trim().min(1) }).strict();
const imagePath = z.string().regex(/^\/(?:images\/comics|comics-demo-assets)\/[a-zA-Z0-9/_-]+\.(?:webp|avif)$/);
const image = z.object({ src: imagePath, width: z.number().int().min(1).max(2000), height: z.number().int().min(1).max(5000) }).strict();
const page = image.extend({ id, kind: z.enum(['cover', 'page']), alt: z.string().trim().min(1) }).strict();
const publication = { approved: z.boolean(), publicationStatus: z.enum(['draft', 'published']) };
const chapter = z.object({ id, slug: id, order: z.number().int().min(0), titles: localizedText, ...publication, pages: z.object({ uk: z.array(page).optional(), en: z.array(page).optional(), ja: z.array(page).optional() }).strict() }).strict();
export const comicSchema = z.object({
  id, slug: id, titles: localizedText, descriptions: localizedText,
  cover: image.extend({ alt: localizedText }).strict(), socialImage: imagePath,
  status: z.enum(['coming-soon', 'ongoing', 'completed']), genres: z.array(localizedText).min(1),
  ...publication, announcement: z.object({ approved: z.boolean(), published: z.boolean() }).strict().optional(), fanContent: z.literal('dead-by-daylight'), chapters: z.array(chapter), demo: z.boolean().optional()
}).strict().superRefine((comic, ctx) => {
  const seen = new Set<string>();
  const orders = new Set<number>();
  for (const [index, issue] of comic.chapters.entries()) {
    if (seen.has(issue.slug) || seen.has(issue.id) || orders.has(issue.order)) ctx.addIssue({ code: 'custom', path: ['chapters', index], message: 'Chapter IDs, slugs and order must be unique.' });
    seen.add(issue.id); seen.add(issue.slug); orders.add(issue.order);
    const reference = comicLocales.map(locale => issue.pages[locale]).find(pages => pages?.length);
    const usedImages = new Set<string>();
    for (const locale of comicLocales) {
      const pages = issue.pages[locale];
      if (!pages?.length) continue;
      for (const page of pages) {
        const prefix = comic.demo ? `/comics-demo-assets/${locale}/${issue.id}/` : `/images/comics/${comic.id}/${issue.id}/${locale}/`;
        if (!page.src.startsWith(prefix) || usedImages.has(page.src)) ctx.addIssue({ code: 'custom', path: ['chapters', index, 'pages', locale], message: 'Each language needs its own prepared images in its chapter/language directory.' });
        usedImages.add(page.src);
      }
      if (pages[0].kind !== 'cover' || pages.slice(1).some(page => page.kind === 'cover') || new Set(pages.map(page => page.id)).size !== pages.length) ctx.addIssue({ code: 'custom', path: ['chapters', index, 'pages', locale], message: 'Put one cover first and use unique stable page IDs.' });
      if (pages.map(page => page.id).join('|') !== reference?.map(page => page.id).join('|')) ctx.addIssue({ code: 'custom', path: ['chapters', index, 'pages', locale], message: 'Translations must keep the same page IDs and order; Japanese is not reversed.' });
    }
    if (issue.approved && issue.publicationStatus === 'published' && !reference) ctx.addIssue({ code: 'custom', path: ['chapters', index], message: 'A published chapter needs at least one complete language.' });
  }
  const assets = [comic.cover.src, comic.socialImage, ...comic.chapters.flatMap(chapter => comicLocales.flatMap(locale => chapter.pages[locale]?.map(page => page.src) || []))];
  if (!comic.demo && assets.some(path => path.startsWith('/comics-demo-assets/'))) ctx.addIssue({ code: 'custom', message: 'Demo assets cannot be used in real comics.' });
});
export type Comic = z.infer<typeof comicSchema>;
export type ComicChapter = Comic['chapters'][number];
export const isPublicComic = (comic: Comic) => comic.approved && comic.publicationStatus === 'published';
export const isListedComic = (comic: Comic) => isPublicComic(comic) || Boolean(comic.announcement?.approved && comic.announcement.published);
export const publishedChapters = (comic: Comic) => isPublicComic(comic) ? comic.chapters.filter(chapter => chapter.approved && chapter.publicationStatus === 'published' && comicLocales.some(locale => chapter.pages[locale]?.length)).sort((a, b) => a.order - b.order) : [];
export const chapterLanguages = (chapter: ComicChapter) => comicLocales.filter(locale => chapter.pages[locale]?.length);
export const comicPath = (locale: ComicLocale, comic?: Comic, chapter?: ComicChapter) => `/${locale}/comics/${comic ? comic.slug + '/' : ''}${chapter ? chapter.slug + '/' : ''}`;
export const chapterAlternates = (comic: Comic, chapter: ComicChapter) => Object.fromEntries(chapterLanguages(chapter).map(locale => [locale, comicPath(locale, comic, chapter)]));
export function comicIndexablePaths(comics: Comic[]) {
  return comicLocales.flatMap(locale => [`/${locale}/comics/`, ...comics.filter(comic => isListedComic(comic) && !comic.demo).flatMap(comic => [comicPath(locale, comic), ...publishedChapters(comic).filter(chapter => chapter.pages[locale]?.length).map(chapter => comicPath(locale, comic, chapter))])]);
}
