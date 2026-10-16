import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
const site = process.env.SITE_URL || env.SITE_URL || 'https://sakura-miyu-blog.pages.dev';
const url = new URL(site);
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
  integrations: [mdx(), sitemap({ filter: (page) => !page.endsWith('/404/') })],
  build: { format: 'directory' },
  vite: { server: { fs: { strict: true } } }
});
