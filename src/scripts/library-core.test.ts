import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  bucketOf,
  computeCounts,
  computeVisible,
  emptyState,
  normalize,
  parseState,
  serializeState,
  type Item,
  type State,
} from './library-core';

const item = (o: Partial<Item> & Pick<Item, 'id'>): Item => ({
  i: 0,
  title: o.id,
  type: 'book',
  formats: ['physical'],
  langs: ['en'],
  tlangs: [],
  scripts: [],
  year: 2020,
  avail: 'unknown',
  text: normalize(o.title ?? o.id),
  ...o,
});

const items: Item[] = [
  item({ id: 'a', i: 0, title: 'À bâtons rompus', langs: ['fr'], year: 2001, scripts: ['Latn'] }),
  item({ id: 'b', i: 1, title: 'Cyrillize it!', scripts: ['Cyrl'], year: 2020 }),
  item({
    id: 'c',
    i: 2,
    title: 'Codex',
    type: 'magazine',
    formats: ['physical', 'digital'],
    year: 2011,
  }),
  item({ id: 'd', i: 3, title: '글립스 타입 디자인', langs: ['ko'], tlangs: ['en'], year: 2019 }),
  item({ id: 'e', i: 4, title: 'Blaze Type', langs: ['en'], tlangs: ['fr'], year: 2023 }),
];

const state = (o: Partial<State> = {}): State => ({ ...emptyState(), ...o });
const ids = (list: Item[]) => list.map((x) => x.id);

describe('normalize and search', () => {
  it('ignores accents and case', () => {
    expect(normalize('  À BÂTONS   rompus ')).toBe('a batons rompus');
  });
  it('finds accented titles without accents', () => {
    expect(ids(computeVisible(items, state({ q: 'a batons' })))).toEqual(['a']);
  });
  it('matches every word, in any order', () => {
    expect(ids(computeVisible(items, state({ q: 'rompus batons' })))).toEqual(['a']);
    expect(ids(computeVisible(items, state({ q: 'rompus codex' })))).toEqual([]);
  });
  it('works with non-Latin scripts (substring)', () => {
    expect(ids(computeVisible(items, state({ q: '글립' })))).toEqual(['d']);
  });
});

describe('filters', () => {
  it('ORs values within a group', () => {
    expect(ids(computeVisible(items, state({ type: new Set(['book', 'magazine']) })))).toHaveLength(
      5,
    );
  });
  it('ANDs across groups', () => {
    const s = state({ type: new Set(['book']), format: new Set(['digital']) });
    expect(ids(computeVisible(items, s))).toEqual([]);
    const s2 = state({ type: new Set(['magazine']), format: new Set(['digital']) });
    expect(ids(computeVisible(items, s2))).toEqual(['c']);
  });
  it('includes translations in the language filter unless turned off', () => {
    expect(ids(computeVisible(items, state({ lang: new Set(['fr']) })))).toEqual(['a', 'e']);
    expect(ids(computeVisible(items, state({ lang: new Set(['fr']), tr: false })))).toEqual(['a']);
  });
  it('filters by date bucket', () => {
    expect(bucketOf(2024)).toBe('now-2020');
    expect(bucketOf(2001)).toBe('2019-2000');
    expect(bucketOf(1985)).toBe('1999-1980');
    expect(bucketOf(1975)).toBe('before-1980');
    expect(ids(computeVisible(items, state({ date: '2019-2000' })))).toEqual(['a', 'c', 'd']);
  });
  it('counts active filter values', () => {
    expect(activeFilterCount(state({ type: new Set(['book']), date: '2019-2000' }))).toBe(2);
  });
});

describe('faceted counts', () => {
  it('counts each option with the other groups applied', () => {
    const counts = computeCounts(items, state({ type: new Set(['book']) }));
    // The type group ignores its own selection…
    expect(counts.type.get('magazine')).toBe(1);
    expect(counts.type.get('book')).toBe(4);
    // …other groups only count books.
    expect(counts.format.get('digital')).toBeUndefined();
    expect(counts.format.get('physical')).toBe(4);
  });
  it('respects the search', () => {
    const counts = computeCounts(items, state({ q: 'codex' }));
    expect(counts.type.get('magazine')).toBe(1);
    expect(counts.type.get('book')).toBeUndefined();
  });
});

describe('sort', () => {
  it('defaults to recently added (server order)', () => {
    expect(ids(computeVisible(items, state()))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('sorts by year both ways and by title', () => {
    expect(ids(computeVisible(items, state({ sort: 'year-desc' })))).toEqual([
      'e',
      'b',
      'd',
      'c',
      'a',
    ]);
    expect(ids(computeVisible(items, state({ sort: 'year-asc' })))).toEqual([
      'a',
      'c',
      'd',
      'b',
      'e',
    ]);
    expect(ids(computeVisible(items, state({ sort: 'title' }))).slice(0, 3)).toEqual([
      'a',
      'e',
      'c',
    ]);
    // Z › A is the exact reverse of A › Z.
    expect(ids(computeVisible(items, state({ sort: 'title-desc' })))).toEqual(
      ids(computeVisible(items, state({ sort: 'title' }))).reverse(),
    );
  });
});

describe('URL state', () => {
  it('round-trips', () => {
    const s = state({
      q: 'diacritics',
      type: new Set(['book']),
      script: new Set(['Latn', 'Cyrl']),
      date: '2019-2000',
      tr: false,
      sort: 'year-desc',
    });
    const qs = serializeState(s);
    expect(qs).toBe('q=diacritics&type=book&script=Cyrl,Latn&tr=0&date=2019-2000&sort=year-desc');
    expect(serializeState(parseState(qs))).toBe(qs);
  });
  it('is empty for the default state and ignores junk', () => {
    expect(serializeState(state())).toBe('');
    const s = parseState('?sort=nonsense&type=,,book');
    expect(s.sort).toBe('added');
    expect([...s.type]).toEqual(['book']);
  });
});
