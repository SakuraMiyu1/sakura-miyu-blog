import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2] || 'dist');
if (!root.startsWith(process.cwd() + path.sep)) throw new Error('Build output must stay inside the project.');
const rules = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      const to = html.match(/data-redirect-target="([^"]+)"/)?.[1];
      if (!to) continue;
      const from = '/' + path.relative(root, file).split(path.sep).join('/').replace(/index\.html$/, '');
      if (to === from || !/^\/(uk|en|ja)\//.test(to)) throw new Error('Unsafe redirect: ' + from);
      rules.push(`${from} ${to} 301`);
    }
  }
}
await scan(root);
await writeFile(path.join(root, '_redirects'), rules.sort().join('\n') + '\n');
const aliases = new Set(rules.map(rule => rule.split(' ')[0]));
for (const file of await readdir(root)) {
  if (!/^sitemap-\d+\.xml$/.test(file)) continue;
  const filename = path.join(root, file);
  const xml = await readFile(filename, 'utf8');
  const canonicalOnly = xml.replace(/<url>[\s\S]*?<\/url>/g, node => {
    const location = node.match(/<loc>([^<]+)<\/loc>/)?.[1];
    return location && aliases.has(decodeURIComponent(new URL(location).pathname)) ? '' : node;
  });
  if (xml !== canonicalOnly) await writeFile(filename, canonicalOnly);
}
console.log(`Generated ${rules.length} one-way Cloudflare 301 redirects for legacy URLs.`);
