import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadComics } from '../../lib/comics';
import { publicComicAssets } from '../../lib/comics-data';

const mediaRoot = path.resolve('src/content/comics-media');
const assets = loadComics().flatMap(publicComicAssets).filter(asset => asset.startsWith('/comics-media/'));

export const getStaticPaths: GetStaticPaths = () => assets.map(asset => ({
  params: { image: asset.slice('/comics-media/'.length) },
  props: { filename: path.resolve(mediaRoot, asset.slice('/comics-media/'.length)) }
}));

export const GET: APIRoute = ({ props }) => {
  const filename = String(props.filename);
  if (!filename.startsWith(mediaRoot + path.sep)) return new Response(null, { status: 404 });
  const type = filename.endsWith('.avif') ? 'image/avif' : 'image/webp';
  return new Response(readFileSync(filename), { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' } });
};
