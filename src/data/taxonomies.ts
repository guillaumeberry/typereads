// Controlled vocabularies (docs/03-content-model.md). The CMS config
// (public/admin/config.yml, Phase 5) must use the same values.

export const TYPES = {
  book: 'Book',
  magazine: 'Magazine',
  web: 'Website & post',
} as const;

export const FORMATS = {
  physical: 'Physical',
  digital: 'Digital',
} as const;

export const STATUSES = ['submitted', 'draft', 'published'] as const;

export const AVAILABILITY = {
  'in-print': 'In print',
  'out-of-print': 'Out of print',
  'free-online': 'Free to read online',
  unknown: '—',
} as const;

/** ISO 15924 codes for the scripts a publication is ABOUT, with a sample glyph for filter chips. */
export const SCRIPTS = {
  Latn: { label: 'Latin', glyph: 'A' },
  Cyrl: { label: 'Cyrillic', glyph: 'Ж' },
  Grek: { label: 'Greek', glyph: 'Ω' },
  Arab: { label: 'Arabic', glyph: 'ع' },
  Hebr: { label: 'Hebrew', glyph: 'א' },
  Deva: { label: 'Devanagari', glyph: 'क' },
  Beng: { label: 'Bengali', glyph: 'ক' },
  Thai: { label: 'Thai', glyph: 'ก' },
  Tibt: { label: 'Tibetan', glyph: 'ཀ' },
  Geor: { label: 'Georgian', glyph: 'ა' },
  Armn: { label: 'Armenian', glyph: 'Ա' },
  Hang: { label: 'Hangul', glyph: '한' },
  Hani: { label: 'Han (Chinese)', glyph: '永' },
  Jpan: { label: 'Japanese', glyph: 'あ' },
  Cans: { label: 'Canadian Aboriginal Syllabics', glyph: 'ᐊ' },
  Cher: { label: 'Cherokee', glyph: 'Ꭰ' },
  Zyyy: { label: 'Multi-script / general', glyph: '✦' },
} as const;

/** Publication-date filter buckets (Figma filter panel, ADR-013; answers Q5). The filter
 *  only offers buckets that have publications, so "Before 1980" shows up when needed. */
export const DATE_BUCKETS = [
  { id: 'now-2020', label: 'Now › 2020', from: 2020, to: Infinity },
  { id: '2019-2000', label: '2019 › 2000', from: 2000, to: 2019 },
  { id: '1999-1980', label: '1999 › 1980', from: 1980, to: 1999 },
  { id: 'before-1980', label: 'Before 1980', from: -Infinity, to: 1979 },
] as const;

export type TypeKey = keyof typeof TYPES;
export type FormatKey = keyof typeof FORMATS;
export type ScriptKey = keyof typeof SCRIPTS;
export type AvailabilityKey = keyof typeof AVAILABILITY;

export const keysOf = <T extends object>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
