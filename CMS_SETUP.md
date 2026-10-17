# Публікація Sakura Miyu через Decap CMS — бюджет £0

Редактор підготовлено для `https://sakura-miyu-blog.pages.dev/admin/`. Блог залишається звичайним статичним Astro-сайтом і працює незалежно від CMS. Сам інтерфейс `/admin/` не містить секретних даних; читати, змінювати й публікувати через GitHub можна лише після авторизації.

**Статус:** реалізація готова до перевірки й одноразового налаштування. Справжні GitHub OAuth login → commit → Cloudflare deploy ще не перевірені: OAuth App та його серверні credentials відсутні. До їх налаштування система повертає 503 для входу й показує чесне повідомлення, що редактор не активований. Тестовий backend ніколи не використовується в production-конфігурації.

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

1. Після перевірки Workers Free й серверних змінних опублікуй перевірену CMS-гілку в `main` без force-push. Cloudflare автоматично запустить збірку.
2. Дочекайся Success у Deployments і відкрий `/api/cms-status`: очікується `{"enabled":true}`. Секретів у відповіді немає.
3. Відкрий `/admin/`, натисни Login with GitHub. Дозволь popup лише для цього домену, підтвердь власний OAuth App і повернися в редактор.
4. Створи один тестовий запис з унікальним slug, збережи через Save draft. Перевір появу `cms/blog/...` гілки та pull request, а також відсутність запису на головній, у search-index.json, RSS і sitemap production.
5. Додай зображення, перевір alt text і Preview. Коли готово, вимкни Keep hidden even after Publish, вибери Ready → Publish now. Перевір merge до main і новий успішний Cloudflare deployment.
6. Перевір сторінку допису, теги, категорію, RSS, архів і пошук. Лише після цих кроків можна вважати справжній publishing-процес перевіреним.
7. Видали тільки власний тестовий запис через підтвердження в CMS, якщо він більше не потрібний. Автоматичні тести не створюють записів у GitHub і не видаляють існуючий welcome-допис.

## Як користуватися редактором

Повсякденна інструкція українською доступна в `/admin/guide.html`: вхід, новий запис, збереження, публікація, картинки, редагування, видалення, SEO, мови та iPhone.

- **Новий запис:** Diary entries → New Diary entry. Заповни Title, URL slug, Description, дату, категорію, теги й текст. Slug для нового запису задається латиницею, цифрами та дефісами; він стає ім'ям Markdown-файлу. URL вже існуючого запису береться з його поточного filename, навіть якщо змінити Title.
- **Чернетка:** Save draft зберігає матеріал у гілку, не в main. Workflow показує чернетки й готові записи. Повторне Save оновлює ту саму чернетку. Для скасування неопублікованих правок використовуй видалення чернетки, не видалення самого опублікованого допису.
- **Публікація:** Ready → Publish now зливає чернетку в main, потім працює наявний GitHub → Cloudflare pipeline. Час появи залежить від збірки. `draft: true` завжди приховує матеріал навіть після merge; звичайні нові CMS-записи мають `draft: false`, а неопублікованими їх робить workflow-гілка. Не плутай ці два механізми.
- **Приватність:** GitHub-репозиторій публічний. Гілки, pull requests, історія файлів, чернетки та завантаження не є конфіденційними. `draft` захищає від показу на сайті, а не від читання через GitHub. Не завантажуй приватні фото чи особисті дані.
- **Майбутні дати:** такі записи не показуються. Після настання дати виконай безкоштовний Retry deployment або наступну публікацію; таймер чи платний scheduler не додавався.
- **Фото:** repository storage `public/images/blog/`, публічні адреси `/images/blog/...`. Це окрема папка, що не містить початкових hero/avatar/background. Давай файлам унікальні імена латиницею з датою, не підтверджуй випадкову заміну. Для доступних браузеру JPEG/PNG/WebP увімкнено локальне перетворення до WebP, ширина до 1600 px, quality 82. Це не платний Cloudflare Images. Передавай файли до 5 MB; обмеження не є серверною квотою безпеки. GIF/SVG не гарантують таку оптимізацію. Для iPhone HEIC спочатку експортуй JPEG.
- **Текст і мови:** редактор Markdown має toolbar і preview. Raw-режим обрано навмисно, щоб зберігати існуючі HTML `section lang` і мовні якорі. Заповнюй текст усередині секцій; вони вже є в шаблоні. Наявний welcome.md автоматично не переписується. Зміна лише через свідоме збереження в CMS. Автоперекладу чи AI немає.
- **MDX:** сайт і надалі збирає `.md` та `.mdx`; ця CMS-колекція створює й редагує `.md`. Для MDX із власними компонентами використовуй GitHub-редактор, щоб Markdown-редактор не пошкодив JSX або imports. Поточний welcome.md повністю сумісний із CMS.
- **SEO:** optional `seoTitle`, `seoDescription` підтримані Astro-схемою та використовуються для meta/Open Graph/Twitter. Порожні поля беруть Title/Description. Заголовок статті залишається особистим Title; canonical походить від filename й production `SITE_URL`. `slug` — метадані CMS для створення filename, не другий маршрутизатор.
- **Категорії:** чинний фіксований список; нову категорію потрібно додати одночасно у `src/lib/post-utils.ts` та `public/admin/config.yml`. Перевірка збірки не дозволить спискам розійтися. Теги можна додавати в CMS без коду.
- **Видалення:** стандартний Delete в Decap показує підтвердження. Для публічного запису видалення може одразу створити commit до main; це змінить сайт після деплою. Не підтверджуй видалення, якщо хотів лише закрити чернетку.
- **iPhone:** Safari, увімкнений JavaScript, дозволений popup GitHub, прокручування полів і перемикання Edit/Preview. Нативний Safari/iPhone окремо потребує перевірки власником; ширини 375/390/430/768/1366 перевіряються автоматизованим Chromium-тестом, коли він запускається.

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

1. У GitHub відкрий `src/content/blog` → Add file → Create new file.
2. Скопіюй `templates/blog-post.md`, назви файл `my-story.md`.
3. Заповни текст, дату, категорію, теги. Для публікації `draft: false`; для прихованого на сайті матеріалу `draft: true` або окрема гілка.
4. Через GitHub Add file → Upload files завантаж картинки в `public/images/blog/`, у тексті використовуй `/images/blog/filename.webp` з alt text.
5. Commit changes у main автоматично оновить Cloudflare. Npm, локальний редактор, OAuth-функції чи Codex для кожного допису не потрібні.

## Перевірки для розробника

```powershell
npm install
npm test
npm run test:content
npm run build
npm run preview -- --host 127.0.0.1
```

Перед `test:content` зупини Astro dev/preview. Тест створює й прибирає лише власні тимчасові матеріали, перевіряє опубліковані/чернеткові/майбутні записи, зображення та SEO. Після нього зроби чистий production build.

В іншому терміналі з установленим Chromium або `TEST_BROWSER_CHANNEL=msedge`:

```powershell
npm run test:cms
npm run test:browser
npm run test:a11y
```

`test:cms` підміняє конфігурацію лише всередині браузерного тесту й використовує справжній Decap із memory backend. Це перевірка редактора, а не справжнього входу в GitHub. OAuth-тести використовують фальшиві відповіді GitHub; не підмінюй ними ручну перевірку справжньої публікації. `astro preview` не запускає Pages Functions; для повного локального runtime потрібен безкоштовний Wrangler Pages dev або production після налаштування. Пакет Wrangler не є runtime-залежністю блогу.

Редактор перевірено з production CSP на 375/390/430/768/1366 px: список, поля, Edit/Preview, Unicode-текст, upload/локальне WebP-перетворення, правильна папка зображень, Save → Ready → Publish і підтвердження видалення у memory backend. OAuth/state/PKCE та спільна логіка перевіряються 14 тестами Node. Pages Functions успішно компілюються через Wrangler. У локальному Cloudflare runtime status повертає `enabled:false`, а auth/callback — HTTP 503 без credentials. Інтеграційна Astro-збірка перевірила нові SEO-поля й завантажене repository-зображення; чернетки й майбутні записи не потрапили в RSS, sitemap, пошук або архів. Чистий production build створює 30 Astro-сторінок і 2 статичні admin HTML; перевірено 1351 внутрішнє посилання, ресурс та якір. Публічний блог також пройшов браузерні перевірки на 8 ширинах і перевірку доступності на 9 сторінках. Astro/TypeScript: 0 errors, 0 warnings, 0 hints. Справжні GitHub-вхід і публікація залишаються окремою ручною перевіркою.

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
| `scripts/verify-cms.mjs`, `test-cms-browser.mjs` | Перевірка конфігурації, цілісності й редактора |
| `tests/cms-auth.test.mjs`, `cms-editor.test.mjs` | Серверні security-тести й валідація полів |

Змінені: `.gitignore`, `README.md`, `astro.config.mjs`, `package.json`, `tsconfig.json`, `public/_headers`, `scripts/verify-build.mjs`, `scripts/test-content-fixtures.mjs`, `src/content.config.ts`, `src/pages/blog/[...slug].astro`, `src/pages/robots.txt.ts`. Чинний `welcome.md`, його URL та початкові зображення не змінені. Нових npm-залежностей немає.

## Якщо щось не працює

| Симптом | Перевірка |
| --- | --- |
| Вхід не налаштовано | Production runtime vars, тип Secret, CMS_ENABLED=true, потім redeploy |
| Callback mismatch | OAuth App callback має бути точно `/api/callback` на production origin, без кінцевого слеша |
| Sign-in session invalid | Закрий popup, відкрий новий вхід; перевір HTTPS, cookies, строк 10 хвилин; не використовуй старий callback URL |
| Editor only available to SakuraMiyu1 | Вийди з іншого GitHub-акаунта, увійди як SakuraMiyu1 |
| 403/rate limit GitHub | Дочекайся reset, перевір OAuth grant і push access; не купуй план |
| Publish є, але запису немає | Keep hidden вимкнений, дата настала, PR merged у main, Cloudflare deployment Success |
| Зображення не видно | Латинське ім'я файлу, `/images/blog/...`, файл у public, підтримуваний формат і завершений деплой |
| Контент не зберігся на телефоні | Не закривай вкладку до успішного Save draft; дозволені cookies/popup; спробуй Safari замість вбудованого браузера месенджера |
| Functions quota вичерпана | Дочекайся добового reset UTC; статичний блог і GitHub Markdown-публікація залишаються доступними |

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
