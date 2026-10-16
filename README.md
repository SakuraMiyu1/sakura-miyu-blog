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

`build` checks TypeScript and Astro, generates `dist`, then checks internal links, image references, language anchors, RSS, sitemaps, search content, and accidental private identity text. `preview` serves the production output. `dist` is the deployment folder.

## Project structure

```text
src/
  components/       Header, hero, cards, profile, filters, share, footer
  content/blog/     Markdown and MDX posts
  layouts/          Base SEO layout and pages with a sidebar
  lib/              Shared site identity, post queries and URL helpers
  pages/            Home, blog, posts, interests, tags, archive and feeds
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

Copy `templates/blog-post.md` to `src/content/blog/my-new-entry.md` (or `.mdx`), replace its text and publication date, then set `draft: false` when ready. Or create a file with this frontmatter:

```yaml
---
title: "A little moment worth keeping"
description: "A short, personal introduction to this entry."
pubDate: 2026-10-17
updatedDate:
category: Diary
tags:
  - Diary
  - Anime
language: multilingual
featured: false
draft: false
image: /images/my-photo.webp
imageAlt: "Describe the image for readers who cannot see it"
---
```

Write your content below the frontmatter. `image` and `imageAlt` are optional: omit them if there is no image. Images belong in `public/images/`. Dates use `YYYY-MM-DD`. A blank `updatedDate` is supported; add a date when revising a published entry. The filename becomes `/blog/my-new-entry/`; nested folders are supported. Avoid changing a published filename unless you also add a redirect.

Set `draft: true` to exclude a post from the public site, RSS, search, related posts, and archives. Future-dated posts are also excluded until a build runs after their publication date; there is no automatic scheduled publishing on a static host. The featured entry is the newest published post with `featured: true`, with the newest entry as a fallback. Mark posts as drafts before committing if they are not ready for public GitHub.

Categories: `Diary`, `Anime`, `Cosplay`, `Gaming`, `Writing`, `Gothic Kawaii`, `University`, `Creative Writing`, `Fanfiction`. Tags are free text. Each tag gets a static page automatically. The main interest tags have pages even while empty. Category pages match the category field; the Diary/Anime/Cosplay/Gaming navigation sections include both that category and posts tagged with the interest. Writing collects writing, creative writing, and fanfiction entries.

Supported language values: `multilingual`, `uk`, `en`, `ja`. Posts are manually written and are never automatically translated. For the optional language navigation, use these exact heading IDs inside language sections:

```html
<section lang="uk">

<h2 id="ukrainian">🇺🇦 Українська</h2>

Твій текст українською.

</section>

---

<section lang="en">

<h2 id="english">🇬🇧 English</h2>

Your text in English.

</section>

---

<section lang="ja">

<h2 id="japanese">🇯🇵 日本語</h2>

日本語の文章。

</section>
```

Keep blank lines around HTML tags so Markdown paragraphs are rendered. The language navigation appears only for headings present in the post. Use the same IDs in MDX. The initial welcome post is a complete example.

Push the new file to GitHub and Cloudflare Pages rebuilds the site, including the search index, tags, related posts, RSS and sitemap.

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
6. If Cloudflare assigned a different project URL, set production `SITE_URL` to that exact HTTPS origin and trigger a new deployment. This sets canonical URLs, RSS links, sitemap links, structured data and social images. When `SITE_URL` is absent, configuration uses Cloudflare's `CF_PAGES_URL` if available, then `https://sakura-miyu-blog.pages.dev` as a local build fallback. This fallback is a proposed address, not a registered deployment. Always set `SITE_URL` before the public launch. Set the same production `SITE_URL` for preview builds if you want them to canonicalize to production.
7. Open the deployed homepage, one post, `/rss.xml`, `/sitemap.xml`, and `/robots.txt`. Pushes to `main` now deploy automatically.
8. Optional custom domain: open the Pages project's **Custom domains**, add your domain, and follow Cloudflare's DNS setup. Once active, set `SITE_URL` to `https://your-domain.example` (without a path), redeploy, and select one primary host. Use Cloudflare redirect rules to redirect secondary domains to the primary host.

Official instructions: [Astro on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/).

For local canonical checks, copy `.env.example` to `.env` and replace `SITE_URL`. Local preview also uses this origin in SEO metadata. The site remains indexable by default; the 404 page alone has `noindex`. Cloudflare may add its own indexing protections to preview deployments.

## Personalize the appearance

- Theme colors are CSS variables at the top of `src/styles/global.css`. The layout uses a dark plum background, soft pink reading cards and dark pink links. Preserve text contrast when changing colors.
- Public identity and SEO copy live in `src/lib/site.ts`; profile text is in `Sidebar.astro` and `about.astro`. No real name, university name, address, schedule, phone or email is stored in public content.
- Change the header, avatar and background by replacing the optimized files in `public/images/` with the same filenames. They are served locally, so there are no remote image dependencies.
- Alternatively replace the supplied original JPGs in `headers/`, `avatars/`, and `backgrounds/`, then run `npm run assets`. The asset script crops the artwork to keep its embedded older title out of the hero, optimizes WebP files and regenerates the social image and favicon. If new source dimensions differ, adjust the crop in `scripts/prepare-assets.mjs` first.
- The hero title and tagline are real accessible HTML in `Hero.astro`. The PNG/ICO favicon is a small pink sakura blossom with a black bow, generated from a local vector in the asset script. No remote font service is used.

## Search, sharing and following

Search is a small client-side script that fetches the static `/search-index.json` only on the blog listing. It searches post titles, descriptions, tags and full text, with category/tag filters, a clear button and six-at-a-time loading. Results work across Ukrainian, English and Japanese; no stemming or translation is performed. All entries remain readable without JavaScript, and category/tag/archive links work without JavaScript.

The post share controls copy the current post URL or open X, Facebook or Pinterest's sharing page. Copying requires a secure browser context; a selectable link is shown if clipboard access is unavailable. Social platforms require a publicly reachable site to fetch previews. The Follow section links to RSS and suggests bookmarking. There is no email form. A future newsletter can be linked in `src/components/Follow.astro` after choosing a provider.

Previous/Next and Related Posts appear automatically when other published entries exist. The first release intentionally includes one authentic introductory post, so there are no fabricated diary entries or inactive previous/next links.

## Verification

`npm run build` runs the production checks. For browser verification, start `npm run preview -- --host 127.0.0.1` in one terminal, then:

```powershell
npx playwright install chromium
npm run test:browser
```

The browser script checks 1920px, 1366px, tablet and mobile layouts, image loading, horizontal overflow, navigation, search content, filters, clear states, language anchors and sharing. Optional development-only tooling is never shipped to the browser. Screenshots go to `test-results/` (gitignored).

To test with an already installed Edge instead of downloading Chromium, set `$env:TEST_BROWSER_CHANNEL = 'msedge'` in PowerShell before `npm run test:browser`.

Original supplied assets are preserved. The source repository is [SakuraMiyu1/sakura-miyu-blog](https://github.com/SakuraMiyu1/sakura-miyu-blog). Cloudflare Pages is connected to `main` and automatically publishes new commits. The production origin is `https://sakura-miyu-blog.pages.dev`; when adding a custom domain, update `SITE_URL` for production and previews, then redeploy.
