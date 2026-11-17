# 01 — Project brief

> Status: planning · Last updated: 2026-11-14

## Context

**Read About Type** is a curated library of publications about type design: books, magazines, websites and posts covering theory, history, monographs, tools, techniques and technology.

History of the project:

1. Started as a Notion database (hard to exploit).
2. Moved to **Airtable + Softr + Tally**, a "no-code triforce" with a domain and a contact address.
3. Rebuilt as a **Framer prototype** (https://read-about-type.framer.website/) with 50 publications, filters by type, sort and detail pages. Its content is good enough to migrate.
4. **Now:** a custom, open-source, lean web platform the project owns end to end.

Why rebuild instead of staying on Framer or no-code:

- Own the code and data, with no vendor lock-in or plan limits (Framer badge, CMS item caps, pricing changes).
- Publish the code as open source.
- Full control over motion, performance and footprint.
- A real but simple editing backend with secure access.

## Vision

> The calmest, fastest way to find something worth reading about type design, across cultures, scripts and languages.

## Audience

| Who                                 | What they need                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Type design students                | "Where do I start?" plus trustworthy, curated references.                      |
| Practising type designers           | Niche or specialist titles, especially non-Latin scripts and technical topics. |
| Educators                           | Lists to share with students, with stable links.                               |
| Researchers, librarians, collectors | Complete metadata (ISBN, publisher, dates, availability).                      |
| Contributors                        | A simple way to suggest a missing publication.                                 |

## Goals (V1)

1. **Browse and find**: the whole library on one page, filterable by type, format, language/translations, script, date and availability, plus full-text search.
2. **Delight**: a slick, well-animated interface with transitions between pages that never gets in the way.
3. **Mobile first**: everything works one-handed on a phone.
4. **Lean**: €0/month hosting, minimal JavaScript, small pages and a low carbon footprint.
5. **Easy to run**: one editor (Guillaume) updates content through a secure web backend, without touching code.
6. **Open to contributions**: an on-site submission form that feeds a review queue in the backend.
7. **Open source**: a public repository with clear licences.

## Non-goals (V1)

Each of these is out of scope on purpose. Revisit them only if real usage asks for them.

- User accounts, favourites, reading lists, comments, ratings or reviews.
- A server-side database (see [ADR-001](06-decisions.md#adr-001--no-database-static-content-in-git)).
- A multilingual UI. The interface is English; content can be in any language.
- E-commerce or affiliate links.
- A public API (the static JSON index could serve as one later).
- "Related publications" and RSS (moved to the post-launch backlog).

## Constraints

- **Hosting**: free tier only.
- **Domain**: not needed for now. Use the free platform subdomain. (A domain was used before; see [open questions](07-open-questions.md).)
- **Builders**: Guillaume with Claude's help. The stack must be simple, well documented and easy to maintain.
- **Scale**: up to about 300 publications within 2 years, with roughly monthly updates.
- **Editors**: one person, comfortable with GitHub.

## Feedback received so far

| Feedback                                   | How it's addressed                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Add **Cabin** analytics                    | V1. Cookie-free, so no consent banner. The free plan covers 10k pageviews/month (see challenge #10). |
| Offer a **list view** as well as the grid  | V1. Grid/list toggle with an animated morph. The list layout still needs a design.                   |
| **Remember display settings** for the user | V1. The view (grid/list) is stored on the device; filters live in the URL (see challenge #7).        |

---

## Challenges to the brief

These are the points where I'd push back or refine the original wishes. Each one links to the decision it led to.

### 1. "Database: need advice" → you don't need one

At ~300 entries updated monthly, the whole library is about 150 KB of text. A database would add a running server (or a third-party service with free-tier limits), credentials, backups, an API layer and cold starts, and it buys nothing a static build doesn't already give you.

**Recommendation:** store each publication as a Markdown file in the Git repo. Git provides versioning, backups, diffs and history for free. The site is pre-built to static HTML: it is fast, secure (no server to attack) and costs nothing.

**When to revisit:** above ~2,000 entries, multiple editors with roles, user accounts, or a public query API. The upgrade path is in [ADR-001](06-decisions.md#adr-001--no-database-static-content-in-git).

### 2. "Lazy loading to not overload the platform" → lazy-load images, not data

300 items can't overload anything. The real weight is **cover images** (~95% of page bytes). So:

- Render every card as HTML (good for SEO, works without JS, enables instant filtering).
- Lazy-load **images** natively, in modern formats with responsive sizes.
- **Drop the "Load more" button.** Pagination fights filtering ("is my result on page 3?") and adds clicks. Browser-level lazy loading makes it unnecessary.

### 3. "Very advanced, high-end animations" vs "lean / low impact" → two tiers

These goals pull against each other. Native browser APIs alone (View Transitions, CSS) give _polished_ motion at 0 KB, but not _high-end, bespoke_ motion. They can't do interruptible or reversible transitions, choreography of elements on the old page, gestures, or page transitions in Firefox. So motion comes in two tiers ([ADR-012](06-decisions.md#adr-012--two-tier-motion-architecture-native-base--gsap-layer--swup-router)):

- **Tier 1, native, always on:** CSS, `linear()` springs, scroll-driven animations, View Transitions. Light, and works for everyone.
- **Tier 2, high-end layer:** GSAP (Flip, SplitText) + Swup page transitions, about 45–60 KB, loaded after first paint and skipped for reduced-motion or Save-Data users. Images still outweigh it many times over.

The framework (Astro) and static hosting don't limit motion at all; the only limit is the JS budget we choose. A **motion spike** in Phase 0 compared three approaches; **Swup + GSAP (C) is chosen for now** (2026-11-15), with native-only as the fallback until the phone tests are done ([ADR-012](06-decisions.md#adr-012--two-tier-motion-architecture-native-base--gsap-layer--swup-router)).

### 4. On-site submissions + a public open-source repo → privacy and spam by design

You chose submissions that land in the backend as drafts. Because content lives in a **public** repo, anything a submission writes there is public forever (Git history). So:

- Never write a submitter's email into the repo. It's emailed to you only.
- A public credit name is opt-in, with an explicit consent checkbox.
- Strong but invisible anti-spam: Cloudflare Turnstile, a honeypot field and rate limiting.
- Submission commits skip the site build, so spam can't burn build minutes.

See [ADR-005](06-decisions.md#adr-005--submissions-on-site-form--worker--draft-entry-in-the-repo).

### 5. Two design sources (Figma + Framer) → consolidate before coding

"Both, partly" is a classic source of design drift. Before front-end work starts, create **one reference**: a single Figma page that holds the chosen version of every screen and state (including mobile, list view, empty states, the filter sheet, the submit form and 404). Otherwise design decisions get made in code, which costs more and looks worse.

### 6. "Most recent" is ambiguous

The prototype sorts by "Most recent". Does that mean **recently published** or **recently added to the library**? Both are useful, so V1 offers both:

- _Recently added_ (default: returning visitors see what's new)
- _Publication date_ (newest first, and oldest first)
- _Title A→Z_

### 7. "Store display settings in the user session" → split by purpose

- **Filters, search and sort live in the URL** (`?type=book&script=Cyrl`). That makes them shareable ("all Cyrillic books"), bookmarkable, and lets the back button return from a detail page with the filters intact.
- **The grid/list view is a personal preference**, kept in `localStorage`, so it's remembered on the device. (A strict "session" via `sessionStorage` would forget it when the tab closes, which seems worse.)

### 8. Cover images and the open-source licence

The code can be MIT, but **cover images are © their publishers**. They can't be relicensed. Recommendation:

- Code: **MIT**.
- Metadata and descriptions: **CC BY 4.0**.
- Covers: no licence granted. Used for identification, credited, with a takedown contact.
- State all of this clearly in `LICENSE`, the README and the About page.

### 9. Fonts in a public repo

`assets/fonts/` exists but is empty. If the site uses commercial or unreleased typefaces, the font files **must not be committed to a public repo**: the licence almost certainly forbids redistribution. Options: use the designer's own fonts with an explicit licence, use open-source (OFL) fonts, or keep font files out of Git and inject them at build. See [open questions](07-open-questions.md).

### 10. Cabin's free plan has a ceiling

Cabin Free = 1 site and **10,000 pageviews/month** per account. Above that, the dashboard hides data until the next month. That's probably enough for a niche library, but if it isn't, the fallback is **Cloudflare Web Analytics** (free, cookie-free, already on the same platform).

### 11. Root-level URLs

The prototype puts publications at `/<slug>` with accented or Korean characters (`/글립스-타입-디자인`). That collides with pages like `/about` and makes ugly encoded URLs when shared. Recommendation: `/publications/<ascii-slug>`. Since the domain is changing anyway, there's no SEO history to protect.

---

## Success criteria for launch

- [ ] All 50 prototype publications migrated, with complete metadata (including the new fields: scripts, availability, year).
- [ ] Lighthouse ≥ 95 on Performance, Accessibility, Best Practices and SEO, on mobile.
- [ ] Core JS ≤ 15 KB gz, plus a motion layer ≤ 60 KB gz (deferred). Every page works with zero JS.
- [ ] Signature motions run at 60 fps on a mid-range Android phone and look the same in Chrome, Safari and Firefox.
- [ ] Every filter combination is reflected in the URL and survives back/forward navigation.
- [ ] A submission arrives in the backend inbox and in your email within a minute.
- [ ] Guillaume can add a publication from a phone, via the backend, in under 3 minutes.
- [ ] €0/month running cost.
- [ ] Public repo with README, licences and contribution notes.
