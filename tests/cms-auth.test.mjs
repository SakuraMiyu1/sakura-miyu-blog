import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth, handleCallback, handleStatus, productionOrigin } from '../cms/oauth.mjs';

const env = { CMS_ENABLED: 'true', GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-only-secret-not-a-real-credential' };
const request = (path, options) => new Request(productionOrigin + path, options);
async function session() {
  const started = await handleAuth({ request: request('/api/auth?provider=github'), env });
  const url = new URL(started.headers.get('Location'));
  const cookie = started.headers.get('Set-Cookie').split(';')[0];
  return { started, url, cookie, callback: () => request(`/api/callback?code=qa-code&state=${url.searchParams.get('state')}`, { headers: { Cookie: cookie } }) };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const github = ({ login = 'SakuraMiyu1', push = true, privateRepo = false } = {}) => async url => {
  if (url.includes('/access_token')) return json({ access_token: 'QA_FAKE_TOKEN_ONLY', token_type: 'bearer' });
  if (url.endsWith('/user')) return json({ login });
  return json({ full_name: 'SakuraMiyu1/sakura-miyu-blog', private: privateRepo, permissions: { push } });
};

test('CMS is disabled without explicit enablement and both server-side credentials', async () => {
  for (const disabled of [{}, { ...env, CMS_ENABLED: 'false' }, { ...env, GITHUB_CLIENT_SECRET: '' }]) {
    assert.equal((await handleAuth({ request: request('/api/auth?provider=github'), env: disabled })).status, 503);
    assert.deepEqual(await (await handleStatus({ request: request('/api/cms-status'), env: disabled })).json(), { enabled: false });
  }
});

test('Sign-in has a secure host cookie, fresh state, PKCE and only public repository scope', async () => {
  const a = await session();
  const b = await session();
  assert.equal(a.started.status, 302);
  assert.equal(a.url.origin, 'https://github.com');
  assert.equal(a.url.searchParams.get('scope'), 'public_repo');
  assert.equal(a.url.searchParams.get('redirect_uri'), productionOrigin + '/api/callback');
  assert.equal(a.url.searchParams.get('code_challenge_method'), 'S256');
  assert.notEqual(a.url.searchParams.get('state'), b.url.searchParams.get('state'));
  assert.notEqual(a.url.searchParams.get('code_challenge'), b.url.searchParams.get('code_challenge'));
  assert.match(a.started.headers.get('Set-Cookie'), /__Host-.*Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=600/);
  assert.equal(a.started.headers.get('Cache-Control'), 'no-store');
  assert.ok(!(await a.started.text()).includes(env.GITHUB_CLIENT_SECRET));
});

test('Only HTTPS production origin, GET and the GitHub provider are accepted', async () => {
  assert.equal((await handleAuth({ request: new Request('https://preview.sakura-miyu-blog.pages.dev/api/auth?provider=github'), env })).status, 403);
  assert.equal((await handleAuth({ request: request('/api/auth?provider=github', { method: 'POST' }), env })).status, 405);
  assert.equal((await handleAuth({ request: request('/api/auth?provider=other'), env })).status, 400);
  assert.equal((await handleAuth({ request: request('/api/auth?provider=github'), env: { ...env, CMS_ORIGIN: 'http://unsafe.test' } })).status, 503);
});

test('Missing, mismatched and tampered state never trigger GitHub requests', async () => {
  const { cookie, url } = await session();
  let calls = 0;
  const forbidden = () => { calls++; throw new Error('Must not call GitHub'); };
  for (const [query, value] of [['state=wrong&code=test', cookie], [`state=${url.searchParams.get('state')}&code=test`, cookie + 'x'], ['code=test', cookie], [`state=${url.searchParams.get('state')}&code=test`, '']]) {
    const response = await handleCallback({ request: request('/api/callback?' + query, { headers: { Cookie: value } }), env }, forbidden);
    assert.equal(response.status, 400);
    assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  }
  assert.equal(calls, 0);
});

test('Signed but expired or future-dated sessions are rejected before token exchange', async () => {
  const { cookie, url } = await session();
  const encoded = cookie.split('=')[1].split('.')[0];
  const data = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  for (const expires of [Date.now() - 1000, Date.now() + 10000000]) {
    const payload = Buffer.from(JSON.stringify({ ...data, expires })).toString('base64url');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.GITHUB_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))).toString('base64url');
    const response = await handleCallback({ request: request(`/api/callback?code=test&state=${url.searchParams.get('state')}`, { headers: { Cookie: `__Host-sakura-cms-oauth=${payload}.${signature}` } }), env }, () => { throw new Error('No network allowed'); });
    assert.equal(response.status, 400);
  }
});

test('Other users, repositories without write access and private repositories receive no token', async () => {
  for (const options of [{ login: 'SomeoneElse' }, { push: false }, { privateRepo: true }]) {
    const auth = await session();
    const response = await handleCallback({ request: auth.callback(), env }, github(options));
    assert.equal(response.status, 403);
    assert.ok(!(await response.text()).includes('QA_FAKE_TOKEN_ONLY'));
  }
});

test('Authorized owner receives a nonce-protected Decap handshake with exact origin and opener validation', async () => {
  const auth = await session();
  const calls = [];
  const response = await handleCallback({ request: auth.callback(), env }, async (url, options) => {
    calls.push({ url, options });
    return github()(url);
  });
  assert.equal(response.status, 200);
  const exchange = JSON.parse(calls[0].options.body);
  assert.ok(exchange.code_verifier);
  assert.equal(exchange.client_secret, env.GITHUB_CLIENT_SECRET);
  assert.equal(calls.length, 3);
  const html = await response.text();
  assert.ok(!html.includes(env.GITHUB_CLIENT_SECRET));
  assert.ok(html.includes('event.origin!==trustedOrigin') && html.includes('event.source!==window.opener'));
  assert.ok(html.includes('authorization:github:success:'));
  assert.ok(!html.includes("postMessage('*'") && !html.includes(',"*"'));
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'nonce-/);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
});

test('GitHub cancellation and token-exchange errors do not expose provider details', async () => {
  const auth = await session();
  const cancelled = request(`/api/callback?error=access_denied&state=${auth.url.searchParams.get('state')}`, { headers: { Cookie: auth.cookie } });
  assert.equal((await handleCallback({ request: cancelled, env }, () => { throw new Error('No network allowed'); })).status, 400);
  const response = await handleCallback({ request: auth.callback(), env }, async () => json({ error: 'bad_verification_code', detail: env.GITHUB_CLIENT_SECRET }));
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes(env.GITHUB_CLIENT_SECRET));
});
