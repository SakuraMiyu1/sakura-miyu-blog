# Єдиний редактор багатомовних статей

Дата перевірок: 28.10.2026. Гілка: feat/unified-multilingual-editor. Зміни підготовлені для Pull Request; main і production у межах цієї задачі не змінювалися.

## Результат

Одна стаття відкривається один раз у Articles. Спільні налаштування розташовані над трьома мовними вкладками: 🇺🇦 Українська, 🇬🇧 English, 🇯🇵 日本語. Одні Save / Ready / Publish застосовуються до всього запису, включно з трьома перекладами й спільним зображенням.

Публічні сторінки, Gothic Kawaii дизайн, шрифти, початкові зображення, мовний перемикач, OAuth, Functions, Google verification і security headers збережені. Нових npm-залежностей, бекендів, баз даних, платних API або сервісів не додано. Вартість інфраструктури залишається £0.00 на наявних GitHub Free / Cloudflare Pages Free; білінг і тарифи не змінювалися.

## Як створити статтю

1. Відкрий Articles → ＋ Article.
2. Задай постійний Article ID, наприклад a-quiet-morning. Він зберігається як translationKey і визначає filename; після створення не змінюється.
3. Заповни спільні Publication date, Updated date за потреби, Category, Tags, Featured image, Featured on Homepage та Keep hidden even after Publish.
4. У кожній потрібній мовній вкладці заповни Title, URL slug, Description, Story у Markdown, image alt text та необов’язкові SEO title/description.
5. Save зберігає один запис в одну workflow-гілку. Ready → Publish now виконується один раз. Після merge й Cloudflare build завершені переклади з’являються у відповідних розділах.

Завершений переклад має непорожні title, slug, description і body. Будь-яку мову можна не заповнювати або лишити частковою: її текст зберігається, але порожня сторінка, RSS item, search result або hreflang не створюються. Обов’язкової основної мови немає. Якщо зображення задане, завершена версія потребує власного alt text.

Shared tags успадковуються, якщо translations.<locale>.tags відсутній. Локальний список замінює спільний; явний [] означає відсутність тегів для цієї мови. Неопубліковану workflow-чернетку можна відкинути стандартним способом Decap; видалення вже опублікованої статті з редактора вимкнено. Для приховування всіх мов використовуй Keep hidden і опублікуй зміну.

## Збереження й Astro

Один файл: src/content/articles/<translationKey>.json. Спільні поля лежать у корені, мовні поля — у translations.uk / translations.en / translations.ja. Body є звичайним Markdown-рядком у JSON; переносам, лапкам і Unicode відповідає стандартне JSON-екранування. CMS робить це автоматично. Для ручного способу без CMS є templates/article.json та інструкції README.md / CMS_SETUP.md.

Astro loader перевіряє запис і обчислює окрему плоску content entry для кожного завершеного перекладу. Компоненти сайту й маршрути використовують ту саму мовну модель, що й раніше. Незалежні slugs допускаються; однакові slugs у різних мовах мають різні collection IDs. Дубль одного URL у межах мови зупиняє збірку. Спільний translationKey зв’язує мовні версії.

## Міграція

П’ять оригінальних Markdown-файлів залишені без змін. На підставі вже наявної явної мапи перекладів створено три активні записи:

| Article ID | Мови | Оригінальні джерела |
| --- | --- | --- |
| welcome | uk / en / ja | welcome.md |
| my-little-anime-world | uk | my-little-anime-world.md |
| little-world-be-yourself | uk / en / ja | malyenkyi-svit-de-mozhna-buty-soboiu.md, a-little-world-where-you-can-be-yourself.md, jibunrashiku-irareru-chiisana-sekai.md |

Для welcome перенесені вже опубліковані локалізовані метадані. У anime не створено вигаданих EN/JA перекладів. Різні теги останньої історії збережено як локальні overrides, зокрема японський «創作, コスプレ» залишається одним тегом.

cms/article-migration.json фіксує джерела, SHA-256, усі сім публічних URL, мовні body hashes і метадані. Хеші використовують канонічні Git LF; Windows CRLF нормалізовано лише всередині нових JSON bodies. Жоден архівний Markdown не переписаний. Зіставлення всіх семи bodies та кожного поля метаданих пройшло; відповідності не визначалися за здогадками.

Архівні джерела позначаються loader як legacy-only і не дублюють нові публікації. Відсутній мігрований JSON не спричиняє мовчазного повернення старої копії: збірка повідомить про втрачений запис. Інші legacy Markdown/MDX залишаються сумісними.

## URL та SEO

Усі сім існуючих мовних URL збережені. Залишилися 55 односторонніх 301 для старих адрес. Для початкових мігрованих URL manifest також дозволяє побудувати alias у разі зміни canonical slug; alias вилучається із sitemap. Для майбутніх нових статей не змінюй уже опублікований slug без окремого redirect.

Кожна готова мова має власні html lang, title/description, canonical, Open Graph, BlogPosting, search index і RSS. Hreflang посилається лише на готові опубліковані переклади. Перемикач відкриває відповідну мовну версію за Article ID, а за її відсутності — головну вибраної мови. Публічні списки, sidebar, related і previous/next залишаються розділеними за мовами.

## Виконані перевірки

| Перевірка | Результат |
| --- | --- |
| npm test | 35 / 35 пройдено |
| npm run build | Пройдено: Astro check 77 файлів, 0 errors / warnings / hints; 177 HTML; 6 318 внутрішніх links/assets/anchors |
| npm run test:unified | Пройдено: один JSON → три мовні сторінки; однакові slugs між мовами; окремий EN-only запис; partial/missing, draft/future; локальні SEO/tags; sitemap/RSS/search, hreflang і перемикання; 8 джерел збережені |
| npm run test:content | Пройдено: legacy fixtures, Unicode, пагінація/пошук, категорії/теги, UTC archive, related, різні slugs зі спільним ключем, image, draft/future; 5 оригіналів збережені |
| npm run test:cms | Пройдено зі справжнім Decap і production CSP: три вкладки, усі мовні поля, Blob/WebP backup/restore, mobile Edit/Preview, один JSON draft та один Publish, редагування welcome зі збереженням інших полів і успадкованих тегів |
| npm run test:cms:github | Пройдено: справжній GitHub backend Decap з 41 перехопленим API-запитом; popup handshake, one-file/one-branch/one-PR, Unicode upload/save/reload/update, усі три переклади |
| npm run test:browser | Пройдено: три мови × вісім ширин 320–1920 px, клавіатура/меню, images/search/RSS, translation links, fallback, localStorage/URL priority, no-JS, canonical/hreflang і legacy targets |
| npm run test:a11y | Пройдено на 28 сторінках: текстовий контраст, headings, labels, landmarks, alt та унікальні ID |
| Cloudflare Pages local runtime | Пройдено: усі 55 справжніх HTTP 301 та їхні цілі, три мовні головні/RSS, збережені admin headers; без локальних secrets auth вимкнений |
| Збереження джерел | Порожній diff для Markdown, public images, global.css, OAuth/Functions, security headers, vendor assets і package-lock; 100 vendor SHA-256 перевірено |

Тимчасові статті існували лише в локальних QA output або in-memory/mock backend, були прибрані після перевірок і не публікувалися на production. Справжні токени та зовнішні записи тестами не використовувалися.

## Межі Decap і ручна перевірка

Pinned Decap 3.17.1 має native single_file i18n, але воно використовує default locale й зберігає metadata під коренями мов. Для одного shared-settings блоку та незалежних optional languages застосовано малий ObjectControl wrapper із вкладками; усі три підконтроли залишаються змонтованими. Додаткова бібліотека не потрібна. Адмін-інтерфейс залишається англійським; автоматичного перекладу немає.

Справжній вхід власника та публікація реальної статті через GitHub OAuth не виконувалися. Їх треба перевірити після погодженого merge; preview не потребує production-секретів. Safari/iPhone і озвучення screen reader залишаються ручними перевірками. Production не змінюється до merge PR.

## Змінені файли

- CMS_SETUP.md
- README.md
- UNIFIED_EDITOR_REPORT.md
- cms/article-migration.json
- package.json
- public/admin/admin.css
- public/admin/config.yml
- public/admin/editor.js
- public/admin/guide.html
- scripts/generate-redirects.mjs
- scripts/test-cms-browser.mjs
- scripts/test-cms-github.mjs
- scripts/test-unified-content.mjs
- scripts/verify-build.mjs
- scripts/verify-cms.mjs
- src/content.config.ts
- src/content/articles/little-world-be-yourself.json
- src/content/articles/my-little-anime-world.json
- src/content/articles/welcome.json
- src/lib/article-data.ts
- src/lib/article-migration.ts
- src/lib/blog.ts
- src/lib/localized-loader.ts
- src/lib/routes.ts
- src/pages/[locale]/[...page].astro
- src/pages/blog/[...slug].astro
- templates/article.json
- tests/article-migration.test.mjs
- tests/articles.test.mjs
- tests/cms-editor.test.mjs
