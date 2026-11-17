// Library engine, pure part: search, filters, faceted counts, sort and URL state.
// No DOM here, so it can be unit-tested (library-core.test.ts) and reused by the
// motion layer later.
import { DATE_BUCKETS } from '../data/taxonomies';

export type Item = {
  id: string;
  /** Server order (= "Recently added"). */
  i: number;
  title: string;
  type: string;
  formats: string[];
  langs: string[];
  /** Languages of translated editions. */
  tlangs: string[];
  scripts: string[];
  year: number;
  avail: string;
  /** Normalised searchable text; descriptions are appended once loaded. */
  text: string;
};

export const SORTS = ['added', 'year-desc', 'year-asc', 'title'] as const;
export type Sort = (typeof SORTS)[number];

/** Multi-select groups (OR within a group, AND across groups). */
export const MULTI = ['type', 'format', 'lang', 'script', 'avail'] as const;
export type MultiGroup = (typeof MULTI)[number];
export type Group = MultiGroup | 'date';

export type State = {
  q: string;
  type: Set<string>;
  format: Set<string>;
  lang: Set<string>;
  /** Include translations in the language filter (on by default). */
  tr: boolean;
  script: Set<string>;
  date: string;
  avail: Set<string>;
  sort: Sort;
};

export const emptyState = (): State => ({
  q: '',
  type: new Set(),
  format: new Set(),
  lang: new Set(),
  tr: true,
  script: new Set(),
  date: '',
  avail: new Set(),
  sort: 'added',
});

/** Lower-case, collapse spaces, strip Latin accents: "À bâtons" → "a batons". Any script works. */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const bucketOf = (year: number) =>
  DATE_BUCKETS.find((b) => year >= b.from && year <= b.to)?.id ?? '';

/** The values an item has in a group. */
export function valuesOf(item: Item, group: Group, state: Pick<State, 'tr'>): string[] {
  switch (group) {
    case 'type':
      return [item.type];
    case 'format':
      return item.formats;
    case 'lang':
      return state.tr ? [...new Set([...item.langs, ...item.tlangs])] : item.langs;
    case 'script':
      return item.scripts;
    case 'avail':
      return [item.avail];
    case 'date':
      return [bucketOf(item.year)];
  }
}

function matchesGroup(item: Item, state: State, group: Group): boolean {
  if (group === 'date') return !state.date || bucketOf(item.year) === state.date;
  const wanted = state[group];
  return wanted.size === 0 || valuesOf(item, group, state).some((v) => wanted.has(v));
}

const matchesQuery = (item: Item, q: string) =>
  !q ||
  normalize(q)
    .split(' ')
    .every((word) => item.text.includes(word));

/** Does the item pass the search and every filter group (optionally ignoring one group)? */
export function matches(item: Item, state: State, except?: Group): boolean {
  if (!matchesQuery(item, state.q)) return false;
  return [...MULTI, 'date' as const].every((g) => g === except || matchesGroup(item, state, g));
}

const byTitle = (a: Item, b: Item) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

export function sortItems(items: Item[], sort: Sort): Item[] {
  const list = [...items];
  switch (sort) {
    case 'added':
      return list.sort((a, b) => a.i - b.i);
    case 'year-desc':
      return list.sort((a, b) => b.year - a.year || a.i - b.i);
    case 'year-asc':
      return list.sort((a, b) => a.year - b.year || a.i - b.i);
    case 'title':
      return list.sort(byTitle);
  }
}

/** Matching items in display order. */
export const computeVisible = (items: Item[], state: State) =>
  sortItems(
    items.filter((it) => matches(it, state)),
    state.sort,
  );

export type Counts = Record<Group, Map<string, number>>;

/**
 * Faceted counts: for each option, how many results it would give with the search
 * and the *other* groups applied.
 */
export function computeCounts(items: Item[], state: State): Counts {
  const groups: Group[] = [...MULTI, 'date'];
  const counts = Object.fromEntries(groups.map((g) => [g, new Map<string, number>()])) as Counts;
  for (const g of groups) {
    for (const item of items) {
      if (!matches(item, state, g)) continue;
      for (const v of valuesOf(item, g, state)) counts[g].set(v, (counts[g].get(v) ?? 0) + 1);
    }
  }
  return counts;
}

/** Number of active filter values (search excluded), for the Filters badge. */
export const activeFilterCount = (s: State) =>
  MULTI.reduce((n, g) => n + s[g].size, 0) + (s.date ? 1 : 0);

// --- URL state ---------------------------------------------------------------

const list = (v: string | null) => new Set((v ?? '').split(',').filter(Boolean));

export function parseState(search: string): State {
  const p = new URLSearchParams(search);
  const sort = p.get('sort') as Sort | null;
  return {
    q: p.get('q') ?? '',
    type: list(p.get('type')),
    format: list(p.get('format')),
    lang: list(p.get('lang')),
    tr: p.get('tr') !== '0',
    script: list(p.get('script')),
    date: p.get('date') ?? '',
    avail: list(p.get('avail')),
    sort: sort && SORTS.includes(sort) ? sort : 'added',
  };
}

/** Query string for the state, without "?"; empty when everything is at its default. */
export function serializeState(s: State): string {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set('q', s.q.trim());
  for (const g of ['type', 'format', 'lang', 'script'] as const) {
    if (s[g].size) p.set(g, [...s[g]].sort().join(','));
  }
  if (!s.tr) p.set('tr', '0');
  if (s.date) p.set('date', s.date);
  if (s.avail.size) p.set('avail', [...s.avail].sort().join(','));
  if (s.sort !== 'added') p.set('sort', s.sort);
  return p.toString().replace(/%2C/g, ',');
}
