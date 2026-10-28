import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArticle, articleVersions } from '../src/lib/article-data.ts';
import { isPublished, postUrl } from '../src/lib/post-utils.ts';

const translation = (title = 'A little world', slug = 'little-world') => ({ title, slug, description: 'A personal story', body: 'A paragraph.\n\n日本語と українська 🌸' });
const record = overrides => ({ translationKey: 'little-world', pubDate: '2026-10-20', tags: ['Diary'], translations: { uk: translation('Маленький світ'), en: translation(), ja: translation('小さな世界') }, ...overrides });

test('A single article produces three linked versions and preserves Markdown and Unicode', () => {
  const source = record();
  const parsed = parseArticle(JSON.parse(JSON.stringify(source)), 'little-world');
  const versions = articleVersions(parsed);
  assert.deepEqual(versions.map(version => version.language), ['uk', 'en', 'ja']);
  for (const version of versions) {
    assert.equal(version.body, source.translations[version.language].body);
    assert.equal(version.data.translationKey, 'little-world');
    assert.equal(version.data.pubDate.toISOString(), '2026-10-20T00:00:00.000Z');
    assert.equal(postUrl({ id: '__articles/test', data: version.data }), `/${version.language}/blog/little-world/`);
  }
});

test('No default locale is required and missing or unfinished translations create no page', () => {
  const source = record({ translations: { uk: {}, en: { title: 'An unfinished idea' }, ja: translation('日本語だけの物語', 'japanese-story') } });
  const parsed = parseArticle(source, 'little-world');
  assert.equal(parsed.translations.en.title, 'An unfinished idea');
  assert.deepEqual(articleVersions(parsed).map(version => version.language), ['ja']);
  assert.deepEqual(articleVersions(parseArticle(record({ translations: {} }), 'little-world')), []);
});

test('Shared tags inherit while localized tags and an explicitly empty override remain distinct', () => {
  const source = record();
  source.translations.en.tags = [];
  source.translations.ja.tags = ['創作, コスプレ'];
  const versions = articleVersions(parseArticle(source, 'little-world'));
  assert.deepEqual(versions.map(version => version.data.tags), [['Diary'], [], ['創作, コスプレ']]);
});

test('Cleared optional CMS fields normalize safely without creating placeholder translations', () => {
  const source = record({ translations: { uk: null, en: { title: null, slug: null, description: null, body: null, seoTitle: null }, ja: { ...translation('小さな世界'), tags: null } } });
  const versions = articleVersions(parseArticle(source, 'little-world'));
  assert.deepEqual(versions.map(version => version.language), ['ja']);
  assert.deepEqual(versions[0].data.tags, ['Diary']);
  assert.throws(() => parseArticle(record({ pubDate: null }), 'little-world'));
});

test('Shared visibility hides every translation, including future-dated articles', () => {
  for (const overrides of [{ draft: true }, { pubDate: '2999-01-01' }]) {
    const versions = articleVersions(parseArticle(record(overrides), 'little-world'));
    assert.equal(versions.filter(version => isPublished({ data: version.data })).length, 0);
  }
});

test('Unsafe identities and slugs are rejected, and complete translations need localized image alternatives', () => {
  assert.throws(() => parseArticle(record(), 'renamed-article'), /match filename/);
  const unsafe = record(); unsafe.translations.en.slug = '../escape';
  assert.throws(() => parseArticle(unsafe, 'little-world'));
  const illustrated = parseArticle(record({ image: '/images/welcome.webp' }), 'little-world');
  assert.throws(() => articleVersions(illustrated), /uk image alternative/);
});
