import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadComics } from '../src/lib/comics.ts';
import { publishedChapters, comicLocales } from '../src/lib/comics-data.ts';

const comics = loadComics({ demo: false });
const allowed = new Map();
for (const comic of comics) {
  allowed.set(comic.cover.src, comic.cover);
  allowed.set(comic.socialImage, null);
  for (const chapter of publishedChapters(comic)) for (const locale of comicLocales) for (const page of chapter.pages[locale] || []) allowed.set(page.src, page);
}
const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
const files = await walk('public/images/comics');
for (const filename of files) {
  const url = '/' + path.relative('public', filename).split(path.sep).join('/');
  if (!allowed.has(url)) throw new Error(`Unapproved or unreferenced comic asset in public: ${filename}. Keep draft images and originals outside the public repository.`);
}
for (const [url, expected] of allowed) {
  const filename = path.join('public', url);
  const [info, metadata] = await Promise.all([stat(filename), sharp(filename).metadata()]);
  if (!['webp', 'avif'].includes(metadata.format) || metadata.width > 2000 || metadata.height > 5000 || info.size > 5 * 1024 * 1024) throw new Error(`Comic asset must be an optimized WebP/AVIF reader copy, not a high-resolution original: ${url}`);
  if (expected && (metadata.width !== expected.width || metadata.height !== expected.height)) throw new Error(`Incorrect comic image dimensions: ${url}`);
}
console.log(`Comics verified: ${comics.length} announced series, ${comics.reduce((count, comic) => count + publishedChapters(comic).length, 0)} approved published issues, ${allowed.size} optimized public assets; draft material excluded.`);
