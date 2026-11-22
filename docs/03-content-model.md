# 03 — Content model

> Status: draft · Last updated: 2026-11-14

Each publication is **one Markdown file**. The metadata sits in YAML front matter and the description is the Markdown body. The same schema is defined twice and must stay in sync:

1. `src/content.config.ts`: the Astro content-collection schema (Zod). The **build fails** on invalid data, which is the safety net.
2. `public/admin/config.yml`: the CMS field definitions, i.e. what the editor sees.

## Publication

| Field             | Type     | Req. | Used for                | Notes                                                                                                                                                                                                                                                                |
| ----------------- | -------- | ---- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`           | string   | ✅   | display, search, sort   | The original title, in its own script.                                                                                                                                                                                                                               |
| `subtitle`        | string   |      | display, search         | E.g. "The Anatomy of Type".                                                                                                                                                                                                                                          |
| `slug`            | string   | ✅   | URL                     | ASCII, kebab-case, unique. Auto-generated from the title in the CMS, editable. Romanise non-Latin titles (`glyphs-type-design`).                                                                                                                                     |
| `status`          | enum     | ✅   | build, CMS views        | `submitted` (from the form) · `draft` · `published`. **Only `published` is built.**                                                                                                                                                                                  |
| `type`            | enum     | ✅   | filter, JSON-LD         | `book` · `magazine` · `web` (shown as "Website & post"). See [Q6](07-open-questions.md) on adding more types.                                                                                                                                                        |
| `authors`         | string[] | ✅   | display, search         | Plain names in V1. Could become references if author pages are added later.                                                                                                                                                                                          |
| `publishers`      | string[] |      | display, search         |                                                                                                                                                                                                                                                                      |
| `formats`         | enum[]   | ✅   | filter                  | `physical` · `digital` (at least one). The prototype's "Digital + Physical" becomes both.                                                                                                                                                                            |
| `languages`       | string[] | ✅   | filter                  | ISO 639-1 codes (`en`, `fr`, `de`, `ko`…). The language(s) **this edition is written in**.                                                                                                                                                                           |
| `translations`    | object[] |      | filter, display         | `{ language, title?, publisher?, year?, link? }`, one per translated edition. Fed into the language filter when _Include translations_ is on.                                                                                                                        |
| `scripts`         | string[] | ✅   | filter                  | ISO 15924 codes (`Latn`, `Cyrl`, `Arab`, `Thai`, `Tibt`, `Hang`, `Geor`…). **The scripts the publication is _about_, not the script it's written in.** _Cyrillize it!_ is written in English but covers `Cyrl`. General type-design books covering Latin get `Latn`. |
| `year`            | integer  | ✅   | filter, sort            | Year of first publication of this edition. For ongoing magazines and websites, use the start year.                                                                                                                                                                   |
| `date`            | date     |      | display, sort tiebreak  | A full date, when known.                                                                                                                                                                                                                                             |
| `availability`    | enum     | ✅   | filter                  | `in-print` · `out-of-print` · `free-online` · `unknown`.                                                                                                                                                                                                             |
| `isbn`            | string   |      | display, JSON-LD        | Books. ISBN-13 (978/979) preferred, or ISBN-10. Validated by checksum. **A `977…` barcode is not an ISBN**: it encodes an ISSN.                                                                                                                                      |
| `issn`            | string   |      | display                 | Magazines, `1234-567X`. From a `977` barcode: digits 4–10 plus a mod-11 check digit (e.g. 977**2043769**008 → 2043-7692).                                                                                                                                            |
| `pages`           | integer  |      | display                 |                                                                                                                                                                                                                                                                      |
| `links.publisher` | url      |      | display                 |                                                                                                                                                                                                                                                                      |
| `links.buy`       | url      |      | display                 |                                                                                                                                                                                                                                                                      |
| `links.read`      | url      |      | display                 | Free online version, if any.                                                                                                                                                                                                                                         |
| `cover`           | image    | ✅*  | display, OG             | *A typographic fallback is generated if missing. Stored next to the entry; optimised at build.                                                                                                                                                                       |
| `color`           | hex      |      | display                 | Background colour of the card and detail page. **Auto-extracted from the cover at build** if empty; set it manually to override.                                                                                                                                     |
| `addedAt`         | date     | ✅   | sort ("Recently added") | Set automatically on creation.                                                                                                                                                                                                                                       |
| `credit`          | string   |      | About → credits         | Public contributor name, **only with consent**.                                                                                                                                                                                                                      |
| _(body)_          | markdown |      | display, search         | The description. Plain Markdown; no raw HTML is rendered.                                                                                                                                                                                                            |

### Derived at build (not stored)

| Value              | How                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color` (if empty) | The dominant colour of the cover (sharp `stats().dominant`), adjusted for pleasant saturation.                                                                            |
| `textColor`        | Black or white, whichever gives the higher WCAG contrast against `color`.                                                                                                 |
| `searchText`       | Title, subtitle, authors, publishers, ISBN and description, lower-cased with accents stripped (NFD normalisation), embedded as a data attribute or in a small JSON index. |
| `dateBucket`       | The publication-date filter range (see below).                                                                                                                            |
| `languagesAll`     | `languages` plus the languages of `translations`.                                                                                                                         |

### Example file

`src/content/publications/manual-of-diacritics.md`

```markdown
---
title: Manual of Diacritics
slug: manual-of-diacritics
status: published
type: book
authors: [Radek Sidun]
publishers: [The Academy of Arts, Architecture & Design in Prague]
formats: [physical]
languages: [en]
translations: []
scripts: [Latn]
year: 2021
date: 2021-10-01
availability: in-print
isbn: '9788088308171'
links:
  publisher: https://…
cover: ./covers/manual-of-diacritics.jpg
color: ''
addedAt: 2024-03-02
---

A practical guide to designing diacritics for Latin-script languages…
```

---

## Taxonomies

The labels below are kept in `src/data/taxonomies.ts`. That's code, so it stays version-controlled and typed. The CMS uses `select` widgets with the same values.

### Type

| Value      | Label          |
| ---------- | -------------- |
| `book`     | Book           |
| `magazine` | Magazine       |
| `web`      | Website & post |

### Format

`physical` → Physical · `digital` → Digital

### Availability

| Value          | Label               | Meaning                         |
| -------------- | ------------------- | ------------------------------- |
| `in-print`     | In print            | Can be bought new.              |
| `out-of-print` | Out of print        | Second-hand or libraries only.  |
| `free-online`  | Free to read online | Full content freely accessible. |
| `unknown`      | —                   | Not shown as a filter option.   |

### Scripts (ISO 15924), with sample glyphs for the filter chips

| Code   | Label                         | Glyph |
| ------ | ----------------------------- | ----- |
| `Latn` | Latin                         | A     |
| `Cyrl` | Cyrillic                      | Ж     |
| `Grek` | Greek                         | Ω     |
| `Arab` | Arabic                        | ع     |
| `Hebr` | Hebrew                        | א     |
| `Deva` | Devanagari                    | क     |
| `Beng` | Bengali                       | ক     |
| `Thai` | Thai                          | ก     |
| `Tibt` | Tibetan                       | ཀ     |
| `Geor` | Georgian                      | ა     |
| `Armn` | Armenian                      | Ա     |
| `Hang` | Hangul                        | 한    |
| `Hani` | Han (Chinese)                 | 永    |
| `Jpan` | Japanese                      | あ    |
| `Cans` | Canadian Aboriginal Syllabics | ᐊ     |
| `Cher` | Cherokee                      | Ꭰ     |
| `Zyyy` | Multi-script / general        | ✦     |

Only scripts that appear in published data are shown as filter options. (_Indigenous North American Type_ would bring in `Cans`, `Cher` and others.)

### Languages

ISO 639-1 codes, displayed with their **native name** via `Intl.DisplayNames` (no hand-maintained list): `fr` → Français, `ko` → 한국어, `de` → Deutsch.

### Publication date ranges (Figma filter panel, ADR-013; answers [Q5](07-open-questions.md))

| Bucket (URL id)             | Years       |
| --------------------------- | ----------- |
| Now › 2020 (`now-2020`)     | 2020 – now  |
| 2019 › 2000 (`2019-2000`)   | 2000 – 2019 |
| 1999 › 1980 (`1999-1980`)   | 1980 – 1999 |
| Before 1980 (`before-1980`) | ≤ 1979      |

Buckets with no publications are hidden. An alternative is a dual-handle year slider: nicer for big ranges, but more JS and harder on mobile. Presets are recommended for V1.

---

## Pages

`src/content/pages/about.md`: front matter `title` and `intro`, a `faq` list of `{question, answer}`, and the body (colophon, licences). Editable in the CMS.

## Settings (optional)

`src/data/site.json`: site name, tagline, contact email, social links. Editable in the CMS as a single-file collection.

---

## Migration from the Framer prototype

1. **Export**: Framer CMS → CSV export of the Publications collection. (Alternatively, Claude can read it through the Framer integration.)
2. **Convert**: a one-off script (`scripts/import-framer.ts`) maps CSV rows to Markdown files:
   - `Format = "Digital + Physical"` → `formats: [digital, physical]`.
   - Category → `type`.
   - Language names → ISO codes.
   - Publication date → `year` + `date`.
   - `status: published`, and `addedAt` = Framer's created date if available, otherwise the import date.
3. **Covers**: download the original-resolution images from `framerusercontent.com` (strip the `?width=` params), save them as `covers/<slug>.jpg` and keep the originals in the repo. The build makes the web versions.
4. **Enrich by hand** (≈ 1–2 h for 50 items): `scripts`, `availability`, missing `languages` and descriptions. (For example, _Manual of Diacritics_ has no language and no description in the prototype.)
5. **Validate**: `npm run build` fails on any schema error. Fix until it's green.
6. **Spot-check** 10 detail pages against the prototype.

### Data-quality rules

- Titles keep their original typography and diacritics (_À bâtons rompus_, _Cómo crear tipografías_).
- Fix obvious typos from the prototype (e.g. "typographyfor" → "typography for" in _Cyrillize it!_).
- Every publication has at least one link.
- No personal data beyond public authorship and opt-in credits.
