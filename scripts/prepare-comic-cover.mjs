import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
const svg = await readFile('src/assets/comics/announcement.svg');
await mkdir('public/images/comics', { recursive: true });
await sharp(svg).webp({ quality: 84 }).toFile('public/images/comics/two-queens-coming-soon.webp');
await sharp(svg).resize(1200, 630, { fit: 'cover', position: 'centre' }).webp({ quality: 84 }).toFile('public/images/comics/two-queens-coming-soon-social.webp');
console.log('Created two optimized announcement graphics; no final comic artwork.');
