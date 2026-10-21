export const contentLocales = ['uk', 'en', 'ja'] as const;
export type ContentLocale = typeof contentLocales[number];
export const contentEntryId = (filename: string) => filename.replace(/\\/g, '/').replace(/\.(md|mdx)$/i, '');
export const legacyTranslationKeys: Record<string, string> = {
  'malyenkyi-svit-de-mozhna-buty-soboiu': 'little-world-be-yourself',
  'a-little-world-where-you-can-be-yourself': 'little-world-be-yourself',
  'jibunrashiku-irareru-chiisana-sekai': 'little-world-be-yourself',
  welcome: 'welcome',
};
export const legacyWelcome = {
  uk: { title: "🌸 Вітаю у Sakura Miyu's Little World 🖤", description: 'Моє маленьке знайомство: улюблені світи, творчість і думки, що розквітають у щоденнику.', imageAlt: 'Сакура Мію під рожевим цвітом сакури у місячному світі Gothic Kawaii' },
  en: { title: "🌸 Welcome to Sakura Miyu's Little World 🖤", description: 'Come meet the girl behind the diary, her favourite worlds, and the stories waiting to bloom.', imageAlt: 'Sakura Miyu beneath pink sakura blossoms in a moonlit Gothic Kawaii world' },
  ja: { title: "🌸 Sakura Miyu's Little Worldへようこそ 🖤", description: '日記を書いている私のこと、大好きな世界、そしてこれから咲く物語を少しだけ紹介します。', imageAlt: '月明かりのゴシックかわいい世界で、ピンクの桜の下にいるさくらみゆ' },
};

export function languageBody(body: string, language: ContentLocale) {
  const sections: Array<{ language: string; body: string }> = [];
  let depth = 0;
  let start = 0;
  let currentLanguage = '';
  for (const tag of body.matchAll(/<\/?section\b[^>]*>/gi)) {
    if (!tag[0].startsWith('</')) {
      if (depth === 0) { currentLanguage = tag[0].match(/\blang=["'](uk|en|ja)["']/)?.[1] || ''; start = tag.index! + tag[0].length; }
      depth++;
    } else if (depth > 0 && --depth === 0 && currentLanguage) sections.push({ language: currentLanguage, body: body.slice(start, tag.index) });
  }
  if (!sections.length) return body;
  if (sections.every(section => section.language === language)) return body;
  const selected = sections.filter(section => section.language === language);
  if (!selected.length) return '';
  return selected.map(section => section.body.replace(/<h2\b[^>]*\bid=["'](?:ukrainian|english|japanese)["'][^>]*>[\s\S]*?<\/h2>/g, '').trim()).join('\n\n');
}

export function translationIdentity(id: string, key?: string) {
  return key || legacyTranslationKeys[id] || `entry:${id}`;
}

export function entrySlug(id: string, slug?: string) {
  return slug || id.replace(/^(uk|en|ja)--/, '');
}
