import { describe, expect, it } from 'vitest';
import { allYears, coverGallery, mainCover, releasesOf } from './editions';

const work = (over: Partial<Parameters<typeof releasesOf<string>>[0]> = {}) => ({
  year: 2014,
  cover: 'first.png',
  editions: [],
  issues: [],
  ...over,
});

describe('books with editions', () => {
  const book = work({
    isbn: '111',
    editions: [
      { label: '3rd edition', year: 2024, cover: 'third.png' },
      { label: '2nd edition', year: 2019, cover: 'second.png', isbn: '222' },
    ],
  });
  it('lists the first edition then the later ones, oldest first', () => {
    expect(releasesOf(book).map((r) => r.label)).toEqual([
      'First edition',
      '2nd edition',
      '3rd edition',
    ]);
    expect(releasesOf(book)[0]).toMatchObject({ year: 2014, isbn: '111', cover: 'first.png' });
  });
  it('shows the newest cover', () => {
    expect(mainCover(book)).toBe('third.png');
  });
  it('skips editions without a cover', () => {
    const b = work({ editions: [{ label: '2nd edition', year: 2020 }] });
    expect(mainCover(b)).toBe('first.png');
  });
  it('orders by full date within a year', () => {
    const b = work({
      editions: [
        { label: 'Late', year: 2020, date: new Date('2020-11-01'), cover: 'late.png' },
        { label: 'Early', year: 2020, date: new Date('2020-02-01'), cover: 'early.png' },
      ],
    });
    expect(mainCover(b)).toBe('late.png');
  });
  it('lists every year once', () => {
    expect(allYears(book)).toEqual([2014, 2024, 2019]);
  });
  it('builds a gallery, newest first', () => {
    expect(coverGallery(book)).toEqual([
      { cover: 'third.png', label: '3rd edition, 2024' },
      { cover: 'second.png', label: '2nd edition, 2019' },
      { cover: 'first.png', label: 'First edition, 2014' },
    ]);
  });
});

describe('magazines with issues', () => {
  const mag = work({
    year: 2010,
    cover: 'logo.png',
    issues: [
      { label: 'No. 1', year: 2010, cover: 'n1.png' },
      { label: 'No. 2', year: 2011, cover: 'n2.png' },
    ],
  });
  it('lists the issues only', () => {
    expect(releasesOf(mag).map((r) => r.label)).toEqual(['No. 1', 'No. 2']);
  });
  it('shows the newest issue cover', () => {
    expect(mainCover(mag)).toBe('n2.png');
  });
  it('puts the magazine cover last in the gallery', () => {
    expect(coverGallery(mag).map((g) => g.label)).toEqual([
      'No. 2, 2011',
      'No. 1, 2010',
      'Since 2010',
    ]);
  });
});

describe('a work with neither', () => {
  it('keeps its own cover and year, with no gallery', () => {
    const w = work();
    expect(releasesOf(w)).toEqual([]);
    expect(mainCover(w)).toBe('first.png');
    expect(allYears(w)).toEqual([2014]);
    expect(coverGallery(w)).toEqual([]);
  });
});
