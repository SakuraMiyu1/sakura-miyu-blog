import type { APIContext } from 'astro';
export function GET({ site }: APIContext) { return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
