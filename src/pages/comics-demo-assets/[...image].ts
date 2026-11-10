import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { loadComics } from '../../lib/comics';
import { comicLocales, publishedChapters } from '../../lib/comics-data';

export const getStaticPaths: GetStaticPaths = () => loadComics().filter(comic => comic.demo).flatMap(comic => publishedChapters(comic).flatMap(chapter => comicLocales.flatMap(locale => (chapter.pages[locale] || []).map((page, index) => ({ params: { image: page.src.slice('/comics-demo-assets/'.length) }, props: { locale, number: index + 1, chapter: chapter.order + 1 } })))));
export const GET: APIRoute = async ({ props }) => {
  const { locale, number, chapter } = props;
  const label = { uk: 'ТЕСТОВА СТОРІНКА', en: 'TEST PAGE', ja: 'テストページ' }[locale as 'uk' | 'en' | 'ja'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#17121c"/><rect x="40" y="40" width="820" height="1120" rx="25" fill="#fff0f5" stroke="#e8a0bf" stroke-width="4"/><g fill="none" stroke="#c2185b" stroke-width="3"><rect x="90" y="260" width="720" height="300"/><rect x="90" y="590" width="340" height="350"/><rect x="470" y="590" width="340" height="350"/></g><g font-family="sans-serif" text-anchor="middle" fill="#21131f"><text x="450" y="150" font-size="32">${label}</text><text x="450" y="210" font-size="24">LOCAL DEMO · ${String(locale).toUpperCase()}</text><text x="450" y="430" font-size="64">${chapter} / ${number}</text><text x="450" y="1030" font-size="22">NOT COMIC ARTWORK</text><text x="450" y="1080" font-size="21">Sakura Miyu Comics · Reader test</text></g></svg>`;
  const bytes = await sharp(Buffer.from(svg)).webp({ quality: 78 }).toBuffer();
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/webp', 'X-Robots-Tag': 'noindex' } });
};
