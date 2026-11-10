import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { comicSchema, isPublicComic, isListedComic, publishedChapters, chapterLanguages, comicIndexablePaths, comicPath } from '../src/lib/comics-data.ts';
import { demoComic, loadComics } from '../src/lib/comics.ts';
import { selectComicPage, comicZoom, comicProgressKey } from '../src/lib/comic-reader-state.ts';

const source = JSON.parse(await readFile('src/data/comics/two-queens-of-the-fog.json', 'utf8'));
test('The initial catalog announces the series but publishes no issues or draft paths', () => {
  const comic = comicSchema.parse(source);
  assert.equal(isPublicComic(comic), false);
  assert.equal(isListedComic(comic), true);
  assert.equal(comic.status, 'coming-soon');
  assert.deepEqual(publishedChapters(comic), []);
  assert.equal(comic.chapters.find(chapter => chapter.id === 'prologue').approved, false);
  const paths = comicIndexablePaths([comic]);
  assert.equal(paths.length, 6);
  assert.ok(paths.every(path => !path.includes('prologue') && !path.includes('issue-01')));
});
test('Both approval and publication are required at series and chapter level', () => {
  const comic = demoComic();
  assert.equal(publishedChapters(comic).length, 2);
  comic.chapters[0].approved = false;
  assert.deepEqual(publishedChapters(comic).map(chapter => chapter.id), ['issue-01']);
  comic.chapters[0].approved = true;
  comic.chapters[0].publicationStatus = 'draft';
  assert.equal(publishedChapters(comic).length, 1);
  comic.approved = false;
  comic.announcement = { approved: true, published: true };
  assert.equal(isListedComic(comic), true, 'An approved announcement can remain visible');
  assert.deepEqual(publishedChapters(comic), []);
});
test('Translations use independent image paths and preserve the original stable page order', () => {
  const comic = demoComic();
  assert.deepEqual(chapterLanguages(comic.chapters[0]), ['uk', 'en', 'ja']);
  assert.deepEqual(chapterLanguages(comic.chapters[1]), ['uk', 'en']);
  const swapped = structuredClone(comic);
  swapped.chapters[0].pages.ja.reverse();
  assert.equal(comicSchema.safeParse(swapped).success, false);
  const reused = structuredClone(comic);
  reused.chapters[0].pages.en[0].src = reused.chapters[0].pages.uk[0].src;
  assert.equal(comicSchema.safeParse(reused).success, false);
  const partial = structuredClone(comic);
  partial.chapters[0].pages.en.pop();
  assert.equal(comicSchema.safeParse(partial).success, false);
});
test('Malformed image paths, missing alt, duplicate chapters and published empty issues fail validation', () => {
  for (const edit of [comic => { comic.cover.src = '/images/comics/../../private.webp'; }, comic => { comic.cover.src = 'https://example.com/image.webp'; }, comic => { comic.chapters[0].pages.uk[0].alt = ''; }, comic => { comic.chapters.push(structuredClone(comic.chapters[0])); }, comic => { comic.chapters[0].pages = {}; }]) {
    const comic = demoComic(); edit(comic); assert.equal(comicSchema.safeParse(comic).success, false);
  }
});
test('Demo reader routes are not indexable and cannot be selected on Cloudflare', () => {
  const demo = demoComic();
  assert.ok(!comicIndexablePaths([demo]).some(path => path.includes(demo.slug)));
  assert.equal(comicPath('ja', demo, demo.chapters[0]), '/ja/comics/reader-demo/prologue/');
  const before = process.env.CF_PAGES;
  try { process.env.CF_PAGES = '1'; assert.throws(() => loadComics({ demo: true }), /cannot be built on Cloudflare/); }
  finally { if (before === undefined) delete process.env.CF_PAGES; else process.env.CF_PAGES = before; }
});
test('Explicit page links override progress; missing/corrupt progress safely falls back', () => {
  const ids = ['cover', 'page-01', 'page-02'];
  assert.equal(selectComicPage(ids, '#comic-page-02', 'page-01'), 'page-02');
  assert.equal(selectComicPage(ids, '', 'page-01'), 'page-01');
  for (const stored of ['10000', '<script>', '{bad json}', '']) assert.equal(selectComicPage(ids, '#comic-unknown', stored), 'cover');
  assert.equal(selectComicPage([], '#comic-cover'), '');
  assert.equal(comicProgressKey('story', 'prologue'), 'sakura-comics:story:prologue');
  assert.notEqual(comicProgressKey('story', 'prologue'), comicProgressKey('story', 'issue-01'));
  assert.equal(comicZoom(-50), 100); assert.equal(comicZoom(500), 200); assert.equal(comicZoom(NaN), 100);
});
