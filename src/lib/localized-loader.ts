import { glob, type Loader } from 'astro/loaders';
import { readFile } from 'node:fs/promises';
import { contentEntryId, contentLocales, languageBody, legacyWelcome, translationIdentity } from './content-languages';

export function localizedBlogLoader(): Loader {
  const base = glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog', generateId: ({ entry }) => contentEntryId(entry) });
  return {
    name: 'localized-blog',
    async load(context) {
      const synchronize = async () => {
        await base.load({ ...context, watcher: undefined });
        for (const entry of context.store.values()) {
          if (entry.id.startsWith('__i18n/')) continue;
          const data = entry.data;
          const source = entry.filePath ? await readFile(new URL(entry.filePath, context.config.root), 'utf8') : entry.body || '';
          const body = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
          const key = translationIdentity(entry.id, data.translationKey as string | undefined);
          if (data.language === 'multilingual') {
            for (const language of contentLocales) {
              const selected = languageBody(body, language);
              if (!selected || selected === body) continue;
              const overrides = entry.id === 'welcome' ? legacyWelcome[language] : null;
              if (!overrides) throw new Error(`Legacy multilingual entry ${entry.id} needs translated metadata before it can appear in ${language}.`);
              const id = `__i18n/${language}/${entry.id}`;
              const parsed = await context.parseData({ id, data: { ...data, ...overrides, language, slug: entry.id, translationKey: key } });
              context.store.set({ id, data: parsed, body: selected, rendered: await context.renderMarkdown(selected, { fileURL: entry.filePath ? new URL(entry.filePath, context.config.root) : undefined }) });
            }
          } else {
            const language = data.language as typeof contentLocales[number];
            const selected = languageBody(body, language);
            const rendered = selected !== body ? await context.renderMarkdown(selected, { fileURL: entry.filePath ? new URL(entry.filePath, context.config.root) : undefined }) : entry.rendered;
            context.store.set({ ...entry, digest: undefined, data: { ...data, translationKey: key }, body: selected, ...(rendered ? { rendered, deferredRender: false } : {}) });
          }
        }
      };
      await synchronize();
      if (context.watcher) {
        let pending = Promise.resolve();
        const changed = (path: string) => {
          if (!path.replace(/\\/g, '/').includes('/src/content/blog/') || !/\.mdx?$/.test(path)) return;
          pending = pending.then(synchronize).catch(error => context.logger.error(String(error)));
        };
        context.watcher.on('add', changed).on('change', changed).on('unlink', changed);
      }
    }
  };
}
