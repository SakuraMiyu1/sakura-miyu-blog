import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { categories } from '../src/lib/post-utils.ts';

const config = JSON.parse(await readFile('public/admin/config.yml', 'utf8'));
assert.equal(config.backend.name, 'github');
assert.equal(config.backend.repo, 'SakuraMiyu1/sakura-miyu-blog');
assert.equal(config.backend.branch, 'main');
assert.equal(config.backend.auth_scope, 'public_repo');
assert.equal(config.publish_mode, 'editorial_workflow');
assert.equal(config.backend.base_url, 'https://sakura-miyu-blog.pages.dev');
assert.equal(config.local_backend, undefined);
assert.equal(config.backend.open_authoring, undefined);
const collection = config.collections[0];
assert.equal(config.collections.length, 1, 'One collection lists one record per article');
assert.equal(collection.folder, 'src/content/articles');
assert.equal(collection.extension, 'json');
assert.equal(collection.format, 'json');
assert.equal(collection.slug, '{{fields.translationKey}}');
assert.equal(collection.identifier_field, 'translationKey');
assert.equal(collection.delete, false, 'Article removal is disabled in the editor');
assert.equal(config.i18n, undefined, 'Language tabs do not require native default-locale i18n');
assert.equal(collection.i18n, undefined);
assert.equal(collection.fields.filter(field => field.name === 'translationKey').length, 1);
assert.notEqual(collection.fields.find(field => field.name === 'translationKey').required, false);
assert.equal(collection.fields.find(field => field.name === 'translationKey').widget, 'string');
assert.deepEqual(collection.fields.map(field => field.name), ['translationKey', 'pubDate', 'updatedDate', 'category', 'tags', 'image', 'featured', 'draft', 'translations']);
const translations = collection.fields.find(field => field.name === 'translations');
assert.equal(translations.widget, 'translation-tabs');
assert.deepEqual(translations.fields.map(field => field.name), ['uk', 'en', 'ja']);
for (const language of translations.fields) {
  assert.equal(language.widget, 'object');
  assert.equal(language.required, false);
  assert.deepEqual(language.fields.map(field => field.name), ['title', 'slug', 'description', 'imageAlt', 'seoTitle', 'seoDescription', 'body', 'tags']);
  assert.ok(language.fields.every(field => field.required === false), 'Partial translations can be saved');
  const body = language.fields.find(field => field.name === 'body');
  assert.equal(body.widget, 'sakura-story');
  assert.equal(body.default, '');
  assert.equal(body.sanitize_preview, true);
  const tags = language.fields.find(field => field.name === 'tags');
  assert.equal(tags.widget, 'list');
  assert.equal(tags.default, undefined, 'Opening a translation must preserve missing tags and shared inheritance');
}
for (const name of ['pubDate', 'updatedDate']) {
  const field = collection.fields.find(field => field.name === name);
  assert.equal(field.widget, 'datetime');
  assert.equal(field.format, 'YYYY-MM-DD');
  assert.equal(field.date_format, 'DD/MM/YYYY');
  assert.equal(field.time_format, false);
  assert.equal(field.picker_utc, true);
}
assert.deepEqual(collection.fields.find(field => field.name === 'category').options, [...categories]);
assert.equal(collection.fields.find(field => field.name === 'draft').default, false);
assert.equal(collection.fields.find(field => field.name === 'image').choose_url, false);
assert.equal(config.media_folder, 'public/images/blog');
assert.ok(!config.media_library?.name, 'No external media provider');
const routes = JSON.parse(await readFile('public/_routes.json', 'utf8'));
assert.deepEqual(routes.include, ['/api/auth', '/api/callback', '/api/cms-status']);
const manifest = JSON.parse(await readFile('cms/vendor-manifest.json', 'utf8'));
const patches = JSON.parse(await readFile('cms/vendor-patches.json', 'utf8'));
assert.equal(patches.version, manifest.version);
let originalVendor = await readFile('public/admin/vendor/' + patches.file, 'utf8');
for (const patch of [...patches.patches].reverse()) {
  assert.equal(originalVendor.split(patch.replace).length, 2, `Exact local vendor patch: ${patch.source}`);
  originalVendor = originalVendor.replace(patch.replace, patch.find);
}
assert.equal(Buffer.byteLength(originalVendor), patches.original.bytes);
assert.equal(createHash('sha256').update(originalVendor).digest('hex'), patches.original.sha256, 'Reversing the documented patches reproduces the pinned upstream release');
const vendor = (await readdir('public/admin/vendor')).sort();
assert.deepEqual(vendor, Object.keys(manifest.files).sort());
for (const [name, expected] of Object.entries(manifest.files)) {
  const content = await readFile('public/admin/vendor/' + name);
  assert.equal(content.length, expected.bytes, `Vendor size: ${name}`);
  assert.equal(createHash('sha256').update(content).digest('hex'), expected.sha256, `Vendor checksum: ${name}`);
  assert.ok(content.length < 25 * 1024 * 1024, 'Cloudflare Pages Free asset size limit');
}
for (const filename of ['public/admin/start.js', 'public/admin/editor.js', 'public/admin/config.yml', 'public/admin/index.html']) {
  const content = await readFile(filename, 'utf8');
  assert.ok(!/gh[pousr]_[A-Za-z0-9]{20,}|client_secret\s*[=:]\s*["'][^"']+["']/.test(content), `No credentials in ${filename}`);
}
console.log(`CMS configuration verified: one JSON article with shared settings and three optional language tabs, unchanged dates, matching Astro categories, editorial workflow, repository media, exact function routes and ${vendor.length} pinned local vendor assets. No paid integrations or frontend secrets.`);
