# Sakura Miyu's Little World 🌸🖤

A personal Pink + Black Gothic Kawaii blog for **Sakura Miyu / さくらみゆ**. Built with Astro, TypeScript, plain CSS, and local Markdown/MDX content. All pages are generated as static files. No database, accounts, analytics, paid services, or runtime API is required.

Live website: [sakura-miyu-blog.pages.dev](https://sakura-miyu-blog.pages.dev/).

## Start locally

Use Node.js **22.22.0 or newer**. Node 20 is not supported by the current Astro release. The project pins the minimum in `.node-version`. On this Windows machine, a suitable Node is already available in `C:\Program Files\nodejs`; if `node --version` shows 20, select it for the current PowerShell session with `$env:Path = "C:\Program Files\nodejs;" + $env:Path` before running npm. This does not change the system installation.

```powershell
cd "E:\Ai projects\Sakura Miyu's"
npm install
npm run dev
```

Open the local URL printed by Astro, usually `http://localhost:4321`.

```powershell
npm run check
npm run build
npm run preview
```

`build` verifies the CMS configuration, checks TypeScript and Astro, generates `dist` and Cloudflare redirects, then checks internal links, image references, language metadata, RSS, sitemaps, search content, and accidental private identity text. `preview` serves the production output. `dist` is the deployment folder.

## Project structure

```text
src/
  components/       Header, hero, cards, profile, filters, share, footer
  content/blog/     Markdown and MDX posts
  layouts/          Base SEO layout and pages with a sidebar
  lib/              Identity, translations, localized loader and URL helpers
  pages/            Localized routes, legacy redirects, sitemap and feeds
  views/            Shared localized page templates
  styles/           Theme and responsive styles
public/
  images/           Optimized, self-hosted WebP and social images
  favicon.png
  favicon.ico
  apple-touch-icon.png
  _headers          Cloudflare security and asset caching headers
scripts/            Asset preparation, build verification, browser checks
avatars/            Original supplied artwork
backgrounds/
headers/
decorations/
astro.config.mjs
package.json
package-lock.json
```

## Add a new post

An optional self-hosted **Decap CMS** writing desk is prepared at `/admin/`. See [CMS_SETUP.md](CMS_SETUP.md) for the one-time GitHub OAuth setup, server-side secret handling, draft/publish workflow, iPhone guide and the £0 cost report. Until it is configured, sign-in is explicitly disabled. The public blog continues to work without the CMS. All editor assets are pinned locally with MIT licenses and SHA-256 checksums; the public blog does not load them. No paid service or new npm dependency was added.

Create one Markdown entry per language. Copy `templates/blog-post.md` to `src/content/blog/en--my-new-entry.md` (or `.mdx`), replace its text and publication date, and set `draft: false` when ready. For example:

```yaml
---
title: "A little moment worth keeping"
description: "A short, personal introduction to this entry."
slug: my-new-entry
translationKey: my-new-entry
pubDate: 2026-10-17
updatedDate:
category: Diary
tags:
  - Diary
  - Anime
language: en
featured: false
draft: false
image: /images/my-photo.webp
imageAlt: "Describe the image for readers who cannot see it"
---
```

Write only this language version below the frontmatter. Supported new-entry languages are `uk`, `en` and `ja`. The example above becomes `/en/blog/my-new-entry/`. CMS filenames use `<language>--<slug>.md`, so two languages can share the same slug without overwriting a file. Public URLs use `/{language}/blog/{slug}/`; without an explicit `slug`, the filename is used with an initial `uk--`, `en--` or `ja--` removed. Avoid changing published slugs or filenames unless you also add a redirect.

For a translation, create another entry with its own language, title, description, body and optional SEO copy. Give translations of the same story the same `translationKey`. Slugs can differ: `en--a-quiet-morning.md` and `ja--shizukana-asa.md` can share `translationKey: quiet-morning`. The CMS requires a lowercase ASCII key for new entries. Each published language/key pair and language/URL pair must be unique; duplicate pairs stop the build. There is no automatic translation or AI integration.

`image` and `imageAlt` are optional: omit them if there is no image. Images belong in `public/images/`; CMS uploads go to `public/images/blog/`. Dates use `YYYY-MM-DD`. A blank `updatedDate` is supported; add a date when revising a published entry. Optional `seoTitle` and `seoDescription` override post SEO/social metadata; empty values fall back to that language's main title and description.

Set `draft: true` to exclude a post from the public site, RSS, search, related posts, and archives. Future-dated posts are also excluded until a build runs after their publication date; there is no automatic scheduled publishing on a static host. The featured entry is the newest published post with `featured: true`, with the newest entry as a fallback. Mark posts as drafts before committing if they are not ready for public GitHub.

Categories: `Diary`, `Anime`, `Cosplay`, `Gaming`, `Writing`, `Gothic Kawaii`, `University`, `Creative Writing`, `Fanfiction`. Tags are free text and must contain at least one letter or number. Each tag gets a static page automatically. Case and Unicode width variants share one tag URL. The main interest tags have pages even while empty. Category pages and the Diary/Anime/Cosplay/Gaming sections include both that category and posts tagged with the interest. Writing collects writing, creative writing, and fanfiction entries. The archive groups published entries by UTC year and month, newest first.

Push the new file to GitHub and Cloudflare Pages rebuilds the site, including each language's search index, tags, related posts, RSS and sitemap.

## Language routes and existing articles

Canonical homepages are `/uk/`, `/en/` and `/ja/`. Blog, About, Writing, tags, categories and archives have the same language prefix; articles use `/{language}/blog/{slug}/`. The language picker follows the matching published translation using `translationKey`. When an article has no translation, it leads to the chosen language's homepage. `hreflang` lists only actual translations, and each localized page has its own canonical, description, Open Graph locale and HTML language.

The root `/` serves Ukrainian content with canonical `/uk/`. On the root only, JavaScript can open the language previously selected by the reader; an explicit `/uk/`, `/en/` or `/ja/` URL always takes priority. Blocked storage and disabled JavaScript leave the page readable and the language links usable.

Existing source articles are preserved byte-for-byte. `src/lib/content-languages.ts` links the three existing differently named versions of “A little world where you can be yourself” through the sidecar key `little-world-be-yourself`. The loader splits legacy `welcome.md` into three computed entries with translated metadata; it does not create copies or rewrite its frontmatter/body. Existing single-language Markdown posts containing multiple `<section lang>` blocks expose only their matching language section in public output; their raw CMS content stays unchanged.

`multilingual` remains an editing option for legacy entries only. Additional legacy multilingual sources need explicit translated metadata in the loader or should be created as separate single-language entries; the build fails with a message rather than publishing incorrect metadata. Section extraction is the compatibility path for the existing Markdown files. New single-language `.md` and `.mdx` work normally; use the GitHub editor for MDX components/imports.

The production build writes `dist/_redirects` with 301 redirects from old public routes to their localized destinations. Legacy HTML pages also provide a no-JavaScript fallback. Neither the verification tag nor CMS/OAuth routes are moved.

## Deploy to Cloudflare Pages from GitHub

1. Create a new GitHub repository, for example `sakura-miyu-blog`. Upload **the contents of this project folder** so `package.json` is at the repository root. Include `package-lock.json`, `public`, `src`, and `scripts`. Do not upload `node_modules`, `dist`, `.astro`, or `.env`.
2. Push the project. If creating an isolated Git repository here, use your GitHub account's public/no-reply commit email to avoid exposing a private address:

   ```powershell
   git init
   git add .
   git commit -m "Create Sakura Miyu's Little World"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/sakura-miyu-blog.git
   git push -u origin main
   ```

3. In Cloudflare, open **Workers & Pages**, choose to create an application, select **Pages**, and connect your GitHub repository. Choose `main` as the production branch. Dashboard wording may vary; select the Pages Git integration rather than a Worker.
4. Use these build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Astro |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | Leave blank when `package.json` is at the repository root |
   | `NODE_VERSION` | `22.22.0` (or a newer supported release) |
   | `SITE_URL` | Your full production origin, e.g. `https://sakura-miyu-blog.pages.dev` |

5. Save and deploy. Cloudflare installs dependencies and builds every route. No Cloudflare adapter, database, secret key, or server runtime is needed for this static site.
6. If Cloudflare assigned a different project URL, set `SITE_URL` to that exact production HTTPS origin and trigger a new deployment. This sets canonical URLs, RSS links, sitemap links, structured data and social images. When `SITE_URL` is absent, configuration uses the existing production address `https://sakura-miyu-blog.pages.dev`. It deliberately ignores `CF_PAGES_URL`, which can be a temporary preview URL. Set the same production `SITE_URL` in both Production and Preview environments. Hashed/branch preview `pages.dev` origins are rejected as permanent site URLs.
7. Open `/uk/`, `/en/`, `/ja/`, one localized post, `/en/rss.xml`, `/sitemap.xml`, and `/robots.txt`. Pushes to `main` now deploy automatically. Root `/rss.xml` and `/search-index.json` remain Ukrainian compatibility aliases.
8. Optional custom domain: open the Pages project's **Custom domains**, add your domain, and follow Cloudflare's DNS setup. Once active, set `SITE_URL` to `https://your-domain.example` (without a path), redeploy, and select one primary host. Use Cloudflare redirect rules to redirect secondary domains to the primary host.

Official instructions: [Astro on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/).

For local canonical checks, copy `.env.example` to `.env` and replace `SITE_URL`. Local preview also uses this origin in SEO metadata. The site remains indexable by default; the 404 page alone has `noindex`. Cloudflare may add its own indexing protections to preview deployments.

## Personalize the appearance

- Theme colors are CSS variables at the top of `src/styles/global.css`. The layout uses a dark plum background, soft pink reading cards and dark pink links. Preserve text contrast when changing colors.
- Public identity lives in `src/lib/site.ts`; shared translated interface copy is in `src/lib/i18n.ts`, and static page copy is in `src/lib/page-copy.ts`. No real name, university name, address, schedule, phone or email is stored in public content.
- Change the header, avatar and background by replacing the optimized files in `public/images/` with the same filenames. They are served locally, so there are no remote image dependencies.
- Alternatively replace the supplied original JPGs in `headers/`, `avatars/`, and `backgrounds/`, then run `npm run assets`. The asset script crops the artwork to keep its embedded older title out of the hero, optimizes WebP files and regenerates the social image and favicon. If new source dimensions differ, adjust the crop in `scripts/prepare-assets.mjs` first.
- The hero title and tagline are real accessible HTML in `Hero.astro`. The PNG/ICO favicon is a small pink sakura blossom with a black bow, generated from a local vector in the asset script. No remote font service is used.

## Search, sharing and following

Search is a small client-side script that fetches `/{language}/search-index.json` only on that language's blog listing. It searches titles, descriptions, tags, categories and full text using case-insensitive Unicode normalization, with category/tag filters, a clear button and six-at-a-time loading. Loading more moves keyboard focus to the first new entry. Each search is restricted to the current language; no stemming or translation is performed. All entries remain readable without JavaScript, and category/tag/archive links work without JavaScript.

The post share controls copy the canonical post URL or open X, Facebook or Pinterest's sharing page. Copying requires a secure browser context; a labelled, focused and selected address field is shown if clipboard access is unavailable or denied. Social platforms require a publicly reachable site to fetch previews. The sidebar Follow section offers RSS, Copy Blog Link and a bookmarking suggestion. `/{language}/rss.xml` contains only that language's posts, with matching feed and item-level Dublin Core language codes. There is no email form. A future newsletter can be linked in `src/components/Follow.astro` after choosing a provider.

Previous/Next follow publication chronology within the current language. Up to three related entries in that language are ranked by shared tags, then category, with date as a tie-breaker. The current entry and duplicate recommendations are excluded; unavailable neighbours and empty related sections are hidden. Existing real posts remain the source content; no fabricated public diary entries are added.

## Verification

`npm test` checks publication boundaries, language/translation helpers, CMS validation, OAuth handling, Unicode tags, recommendation ranking and archive grouping. `npm run build` runs production checks, including localized metadata, JSON-LD, canonical origins and internal links. The commands below are verification instructions, not a claim that a particular deployment has passed them.

Run `npm run test:content` serially, without another build or Astro dev/preview process using the same project. It records every original article's hash, creates uniquely named QA posts and its own image folder, builds only to gitignored `.qa-dist`, and serves that output on port 4399. It checks scoped search/RSS, translation switching with different slugs, pagination, related posts, UTC archives, SEO, image loading and draft/future exclusions, then removes only its own files and verifies original hashes in `finally`. Do not interrupt it. After a forced interruption, inspect leftover `qa-fixture-*` files before removing them; never delete an existing article by a broad pattern. The production checker refuses to publish QA content. Set `TMP` and `TEMP` to the project's `_tmp` folder for browser tests on this Windows workspace.

For browser verification, start `npm run preview -- --host 127.0.0.1` in one terminal, then:

```powershell
$env:TEMP = Join-Path (Get-Location) '_tmp'
$env:TMP = $env:TEMP
$env:TEST_BROWSER_CHANNEL = 'msedge'
npm run test:browser
npm run test:a11y
npm run test:cms
npm run test:cms:github
```

The browser script checks responsive layouts, image loading, horizontal overflow, keyboard navigation, language selection, search, filters, clipboard fallback, feed XML, custom 404 and no-JavaScript reading. The accessibility script checks computed text contrast, heading order, labels, landmarks, alt attributes and duplicate IDs on representative pages. These checks do not replace manual screen-reader testing or Lighthouse measurement. CMS suites use in-memory or intercepted GitHub responses; they never publish or delete real articles and do not replace the owner's real OAuth/publishing check. Optional development-only tooling is never shipped to the browser. Screenshots and the accessibility report go to `test-results/` (gitignored).

The example uses already installed Edge, without installing or downloading a browser. If you already have Playwright Chromium available, omit `TEST_BROWSER_CHANNEL` instead.

Original supplied assets are preserved. The source repository is [SakuraMiyu1/sakura-miyu-blog](https://github.com/SakuraMiyu1/sakura-miyu-blog). Cloudflare Pages is connected to `main` and automatically publishes new commits. The production origin is `https://sakura-miyu-blog.pages.dev`; when adding a custom domain, update `SITE_URL` for production and previews, then redeploy.
