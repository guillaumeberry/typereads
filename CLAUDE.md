# CLAUDE.md — Read About Type

Guidance for Claude Code when working in this sub-project.

## Status

Phase 1 in progress (scaffold and content). Read `README.md` and `docs/` first.

## Commands

- `npm run dev`: local dev server (http://localhost:4321)
- `npm run build`: static build to `dist/` (fails on invalid content: that's the safety net)
- `npm run check`: type-check (`astro check`)
- `npm run format` / `npm run format:check`: Prettier
- CI (`.github/workflows/ci.yml`) runs format:check, check and build on every push and PR.
- No unit tests yet (Vitest arrives with the library engine, Phase 3).

## Layout

- `src/content/publications/*.md`: one file per publication (written by the CMS later; Prettier ignores it).
- `src/content.config.ts`: Zod schema. `REQUIRE_ENRICHMENT` is `false` until every entry has `languages` and `scripts`; then flip it to `true`.
- `src/data/taxonomies.ts`: controlled vocabularies (types, formats, scripts, availability, date buckets).
- `src/lib/identifiers.ts`: ISBN/ISSN checksums (`977…` barcodes are ISSNs, not ISBNs).
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
