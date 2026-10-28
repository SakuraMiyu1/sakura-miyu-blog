# Публікація Sakura Miyu через Decap CMS — бюджет £0

Редактор підготовлено для `https://sakura-miyu-blog.pages.dev/admin/`. Блог залишається звичайним статичним Astro-сайтом і працює незалежно від CMS. Сам інтерфейс `/admin/` не містить секретних даних; читати, змінювати й публікувати через GitHub можна лише після авторизації.

**Історична перевірка 17.10.2026:** production OAuth був активований; наявність серверних змінних перевіряли без читання їхніх значень. Тодішню чернетку `cms/blog/my-little-anime-world` не змінювали й не публікували в межах тієї діагностики. Тестовий backend не використовується в production-конфігурації.

**Нова модель редактора:** один запис статті зі спільними налаштуваннями й вкладками UA / EN / JP готується як зміна для pull request. Ця документація не підтверджує merge або production deployment цієї зміни. OAuth secrets, Functions і CSP для неї не змінюються.

## Виправлення збереження чернеток

- **CSP:** у живій відповіді `/admin/` не було `blob:` у `connect-src`. Decap викликає `fetch(blobURL)` у `AssetProxy.toBase64()` для GitHub upload і в `persistLocalDraftBackup()` для IndexedDB. Обидва запити блокувалися. Дозвіл додано тільки до `connect-src` правила `/admin/*`; глобальні заголовки, `script-src`, `object-src`, OAuth callback CSP та secrets не змінювали.
- **Прев’ю зображень:** Decap 3.17.1 повертав `/images/blog/...` як абсолютну URL раніше, ніж шукав відповідний asset proxy. Відтворено порожнє зображення та 404 навіть після дозволу blob-fetch. Точковий патч `selectMediaFilePath` зіставляє цей public prefix із `public/images/blog/...`. Файл у полі залишається `/images/blog/...`; прев’ю використовує локальний або GitHub draft blob. Зовнішні URL та наявні `/images/welcome.webp` не змінюються.
- **Помилка `indexOf`:** надана позиція `decap-cms.js:56:112935` відповідає `r.data.indexOf` у `authorizeCallback`, а не полю дати. Оригінальний handler відтворює TypeError на сторонньому object-valued `postMessage`. Патч перевіряє string, точний origin і вікно OAuth popup перед обробкою. `pubDate`/`updatedDate` зберігають `YYYY-MM-DD`; перевірені наявна дата, порожнє оновлення та зміна дати після повторного відкриття.
- **404 `sakura-miyu.webp`:** під час діагностики цього файлу немає ні в `main`, ні в збереженій гілці чернетки. Сервер не може віддати файл, який ще не потрапив у Git. Файл, завантажений лише у відкритому редакторі, або файл у неопублікованій гілці не зобов’язаний існувати на публічному сайті. Прев’ю тепер не залежить від такої публікації. Якщо зображення не відновилося з локальної копії, вибери його повторно з комп’ютера та натисни Save.

Два локальні патчі self-hosted SDK описані точними замінами в `cms/vendor-patches.json`. Збережені початковий та змінений SHA-256; `verify-cms.mjs` перевіряє всі assets і доводить, що зворотне застосування патчів відтворює оригінальний pinned Decap 3.17.1. Ліцензії збережено. При оновленні Decap ці патчі потрібно перевірити на новому upstream-коді, а не переносити автоматично.

Перевірки: `npm test`, `npm run test:cms`, `npm run test:cms:github`, `npm run build`. GitHub browser test використовує справжній Decap GitHub backend і перехоплює всі API-запити: popup handshake → image/base64 upload → draft branch + PR → reload → image/date preview → update тієї самої чернетки. Жодних реальних токенів або записів у GitHub під час тесту. Окремо перевіряється резервна копія з Blob в IndexedDB та її відновлення після reload.

Після деплою вручну: скопіюй незбережений текст із відкритого старого редактора, перезавантаж `/admin/` без очищення browser storage, увійди як SakuraMiyu1, відкрий наявну чернетку, вибери зображення/alt text і натисни Save. Перевір прев’ю, повторно відкрий чернетку, зміни текст і збережи ще раз. У GitHub має оновитися та сама `cms/blog/...` гілка/PR разом із медіафайлом; `main` залишається незмінним до явного Publish. Повний вхід через реальний GitHub OAuth та збереження від імені власника потребують цієї ручної перевірки; серверний redirect/PKCE/state і callback без state перевіряються окремо. Публікація твоєї наявної чернетки в межах діагностики не виконується.

## Одноразове налаштування

### 1. Перевір безкоштовні плани

- GitHub: використовуй наявний GitHub Free, репозиторій `SakuraMiyu1/sakura-miyu-blog`.
- Cloudflare: Workers & Pages → Workers Plans має показувати **Free**. Pages також залишається Free. Не обирай Workers Paid/Standard, Pro, платний trial або додавання картки.
- Workers Free підтверджений власником акаунта 17.10.2026. Авторизація через API не дала права самостійно прочитати білінговий план; платні підписки не створювались і не змінювались.
- Не вмикай R2, Images, Stream, Access, KV, D1, платні логи або сторонній OAuth-хостинг: ця реалізація їх не використовує.

### 2. Створи GitHub OAuth App

1. Увійди в GitHub саме як **SakuraMiyu1**.
2. Відкрий [Settings → Developer settings → OAuth Apps → New OAuth App](https://github.com/settings/applications/new).
3. Заповни:

   | Поле | Значення |
   | --- | --- |
   | Application name | Sakura Miyu Writing Desk |
   | Homepage URL | `https://sakura-miyu-blog.pages.dev/admin/` |
   | Application description | Personal writing dashboard for Sakura Miyu |
   | Authorization callback URL | `https://sakura-miyu-blog.pages.dev/api/callback` |

4. Залиш Device Flow вимкненим. Не підключай платних інтеграцій. Для стандартного Decap OAuth-потоку не вмикай expiring tokens/offline access: ця інтеграція не використовує refresh tokens.
5. Натисни Register application. Скопіюй **Client ID**. Натисни Generate a new client secret і перенеси секрет **безпосередньо в Cloudflare** наступним кроком.
6. Не вставляй секрет у чат, GitHub-файл, README, CMS-конфігурацію, скріншот чи змінну з префіксом PUBLIC_. Реальний access token створиться лише під час входу; готовий PAT не потрібен.

OAuth просить `public_repo`, а не `repo`: приватні репозиторії не потрібні. У GitHub OAuth Apps цей scope дає користувацькому токену доступ до доступних користувачу публічних репозиторіїв, а не лише до одного. Сервер видає токен редактору тільки після перевірки користувача SakuraMiyu1 та push-права саме на цей публічний репозиторій. Не використовуй цей застосунок для інших акаунтів.

### 3. Збережи значення в Cloudflare

Відкрий Workers & Pages → **sakura-miyu-blog** → Settings → Variables and Secrets. У середовищі **Production** додай:

| Назва | Тип | Значення |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Plain text | Client ID власного OAuth App |
| `GITHUB_CLIENT_SECRET` | Secret / Encrypt | Новий Client secret власного OAuth App |
| `CMS_ENABLED` | Plain text | `true`, тільки коли credentials додані й Workers Free підтверджений |
| `CMS_ORIGIN` | Plain text, optional | `https://sakura-miyu-blog.pages.dev` — це значення вже є стандартним у коді |

Чинні `SITE_URL=https://sakura-miyu-blog.pages.dev`, `NODE_VERSION=22.22.0` та `ASTRO_TELEMETRY_DISABLED=1` збережи. Команда збірки залишається `npm run build`, output — `dist`, root — корінь репозиторію. Functions лежать у кореневій папці `functions/`; Cloudflare Git integration збирає їх окремо від статичного Astro, адаптер Astro Cloudflare не потрібен.

У **Preview** не додавай OAuth secret і залиш `CMS_ENABLED` відсутнім або `false`. Вхід з preview-доменів заборонений сервером. Працюй лише з production `/admin/`.

Секрети читаються під час виконання функцій через `context.env` і не підставляються в браузерний bundle чи статичний HTML. Не створюй `.env` з реальним секретом. Якщо локальна перевірка колись потребуватиме credentials, використовуй `.dev.vars`, який уже виключений з Git.

### 4. Вимкни preview-збірки для CMS-чернеток

У Pages → Settings → Builds & deployments → Branch control встанови custom preview branches: Include `*`, Exclude `cms/*`. Залиш production-гілкою `main`. Це збереже інші preview-гілки, але не витрачатиме 500 місячних безкоштовних збірок на кожне збереження чернетки.

Це правило вже збережено в наявному Cloudflare-проєкті під час інтеграції; повторювати його налаштування не потрібно.

Додатково Astro відмовляється збирати `CF_PAGES_BRANCH`, що починається з `cms/`, тому випадково ввімкнений preview не створить сайт із CMS-чернетками. Звичайні preview інших гілок продовжують працювати з production canonical.

### 5. Деплой і перевірка справжнього входу

1. Зміни нового редактора спочатку проходять review у pull request. Після схвалення та merge до `main` працює звичайний автоматичний deployment. Чинні OAuth credentials повторно створювати чи змінювати не потрібно. Якщо виконується перше налаштування серверних змінних, застосуй їх через Pages → Deployments → Retry deployment; force-push не потрібний.
2. Дочекайся Success у Deployments і відкрий `/api/cms-status`: очікується `{"enabled":true}`. Секретів у відповіді немає.
3. Відкрий `/admin/`, натисни Login with GitHub. Дозволь popup лише для цього домену, підтвердь власний OAuth App і повернися в редактор.
4. Створи один тестовий Article ID, заповни спільні налаштування й потрібні мовні вкладки, збережи через Save draft. Має з’явитися одна гілка `cms/blog/<article-id>` та один pull request із JSON-файлом `src/content/articles/<article-id>.json`. До Publish запису немає на основному сайті.
5. Додай спільне зображення, alt text у завершених мовах і перевір Preview. Коли готово, вимкни Keep hidden even after Publish, вибери Ready → Publish now один раз. Перевір merge одного PR до main і новий успішний Cloudflare deployment.
6. Перевір усі завершені переклади, теги, категорію, RSS, архів і пошук. Частково заповнена мова має зберегтися в JSON без публічної сторінки. Лише після цих кроків можна вважати справжній publishing-процес перевіреним.
7. Видалення статей у CMS вимкнене. Для приховування власного тестового матеріалу ввімкни Keep hidden even after Publish та опублікуй зміну. Автоматичні тести не створюють реальних записів у GitHub.

## Як користуватися редактором

Повсякденна інструкція українською доступна в `/admin/guide.html`: вхід, одна стаття з трьома вкладками, збереження, публікація, картинки, редагування, приховування, SEO та iPhone.

- **Нова стаття:** Articles → New Article. Введи один Article ID — це поле `translationKey`, постійне ім’я файла `src/content/articles/<id>.json`. Воно використовує малі латинські літери, цифри й дефіси та не змінюється після створення. Дата, категорія, картинка, Tags, featured і draft спільні. Назви, slug, опис, alt text, SEO та Story розташовані у трьох мовних вкладках того самого запису.
- **Чернетка:** Save draft зберігає весь JSON і медіа в одну гілку, не в main. Workflow показує статтю один раз; повторне Save оновлює ту саму чернетку й PR. Можна залишити будь-яку мову порожньою або частково написаною — її текст не стирається.
- **Публікація:** Ready → Publish now натискається один раз для статті. Після merge і Cloudflare build стають публічними завершені мовні версії. Мова завершена, коли непорожні Title, URL slug, Description і Story. Незаповнена версія не створює сторінку чи записи в пошуку, RSS, sitemap або hreflang. `draft: true` приховує всі мови навіть після merge; workflow-чернетка окремо означає, що JSON ще не потрапив у main.
- **Приватність:** GitHub-репозиторій публічний. Гілки, pull requests, історія файлів, чернетки та завантаження не є конфіденційними. `draft` захищає від показу на сайті, а не від читання через GitHub. Не завантажуй приватні фото чи особисті дані.
- **Майбутні дати:** такі записи не показуються. Після настання дати виконай безкоштовний Retry deployment або наступну публікацію; таймер чи платний scheduler не додавався.
- **Фото:** repository storage `public/images/blog/`, публічні адреси `/images/blog/...`. Це окрема папка, що не містить початкових hero/avatar/background. Давай файлам унікальні імена латиницею з датою, не підтверджуй випадкову заміну. Для доступних браузеру JPEG/PNG/WebP увімкнено локальне перетворення до WebP, ширина до 1600 px, quality 82. Це не платний Cloudflare Images. Передавай файли до 5 MB; обмеження не є серверною квотою безпеки. GIF/SVG не гарантують таку оптимізацію. Для iPhone HEIC спочатку експортуй JPEG.
- **Текст і мови:** вкладки Українська (UA), English (EN), 日本語 (JP) містять окремі тексти у `translations.uk/en/ja`. Пиши Story у Markdown без спільних тримовних HTML-секцій. Основної обов’язкової мови немає. Перемикай вкладки мишкою або стрілками/Home/End; приховані вкладки залишаються змонтованими, щоб редактор зберігав їхній стан. Автоперекладу чи AI немає.
- **Теги:** `tags` у корені JSON — спільний список. Якщо локальне поле `translations.<locale>.tags` відсутнє, використовуються спільні теги. Залиш Language-specific tags недоторканим для успадкування. Явний локальний список замінює спільний; `[]` означає навмисно не показувати теги цією мовою. Відсутність і порожній список не перетворюються один на одного при звичайному збереженні.
- **Старі записи:** п’ять оригінальних Markdown-файлів залишені без змін як архів. Три JSON-записи в Articles мають пріоритет над їхніми старими джерелами. Для зміни видимого тексту редагуй відповідну статтю в Articles, а не архівний Markdown. `templates/blog-post.md` збережено; новий шаблон — `templates/article.json`.
- **Markdown/MDX:** тіло нових JSON-статей містить Markdown-рядок. Legacy `.md`/`.mdx` підтримка не видаляється, але звичайний CMS-workflow тепер працює з одним JSON; JSX/imports не слід вставляти в його Markdown body.
- **SEO:** optional `seoTitle`, `seoDescription` окремі для кожної вкладки; порожні поля беруть її Title/Description. Canonical має вигляд `SITE_URL/<language>/blog/<slug>/`. Для різних мов можна вказати різні slug в одному JSON. Зберігай опубліковані slug незмінними, щоб не ламати старі посилання.
- **Категорії:** чинний фіксований список; нову категорію потрібно додати одночасно у `src/lib/post-utils.ts` та `public/admin/config.yml`. Перевірка збірки не дозволить спискам розійтися. Теги можна додавати в CMS без коду.
- **Приховування:** `delete: false` вимикає видалення опублікованих статей через CMS; звичайну неопубліковану workflow-чернетку Decap усе ще дозволяє відкинути. Використовуй Keep hidden even after Publish і опублікуй цю зміну, щоб приховати всю статтю зі збереженням текстів та медіа.
- **iPhone:** Safari, увімкнений JavaScript, дозволений popup GitHub, прокручування полів і перемикання Edit/Preview. Нативний Safari/iPhone окремо потребує перевірки власником; ширини 375/390/430/768/1366 перевіряються автоматизованим Chromium-тестом, коли він запускається.

## Переклади UA / EN / JP

Головні сторінки мов — `/uk/`, `/en/`, `/ja/`. Статті розміщені в `/{language}/blog/{slug}/`. Один файл `src/content/articles/quiet-morning.json` із `translationKey: quiet-morning` може містити:

| Вкладка | Поле slug | Адреса |
| --- | --- | --- |
| `uk` | `tykhyi-ranok` | `/uk/blog/tykhyi-ranok/` |
| `en` | `a-quiet-morning` | `/en/blog/a-quiet-morning/` |
| `ja` | `shizukana-asa` | `/ja/blog/shizukana-asa/` |

Пиши всі переклади в цьому записі й публікуй один раз. Перемикач мови знаходить завершений опублікований переклад за ключем, а коли його немає — веде на головну вибраної мови. `hreflang` включає тільки наявні публічні переклади. Збірка відхиляє дублікати Article ID та мовної URL-адреси.

Пошук, RSS, останні записи, рекомендації, архів, категорії та теги обмежені поточною мовою. Feed — `/{language}/rss.xml`, індекс пошуку — `/{language}/search-index.json`. Кореневі `/rss.xml` і `/search-index.json` залишені як українські aliases.

Міграція об’єднує п’ять незмінених оригінальних Markdown-файлів у три редакторські JSON-статті: `welcome`, `my-little-anime-world`, `little-world-be-yourself`. `cms/article-migration.json` містить хеші джерел, тіл мовних версій, метадані та сім чинних локалізованих URL. JSON має пріоритет над відповідним legacy-джерелом: прихований або неповний запис не «відроджує» архівний текст. Тексти, метадані, зображення та чинні slug збережені.

Вкладки — тонка обгортка над ObjectControl з уже встановленого Decap 3.17.1. Native i18n `single_file` прив’язує перевірку до default locale й зберігає поля під мовними коренями; тут потрібні один shared-корінь і незалежні необов’язкові мови. Тому використовується звичайний object `translations`, без native i18n. Усі 100 vendor-файлів лишилися незмінними; нових залежностей немає.

Старі публічні адреси мають 301-правила у згенерованому `dist/_redirects` і HTML-посилання для браузера без JavaScript. Корінь `/` показує український контент із canonical `/uk/`; лише тут JavaScript може врахувати збережений вибір мови. Явна мовна адреса має пріоритет. Заблокований storage або вимкнений JavaScript не заважає читати сайт і переходити мовними посиланнями. `/admin/`, OAuth, security headers і Google verification tag залишаються на своїх місцях.

## Безпека

- Лише server-side secret; немає PAT у репозиторії, anonymous publishing, Netlify Identity/Git Gateway або стороннього OAuth broker.
- Випадковий state, PKCE S256, HMAC-підписана cookie `__Host-`, HTTPS, HttpOnly, Secure, SameSite=Lax, строк 10 хвилин. Callback перевіряє state, підпис, строк, власника й repository push permission до передачі токена.
- Код GitHub одноразовий; cookie видаляється після callback. База даних для сесій не потрібна.
- Передача токена в popup виконується лише на точний production origin з перевіркою opener/source. Callback має nonce CSP, no-store, no-referrer та заборону iframe. Токен не записується в URL, логи чи файл.
- CSP лише для статичної адмінки дозволяє `unsafe-eval`, потрібний AJV-валідатору поточного Decap. Inline JavaScript та сторонні скрипти не дозволені; inline CSS потрібний самому редактору. Це обмеження стандартного Decap-бандлу. OAuth callback використовує окремий nonce CSP без `unsafe-eval`.
- Decap GitHub backend працює з користувацьким access token у браузері. Це стандартна модель Decap, не HttpOnly server session: використовуй власний пристрій, не вставляй сторонні скрипти й виходь на спільних пристроях. Для відкликання доступу: GitHub → Settings → Applications → Authorized OAuth Apps → Sakura Miyu Writing Desk → Revoke.
- `/admin/` закритий від індексації, але прихована адреса не є захистом. Запис захищають GitHub permissions і OAuth. Невідомі користувачі не отримують токен від цього broker.
- Редактор та lazy chunks самостійно хостяться на Pages, версія Decap **3.17.1**, MIT; SHA-256 кожного файлу в `cms/vendor-manifest.json`. Немає CDN, зовнішніх fonts, платного Decap Turbo, медіабібліотек або AI. Бандл завантажується тільки в адмінці після перевірки конфігурації.
- `_routes.json` викликає Functions лише для `/api/auth`, `/api/callback`, `/api/cms-status`. Звичайні сторінки, RSS, картинки й редакторні static assets не споживають Functions quota. Вичерпання OAuth quota не відкриває доступу до GitHub і не перетворює блог на server-rendered.

## Безкоштовний запасний спосіб без CMS

1. У GitHub відкрий `src/content/articles` → Add file → Create new file.
2. Скопіюй `templates/article.json`, назви файл `a-little-moment.json`; його `translationKey` має бути `a-little-moment`.
3. Заповни спільні поля та потрібні `translations.uk/en/ja`. У кожному `body` пиши Markdown із JSON-екрануванням: `\n\n` для абзаців, `\"` для лапок. Незавершені мови можна лишити. Для публікації `draft: false`; для прихованого на сайті матеріалу `draft: true` або окрема гілка.
4. Через GitHub Add file → Upload files завантаж картинки в `public/images/blog/`, у тексті використовуй `/images/blog/filename.webp` з alt text.
5. Commit changes у main автоматично оновить Cloudflare. Npm, локальний редактор, OAuth-функції чи Codex для кожного допису не потрібні.

## Перевірки для розробника

```powershell
npm install
npm test
npm run test:unified
npm run build
npm run preview -- --host 127.0.0.1
```

Запускай fixture-перевірки послідовно, без одночасного build або Astro dev/preview цього проєкту. `test:unified` перевіряє нові JSON-статті, часткові мови, спільні метадані й наслідування тегів; `test:content` залишено для legacy-сумісності. Тести використовують ізольований QA output і прибирають лише власні створені файли. Не переривай їх і не очищай реальні матеріали за широкою маскою. Після fixture-перевірок зроби чистий production build.

В іншому терміналі з установленим Chromium або `TEST_BROWSER_CHANNEL=msedge`:

```powershell
$env:TEMP = Join-Path (Get-Location) '_tmp'
$env:TMP = $env:TEMP
$env:TEST_BROWSER_CHANNEL = 'msedge'
npm run test:cms
npm run test:cms:github
npm run test:browser
npm run test:a11y
```

`test:cms` підміняє конфігурацію лише всередині браузерного тесту й використовує справжній Decap із memory backend. `test:cms:github` використовує GitHub backend із перехопленими API-відповідями, перевіряючи popup, upload, один JSON/гілку/PR, мовні вкладки та повторне збереження. Нові fixtures мають один Article ID з трьома мовними об’єктами. Жоден тест не використовує справжній токен і не змінює реальні записи; не підмінюй ними ручну перевірку справжнього входу та публікації. `astro preview` не запускає Pages Functions; для повного локального runtime потрібен безкоштовний Wrangler Pages dev або production після налаштування. Пакет Wrangler не є runtime-залежністю блогу. Наведені команди описують перевірки, а не гарантують, що їх уже виконано для поточного deployment.

Автоматизовані перевірки потрібно повторювати після зміни мовної архітектури, CMS-конфігурації або vendor SDK. Для локального runtime без credentials очікуються `enabled:false` та HTTP 503 від auth/callback. Справжні GitHub-вхід і публікація, Safari/iPhone та поведінка Google Search Console залишаються ручними перевірками власника. Поточні результати build, тестів і deployment слід брати з фактичного запуску, а не з історичних кількостей сторінок у документації.

## Файли реалізації

| Нові файли | Призначення |
| --- | --- |
| `CMS_SETUP.md` | Налаштування, щоденна робота, безпека, статус і вартість |
| `cms/oauth.mjs` | OAuth broker, state, PKCE, перевірка користувача й repo |
| `cms/vendor-manifest.json` | Версія, ліцензія, розміри й SHA-256 усіх vendor-файлів |
| `functions/api/auth.js`, `callback.js`, `cms-status.js` | Три Pages Functions |
| `public/_routes.json` | Тільки три динамічні OAuth/status-маршрути |
| `public/admin/index.html`, `guide.html` | Інтерфейс входу й інструкція |
| `public/admin/start.js`, `editor.js` | Безпечний запуск, preview і валідація |
| `public/admin/admin.css`, `preview.css` | Ізольований адаптивний інтерфейс і preview |
| `public/admin/config.yml` | Decap-конфігурація у JSON-синтаксисі, який є валідним YAML; credentials тут відсутні |
| `public/admin/vendor/*` | 100 локальних файлів Decap; точний перелік у manifest, ліцензії включені |
| `scripts/verify-cms.mjs`, `test-cms-browser.mjs`, `test-cms-github.mjs` | Перевірка конфігурації, цілісності, редактора й mocked GitHub workflow |
| `src/lib/content-languages.ts`, `localized-loader.ts` | Ключі legacy-перекладів і мовні представлення без перезапису оригіналів |
| `src/lib/i18n.ts`, `page-copy.ts` | Переклади інтерфейсу та статичних сторінок |
| `src/content/articles/*.json`, `templates/article.json` | Один файл статті зі спільними параметрами й трьома мовами |
| `cms/article-migration.json` | Хеші збережених оригіналів і дані перевірки міграції |
| `scripts/generate-redirects.mjs` | 301-правила для старих адрес у production output |
| `tests/cms-auth.test.mjs`, `cms-editor.test.mjs` | Серверні security-тести й валідація полів |

Оригінальні Markdown-статті та початкові зображення збережено. Їхні нові canonical-адреси мають мовний префікс; старі адреси перенаправляються. CMS, OAuth broker і Functions продовжують використовувати наявну інфраструктуру. Для багатомовності не додано npm-залежностей, сервісів або платних можливостей.

## Якщо щось не працює

| Симптом | Перевірка |
| --- | --- |
| Вхід не налаштовано | Production runtime vars, тип Secret, CMS_ENABLED=true, потім redeploy |
| Callback mismatch | OAuth App callback має бути точно `/api/callback` на production origin, без кінцевого слеша |
| Sign-in session invalid | Закрий popup, відкрий новий вхід; перевір HTTPS, cookies, строк 10 хвилин; не використовуй старий callback URL |
| Editor only available to SakuraMiyu1 | Вийди з іншого GitHub-акаунта, увійди як SakuraMiyu1 |
| 403/rate limit GitHub | Дочекайся reset, перевір OAuth grant і push access; не купуй план |
| Publish є, але мови немає | Keep hidden вимкнений, дата настала, заповнені Title/slug/Description/Story цієї мови, PR merged у main, Cloudflare deployment Success |
| Зображення не видно | Латинське ім'я файлу, `/images/blog/...`, файл у public, підтримуваний формат і завершений деплой |
| Контент не зберігся на телефоні | Не закривай вкладку до успішного Save draft; дозволені cookies/popup; спробуй Safari замість вбудованого браузера месенджера |
| Functions quota вичерпана | Дочекайся добового reset UTC; статичний блог і GitHub JSON-публікація залишаються доступними |

## Звіт про вартість

Ціль: **£0.00/місяць**, без картки, без увімкнення платних планів чи автоматичних upgrade. Ліміти перевірені за офіційними сторінками 17.10.2026; це не гарантія незмінності тарифів у майбутньому. Потрібно залишатися на Free. Код не містить операцій білінгу чи активації підписок.

| Сервіс / компонент | Безкоштовний | Картка | Важливі обмеження | Неочікувані витрати |
| --- | --- | --- | --- | --- |
| GitHub Free: Git, repo, OAuth App, API та картинки в repo | Так | Не потрібна | API зазвичай 5000 запитів/год на користувача; secondary limits; файл Git <100 MiB, варто тримати repo <1 GB | Немає автоматичної оплати API/Git; при лімітах запити/операції відхиляються. LFS, Actions і paid add-ons не використовуються |
| Cloudflare Pages Free: статичний сайт і admin bundle | Так | Не потрібна | 500 builds/місяць, 1 одночасна збірка, 20000 файлів, до 25 MiB на asset; статичні запити безкоштовні | На Free не вмикається автоматично платний план; при перевищенні build limits слід почекати |
| Cloudflare Pages Functions / Workers Free: OAuth | Так; Free підтверджений власником | Не потрібна | 100000 запитів/день спільно з іншими Workers; до 10 ms CPU на виклик; звичайний вхід використовує status + auth + callback | На Free quota обмежує доступ, а не створює overage-рахунок. Не переходь на Paid |
| Decap CMS 3.17.1, self-hosted, MIT | Так, open source | Не потрібна | Ліміти GitHub і Pages; не Decap Turbo | Немає підписки або білінгу |
| Astro, TypeScript, Markdown і браузерне стискання зображень | Так, open source | Не потрібна | Збірка в наявній квоті Pages | Немає ліцензійних платежів |
| npm registry, лише отримання відкритих пакетів під час install/build | Так | Не потрібна | Публічні пакети; vendored Decap уже в repo, runtime не звертається до npm | Платні npm organization/private packages не використовуються |

Не використовуються: email-сервіс, база даних, зовнішнє image storage, AI API, платний auth provider, Netlify, Decap Turbo, R2, LFS, GitHub Actions або платний домен. RSS і `pages.dev` залишаються безкоштовними. Наявний GitHub і Cloudflare — прийняті тобою хостингові платформи; власний код і CMS використовують відкриті рішення.

Офіційні джерела: [Decap GitHub backend](https://decapcms.org/docs/github-backend/), [editorial workflow](https://decapcms.org/docs/editorial-workflows/), [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [GitHub API limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [GitHub Free](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Functions routing](https://developers.cloudflare.com/pages/functions/routing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Cloudflare free account без картки](https://developers.cloudflare.com/labs/workers).
