# Багатомовність Sakura Miyu’s Little World

Дата перевірки: 21.10.2026. Реалізація підготовлена локально; push і production deployment для цього завдання ще не виконувалися.

## Що реалізовано

Одна кнопка поточної мови з трьома варіантами: Українська / English / 日本語. Меню підтримує повторний клік, клік зовні, Escape, стрілки, Tab, видимий фокус та мобільний екран. Без JavaScript воно працює як native details із звичайними посиланнями.

Окремі статичні версії /uk/, /en/, /ja/. Головна, щоденник, тематичні сторінки, категорії, теги, архів, sidebar, пошук, RSS, сусідні та рекомендовані статті отримують лише записи своєї мови. Основний CSS, шрифти, зображення, Gothic Kawaii оформлення та структура головної збережені.

Вибір зберігається у localStorage. Збережена мова враховується на кореневій адресі /; явний мовний URL має пріоритет. За відсутності JavaScript або доступу до localStorage сторінки доступні звичайними посиланнями. Коренева сторінка без збереженого вибору українська.

## Архітектура

- i18n.ts і page-copy.ts містять переклади інтерфейсу та сторінок; language.css додає оформлення перемикача.
- Один мовний catch-all маршрут генерує статичні сторінки й окремі endpoints пошуку та RSS для трьох мов.
- language визначає мову; translationKey зв’язує переклади незалежно від title та slug. Якщо перекладу немає, перемикач веде на головну вибраної мови.
- ID колекції береться з filename, тому однаковий slug у різних мовах не перезаписує записи. Дублікати опублікованого translationKey або URL в межах однієї мови зупиняють збірку.
- Старі три різнойменні переклади пов’язані sidecar-мапою ключем little-world-be-yourself без переписування оригіналів.
- Для legacy welcome.md loader обчислює три мовні версії з відповідними метаданими. Для старих одномовних статей з трьома секціями публікує лише секцію вибраної мови. Оригінальний Markdown залишається незмінним.
- html lang, canonical, SEO title/description, Open Graph і BlogPosting відповідають мові. Hreflang містить лише наявні сторінки. Sitemap включає мовні canonical URL, виключає старі aliases і 404.
- Google verification, CSP, OAuth, Functions, vendor SDK, secrets і медіафайли не змінювалися.

## Нові переклади в Decap CMS

1. Створи окремий Diary entry для кожної мови; вибери Language: uk / en / ja.
2. Вкажи однаковий Translation Key для перекладів однієї історії, наприклад quiet-morning.
3. Вкажи URL slug для цієї версії. Slug може відрізнятися між перекладами або збігатися між різними мовами.
4. Заповни title, description, body та за потреби SEO title/description відповідною мовою. Для зображення додай alt text.
5. Save створює чернетку в editorial workflow. Для видимої публікації залиш Keep hidden even after Publish вимкненим і скористайся Publish.

Нові файли: src/content/blog/uk--quiet-morning.md, en--quiet-morning.md, ja--quiet-morning.md. Публічні адреси: /uk/blog/quiet-morning/, /en/blog/quiet-morning/, /ja/blog/quiet-morning/.

Існуючі filenames збережені; під час редагування вже створеного prefixed запису CMS не перейменовує його і не дозволяє змінити мову замість створення окремого перекладу. Legacy multilingual доступний лише для існуючих записів. Покрокова довідка також у CMS_SETUP.md і /admin/guide.html.

## Старі адреси

Після build генерується dist/_redirects: 55 постійних односторонніх HTTP 301 правил для колишніх сторінок і статей. Їхні цілі існують та мають мовний префікс; циклів немає. HTML-сторінки перенаправлення також містять meta refresh і звичайне посилання як запасний варіант.

Старі /rss.xml та /search-index.json залишаються українськими compatibility aliases. Нові мовні версії використовують /uk/rss.xml, /en/rss.xml, /ja/rss.xml і відповідні search-index.json.

## Фактично виконані перевірки

| Перевірка | Результат |
| --- | --- |
| npm test | 24/24 пройдено |
| npm run build | Пройдено; Astro check: 72 файли, 0 errors/warnings/hints |
| Перевірка output | 177 HTML-сторінок; 6 318 внутрішніх посилань, assets і anchors; SEO, JSON-LD, sitemap, RSS, robots, search index |
| npm run test:content | Пройдено: 12 тимчасових записів, 5 оригіналів з незмінними SHA-256; мовна ізоляція; однакові slug між мовами; різні slug зі спільним ключем; пагінація, Unicode, дати UTC, SEO, media, draft/future exclusion |
| npm run test:browser | Пройдено: 3 мови × 8 ширин 320–1920 px, меню/клавіатура, пошук, RSS, справжні переходи перекладів, missing-translation fallback, localStorage, URL priority, no-JS, усі legacy targets |
| npm run test:a11y | Пройдено на 28 сторінках: текстовий контраст, heading levels, labels, landmarks, alt, ID |
| npm run test:cms | Пройдено з production CSP: локальний in-memory backend, створення/збереження/відновлення/публікація QA-чернетки, Blob backup, WebP preview, дати та mobile layout |
| npm run test:cms:github | Пройдено з реальним Decap frontend і mock GitHub API: OAuth popup handshake, draft branch/PR, upload, reload/update, збереження language/key/slug/filename; 41 перехоплений API-запит |
| Cloudflare local runtime | Пройдено: 55 справжніх HTTP 301, доступні мовні сторінки та RSS, збережені admin security headers, auth disabled без локальних secrets |
| git diff --check | Пройдено |

Публічні та CMS suites повторно запущені послідовно після нестабільного паралельного запуску. Порожнє поле дати з раннього тесту не відтворилося; serialized date, reload та update перевірено, конфігурацію дат не змінювали. Пошкодження збережених дат не встановлено.

Мобільні й desktop скриншоти збережені у test-results/{uk,en,ja}-home-{390,1366}.png. П’ять оригінальних Markdown-файлів, зображення, global.css, security headers, OAuth та Functions мають порожній diff від вихідного commit 771585c.

## Обмеження й ручна перевірка після погодженого deployment

- Реальний вхід власника через GitHub та публікація справжньої статті не виконувалися. CMS тести використовували mock/in-memory backend, без зовнішніх записів та реальних токенів.
- Safari/iPhone та озвучення screen reader не перевірялися; mobile перевірено в Chromium/Edge через різні viewport.
- Переклади статей не генеруються автоматично. Довільні авторські теги, назви творів та власні назви зберігаються; відомі теми інтерфейсу перекладені. Адмін-інтерфейс Decap залишається англійським.
- Legacy welcome редагується в існуючому файлі з трьома секціями. Інший старий multilingual запис потребує явних перекладених метаданих у loader; нові записи створюються одномовними.
- На production після публікації слід перевірити /uk/, /en/, /ja/, перемикання відповідних трьох перекладів, CMS-вхід, HTTP 301 старих адрес та sitemap.

Нових залежностей, сервісів, платних API чи тарифів не додано. Цільова щомісячна вартість залишається £0.00; наявні безкоштовні ліміти описані в CMS_SETUP.md.

## Змінені файли

- .gitignore
- CMS_SETUP.md
- LOCALIZATION_REPORT.md
- README.md
- astro.config.mjs
- package.json
- public/admin/config.yml
- public/admin/editor.js
- public/admin/guide.html
- scripts/audit-accessibility.mjs
- scripts/generate-redirects.mjs
- scripts/test-browser.mjs
- scripts/test-cms-browser.mjs
- scripts/test-cms-github.mjs
- scripts/test-content-fixtures.mjs
- scripts/verify-build.mjs
- scripts/verify-cms.mjs
- src/components/CopyLink.astro
- src/components/Follow.astro
- src/components/Footer.astro
- src/components/Header.astro
- src/components/Hero.astro
- src/components/LanguagePicker.astro
- src/components/PostCard.astro
- src/components/PostListing.astro
- src/components/Share.astro
- src/components/Sidebar.astro
- src/components/TopicPosts.astro
- src/content.config.ts
- src/layouts/BaseLayout.astro
- src/layouts/LegacyRedirect.astro
- src/layouts/PageLayout.astro
- src/lib/blog.ts
- src/lib/content-languages.ts
- src/lib/feeds.ts
- src/lib/i18n.ts
- src/lib/localized-loader.ts
- src/lib/page-copy.ts
- src/lib/post-utils.ts
- src/lib/routes.ts
- src/pages/404.astro
- src/pages/[locale]/[...page].astro
- src/pages/[locale]/rss.xml.ts
- src/pages/[locale]/search-index.json.ts
- src/pages/[topic].astro
- src/pages/about.astro
- src/pages/archive.astro
- src/pages/blog/[...slug].astro
- src/pages/blog/index.astro
- src/pages/categories/[category].astro
- src/pages/index.astro
- src/pages/rss.xml.ts
- src/pages/search-index.json.ts
- src/pages/tags/[tag].astro
- src/pages/tags/index.astro
- src/pages/writing.astro
- src/styles/language.css
- src/views/ArchivePage.astro
- src/views/ArticlePage.astro
- src/views/CollectionPage.astro
- src/views/HomePage.astro
- src/views/NotFoundPage.astro
- src/views/StaticPage.astro
- src/views/TagDirectory.astro
- templates/blog-post.md
- tests/cms-editor.test.mjs
- tests/i18n.test.mjs
- tsconfig.json
