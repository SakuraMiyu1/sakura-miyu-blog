export const productionOrigin = 'https://sakura-miyu-blog.pages.dev';
const repository = 'SakuraMiyu1/sakura-miyu-blog';
const owner = 'sakuramiyu1';
const cookieName = '__Host-sakura-cms-oauth';
const ttl = 600;
const encoder = new TextEncoder();
const base64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unbase64 = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), character => character.charCodeAt(0));
const random = () => base64(crypto.getRandomValues(new Uint8Array(32)));
const key = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const clearCookie = `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'text/plain; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow'
};

function origin(env) {
  const url = new URL(env.CMS_ORIGIN || productionOrigin);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Invalid CMS origin');
  if (url.hostname.endsWith('.pages.dev') && url.hostname.split('.').length !== 3) throw new Error('Preview CMS origin is forbidden');
  return url.origin;
}

function configured(env) {
  return env.CMS_ENABLED === 'true' && typeof env.GITHUB_CLIENT_ID === 'string' && env.GITHUB_CLIENT_ID.length > 5 && typeof env.GITHUB_CLIENT_SECRET === 'string' && env.GITHUB_CLIENT_SECRET.length >= 20;
}

const response = (message, status = 400, extra = {}) => new Response(message, { status, headers: { ...headers, ...extra } });

export async function handleStatus({ request, env }) {
  let enabled = false;
  try { enabled = configured(env) && new URL(request.url).origin === origin(env); } catch { enabled = false; }
  return response(JSON.stringify({ enabled }), 200, { 'Content-Type': 'application/json; charset=utf-8' });
}

export async function handleAuth({ request, env }) {
  if (request.method !== 'GET') return response('Method not allowed.', 405, { Allow: 'GET' });
  if (!configured(env)) return response('CMS sign-in is disabled until its GitHub OAuth settings have been completed. The public blog is available as usual.', 503);
  let site;
  try { site = origin(env); } catch { return response('CMS origin is not configured correctly.', 503); }
  const url = new URL(request.url);
  if (url.origin !== site) return response('Sign in from the production admin dashboard.', 403);
  if (url.searchParams.get('provider') !== 'github') return response('Only GitHub sign-in is supported.');
  const state = random();
  const verifier = random();
  const payload = base64(encoder.encode(JSON.stringify({ state, verifier, expires: Date.now() + ttl * 1000 })));
  const signature = base64(new Uint8Array(await crypto.subtle.sign('HMAC', await key(env.GITHUB_CLIENT_SECRET), encoder.encode(payload))));
  const redirect = new URL('https://github.com/login/oauth/authorize');
  redirect.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${site}/api/callback`, scope: 'public_repo', state, code_challenge: base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)))), code_challenge_method: 'S256', allow_signup: 'false' }).toString();
  return response('', 302, { Location: redirect.href, 'Set-Cookie': `${cookieName}=${payload}.${signature}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${ttl}` });
}

export async function handleCallback({ request, env }, fetcher = fetch) {
  const finish = (message, status = 400) => response(message, status, { 'Set-Cookie': clearCookie });
  if (request.method !== 'GET') return finish('Method not allowed.', 405);
  if (!configured(env)) return finish('CMS sign-in is disabled until its GitHub OAuth settings have been completed.', 503);
  let site;
  try { site = origin(env); } catch { return finish('CMS origin is not configured correctly.', 503); }
  const url = new URL(request.url);
  if (url.origin !== site) return finish('Sign in from the production admin dashboard.', 403);
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  try {
    if (!state || !cookie || cookie.length > 1500) return finish('The sign-in session is missing. Close this window and try again.');
    const [payload, signature, extra] = cookie.split('.');
    if (extra || !payload || !signature || !await crypto.subtle.verify('HMAC', await key(env.GITHUB_CLIENT_SECRET), unbase64(signature), encoder.encode(payload))) return finish('The sign-in session is invalid. Try again.');
    const session = JSON.parse(new TextDecoder().decode(unbase64(payload)));
    if (session.state !== state || session.expires < Date.now() || session.expires > Date.now() + ttl * 1000 || !/^[A-Za-z0-9_-]{43}$/.test(session.verifier)) return finish('The sign-in session has expired or is invalid. Try again.');
    if (url.searchParams.has('error')) return finish('GitHub sign-in was cancelled. Close this window to return to the editor.');
    const code = url.searchParams.get('code');
    if (!code || code.length > 256) return finish('GitHub did not return a valid authorization code.');
    const exchanged = await fetcher('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${site}/api/callback`, code_verifier: session.verifier }), signal: AbortSignal.timeout(15000) });
    if (!exchanged.ok) return finish('GitHub could not complete sign-in. Try again later.', 502);
    const credentials = await exchanged.json();
    if (credentials.error || typeof credentials.access_token !== 'string' || credentials.token_type?.toLowerCase() !== 'bearer') return finish('GitHub did not issue a usable token. Try again.', 502);
    const githubHeaders = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${credentials.access_token}`, 'User-Agent': 'Sakura-Miyu-CMS', 'X-GitHub-Api-Version': '2022-11-28' };
    const userResponse = await fetcher('https://api.github.com/user', { headers: githubHeaders, signal: AbortSignal.timeout(15000) });
    if (!userResponse.ok || (await userResponse.json()).login?.toLowerCase() !== owner) return finish('This editor is only available to SakuraMiyu1.', 403);
    const repoResponse = await fetcher(`https://api.github.com/repos/${repository}`, { headers: githubHeaders, signal: AbortSignal.timeout(15000) });
    const repo = repoResponse.ok ? await repoResponse.json() : null;
    if (!repo?.permissions?.push || repo.private !== false || repo.full_name?.toLowerCase() !== repository.toLowerCase()) return finish('Write access to the intended public blog repository is required.', 403);
    const nonce = random();
    const message = JSON.stringify(`authorization:github:success:${JSON.stringify({ token: credentials.access_token, provider: 'github' })}`).replaceAll('<', '\\u003c');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sakura Miyu CMS sign-in</title></head><body><p id="status">Completing sign-in. Keep the original editor tab open.</p><script nonce="${nonce}">const trustedOrigin=${JSON.stringify(site)};if(window.opener){const receive=event=>{if(event.origin!==trustedOrigin||event.source!==window.opener||event.data!=='authorizing:github')return;window.removeEventListener('message',receive);window.opener.postMessage(${message},trustedOrigin);document.getElementById('status').textContent='Signed in. You can close this window.';window.close();};window.addEventListener('message',receive);window.opener.postMessage('authorizing:github',trustedOrigin);}else{document.getElementById('status').textContent='Open sign-in from the admin dashboard, then try again.';}</script></body></html>`;
    return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': clearCookie, 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` } });
  } catch {
    return finish('Sign-in could not be verified. Close this window and try again.', 400);
  }
}
