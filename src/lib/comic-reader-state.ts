export const comicProgressKey = (comic: string, chapter: string) => `sakura-comics:${comic}:${chapter}`;
export function selectComicPage(ids: string[], hash: string, stored?: string | null) {
  const fromHash = hash.startsWith('#comic-') ? hash.slice(7) : '';
  return ids.includes(fromHash) ? fromHash : stored && ids.includes(stored) ? stored : ids[0] || '';
}
export const comicZoom = (value: number) => Number.isFinite(value) ? Math.min(200, Math.max(100, Math.round(value / 25) * 25)) : 100;
