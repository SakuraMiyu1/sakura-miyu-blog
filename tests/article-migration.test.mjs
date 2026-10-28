import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { migratedArticles, migrationAliases } from '../src/lib/article-migration.ts';
import { languageBody } from '../src/lib/content-languages.ts';

const hash = value => createHash('sha256').update(String(value).replace(/\r\n/g, '\n')).digest('hex');
test('Every original source and all seven archived language bodies remain intact', async () => {
  let count = 0;
  for (const article of migratedArticles) {
    for (const source of article.sources) assert.equal(hash(await readFile(source.path)), source.sha256, source.path);
    for (const [locale, original] of Object.entries(article.translations)) {
      const source = article.sources.find(source => source.id === original.metadata.slug) || article.sources[0];
      const text = await readFile(source.path, 'utf8');
      const body = text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
      assert.equal(hash(languageBody(body, locale)), original.bodySha256, `${article.key}/${locale}`);
      count++;
    }
  }
  assert.equal(count, 7);
});

const entry = (key, slug) => ({ id: `__articles/uk/${key}`, data: { language: 'uk', translationKey: key, slug } });
const unchanged = [entry('welcome', 'welcome'), entry('my-little-anime-world', 'my-little-anime-world'), entry('little-world-be-yourself', 'malyenkyi-svit-de-mozhna-buty-soboiu')];
test('Migration preserves canonical addresses and safely redirects moved or unavailable translations', () => {
  assert.deepEqual(migrationAliases('uk', unchanged), []);
  const changed = unchanged.map(post => post.data.translationKey === 'welcome' ? entry('welcome', 'a-new-welcome') : post);
  assert.deepEqual(migrationAliases('uk', changed), [{ path: 'blog/welcome', to: '/uk/blog/a-new-welcome/' }]);
  assert.deepEqual(migrationAliases('uk', unchanged.slice(1)), [{ path: 'blog/welcome', to: '/uk/' }]);
  assert.throws(() => migrationAliases('uk', [entry('unrelated-story', 'welcome'), ...changed]), /cannot reuse the legacy URL/);
});
