import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadComics } from '../src/lib/comics.ts';
import { publishedChapters, comicLocales, publicComicAssets } from '../src/lib/comics-data.ts';

const comics = loadComics({ demo: false });
const allowed = new Map();
for (const comic of comics) {
  for (const asset of publicComicAssets(comic)) {
    const page = comic.cover.src === asset ? comic.cover : comic.chapters.flatMap(chapter => comicLocales.flatMap(locale => chapter.pages[locale] || [])).find(page => page.src === asset);
    allowed.set(asset, page || null);
  }
}
const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
const files = await walk('public/images/comics');
for (const filename of files) {
  const url = '/' + path.relative('public', filename).split(path.sep).join('/');
  if (!allowed.has(url)) throw new Error(`Unapproved or unreferenced comic asset in public: ${filename}. Keep draft images and originals outside the public repository.`);
}
const sourceRoot = 'src/content/comics-media';
const sourceFiles = await access(sourceRoot).then(() => walk(sourceRoot), () => []);
for (const filename of sourceFiles) {
  const relative = path.relative(sourceRoot, filename).split(path.sep).join('/');
  if (!/^[a-zA-Z0-9/_-]+\.(?:webp|avif)$/.test(relative)) throw new Error(`Comic CMS media must be optimized WebP/AVIF with a safe filename: ${filename}`);
  const [info, metadata] = await Promise.all([stat(filename), sharp(filename).metadata()]);
  if (!['webp', 'avif'].includes(metadata.format) || metadata.width > 2000 || metadata.height > 5000 || info.size > 5 * 1024 * 1024) throw new Error(`Comic CMS media must be an optimized WebP/AVIF reader copy: ${filename}`);
}
for (const [url, expected] of allowed) {
  const filename = url.startsWith('/comics-media/') ? path.join(sourceRoot, url.slice('/comics-media/'.length)) : path.join('public', url);
  const [info, metadata] = await Promise.all([stat(filename), sharp(filename).metadata()]);
  if (!['webp', 'avif'].includes(metadata.format) || metadata.width > 2000 || metadata.height > 5000 || info.size > 5 * 1024 * 1024) throw new Error(`Comic asset must be an optimized WebP/AVIF reader copy, not a high-resolution original: ${url}`);
  if (expected?.width && expected?.height && (metadata.width !== expected.width || metadata.height !== expected.height)) throw new Error(`Incorrect comic image dimensions: ${url}`);
}
console.log(`Comics verified: ${comics.length} announced series, ${comics.reduce((count, comic) => count + publishedChapters(comic).length, 0)} approved published issues, ${allowed.size} deployable optimized assets; ${sourceFiles.length} CMS source assets remain gated by publication data.`);
