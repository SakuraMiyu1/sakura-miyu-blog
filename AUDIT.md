# Аудит Sakura Miyu's Little World — 17.10.2026

## Що покращено

- Збережено Gothic Kawaii оформлення, початкові зображення, палітру, основне меню та чинні URL. `welcome.md` залишився побайтово незмінним.
- Основні категорії зібрані в одному блоці Explore my world. Бічна колонка містить профіль Meet Sakura Miyu, Latest Diary Entries, короткий список використаних тегів, архів і Follow Sakura Miyu. Прибрано повторний повний список категорій та дублювання featured-допису серед останніх записів.
- Збільшено дрібний текст, відступи й активні області посилань. На вузьких екранах бічна колонка йде після основного вмісту. Меню закривається через Escape, клік поза меню, перехід і зміну ширини; Escape повертає фокус кнопці лише коли меню було відкрито.
- Пошук охоплює заголовок, опис, теги, категорію та текст. Підтримує українську, англійську, японську, регістронезалежне порівняння та Unicode NFKC. Збережено фільтри й завантаження по шість записів; після завантаження фокус переходить на новий запис.
- Теги з різним регістром або шириною символів об'єднуються за нормалізованим slug. Сторінки категорій показують також дописи з відповідним тегом. Чернетки й майбутні дописи виключені з усіх публічних списків.
- Previous/Next працюють за датою. До трьох рекомендацій відбираються за спільними тегами та категорією, без поточного запису й повторів. Відсутні сусіди та порожні рекомендації приховані.
- Архів автоматично групує записи за роком і місяцем у UTC, від нових до старих. Порожні розділи мають дружні повідомлення.
- Оновлено власну сторінку 404, підвал, повні назви мовних посилань і блок Follow. RSS містить метадані мов кожного допису через Dublin Core; email-підписки не імітуються.
- Спільний CopyLink копіює канонічну адресу. Якщо clipboard недоступний чи заборонений, показує підписане поле, виділяє адресу й повідомляє спосіб копіювання.
- Канонічна адреса завжди використовує production `SITE_URL`. Тимчасовий `CF_PAGES_URL` більше не підставляється; preview-адреси `pages.dev` відхиляються як основний домен. Перевірено Open Graph, Twitter Card, BlogPosting/WebSite JSON-LD, sitemap, robots і наявні favicon-файли.
- CSS відформатовано для підтримки, видалено стилі прибраних блоків. Збережено оптимізовані локальні зображення, відсутність зовнішніх шрифтів, eager-завантаження hero, lazy-завантаження карток і підтримку reduced motion.

## Змінені файли

```text
.gitignore
README.md
astro.config.mjs
package.json
scripts/test-browser.mjs
scripts/verify-build.mjs
src/components/Follow.astro
src/components/Footer.astro
src/components/Header.astro
src/components/PostCard.astro
src/components/PostListing.astro
src/components/Share.astro
src/components/Sidebar.astro
src/components/TopicPosts.astro
src/content.config.ts
src/layouts/BaseLayout.astro
src/layouts/PageLayout.astro
src/lib/blog.ts
src/pages/404.astro
src/pages/[topic].astro
src/pages/archive.astro
src/pages/blog/[...slug].astro
src/pages/categories/[category].astro
src/pages/index.astro
src/pages/rss.xml.ts
src/pages/tags/[tag].astro
src/pages/tags/index.astro
src/pages/writing.astro
src/styles/global.css
```

## Нові файли

```text
AUDIT.md
scripts/audit-accessibility.mjs
scripts/test-content-fixtures.mjs
src/components/CopyLink.astro
src/lib/post-utils.ts
tests/post-utils.test.mjs
```

## Результати перевірок

| Перевірка | Результат |
| --- | --- |
| `npm test` | 4 тести пройшли: Unicode, дати/чернетки, рекомендації, архів |
| `npm run test:content` | Пройшло: 8 тимчасових опублікованих записів, чернетка й майбутній запис; пошук, пагінація, теги, рекомендації, хронологія, архів за 3 роки; тестові Markdown-файли видалено |
| `npm run build` | 0 помилок, попереджень і hints Astro/TypeScript; 30 HTML-сторінок; перевірено 1341 внутрішнє посилання, ресурс і якір |
| SEO після збірки | Унікальні заголовки, descriptions, production canonical, Open Graph/Twitter, коректний JSON-LD, RSS-мови, sitemap і robots |
| `npm run preview` | Production-вивід успішно запущено локально |
| `npm run test:browser` | Реальний headless Edge: 320, 375, 390, 430, 768, 1024, 1366, 1920 px; головна, пошук і допис на всіх ширинах; інші основні маршрути на 390 px |
| Браузерні сценарії | Немає горизонтального overflow, зламаних зображень чи JS exceptions; працюють клавіатурне меню, фільтри, мови, clipboard fallback, XML RSS/sitemap, custom 404 з HTTP 404 та читання без JavaScript |
| `npm run test:a11y` | 9 сторінок без виявлених проблем обчисленого контрасту тексту, порядку заголовків, labels, landmarks, alt чи повторних ID |
| Особистий текст | SHA-256 welcome.md: `72d62cfdaa8ffbbe9362a86186a2e4c713e2554b47fd86b8c59feabde71d4164` |

Скріншоти головної та мобільного допису переглянуто візуально. Артефакти браузерних перевірок знаходяться в gitignored `test-results/`.

Нових залежностей немає; використано вже встановлені Astro, TypeScript і Playwright. Новий сервер, база даних або платні сервіси не потрібні.

## Межі перевірки

Відомих функціональних блокерів після локальних перевірок немає. Автоматична перевірка доступності не є сертифікацією WCAG: озвучення NVDA/VoiceOver, фізичні сенсорні пристрої та контраст тексту поверх усіх варіантів фонового зображення потребують ручної перевірки. Бал Lighthouse не вимірювався. Протестований браузер — Edge; Safari/Firefox окремо не запускалися.

На сайті один справжній допис: сусідні й пов'язані записи з'являться після додавання інших публікацій. Їхню логіку перевірено тимчасовими локальними матеріалами, які не публікуються. На статичному хостингу новий рік у підвалі й настання дати відкладеного допису застосовуються під час наступної збірки.

## Публікація й ручні налаштування

Наявне підключення: GitHub `SakuraMiyu1/sakura-miyu-blog`, гілка `main` → Cloudflare Pages `sakura-miyu-blog`. Зміни в `main` запускають автоматичний деплой.

1. Перевірити `npm test` і `npm run build`, закомітити зміни та виконати `git push origin main`.
2. У Cloudflare → Workers & Pages → sakura-miyu-blog → Deployments дочекатися Success для потрібного commit.
3. Чинні параметри: Astro, команда `npm run build`, output `dist`, корінь репозиторію без підпапки, `NODE_VERSION=22.22.0`, `SITE_URL=https://sakura-miyu-blog.pages.dev` для Production та Preview.
4. Відкрити production `https://sakura-miyu-blog.pages.dev/`, `/rss.xml`, `/sitemap.xml`, `/robots.txt` і неіснуючий URL; останній має повертати HTTP 404. Старі preview-посилання є незмінними артефактами попередніх збірок.

Обов'язкових нових ручних налаштувань немає. Якщо підключиш власний домен, додай його в Pages → Custom domains, зміни `SITE_URL` у Production та Preview й запусти нову збірку. Детальні інструкції встановлення, додавання дописів і деплою — у README.md.
