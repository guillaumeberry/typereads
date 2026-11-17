# CLAUDE.md — Read About Type

Guidance for Claude Code when working in this sub-project.

## Status

Phase 4 done (motion: Swup + GSAP layer over native transitions); hand tests on phones/Safari/Firefox and Phase 1 data enrichment still open. Read `README.md` and `docs/` first.

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
- `src/layouts/Base.astro`: page shell (meta, OG, JSON-LD, fonts). `src/components/`: Header, Footer, Card, Cover, Logo, Prose.
- `src/content/pages/about.md`: About copy (FAQ as front-matter fields).
- Fonts: HEX Franklin is **commercial**: never commit it. `scripts/fonts.mjs` (runs before `dev`/`build`) downloads it from the private repo `guillaumeberry/typereads-fonts` when `FONTS_BASE_URL` (+ `FONTS_TOKEN`) is set (Cloudflare build, with `FONTS_REQUIRED=1` so a missing font fails the deploy), otherwise copies it from the gitignored `assets/fonts/`, into the gitignored `public/fonts/`; `Base.astro` uses it when present, else Archivo (OFL, npm).
- Theme: light by default, dark via `prefers-color-scheme` (tokens in `src/styles/global.css`).
- `src/scripts/boot.ts`: the one script every page loads (via `Base.astro`): `mount`/`unmount` page scripts, the "←" history helper (capture phase), Tier 1 view transitions (`vt.ts`), and the idle loader for `motion/` (skipped under reduced motion / Save-Data). Page scripts must be started from `mount()`, never from a page-level `<script>`: the router doesn't re-run those.
- `src/scripts/motion/`: Swup router + GSAP transitions (`index.ts`), Flip for in-page changes (`flip.ts`). Budget ≤ 60 KB gz.
- `src/scripts/library-core.ts` (pure, tested) + `library.ts` (DOM, `init`/`destroy`, `animate` hook): search, filters, faceted counts, sort, URL state. Cards carry `data-*` attributes; `/search.json` holds descriptions, loaded on first search focus.
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
- Prototype for visual reference: https://read-about-type.framer.website/
