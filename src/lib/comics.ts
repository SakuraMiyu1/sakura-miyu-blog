import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { comicSchema, comicLocales, isListedComic, type Comic } from './comics-data.ts';

export function loadComics({ demo = process.env.COMICS_DEMO === '1' } = {}): Comic[] {
  if (demo && process.env.CF_PAGES) throw new Error('Local comic demos cannot be built on Cloudflare Pages.');
  const directory = path.resolve('src/data/comics');
  const comics = readdirSync(directory).filter(file => file.endsWith('.json')).sort().map(file => comicSchema.parse(JSON.parse(readFileSync(path.join(directory, file), 'utf8'))));
  if (new Set(comics.map(comic => comic.id)).size !== comics.length || new Set(comics.map(comic => comic.slug)).size !== comics.length) throw new Error('Comic IDs and slugs must be unique.');
  if (comics.some(comic => comic.demo)) throw new Error('Demo records belong in the local fixture, not src/data/comics.');
  if (demo) comics.push(demoComic());
  return comics.filter(isListedComic);
}

export function demoComic(): Comic {
  const titles = { uk: 'Тестова читалка — не комікс', en: 'Reader demo — not a comic', ja: 'リーダーのテスト・コミック本編ではありません' };
  return comicSchema.parse({
    id: 'reader-demo', slug: 'reader-demo', titles,
    descriptions: { uk: 'Локальні тестові сторінки для перевірки читалки. Не матеріали «Двох королев Туману».', en: 'Local test pages for checking the reader. Not artwork from Two Queens of the Fog.', ja: 'リーダー動作確認用のローカルテストページです。「霧の二人の女王」の本編ではありません。' },
    cover: { src: '/images/comics/two-queens-coming-soon.webp', width: 900, height: 1200, alt: titles }, socialImage: '/images/comics/two-queens-coming-soon-social.webp',
    status: 'ongoing', genres: [{ uk: 'Локальний тест', en: 'Local test', ja: 'ローカルテスト' }], approved: true, publicationStatus: 'published', fanContent: 'dead-by-daylight', demo: true,
    chapters: ['prologue', 'issue-01', 'unapproved-test'].map((id, index) => ({
      id, slug: id, order: index, titles: { uk: `ТЕСТ · ${index === 0 ? 'Передісторія' : 'Випуск ' + index}`, en: `TEST · ${index === 0 ? 'Prologue' : 'Issue ' + index}`, ja: `テスト・${index === 0 ? '前日譚' : '第' + index + '話'}` },
      approved: index < 2, publicationStatus: index < 2 ? 'published' : 'draft',
      pages: Object.fromEntries(comicLocales.filter(locale => !(index === 1 && locale === 'ja')).map(locale => [locale, ['cover', 'page-01', 'page-02'].map((page, number) => ({ id: page, kind: number === 0 ? 'cover' : 'page', src: `/comics-demo-assets/${locale}/${id}/${page}.webp`, width: 900, height: 1200, alt: `${titles[locale]} · ${index + 1} · ${number + 1}` }))]))
    }))
  });
}
