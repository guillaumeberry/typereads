# CLAUDE.md — Read About Type

Guidance for Claude Code when working in this sub-project.

## Status

Phase 5 done (admin at /admin; Cloudflare Access optional). Phase 6 done (public submissions live; email via Resend). Phase 7 (QA) in progress: see `docs/05-roadmap.md`. Redesign from Figma (ADR-013): homepage, header, footer and detail page done; About, Submit, 404 and the search/filter panels next. Hand tests on phones/Safari/Firefox and Phase 1 data enrichment still open. Read `README.md` and `docs/` first.

## Commands

- `npm run dev`: local dev server (http://localhost:4321)
- `npm run build`: static build to `dist/` (fails on invalid content: that's the safety net)
- `npm run check`: type-check (`astro check`)
- `npm run format` / `npm run format:check`: Prettier
- CI (`.github/workflows/ci.yml`) runs format:check, check and build on every push and PR.
- `npm test`: Vitest unit tests (`src/scripts/*.test.ts`); also run in CI.

## Layout

- `src/content/publications/*.md`: one file per publication (written by the CMS later; Prettier ignores it).
- `src/content.config.ts`: Zod schema. `REQUIRE_ENRICHMENT` is `false` until every entry has `languages` and `scripts`; then flip it to `true`.
- `src/data/taxonomies.ts`: controlled vocabularies (types, formats, scripts, availability, date buckets).
- `src/lib/identifiers.ts`: ISBN/ISSN checksums (`977…` barcodes are ISSNs, not ISBNs).
- `src/lib/`: `publications.ts` (only `status: published`, default sort), `color.ts` (contrast), `format.ts` (labels, native language names).
- `src/layouts/Base.astro`: page shell (meta, OG, JSON-LD, fonts). `src/components/`: Header, Footer, Card, Cover, Logo, Icon, Prose, LibraryTools (the homepage's header buttons), LibraryControls (search row, filter panel, status).
- Design (ADR-013): the Figma file "Typereads.xyz" is the visual reference; its variables are the tokens in `global.css` (`--xxs`…`--x3l`, `--h2`/`--paragraph`/`--caption`, text classes `.t-h2`/`.t-paragraph`/`.t-caption`, `.u-link`, `.trigger`). The header has two slots swapped by the router with `#main`: `back` (`[data-header-back]`, filled with `slot="header-back"`, the detail page's "Home ←") and `tools` (`[data-header-tools]`, `slot="header-tools"`, the homepage's buttons). The homepage intro is CSS under `html.is-intro` (set by the inline script in `index.astro`, removed by `boot.ts`); fading a card delays LCP to the end of its animation (mobile Lighthouse ~90 instead of 97), see ADR-013.
- Editions and issues (ADR-014): one entry per work; `editions` (books, later editions), `issues` (magazines) and `series` in the schema, CMS and docs/03. `src/lib/editions.ts` (tested): `releasesOf`, `mainCover` (the newest cover is the one shown everywhere), `allYears` (every year feeds the date filter: cards carry `data-years`), `coverGallery` (the detail page's thumbnails, swapped by `src/scripts/covers.ts`, lazy-loaded by `boot.ts`). The motion layer finds the shown cover with `.hero-cover > :not([hidden]) img`.
- SEO: `src/lib/seo.ts` (tested): site names, whole-word descriptions, "Title by Author" titles, JSON-LD ids. JSON-LD: WebSite + Organization + CollectionPage/ItemList on `/`, Book/Periodical + BreadcrumbList on publications, AboutPage + FAQPage on `/about`. `public/og.png` (1200 × 630, logo + shelf, no rasterised font) is the share image of pages without a cover. `noindex` pages have no canonical.
- `src/content/pages/about.md`: About copy (FAQ as front-matter fields). Its external links open in a new window via `src/lib/links.ts` (applied to the rendered HTML in `about.astro`: Astro 7's Markdown processor, Sätteri, doesn't run rehype plugins without `@astrojs/markdown-remark`).
- Fonts: HEX Franklin is **commercial**: never commit it. `scripts/fonts.mjs` (runs before `dev`/`build`) downloads it from the private repo `guillaumeberry/typereads-fonts` when `FONTS_BASE_URL` (+ `FONTS_TOKEN`) is set (Cloudflare build, with `FONTS_REQUIRED=1` so a missing font fails the deploy), otherwise copies it from the gitignored `assets/fonts/`, into the gitignored `public/fonts/`; `Base.astro` uses it when present, else Archivo (OFL, npm).
- Theme: light only for now (ADR-013; tokens in `src/styles/global.css`). Fonts: HEX Franklin Light (optional in `fonts.mjs`), Regular, Bold.
- `src/scripts/boot.ts`: the one script every page loads (via `Base.astro`): `mount`/`unmount` page scripts, the "←" history helper (capture phase), Tier 1 view transitions (`vt.ts`), and the idle loader for `motion/` (skipped under reduced motion / Save-Data). Page scripts must be started from `mount()`, never from a page-level `<script>`: the router doesn't re-run those.
- `src/scripts/motion/`: Swup router + GSAP transitions (`index.ts`), Flip for in-page changes (`flip.ts`). Budget ≤ 60 KB gz.
- `src/scripts/library-core.ts` (pure, tested) + `library.ts` (DOM, `init`/`destroy`, `animate` hook): search, filters, faceted counts, sort, URL state. Cards carry `data-*` attributes; `/search.json` holds descriptions, loaded on first search focus.
- Admin: `public/admin/` (Sveltia CMS, pinned in `index.html`; `config.yml` mirrors the schema: change a field in `content.config.ts`, `config.yml` and docs/03 together). Login via the GitHub App "TypeReads CMS" and the `sveltia-cms-auth` Worker (`base_url`); its secrets live in that Worker's runtime settings. `public/_headers` holds the site-wide CSP and the admin's own (which detaches the site one with `! Content-Security-Policy`): add a domain there if Sveltia needs a new one (check the browser console). A new or changed inline `<script>` needs its hash in the site CSP: `npm run build` fails (`scripts/csp.mjs`) and prints it. Uploads are slugified and converted to WebP (`media_libraries`); on Safari that needs a WebAssembly encoder, hence `'wasm-unsafe-eval'` in the CSP: keep it. Entry ids are file names (`generateId`), so a repeated `slug` fails the build in `getPublished()`.
- Submissions (Phase 6, ADR-005): `worker/index.ts` is the site's Worker, run only for `/api/*` (`wrangler.jsonc`); validation in `src/lib/submission.ts` (tested); form in `src/components/SubmitForm.astro` + `src/scripts/submit.ts`; the header's "+" opens it in `SubmitPanel.astro` (a `<dialog>` in `Base.astro`, wired by `openPanel()` on first open); page forms (`/submit`, `/submit/fix/…`) start from `boot.ts` only inside `#main`. Secrets `TURNSTILE_SECRET`, `GITHUB_TOKEN`, `RESEND_API_KEY`, `NOTIFY_TO` live in the Cloudflare dashboard (email via Resend's HTTP API). Local test: `.dev.vars` (gitignored) with `TURNSTILE_SECRET=1x0000000000000000000000000000000AA` and `DRY_RUN=1`, `npm run build`, then `npx wrangler dev`. Never log or commit the submitter's email.
- URLs: pages are built as files (`about.html`) and served at clean URLs (`/about`); canonical URLs strip `.html`.
- `spike/` is gitignored and throwaway (motion spike, CMS demo with its own `.git`). Don't import from it.

## Source of truth

- Product decisions: `docs/06-decisions.md` (ADRs). Don't contradict an accepted ADR silently. Propose a new ADR instead.
- Data schema: `docs/03-content-model.md` → later `src/content.config.ts` (Zod) **and** `public/admin/config.yml` (CMS). Keep all three in sync whenever a field changes.
- Open questions: `docs/07-open-questions.md`. Use the stated default if a question is unanswered, and say so.

## Non-negotiables

- Lean: core JS ≤ 15 KB gz; the motion layer (GSAP + Swup, ADR-012) ≤ 60 KB gz, deferred and never on the LCP path; no UI framework unless an ADR says so.
- Motion is two-tier: native CSS/VT/scroll-driven animations always work; the GSAP/Swup layer is an enhancement, skipped under `prefers-reduced-motion` and Save-Data. Animate only transform, opacity and clip-path.
- Every script exposes `init`/`destroy` (Swup lifecycle); no global state that leaks between pages.
- Progressive enhancement: every page must work without JS.
- The repo is public. **Never commit personal data** (submitter emails), secrets, or font files whose licence forbids redistribution.
- Only `status: published` entries are built.
- The Framer prototype (read-about-type.framer.website) was taken offline on 2026-11-18: the live site is now the visual reference.
