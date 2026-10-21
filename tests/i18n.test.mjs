import test from 'node:test';
import assert from 'node:assert/strict';
import { locales, localePath, localeFromPath, t } from '../src/lib/i18n.ts';
import { languageBody, entrySlug, translationIdentity } from '../src/lib/content-languages.ts';
import { postUrl, relatedPosts } from '../src/lib/post-utils.ts';

test('Locale URLs preserve root, file, query and fragment boundaries', () => {
  for (const locale of locales) {
    assert.equal(localeFromPath(`/${locale}/blog/`), locale);
    assert.equal(localePath(locale), `/${locale}/`);
    assert.equal(localePath(locale, '/en/blog/?q=moon#posts'), `/${locale}/blog/?q=moon#posts`);
    assert.equal(localePath(locale, 'rss.xml'), `/${locale}/rss.xml`);
    assert.equal(localePath(locale, 'search-index.json'), `/${locale}/search-index.json`);
    assert.ok(t(locale, 'search'));
  }
  assert.equal(localeFromPath('/admin/'), 'uk');
});

test('Legacy language extraction never includes another language section or its empty heading', () => {
  const body = '<section lang="uk"><h2 id="ukrainian">Українська</h2>Моя історія</section>\n---\n<section lang="en"><h2 id="english">English</h2>My story</section>\n---\n<section lang="ja"><h2 id="japanese">日本語</h2>私の物語</section>';
  assert.equal(languageBody(body, 'uk'), 'Моя історія');
  assert.equal(languageBody(body, 'en'), 'My story');
  assert.equal(languageBody(body, 'ja'), '私の物語');
  assert.equal(languageBody('Plain Markdown', 'ja'), 'Plain Markdown');
  assert.equal(languageBody('<section lang="uk">Моя історія</section>', 'ja'), '');
  const single = 'Introduction\n<section lang="en">Story<section>Nested section</section>ending</section>\nAfterword';
  assert.equal(languageBody(single, 'en'), single);
  assert.equal(languageBody('<section lang="en">Story<section>Nested</section>end</section><section lang="ja">物語</section>', 'en'), 'Story<section>Nested</section>end');
});

test('Existing differently named translations share identity without modifying their sources', () => {
  const ids = ['malyenkyi-svit-de-mozhna-buty-soboiu', 'a-little-world-where-you-can-be-yourself', 'jibunrashiku-irareru-chiisana-sekai'];
  assert.equal(new Set(ids.map(id => translationIdentity(id))).size, 1);
  assert.notEqual(translationIdentity('another-post'), translationIdentity(ids[0]));
  assert.equal(translationIdentity('another-post', 'shared-key'), 'shared-key');
  assert.equal(entrySlug('en--dream'), 'dream');
  assert.equal(entrySlug('en--dream', 'custom'), 'custom');
  assert.equal(postUrl({ id: 'ja--dream', data: { language: 'ja', slug: 'dream' } }), '/ja/blog/dream/');
});

test('Related entries cannot cross the selected language even when they share tags', () => {
  const item = (id, language) => ({ id, data: { language, tags: ['Anime'], category: 'Diary', pubDate: new Date('2026-10-17') } });
  const source = item('source', 'uk');
  assert.deepEqual(relatedPosts(source, [source, item('uk-story', 'uk'), item('en-story', 'en'), item('ja-story', 'ja')]).map(post => post.id), ['uk-story']);
});
