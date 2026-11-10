import { comicProgressKey, selectComicPage, comicZoom } from '../lib/comic-reader-state';

export function initializeComicReaders() {
  document.querySelectorAll<HTMLElement>('[data-comic-reader]').forEach(root => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const ids: string[] = JSON.parse(root.dataset.pageIds || '[]');
    const pages = [...root.querySelectorAll<HTMLElement>('[data-reader-page]')];
    const key = comicProgressKey(root.dataset.comicId!, root.dataset.chapterId!);
    let stored: string | null = null;
    try { stored = localStorage.getItem(key); } catch {}
    let selected = selectComicPage(ids, location.hash, stored);
    const previous = root.querySelector<HTMLButtonElement>('[data-reader-previous]');
    const next = root.querySelector<HTMLButtonElement>('[data-reader-next]');
    const counter = root.querySelector<HTMLOutputElement>('[data-reader-counter]');
    const stage = root.querySelector<HTMLElement>('[data-reader-stage]');
    const languageLinks = [...document.querySelectorAll<HTMLAnchorElement>('.language-picker a[data-locale], [data-reader-language]')];
    const show = (id: string) => {
      if (!ids.includes(id)) return;
      selected = id;
      const index = ids.indexOf(id);
      pages.forEach(page => { page.hidden = page.dataset.readerPage !== id; });
      if (previous) previous.disabled = index <= 0;
      if (next) next.disabled = index >= ids.length - 1;
      if (counter) counter.textContent = root.dataset.counterLabel!.replace('{current}', String(index + 1)).replace('{total}', String(ids.length));
      root.querySelectorAll<HTMLAnchorElement>('[data-reader-jump]').forEach(link => { if (link.hash === `#comic-${id}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
      languageLinks.forEach(link => { const url = new URL(link.href); url.hash = `comic-${id}`; link.href = url.href; });
      if (pages.length) {
        try { localStorage.setItem(key, id); } catch {}
        history.replaceState(null, '', `#comic-${id}`);
      }
      stage?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    const move = (offset: number) => {
      const index = ids.indexOf(selected) + offset;
      if (index >= 0 && index < ids.length) show(ids[index]);
    };
    previous?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    root.querySelectorAll<HTMLAnchorElement>('[data-reader-jump]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); show(link.hash.slice(7)); }));
    window.addEventListener('hashchange', () => { const id = location.hash.slice(7); if (location.hash.startsWith('#comic-') && ids.includes(id)) show(id); });
    document.addEventListener('keydown', event => {
      if (!pages.length || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable=true],.language-picker,summary'))) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
    });
    const zoomSelect = root.querySelector<HTMLSelectElement>('[data-reader-zoom]');
    const zoomOut = root.querySelector<HTMLButtonElement>('[data-zoom-out]');
    const zoomIn = root.querySelector<HTMLButtonElement>('[data-zoom-in]');
    const zoom = (value: number) => {
      const scale = comicZoom(value);
      root.style.setProperty('--comic-zoom', String(scale / 100));
      if (zoomSelect) zoomSelect.value = String(scale);
      if (zoomOut) zoomOut.disabled = scale === 100;
      if (zoomIn) zoomIn.disabled = scale === 200;
    };
    zoomSelect?.addEventListener('change', () => zoom(Number(zoomSelect.value)));
    zoomOut?.addEventListener('click', () => zoom(Number(zoomSelect?.value) - 25));
    zoomIn?.addEventListener('click', () => zoom(Number(zoomSelect?.value) + 25));
    root.querySelector('[data-zoom-fit]')?.addEventListener('click', () => zoom(100));
    show(selected);
    zoom(100);
    const controls = root.querySelector<HTMLElement>('[data-reader-controls]');
    if (controls && pages.length) controls.hidden = false;
    root.classList.add('is-paged');
  });
}
