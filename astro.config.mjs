import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';
import { loadComics } from './src/lib/comics.ts';
import { comicIndexablePaths } from './src/lib/comics-data.ts';

const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
const site = process.env.SITE_URL || env.SITE_URL || 'https://sakura-miyu-blog.pages.dev';
const url = new URL(site);
const comicSitemap = new Set(comicIndexablePaths(loadComics()));
if (process.env.CF_PAGES_BRANCH?.startsWith('cms/')) {
  throw new Error('CMS draft branches are not deployed. Publish the entry to main to update the public blog.');
}
if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
  throw new Error('SITE_URL must be an absolute HTTP(S) origin, without a path, query or fragment.');
}
if (url.hostname.endsWith('.pages.dev') && url.hostname.split('.').length > 3) {
  throw new Error('SITE_URL must be the permanent production origin, not a Cloudflare preview deployment.');
}

export default defineConfig({
  site: url.origin,
  output: 'static',
  compressHTML: true,
  trailingSlash: 'always',
  integrations: [mdx(), sitemap({ filter: (page) => { const path = new URL(page).pathname; return /^\/(uk|en|ja)\//.test(path) && !path.endsWith('/404/') && (!/^\/(uk|en|ja)\/comics\//.test(path) || comicSitemap.has(path)); } })],
  build: { format: 'directory' },
  vite: { server: { fs: { strict: true } } }
});
