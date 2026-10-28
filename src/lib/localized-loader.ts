import { glob, type Loader } from 'astro/loaders';
import { readFile, readdir } from 'node:fs/promises';
import { contentEntryId, contentLocales, languageBody, legacyWelcome, translationIdentity } from './content-languages';
import { parseArticle, articleVersions } from './article-data';
import { migratedArticles, migrationForSource } from './article-migration';

export function localizedBlogLoader(): Loader {
  const base = glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog', generateId: ({ entry }) => contentEntryId(entry) });
  return {
    name: 'localized-blog',
    async load(context) {
      const synchronize = async () => {
        await base.load({ ...context, watcher: undefined });
        const directory = new URL('src/content/articles/', context.config.root);
        const files = (await readdir(directory)).filter(file => file.endsWith('.json')).sort();
        const records = await Promise.all(files.map(async file => ({ file, article: parseArticle(JSON.parse(await readFile(new URL(file, directory), 'utf8')), file.slice(0, -5)) })));
        for (const migrated of migratedArticles) {
          if (!records.some(record => record.article.translationKey === migrated.key)) throw new Error(`Migrated article ${migrated.key}.json is missing. Restore it or use Keep Hidden; archived Markdown is not republished automatically.`);
        }
        for (const entry of context.store.values()) {
          if (entry.id.startsWith('__i18n/') || entry.id.startsWith('__articles/')) continue;
          const data = entry.data;
          if (migrationForSource(entry.id)) {
            context.store.set({ ...entry, digest: undefined, data: { ...data, legacyOnly: true } });
            continue;
          }
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
        for (const { file, article } of records) {
          const fileURL = new URL(file, directory);
          for (const version of articleVersions(article)) {
            const id = `__articles/${version.language}/${article.translationKey}`;
            const data = await context.parseData({ id, data: version.data });
            context.store.set({ id, data, body: version.body, rendered: await context.renderMarkdown(version.body, { fileURL }) });
          }
        }
      };
      await synchronize();
      if (context.watcher) {
        let pending = Promise.resolve();
        const changed = (path: string) => {
          const normalized = path.replace(/\\/g, '/');
          if (!(/\/src\/content\/blog\/.*\.mdx?$/.test(normalized) || /\/src\/content\/articles\/.*\.json$/.test(normalized))) return;
          pending = pending.then(synchronize).catch(error => context.logger.error(String(error)));
        };
        context.watcher.on('add', changed).on('change', changed).on('unlink', changed);
      }
    }
  };
}
