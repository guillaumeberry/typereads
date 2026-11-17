# 06 — Decision log

Lightweight ADRs (architecture decision records). Each one records what was decided, why, what else was considered, and **when to revisit**. Add new ones at the bottom; never delete. Mark a replaced decision as _Superseded_.

---

## ADR-001 — No database: static content in Git

- **Status:** Accepted (2026-11-14)
- **Decision:** Store each publication as a Markdown file with YAML front matter in the repo. Build the site to static HTML.
- **Why:** At ~300 items with monthly updates, a DB adds a runtime, credentials, backups and failure modes for no benefit. Git gives versioning, diffs, backups and open-source transparency for free. Static output is the fastest, cheapest and most secure option.
- **Alternatives:** Airtable (used before: API limits, lock-in), Supabase/Turso/Cloudflare D1 (fine databases, but they need a server or API layer), headless SaaS CMS (lock-in, changing free tiers).
- **Revisit when:** more than ~2,000 items, several editors with roles, user accounts or favourites, or a public query API. **Upgrade path:** keep the static front end; add Cloudflare D1 (SQLite) behind a Worker API, and migrate with a script that reads the Markdown files.

## ADR-002 — Astro as the site framework

- **Status:** Accepted (2026-11-14)
- **Decision:** Astro with static output and TypeScript strict mode.
- **Why:** Zero JS by default; typed content collections with build-time validation; built-in image optimisation (AVIF/WebP, srcset); first-class view transitions; huge docs and community, which helps a "me + Claude" team. If a page ever needs a component framework, islands allow it without rewriting.
- **Alternatives:** Eleventy (lighter, but a DIY image pipeline and validation), SvelteKit/Next/Nuxt (heavier, server-oriented), plain HTML (no content pipeline).
- **Revisit when:** never likely at this scale.

## ADR-003 — Cloudflare for hosting and serverless pieces

- **Status:** Accepted (2026-11-14)
- **Decision:** Host the static site on Cloudflare (Pages or Workers static assets, whichever Cloudflare recommends at setup time). Run the OAuth and submission Workers there too, with Turnstile, Email Routing and WAF rate limiting.
- **Why:** The free tier has unmetered static bandwidth and requests, 500 builds/month and 100k Worker requests/day. Everything server-ish lives on one platform with one account.
- **Alternatives:** Netlify (see below), Vercel (Hobby is non-commercial only), GitHub Pages (no functions, so submissions and OAuth would need another host).
- **Netlify, re-checked 2026-11-15:** the Free plan is now **300 credits a month**: a production deploy costs 15, 1 GB of bandwidth 20, 10k requests 2; form submissions and deploy previews are free. When the credits run out, **every site on the team goes offline until the next month** (Free can't buy more). Netlify Identity is free and supported (invite-only, GitHub/Google login), but **Git Gateway, which lets Decap commit for Identity users, is deprecated** (no fixes). Netlify Forms (free, unlimited, spam filtering) would replace the submission Worker, but entries land in Netlify's dashboard, not the CMS Inbox, unless a function commits them. Verdict: nice for forms and editors without GitHub, but a hard monthly cap that can take the site offline and a deprecated CMS bridge; Cloudflare stays.
- **Revisit when:** Cloudflare changes its free tier materially. The site is plain static files, so moving takes about an hour.

## ADR-004 — Sveltia CMS (Git-based) as the backend

- **Status:** **Confirmed (2026-11-15)** after trying Sveltia and Decap side by side on the 50 publications ([`spike/cms/`](../spike/cms/README.md)). Login updated the same day (GitHub App). Decap stays the fallback; Kirby and Netlify were considered and not chosen (below and ADR-003). First accepted 2026-11-14.
- **Decision:** Sveltia CMS at `/admin`, GitHub backend, with login through the official `sveltia-cms-auth` Cloudflare Worker backed by a **GitHub App installed on this repo only** (not an OAuth app).
- **Access (updated 2026-11-15):**
  - **GitHub App, not OAuth app.** A GitHub App only reaches the repos it's installed on; an OAuth app's token reaches _all_ your repos, private ones included. Permissions: Contents read/write and Metadata read; Pull requests read/write only if we turn on the editorial workflow. (Trade-off: Open Authoring, which lets non-collaborators propose edits, doesn't work with a GitHub App. We don't need it: public submissions go through the form.)
  - **Worker settings:** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (a Worker secret, never in the repo), and **`ALLOWED_DOMAINS`** set to the site's hostname, so other sites can't obtain tokens through our Worker. Keep **token expiry on**: access tokens last 8 hours and refresh tokens 6 months.
  - **GitHub account:** 2FA with a passkey or hardware key. It is effectively the backend password.
  - **Token in the browser:** Sveltia keeps the token in `localStorage` on the site's origin, so any script injected into the site could read it. Mitigation: a strict CSP on the whole site, and only first-party scripts plus Cabin.
  - **Optional second gate:** Cloudflare Access on `/admin*` (free), so strangers can't even load the admin.
  - **Simpler alternative, acceptable for a solo editor:** _Sign in with Token_ using a **fine-grained personal access token** (this repo only, Contents read/write, with an expiry). No GitHub App or Worker needed; the trade-off is a long-lived token per device that you rotate by hand. Sveltia can disable token sign-in if we go with the GitHub App.
- **Why:** Fully static, so nothing to host besides the tiny OAuth Worker. Secure: access = GitHub repo write permission + 2FA, and no passwords are stored by us. Fast, modern UI that works on mobile. Config-compatible with Decap CMS, so there's a fallback.
- **Alternatives:** Decap CMS (same model, older UI; the fallback), Keystatic (needs SSR routes in GitHub mode), Pages CMS (hosted third party with repo access), TinaCMS (needs Tina Cloud or a self-hosted backend), Sanity/Contentful (SaaS lock-in).
- **Kirby, considered 2026-11-15:** the best admin interface of the options (fully designed Panel, built-in drafts, native form handling, accounts with 2FA, no GitHub needed). Not chosen for now: €99 licence (free/discounted for non-profits on request), PHP hosting at roughly €3–10/month instead of €0, a server to maintain, and content outside Git. It would rewrite ADR-001, 003, 004 and 005. If chosen later, use it **headless** (Kirby as the admin, Astro still builds the static site) to keep the front end and motion work. Decision: try the Sveltia demo in `spike/cms/` first.
- **Revisit when:** non-GitHub editors join (→ Pages CMS, Kirby, or Decap with an identity provider), Sveltia's generic interface turns out to be a real pain in the demo or in use (→ Kirby, headless), or Sveltia lacks a needed feature (→ Decap).

## ADR-005 — Submissions: on-site form → Worker → draft entry in the repo

- **Status:** Accepted (2026-11-14)
- **Decision:** A native form on `/submit` posts to a Cloudflare Worker. The Worker checks Turnstile, the honeypot and the rate limit, validates the payload, and commits a Markdown file with `status: submitted` (commit message includes `[skip ci]`). It then emails the editor. The CMS shows these entries in an _Inbox_ collection.
- **Why:** Your choice: submissions should land in the backend as drafts, with no copy-pasting from a spreadsheet. Reusing the Git content model means no extra storage.
- **Consequences / guardrails:**
  - The repo is public, so **submissions are public once committed**. Never commit submitter emails (they go to the notification only). Credit names are opt-in.
  - Spam that gets through would be visible in Git history, which is why there are several anti-spam layers.
  - `[skip ci]` avoids burning builds on unpublished entries.
- **Alternatives:** Tally → spreadsheet (simplest, nothing to build; a fine **interim fallback** if Phase 6 slips), GitHub issue forms (excludes non-GitHub contributors), private queue in KV/D1 with an accept button (more private, more code; the escalation path).
- **Revisit when:** spam gets through, or submitters' privacy expectations change.

## ADR-006 — Client-side filtering over server-rendered cards

- **Status:** Accepted (2026-11-14)
- **Decision:** Render all published cards into the home page HTML with facet data attributes. One small vanilla TS module filters, searches and sorts by toggling and reordering DOM nodes. State lives in the URL.
- **Why:** Instant feedback, SEO, works without JS, no fetches, no framework, about 10 KB of JS. 300 nodes is trivial.
- **Alternatives:** JSON index + client rendering (needs templating in JS, duplicates markup), Pagefind (excellent, but its search index is overkill for 300 items; kept as the scaling path), server-side filtering (needs a server).
- **Revisit when:** more than ~1,500 items, or the home page HTML exceeds ~150 KB gz.

## ADR-007 — Motion: native View Transitions API, no animation library

- **Status:** ~~Accepted~~ **Superseded by [ADR-012](#adr-012--two-tier-motion-architecture-native-base--gsap-layer--swup-router)** (2026-11-14). Native-only delivers _polished_ motion, not the _high-end, bespoke_ motion the brief asks for. It stays the documented fallback: it is variant **A** in the motion spike, compared with C in ADR-012.
- **Decision:** Cross-document view transitions (`@view-transition { navigation: auto }`) for page changes, a shared `view-transition-name` for the card → detail cover morph, `document.startViewTransition()` for filtering and the grid/list switch, and CSS for micro-interactions.
- **Why:** Zero JS weight for page transitions, progressive enhancement, and it keeps the site a true multi-page app (simpler code, bfcache, no client router).
- **Trade-off:** As of Nov 2026, Firefox supports same-document transitions (since 144) but **not cross-document ones** (an Interop 2026 focus area). Firefox users get instant page navigation; in-page transitions still work.
- **Alternatives:** Astro `<ClientRouter />` (cross-browser page transitions via JS, but script lifecycle complexity and more JS), GSAP/Barba/Motion (weight and complexity).
- **Revisit when:** at launch, check Firefox status. If page transitions in Firefox matter and it still hasn't shipped, enable `<ClientRouter />`.

## ADR-008 — Analytics: Cabin

- **Status:** Accepted (2026-11-14), from feedback
- **Decision:** Cabin, cookie-free, with no consent banner.
- **Why:** Privacy-first and low-carbon, which fits the project's values. Requested in feedback.
- **Limits:** The free plan is 1 site and 10k pageviews/month per account; above that, data is hidden until next month. No custom events on Free.
- **Fallback:** Cloudflare Web Analytics (free, cookie-free, same platform).

## ADR-009 — Licensing

- **Status:** Proposed (2026-11-14). Confirm in Q9.
- **Decision:** Code under **MIT**; metadata and descriptions under **CC BY 4.0**; cover images **not licensed** (© publishers, shown for identification, with a takedown contact); fonts under their own licences (and kept out of the public repo if those don't allow it).
- **Why:** A permissive code licence encourages reuse; CC BY gives the community the data with attribution; covers can't be relicensed by us.

## ADR-010 — URL scheme

- **Status:** Accepted (2026-11-14)
- **Decision:** `/publications/<ascii-slug>`; filter state in the query string on `/`.
- **Why:** Avoids collisions with top-level pages, gives clean shareable URLs, and there's no SEO history to preserve on a new domain.

## ADR-011 — Display preferences vs filter state

- **Status:** Accepted (2026-11-14), from feedback
- **Decision:** Grid/list view stored in `localStorage` (per device, persistent). Search, filters and sort in the URL.
- **Why:** The view is a personal preference; filters are content state worth sharing and restoring with back/forward.

## ADR-012 — Two-tier motion architecture (native base + GSAP layer + Swup router)

- **Status:** **Accepted for now (2026-11-15): variant C, Swup + GSAP.** Chosen after the desktop spike, with A (native only) as the documented fallback. Phone, Safari and Firefox tests are still to do; see _Revisit when_ below. Proposed 2026-11-14.
- **Context:** The brief asks for _very advanced, high-end_ animations and page transitions. Astro and static hosting put no limit on motion; any JS or WebGL can run. What limited it was ADR-007's own rules: native only, no library, 15 KB JS. Native View Transitions have hard limits for high-end work:
  - Page-to-page transitions don't work in Firefox.
  - The old page is a **flat snapshot**, so its inner elements can't be choreographed unless each gets its own name.
  - A new transition **skips** the running one instead of reversing it smoothly, so it isn't really interruptible.
  - It can't be driven by gestures (scrubbing, swipe-back).
  - There are no persistent live elements across pages in a multi-page app.
  - Element-scoped transitions (Chrome 147+) help with in-page work, but are Chrome-only and don't apply across documents.
- **Decision:**
  - **Tier 1, native, always on:** CSS transitions; `linear()` spring easings; **CSS scroll-driven animations** (Baseline since Firefox 159, Oct 2026, so they run off the main thread everywhere); variable-font axis animation (`font-variation-settings`); same-document View Transitions for simple state changes.
  - **Tier 2, the high-end layer, loaded after first paint:** **GSAP** core plus **Flip** (interruptible, cross-browser layout morphs for filtering, grid↔list and card→detail), **SplitText** (letter- and line-level type animation, very on-topic) and **ScrollTrigger/Observer** only if needed. It is skipped under `prefers-reduced-motion` and Save-Data, where Tier 1 still works.
  - **Page transitions: Swup** (official `@swup/astro` integration) with its JS-animation plugin, so GSAP timelines run on the **live DOM of both pages**. Native-VT mode is still available per route. This gives cross-browser transitions (Firefox included), choreographed out→in sequences, interruptible/reversible timelines, preload on hover, scroll restoration, and persistent elements (the header, a future canvas).
- **Why GSAP over Motion:** this is a vanilla-JS site. Motion's automatic layout animations are React-only, while GSAP Flip does FLIP morphs in plain JS, can be interrupted and nested, and works in every browser. All GSAP plugins have been free since April 2025. Motion keeps the edge on true velocity-based springs; for those, CSS `linear()` springs cover most needs.
- **Trade-offs:**
  - **About 45–60 KB gzipped** more JS (GSAP core + Flip + SplitText + Swup; measure in the spike). It's deferred, cached across pages and never blocks LCP; cover images still dominate page weight.
  - **Licence:** GSAP uses Webflow's free _"Standard No Charge"_ licence, which is **proprietary, not OSI open source**. An MIT repo can depend on it (it's installed from npm, not vendored), but say so in the README. The licence's only notable restriction targets visual animation-builder tools, which this project isn't.
  - **More lifecycle care:** with a client router, scripts must initialise and tear down on Swup's `page:view` hooks, and the library engine must restore its state from the URL on each visit.
  - Mobile performance needs guardrails (see the motion spec in 02).
- **Alternatives:**
  - Native only (ADR-007): lightest; the fallback if the spike shows it's enough.
  - **Astro `<ClientRouter />`**: zero extra dependencies, works cross-browser, has `transition:persist`, but is still snapshot-based. The middle option.
  - Motion: MIT licence and springs, but no vanilla layout animations.
  - Barba.js: similar to Swup, but no official Astro integration.
  - **WebGL** (OGL/three.js; shader distortions, liquid transitions): **not in V1**. At most one lazy-loaded signature moment later, if it's worth 30–150 KB.
- **Spike outcome (2026-11-15):** the [motion spike](../spike/motion/README.md) built the 3 signature motions three ways on the 50 real publications. **B** (Astro `<ClientRouter />`) was dropped: it looks like A but costs more JS and adds router lifecycle. The real choice was between **A** and **C**:

  |                              | **A · Native View Transitions**                                                                                        | **C · Swup + GSAP** (chosen)                                                                                                  |
  | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
  | JS (gz, library page)        | ~3 KB                                                                                                                  | ~56 KB (budget 60 KB)                                                                                                         |
  | Visual ambition              | Good: browser-animated screenshots, CSS-only choreography                                                              | Best: live-DOM timelines, cover flight, colour flood, SplitText title, ripple stagger, exact reverse on Back                  |
  | Firefox page transitions     | ✗ (plain page load)                                                                                                    | ✓                                                                                                                             |
  | Interruptible / reversible   | ✗ (a new transition skips the running one)                                                                             | ✓ (Flip continues from in-flight positions)                                                                                   |
  | Main thread, desktop Chrome  | Best: 9–25 ms worst frame, animation runs off the main thread                                                          | 9–33 ms worst frame after the fixes; ~50 ms on grid ↔ list mid-scroll (one long frame while measuring layout)                 |
  | Things that can break        | Few: real page loads, so bfcache, scroll restoration, analytics, focus and screen-reader announcements work by default | Many: app-style routing needs init/destroy for every script, plus manual analytics pageviews, focus, announcements and scroll |
  | Without JS                   | Page transitions still work (CSS)                                                                                      | Normal page loads (Tier 1)                                                                                                    |
  | Licence                      | Fully open source                                                                                                      | GSAP is free but proprietary (accepted, [A9](07-open-questions.md#answered))                                                  |
  | Effort to build and maintain | Low                                                                                                                    | High                                                                                                                          |
  - **A, pros:** tiny; smoothest on the main thread; plain multi-page site with few failure modes; works without JS; improves with each browser release; no licence question.
  - **A, cons:** no page transitions in Firefox yet; the old page is a flat snapshot, so its contents can't be choreographed; transitions jump to the end when interrupted; one unchecked case: if the library page is rebuilt instead of restored from the Back cache, the cover could land on the wrong card for a frame.
  - **C, pros:** full choreography on both pages; identical in every browser; interruptible; the same library serves later work (draggable sheet, hover tilt, 404 numeral cycle, type animation).
  - **C, cons:** ~56 KB, close to the budget, so it must stay deferred; app-style routing is a bug surface (the spike hit a "← Library needs two clicks" bug: Swup and our own back helper both handled the click); one long frame at the start of each transition, unmeasured on a mid-range Android phone; GSAP licence; more code.
  - **Why C for now:** the brief asks for high-end, bespoke motion, and only C delivers the choreographed card → detail transition and its exact reverse in every browser. The costs are known and bounded: the layer is deferred, skipped under reduced motion and Save-Data, and Tier 1 (A's techniques) stays as the base.
  - **Middle path, kept on file:** A for page transitions plus GSAP Flip only for filtering and grid ↔ list (no Swup). Keeps real page loads and their simplicity, and makes filtering interruptible; loses C's choreographed page transition. Another option: push A further with a CSS clip-path colour flood and a CSS title reveal, which narrows the visual gap.

- **Revisit when:**
  - **The phone test is done** (mid-range Android, iPhone with swipe-back, desktop Safari and Firefox). If C doesn't feel clearly better than A, or isn't smooth on the Android phone (especially grid ↔ list mid-scroll), switch to A or the middle path. Record the scorecard here.
  - **Firefox ships cross-document View Transitions**, which removes C's main cross-browser advantage over A.
  - **The motion layer goes over 60 KB gz**, or GSAP's licence terms change.
