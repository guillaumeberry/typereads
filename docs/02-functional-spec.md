# 02 — Functional spec

> Status: draft · Last updated: 2026-11-14
> Data fields used here are defined in [03 — Content model](03-content-model.md).

## Sitemap and URLs

| Page               | URL                           | Notes                                                                                             |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Home / library     | `/`                           | Full list with search, filters, sort and the grid/list view. Filter state is in the query string. |
| Publication detail | `/publications/<slug>`        | ASCII slug (e.g. `glyphs-type-design` for 글립스 타입 디자인).                                    |
| About              | `/about`                      | Mission, FAQ, colophon, licences, credits.                                                        |
| Submit             | `/submit`                     | Contribution form. Also handles corrections via `/submit/fix/<slug>`.                             |
| Submit — thanks    | `/submit/thanks`              | Confirmation shown after sending.                                                                 |
| 404                | any unknown URL               | The fun twist (see below).                                                                        |
| Backend (CMS)      | `/admin`                      | GitHub login. Not linked from the public site.                                                    |
| Machine files      | `/sitemap.xml`, `/robots.txt` | Generated at build. (`/rss.xml` comes post-launch.)                                               |

## Global elements

- **Header**: logo/wordmark (→ home), _About_, _Submit_. It stays the same on every page, and the view transition keeps it still during navigation.
- **Footer**: one-line mission, _Submit a publication_, credits, licence links, contact.
- **Skip link** to the main content, and visible focus styles everywhere.
- **Theme**: light only for now ([ADR-013](06-decisions.md#adr-013--visual-redesign-from-the-figma-file-typereadsxyz)); dark mode returns once it's designed.

---

## Home — the library

### Layout (top to bottom)

1. Short intro line ("A collection of books, essays, magazines and more about type design.").
2. **Toolbar**: search field · _Filters_ button (with an active-count badge) · sort menu · grid/list toggle.
3. **Active filter chips**: one removable chip per active value, plus _Reset all_.
4. **Live result count**: "50 publications" / "12 of 50", announced to screen readers with `aria-live="polite"`.
5. **Results**: grid of cover cards, or list rows.
6. **Empty state**: a friendly line, the active filters, and a _Reset filters_ button. (Optional extra: "Know one that fits? Submit it.")

### Cards

| View               | Shows                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grid** (default) | Cover on its publication colour · title · type · format. Hover: the cover lifts slightly. The whole card is the link.                                      |
| **List**           | One row per publication: title · authors · year · type · languages · format. Very dense and scannable. Layout to be designed ([Q4](07-open-questions.md)). |

The grid is **2 columns up to 1023 px** (phones and small screens), **3 columns from 1024 to 1920 px** and **4 above**; the page stops growing at 2560 px ([ADR-013](06-decisions.md#adr-013--visual-redesign-from-the-figma-file-typereadsxyz)). Detail pages stay at 1680 px until they're redesigned. On phones a list row is a colour strip with the cover, the title and two caption lines.

### Filters

Filter groups, all built from publication metadata.

> **Since ADR-013 (2026-11-22)** the panel follows the Figma "Filters" design: four groups with **one choice each** (radio dots), applied at once: **Type** (All · Books · Magazines · Websites), **Format** (Physical + Digital · Physical · Digital), **Publication** (Anytime · Now › 2020 · 2019 › 2000 · 1999 › 1980) and **Sorting** (Recently added · A › Z · Z › A · Recent first · Oldest first), plus Reset. It opens under the header, attached to the Filter button, and pushes the publications down; four columns on desktop, one on phones. The Filter button shows the number of active filters, "Filter (2)". Language, script and availability are no longer in the panel (still applied from a URL, cleared by Reset). The table below is the original plan.

| Group                | Field                          | Control                                                                 | Values                                                                                                                                                                                                            |
| -------------------- | ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Type**             | `type`                         | Chips (multi)                                                           | Book · Magazine · Website & post                                                                                                                                                                                  |
| **Format**           | `formats`                      | Chips (multi)                                                           | Physical · Digital                                                                                                                                                                                                |
| **Language**         | `languages` (+ `translations`) | Searchable checklist with counts, plus an _Include translations_ toggle | ISO 639-1 codes, shown by name (English, Français, Deutsch, 한국어…)                                                                                                                                              |
| **Script**           | `scripts`                      | Chips with a sample glyph (multi)                                       | Latin **A** · Cyrillic **Ж** · Greek **Ω** · Arabic **ع** · Hebrew **א** · Devanagari **क** · Thai **ก** · Tibetan **ཀ** · Georgian **ა** · Hangul **한** · Han **永** · … (only scripts that appear in the data) |
| **Publication date** | `year`                         | Range presets (single)                                                  | Proposal: _2020s_ · _2010s_ · _2000s_ · _1990s_ · _Before 1990_. Final ranges still open ([Q5](07-open-questions.md)).                                                                                            |
| **Availability**     | `availability`                 | Chips (multi)                                                           | In print · Out of print · Free to read online                                                                                                                                                                     |

**Logic**

- **OR within a group, AND across groups.** "Book OR Magazine" AND "Cyrillic" AND "2010s".
- **Faceted counts**: each option shows how many results it _would_ give with the other active groups applied. Options with 0 results stay visible but are dimmed and disabled, never hidden, so the panel doesn't jump around.
- **Include translations** (on by default): a French filter also matches books _translated_ into French. Turning it off matches the original language only.
- Search and filters combine with AND.

**Placement**

- **Desktop**: a collapsible panel under the toolbar. Results update live.
- **Mobile**: a bottom sheet with large touch targets, and a sticky _Show 12 results_ button that closes it. Results update behind the sheet.

### Search

- One field. It matches title, subtitle, authors, publishers, ISBN/ISSN and description.
- **Accent- and case-insensitive**: "a batons rompus" finds _À bâtons rompus_. Works with any script (substring match, so Korean, Thai and so on work).
- Debounced at about 120 ms. Also updates `?q=`.
- Keyboard: `⌘ K` (Mac) or `Ctrl K` (Windows, Linux) opens the search bar and selects its text; `Esc` (or ×) clears the search and closes the bar. The tag in the field shows the right one for the platform.

### Sort

In the panel's order (Figma "Filters"). Since 2026-11-24 the default is **Recent first** (Q13); the server renders the cards in that order, so the page doesn't reorder when the script loads.

| Option         | Field                                          | Default |
| -------------- | ---------------------------------------------- | ------- |
| Recent first   | `year` ↓ (first publication), then `addedAt` ↓ | ✅      |
| Oldest first   | `year` ↑                                       |         |
| Recently added | `addedAt` ↓                                    |         |
| A › Z          | `title` (locale-aware collation)               |         |
| Z › A          | `title`, reversed                              |         |

### State and persistence

| State                   | Where                                                                                        | Why                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Search, filters, sort   | URL query string, e.g. `/?q=diacritics&type=book&script=Latn,Cyrl&date=2010s&sort=year-desc` | Shareable, bookmarkable, and survives back/forward. Uses `history.replaceState` while typing and `pushState` when a filter changes. |
| Grid/list view          | `localStorage` (`rat:view`)                                                                  | A personal preference, remembered on the device. Wrapped in `try/catch`; defaults to grid.                                          |
| Scroll position on back | Swup scroll plugin (Tier 2) or the native back/forward cache (no JS)                         | Return to the exact card. With Swup, the library engine re-reads state from the URL on every `page:view`.                           |

### Without JavaScript

Everything is server-rendered. With JS off, all publications show in grid view, sorted recent first (newest publication year), and every link works. Filters, search and the view toggle appear only when JS is available (progressive enhancement).

---

## Publication detail

### Content

1. **Back link** (←). If the visitor came from the library, it goes _back_ in history so filters and scroll are restored. Otherwise it links to `/`.
2. **Hero**: the cover on the publication's colour. It **morphs from the card** via the view transition. If a publication has no cover, a generated typographic cover is shown (title set in the site typeface on the publication colour), so there's never a broken image.
3. **Title** and subtitle.
4. **Metadata grid**, showing only the fields that have values:
   - Author(s) · Publisher(s) · Type · Format(s)
   - Language(s) · Translations (language: title, with a link if any)
   - Scripts covered · Publication date · Availability
   - ISBN / ISSN · Pages (optional)
5. **Links**: _Publisher page ↗_, _Buy ↗_, _Read online ↗_ (whichever exist), all opening in a new tab with `rel="noopener"`.
6. **Description** (Markdown).
7. **Footer actions**: _Suggest a correction_ (→ `/submit/fix/<slug>`) · _Back to the library_.

### Rules

- Text colour on the hero (black or white) is **chosen at build time from the publication colour** to meet WCAG AA contrast.
- Structured data: JSON-LD `Book` or `Periodical` (by type), with name, author, publisher, isbn, datePublished, inLanguage and image.
- `<title>` = "Title — Read About Type". Open Graph image = the cover.
- Post-launch: _Related publications_ (by shared authors, scripts or topics), computed at build.

---

## About

From the prototype, updated:

- **It's about Type Design**: mission paragraph.
- **FAQ**, using native `<details>/<summary>` (accessible, no JS): Why this list? · What can I find here? · How can I help? · Why so many Latin-script publications? · What's next?
- **Contribute**: short text and a link to `/submit`.
- **Colophon**: the _new_ stack (Astro, Cloudflare, Sveltia CMS, Cabin), the typefaces, the €0 hosting cost and footprint figures. Being open about this fits the project's tone.
- **Licences**: code MIT · data CC BY 4.0 · covers © publishers, with a takedown contact.
- **Credits**: contributors who opted in to public credit.

The About copy is editable in the CMS (a single Markdown file).

---

## Submit

Since ADR-013 the form opens in a **panel** from the header's "+" (any page) and ends on a success view with a recap; `/submit` stays as a page for direct links and visitors without JavaScript. Link, year, languages, scripts and "why" were dropped from the form (2026-11-22): the editor looks them up when reviewing.

### Form fields

| Field                        | Required         | Notes                                                                                                     |
| ---------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| Title                        | ✅               |                                                                                                           |
| Author(s)                    | ✅               | Free text, comma-separated.                                                                               |
| Type                         | ✅               | Book / Magazine / Website & post / Other.                                                                 |
| Publisher                    |                  |                                                                                                           |
| Your name, for public credit |                  | Optional. Published **only** if the consent box is ticked.                                                |
| Your email                   |                  | Optional. **Never published or stored in the repo.** It's only forwarded to the editor so they can reply. |
| Consent checkbox             | ✅ if name given | "I agree my name may be shown as a contributor."                                                          |
| _(hidden honeypot)_          | —                | Must stay empty.                                                                                          |
| _(Turnstile widget)_         | —                | Invisible or managed mode.                                                                                |

**Correction mode** (`/submit/fix/<slug>`, one static page per publication, linked from its page): shows "Suggest a correction" for _Title_, with a single "What should change?" text field plus name and email. Corrections are emailed to the editor, not committed.

### Behaviour

- It's a native HTML `<form method="post" action="/api/submit">` (the server redirects to `/submit/thanks` or `/submit/error`). With JS, it submits in place and shows inline errors. **Exception to "works without JS":** the Turnstile spam check needs JS, so a no-JS visitor sees a note with the email address instead (ADR-005).
- Validation runs on the client for UX and **again on the server**, which is the source of truth.
- The success page explains what happens next: "I review every submission by hand; accepted titles usually appear within a month."
- Errors are friendly and keep everything the person typed.
- The full pipeline is in [04 — Architecture](04-architecture.md#submission-pipeline).

---

## 404 — the fun twist

> **Since ADR-013 (2026-11-22):** the 404 follows the Figma "404 desktop" frame instead: "404" spelled in a 12 × 6 dot matrix on a white card (the black dots fill in diagonal by diagonal), then "I'm feeling curious (and lucky)" (a random publication) and "Nah, bring me back home". The .notdef concept below is the original plan.

**Concept: ".notdef".** In a font, `.notdef` is the glyph shown when a character doesn't exist: the empty box designers call _tofu_. A missing page is a missing glyph.

1. The page shows **"404"**, which **cycles through the numerals of different scripts**: ٤٠٤ (Arabic-Indic) → ४०४ (Devanagari) → ๔๐๔ (Thai) → ༤༠༤ (Tibetan) → ৪০৪ (Bengali) → … and finally lands on **three tofu boxes ☐☐☐**. This ties directly to the library's multi-script mission.
2. Copy: **"This glyph isn't in the font."** Then: "The page you're looking for doesn't exist (or was never drawn)."
3. Two ways out: **Back to the library** and **Read something random** (links to a random publication; the list is embedded at build, so it costs nothing).
4. Reduced motion: no cycling. Show the tofu boxes with the numerals listed underneath as a static line.

Cost: a few lines of CSS/JS. The numerals rely on system fonts, falling back to the tofu boxes if a font is missing, which is fitting.

Alternative concepts, if you'd rather: a _kerning_ micro-interaction (drag the badly spaced "4 0 4" until it looks right, which then reveals the links), or a glyph-grid "404" drawn on a type-design grid with visible nodes and handles.

---

## Backend (CMS) — what the editor sees

Login at `/admin` with GitHub. Only accounts with write access to the repo can get in (security details in [04](04-architecture.md#access-and-security)).

**What it looks like:** Sveltia's own interface (works in light/dark and on a phone). It can't be themed to look like Read About Type; what we design is the **form**: field order, labels, help text, dropdowns, defaults and validation. To see it, run the local demo in [`spike/cms/`](../spike/cms/README.md).

- A sidebar with the collections below; each opens as a list you can search, sort, filter (type, status) and group.
- Each entry opens as a form with a preview beside it. The preview is plain, so don't rely on it for layout; the live site updates within 1–2 minutes of saving.
- Images (covers) upload from a phone or desktop.
- Required fields and formats (slug, ISBN, URL, colour, year) are checked before saving; the build's schema check is the second safety net.

| Section          | Purpose                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inbox**        | Publications with `status: submitted` (from the public form). Open one, complete the metadata, upload the cover, then set it to _published_ or delete it. |
| **Publications** | All drafts and published items. Create, edit or unpublish.                                                                                                |
| **Pages**        | About page copy.                                                                                                                                          |

Editing a publication triggers a build, and the change is live in about 1–2 minutes. Details are in [04 — Architecture](04-architecture.md#backend-cms).

---

## Motion spec

### Principles

1. **Motion explains space**: where something came from and where it went. Never decoration for its own sake.
2. **Fast and interruptible**: nothing blocks input, and there are no splash screens or loaders. A new action reverses or redirects a running animation instead of waiting for it to finish.
3. **Two tiers** ([ADR-012](06-decisions.md#adr-012--two-tier-motion-architecture-native-base--gsap-layer--swup-router)): a native base (CSS, scroll-driven animations, View Transitions) that always works, plus a **high-end layer** (GSAP + Swup) loaded after first paint for choreographed, cross-browser and interruptible motion.
4. **Respect people**: `prefers-reduced-motion: reduce` or Save-Data turns off the high-end layer, and transitions become instant changes or plain crossfades.
5. **Type is the hero**: animate letterforms where it makes sense (variable-font axes, line and letter reveals). It's a type-design library.

### Tokens

```css
--dur-fast: 120ms; /* hovers, toggles */
--dur-base: 240ms; /* filtering, view switch */
--dur-slow: 420ms; /* page transitions, cover morph */
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### Animated moments

| Moment                        | Technique (Tier 2 · _Tier 1 fallback_)                                                            | Behaviour                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page → page                   | Swup + GSAP timeline on the live DOM · _instant navigation_                                       | Choreographed: outgoing content masks and slides out with a staggered exit while the header stays put; incoming content reveals line by line. Interruptible: clicking Back mid-transition reverses it.                                                                                                                                   |
| **Card → detail** (signature) | Swup + **GSAP Flip** (`data-flip-id="cover-<slug>"`) · _native cross-document VT where supported_ | The tile's coloured square grows into the detail page's coloured block while the cover flies into place on top of it (never masked, always on its colour); then the title and details fade in. Back plays the reverse, landing on the right card ([ADR-013](06-decisions.md#adr-013--visual-redesign-from-the-figma-file-typereadsxyz)). |
| Filtering / search / sort     | **GSAP Flip** on the cards in view (others snap) · _same-document VT_                             | Cards glide to their new positions with a slight stagger by distance; leaving cards scale and fade out; arriving cards fade in. Rapid changes redirect the motion mid-flight instead of restarting it.                                                                                                                                   |
| Grid ↔ list                   | GSAP Flip (nested: card → row, cover → thumbnail) · _same-document VT_                            | Covers shrink into list thumbnails while text reflows into columns; the reverse grows them back.                                                                                                                                                                                                                                         |
| Scroll                        | **CSS scroll-driven animations** (`animation-timeline: view()`), Tier 1                           | Cards rise and fade in as they enter the viewport; subtle parallax on the detail-page cover; a reading-progress hairline on long descriptions. Runs off the main thread.                                                                                                                                                                 |
| Type moments                  | Variable-font axes (CSS) + SplitText                                                              | The wordmark breathes in weight or width on hover; the detail title reveals line by line; the About headline animates along a variable axis while scrolling. Depends on the font choice ([Q2](07-open-questions.md)).                                                                                                                    |
| Card hover / focus            | CSS transform + `linear()` spring                                                                 | Cover lifts 4 px with a soft shadow and a tiny overshoot. Optional pointer-tilt (±3°) on desktop. Hover-capable devices only.                                                                                                                                                                                                            |
| Filter sheet (mobile)         | `<dialog>` + GSAP Observer (drag) · _CSS slide_                                                   | Slides up and can be **dragged down to dismiss**, following the finger with velocity.                                                                                                                                                                                                                                                    |
| Result count                  | CSS / small JS                                                                                    | Digits roll to the new number.                                                                                                                                                                                                                                                                                                           |
| 404                           | CSS/JS                                                                                            | The numeral cycle described above.                                                                                                                                                                                                                                                                                                       |

### Capability check: what each tier can do

| High-end pattern                                     | Native only (Tier 1)                                                  | With Tier 2 (GSAP + Swup)                                                               |
| ---------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Shared-element morph between pages                   | ✅ Chrome/Edge/Safari · ❌ Firefox (instant)                          | ✅ all browsers                                                                         |
| Choreographed out→in sequences, staggered and masked | ⚠️ Limited: the old page is a flat snapshot; needs a name per element | ✅ full control over the live DOM                                                       |
| Interruptible / reversible transitions               | ❌ a new transition skips the running one                             | ✅ timelines reverse or redirect                                                        |
| Gesture-driven motion (drag to dismiss, swipe back)  | ❌                                                                    | ✅ GSAP Observer/Draggable (build effort)                                               |
| Layout morphs (filtering, grid↔list)                 | ✅ VT, but heavy with many names on mobile                            | ✅ Flip, interruptible, nested                                                          |
| Spring easing                                        | ✅ `linear()` approximations                                          | ✅ (GSAP eases; true velocity springs would need Motion)                                |
| Scroll-linked reveals and parallax                   | ✅ CSS scroll-driven, all browsers since Oct 2026                     | ✅ ScrollTrigger (only if needed)                                                       |
| Letter/line-level type animation                     | ⚠️ Manual spans                                                       | ✅ SplitText                                                                            |
| Variable-font axis animation                         | ✅ native CSS                                                         | ✅                                                                                      |
| Persistent elements across pages                     | ❌ (faked visually with VT)                                           | ✅ Swup persists them                                                                   |
| WebGL / shader effects                               | —                                                                     | Possible, but **out of V1** (30–150 KB); at most one lazy-loaded signature moment later |

### Browser support

- **Tier 2** (GSAP + Swup) runs the same in Chrome, Edge, Safari and **Firefox**, which closes the Firefox page-transition gap.
- **Tier 1** fallbacks: the native cross-document VT works in Chrome, Edge and Safari 18.2+; Firefox (late 2026) gets instant navigation. Scroll-driven animations are Baseline in all of them.

### Mobile performance guardrails

- Animate only `transform`, `opacity` and `clip-path`. No layout properties, and no large `filter: blur()` on scrolling content.
- Flip only the cards **in or near the viewport** (≤ ~40); the others snap into place.
- `will-change` is set just before an animation and removed after it.
- The Tier 2 bundle loads with `defer`/idle after first paint and is cached across pages. It's never on the LCP path.
- Target **60 fps on a mid-range Android phone** at 4× CPU throttle in DevTools; INP < 150 ms during and after transitions.
- Page-transition total ≤ 600 ms. Navigation never waits on an animation: the new page is fetched or preloaded in parallel.

---

## Performance and lazy-loading spec

### Budgets (mobile, slow 4G)

| Metric                           | Budget                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Home JS: core features (gzipped) | ≤ 15 KB (library engine)                                                            |
| JS: motion layer (gzipped)       | ≤ 60 KB (GSAP core + Flip + SplitText + Swup), deferred, cached, never blocking LCP |
| Pages without JS                 | Must still work fully (motion is enhancement only)                                  |
| Home HTML (gzipped, 300 items)   | ≤ 60 KB                                                                             |
| CSS (gzipped)                    | ≤ 20 KB                                                                             |
| Web fonts                        | ≤ 2 files preloaded, WOFF2, subsetted, ≤ 80 KB total                                |
| LCP                              | < 2.0 s                                                                             |
| CLS                              | < 0.05                                                                              |
| INP                              | < 150 ms                                                                            |
| Lighthouse (all four categories) | ≥ 95                                                                                |

### Techniques

- **Images**: optimised at build into AVIF/WebP with `srcset`/`sizes`. Explicit `width`/`height` prevent layout shift. `loading="lazy"` and `decoding="async"` everywhere except the first row, which gets `fetchpriority="high"`.
- **Placeholder**: the card background is the publication's colour (extracted at build), so lazy covers fade in over a matching colour block. No blur-hash JS is needed.
- **Off-screen rendering**: `content-visibility: auto` with `contain-intrinsic-size` on cards keeps the 300-card page cheap to lay out.
- **Instant navigation**: Swup's preload plugin fetches detail pages on hover/touchstart, so the transition starts with the content already in memory. (If the spike chooses native-only, use the Speculation Rules API with `prerender` at moderate eagerness instead.)
- **Fonts**: self-hosted, subsetted, `font-display: swap`, with metric-adjusted fallbacks (`size-adjust`) to avoid layout shift.
- **No third-party scripts** except Cabin (small, cookie-free) and Turnstile (on `/submit` only).

---

## Accessibility (WCAG 2.2 AA)

- All filters are real form controls (`<input type="checkbox">`, `<fieldset>`/`<legend>`), fully keyboard operable.
- The mobile filter sheet is a `<dialog>` with focus trap, `Esc` to close and focus returned to the trigger.
- The result count is announced via `aria-live="polite"`. Focus is never moved unexpectedly after filtering.
- Cover `alt` = "Cover of _Title_". Decorative images use `alt=""`.
- Per-publication colours are checked for contrast at build, with automatic black/white text.
- Respects `prefers-reduced-motion` and `prefers-contrast`.
- `lang` attributes are set on titles in other languages (e.g. `<span lang="ko">`), so screen readers and hyphenation behave.

## SEO and sharing

- A unique `<title>` and meta description on every page. Canonical URLs.
- Open Graph and Twitter cards: the cover image on detail pages, a branded image elsewhere. (Generated per-publication OG images come post-launch.)
- JSON-LD: `WebSite` with `SearchAction` on home, and `Book`/`Periodical` on detail pages.
- `sitemap.xml` generated at build. Filtered URLs are canonicalised to `/`.

## Analytics

- **Cabin** pageviews, with no cookies and no consent banner.
- Custom events (e.g. which filters get used) need Cabin Plus. If that data matters later, add a tiny privacy-respecting event log, or upgrade.
