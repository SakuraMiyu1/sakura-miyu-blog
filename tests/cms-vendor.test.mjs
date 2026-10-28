import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import path from 'node:path/posix';

const vendor = await readFile('public/admin/vendor/decap-cms.js', 'utf8');
const { patches } = JSON.parse(await readFile('cms/vendor-patches.json', 'utf8'));
const absolutePath = value => /^(?:[a-z]+:)?\/\/|^\//i.test(value);
const resolveMedia = runInNewContext(`(${patches[0].replace})`, {
  kh: absolutePath, r_: config => config.media_folder,
  yr: () => path, xh: path.basename
});

test('Draft image URLs resolve to repository assets without changing stored public paths', () => {
  assert.ok(vendor.includes(patches[0].replace));
  const config = { media_folder: 'public/images/blog', public_folder: '/images/blog' };
  assert.equal(resolveMedia(config, null, null, '/images/blog/ribbon.webp'), 'public/images/blog/ribbon.webp');
  assert.equal(resolveMedia(config, null, null, '/images/blog/nested/ribbon.webp'), 'public/images/blog/nested/ribbon.webp');
  assert.equal(resolveMedia(config, null, null, 'ribbon.webp'), 'public/images/blog/ribbon.webp');
  for (const value of ['/images/welcome.webp', '/images/blog-other/ribbon.webp', 'https://example.com/image.webp', '//example.com/image.webp', '/images/blog/../private.webp']) {
    assert.equal(resolveMedia(config, null, null, value), value);
  }
  assert.equal(resolveMedia({ ...config, public_folder: 'https://example.com/images' }, null, null, 'https://example.com/images/ribbon.webp'), 'https://example.com/images/ribbon.webp');
});

function authenticator(code) {
  const start = code.indexOf('authorizeCallback(e,t){');
  const end = code.indexOf('getSiteID()', start);
  const method = code.slice(start, end);
  const authWindow = { close() { this.closed = true; } };
  const window = { removeEventListener() {} };
  const auth = runInNewContext(`({${method}})`, { window, gU: Error });
  return Object.assign(auth, { authWindow, base_url: 'https://sakura-miyu-blog.pages.dev' });
}

test('The supplied stack location is the OAuth message handler, unrelated to date widgets', () => {
  const original = patches.reduceRight((code, patch) => code.replace(patch.replace, patch.find), vendor);
  const line = original.split('\n')[55];
  assert.match(line.slice(112920, 113000), /r\.data\.indexOf/);
  const auth = authenticator(original);
  assert.throws(() => auth.authorizeCallback({ provider: 'github' }, () => {})({ origin: auth.base_url, source: auth.authWindow, data: { type: 'unrelated message' } }), /data\.indexOf is not a function/);
});

test('OAuth ignores unrelated objects, foreign origins and other windows, but accepts its popup', () => {
  const auth = authenticator(vendor);
  const replies = [];
  const handler = auth.authorizeCallback({ provider: 'github' }, (...args) => replies.push(args));
  const success = 'authorization:github:success:' + JSON.stringify({ token: 'QA_FAKE_TOKEN', provider: 'github' });
  for (const data of [{ date: new Date() }, null, 123, ['message']]) {
    handler({ origin: auth.base_url, source: auth.authWindow, data });
  }
  handler({ origin: 'https://example.com', source: auth.authWindow, data: success });
  handler({ origin: auth.base_url, source: {}, data: success });
  assert.equal(replies.length, 0);
  handler({ origin: auth.base_url, source: auth.authWindow, data: success });
  assert.equal(replies.length, 1);
  assert.equal(replies[0][0], null);
  assert.equal(replies[0][1].token, 'QA_FAKE_TOKEN');
  assert.equal(auth.authWindow.closed, true);
});

test('Blob fetch permission is limited to admin CSP; script/object protections remain', async () => {
  const headers = await readFile('public/_headers', 'utf8');
  const global = headers.slice(0, headers.indexOf('/admin/*'));
  assert.ok(!global.includes('blob:'));
  const csp = headers.match(/Content-Security-Policy: ([^\r\n]+)/)[1];
  assert.match(csp, /connect-src 'self' blob: https:\/\/api.github.com https:\/\/raw.githubusercontent.com;/);
  assert.match(csp, /default-src 'self';/);
  assert.match(csp, /object-src 'none';/);
  assert.ok(!csp.match(/script-src [^;]*blob:/));
});

test('GitHub paginated failures report API errors instead of stringifying response objects', async () => {
  const patch = patches.find(item => item.source === 'decap-cms-backend-github/src/API.ts: requestAllPages');
  assert.ok(vendor.includes(patch.replace));
  const method = code => code.slice(0, code.indexOf('generateContentKey('));
  const run = (code, getAllResponses) => Object.assign(runInNewContext(`({${method(code)}})`, { ih: getAllResponses }), {
    requestHeaders: async () => ({}), urlFor: value => value, nextUrlProcessor: () => value => value,
    parseResponse: async response => response,
    handleRequestError: (error, status) => { throw Object.assign(new Error(error.message), { status }); }
  }).requestAllPages('/repos/SakuraMiyu1/sakura-miyu-blog/pulls');
  const rejected = { message: 'Bad credentials', documentation_url: 'https://docs.github.com/rest', status: '401' };
  await assert.rejects(run(patch.find, async () => { throw rejected; }), error => error === rejected && String(error) === '[object Object]');
  await assert.rejects(run(patch.replace, async () => { throw rejected; }), error => error.status === 401 && /GitHub sign-in is no longer valid.*copy unsaved text/.test(error.message));
  await assert.rejects(run(patch.replace, async () => { throw { message: 'API rate limit exceeded', status: '403' }; }), error => error.status === 403 && error.message === 'API rate limit exceeded');
  await assert.rejects(run(patch.replace, async () => { throw new TypeError('Failed to fetch'); }), error => error.status === 500 && error.message === 'Failed to fetch');
  assert.equal(JSON.stringify(await run(patch.replace, async () => [[{ number: 1 }], [{ number: 2 }]])), '[{"number":1},{"number":2}]');
});
