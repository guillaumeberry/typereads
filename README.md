# Read About Type

A curated, open-source library of publications about type design (books, magazines, websites and posts), across cultures, scripts and languages.

> **Status:** Phase 1, scaffold and content (2026-11-17). Astro project with the content schema and the 50 publications; a bare page lists them. Throwaway spikes live in `spike/` (gitignored).
> Repo: https://github.com/guillaumeberry/typereads · Prototype: https://read-about-type.framer.website/

## Docs

| #   | Doc                                           | What's inside                                                                                        |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 01  | [Brief](docs/01-brief.md)                     | Vision, audience, goals, non-goals, feedback received, **challenges to the brief**, success criteria |
| 02  | [Functional spec](docs/02-functional-spec.md) | Pages, filters, search, sort, URL state, motion spec, 404 concept, performance budgets, a11y, SEO    |
| 03  | [Content model](docs/03-content-model.md)     | Publication schema, taxonomies (scripts, languages, date ranges), migration from Framer              |
| 04  | [Architecture](docs/04-architecture.md)       | Stack, system diagram, repo structure, CMS, submission pipeline, security                            |
| 05  | [Roadmap](docs/05-roadmap.md)                 | Phases 0–7 with checklists, exit criteria, post-launch backlog                                       |
| 06  | [Decisions](docs/06-decisions.md)             | ADR log: why each choice, alternatives, when to revisit                                              |
| 07  | [Open questions](docs/07-open-questions.md)   | What's still to decide, with defaults                                                                |

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run check    # type-check
```

Requires Node 22+. Content lives in `src/content/publications/` (one Markdown file per publication); the schema is `src/content.config.ts`.

## TL;DR

- **No database.** ~300 publications = Markdown files in Git. Static site, €0 hosting.
- **Astro** (static) + **one small vanilla TS module** for filters, search, sort and grid/list.
- **Two-tier motion:** a native base (CSS, scroll-driven animations, View Transitions) plus a deferred high-end layer (**GSAP** Flip/SplitText + **Swup** page transitions, ≤ 60 KB) for choreographed, interruptible, cross-browser transitions. **Chosen for now after the motion spike** (variant C, [ADR-012](docs/06-decisions.md#adr-012--two-tier-motion-architecture-native-base--gsap-layer--swup-router)); native-only (A) is the fallback until phones are tested.
- **Cloudflare** hosts the site, the CMS login Worker, the submission Worker, Turnstile anti-spam and email alerts. All on the free tier.
- **Sveltia CMS** at `/admin`, with GitHub login (2FA). Edits are commits; the site rebuilds in about 1–2 minutes.
- **Submissions**: on-site form → Worker → `status: submitted` entry in the CMS Inbox, plus an email to the editor. Submitter emails never touch the public repo.
- **Cabin** analytics (cookie-free).
- **Licences**: MIT code · CC BY 4.0 data · covers © publishers.

## Folder

```
typereads/
├── README.md        ← you are here
├── CLAUDE.md        ← guidance for Claude sessions
├── docs/            ← planning docs (above)
├── src/             ← Astro site: content/, content.config.ts, data/, lib/, pages/
├── LICENSE          ← MIT (code) · LICENSE-CONTENT.md: CC BY 4.0 (data), covers excluded
├── spike/motion/    ← throwaway motion spike: 3 variants to compare (see its README)
├── spike/cms/       ← local demo of the admin (Sveltia CMS) on the 50 publications
└── assets/fonts/    ← (empty) project typefaces, see open question Q2
```
