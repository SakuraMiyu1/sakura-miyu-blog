import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveGroups, comparePosts, hasTag, isPublished, languageCodes, matchesCategory, normalizeText, relatedPosts, slugify, tagNames } from '../src/lib/post-utils.ts';

const post = (id, date, category = 'Diary', tags = [], draft = false) => ({ id, data: { title: id, description: id, pubDate: new Date(date), category, tags, draft } });

test('Unicode slugs and tag variants share one working route', () => {
  assert.equal(slugify('  Gothic Kawaii 🌸 '), 'gothic-kawaii');
  assert.equal(slugify('Ｃａｆｅ'), 'cafe');
  assert.equal(slugify('Мої думки'), 'мої-думки');
  assert.equal(slugify('日本語'), '日本語');
  assert.equal(normalizeText('САКУРА'), 'сакура');
  const entry = post('one', '2026-01-01', 'Diary', ['anime', 'Anime', 'Ｃａｆｅ', 'Cafe']);
  assert.equal(tagNames([entry]).filter(tag => slugify(tag) === 'anime').length, 1);
  assert.deepEqual(tagNames([entry], false).map(slugify), ['anime', 'cafe']);
  assert.ok(hasTag(entry, 'ANIME'));
  assert.ok(matchesCategory(entry, 'Anime'));
  assert.ok(!matchesCategory(entry, 'Gaming'));
});

test('Publication boundaries exclude drafts and future entries and sort newest first', () => {
  const now = Date.parse('2026-10-17T00:00:00Z');
  const entries = [post('old', '2025-01-01'), post('new', '2026-10-17'), post('draft', '2026-10-16', 'Diary', [], true), post('future', '2026-10-18')];
  assert.deepEqual(entries.filter(entry => isPublished(entry, now)).sort(comparePosts).map(entry => entry.id), ['new', 'old']);
});

test('Related posts prioritize shared tags, include category matches, and never repeat the current entry', () => {
  const current = post('current', '2026-10-16', 'Diary', ['Anime', 'Writing']);
  const both = post('both', '2026-01-01', 'Diary', ['anime', 'Writing']);
  const tag = post('tag', '2026-03-01', 'Gaming', ['Anime']);
  const category = post('category', '2026-04-01', 'Diary');
  const unrelated = post('unrelated', '2026-06-01', 'Cosplay');
  const result = relatedPosts(current, [current, category, tag, both, both, unrelated]);
  assert.deepEqual(result.map(entry => entry.id), ['both', 'tag', 'category']);
  assert.deepEqual(relatedPosts(unrelated, [current, unrelated]), []);
});

test('The archive groups UTC years and months newest first without mutating input', () => {
  const entries = [post('december', '2025-12-31T23:59:00Z'), post('september', '2026-09-01'), post('october', '2026-10-16')];
  const groups = archiveGroups(entries);
  assert.deepEqual(groups.map(group => group.year), [2026, 2025]);
  assert.deepEqual(groups[0].months.map(month => month.key), ['2026-10', '2026-09']);
  assert.equal(groups[1].months[0].label, 'December');
  assert.equal(entries[0].id, 'december');
  assert.deepEqual(archiveGroups([]), []);
  assert.deepEqual(languageCodes('multilingual'), ['uk', 'en', 'ja']);
});
