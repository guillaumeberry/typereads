// Editions and issues (ADR-014): one entry per work, its later editions (books) or
// its issues (magazines) listed inside it. Pure helpers, generic over the cover type
// (an image in the build, anything in tests); tested in editions.test.ts.

export type Release<C> = {
  label: string;
  year: number;
  date?: Date;
  publisher?: string;
  isbn?: string;
  pages?: number;
  cover?: C;
};

type Work<C> = {
  year: number;
  date?: Date;
  isbn?: string;
  pages?: number;
  cover?: C;
  editions: Release<C>[];
  issues: Release<C>[];
};

/** Older first: by year, then full date, then list order. */
const chronological = <C>(list: Release<C>[]) =>
  list
    .map((r, i) => ({ r, i }))
    .sort(
      (a, b) =>
        a.r.year - b.r.year || (a.r.date?.getTime() ?? 0) - (b.r.date?.getTime() ?? 0) || a.i - b.i,
    )
    .map(({ r }) => r);

/**
 * The editions (the first one included, from the top-level fields) or the issues,
 * oldest first. Empty when the work has neither list.
 */
export function releasesOf<C>(w: Work<C>): Release<C>[] {
  if (w.editions.length) {
    const first: Release<C> = {
      label: 'First edition',
      year: w.year,
      date: w.date,
      isbn: w.isbn,
      pages: w.pages,
      cover: w.cover,
    };
    return chronological([first, ...w.editions]);
  }
  return chronological(w.issues);
}

/** The cover to show (card, top of the detail page, share image): the publication's
 *  own cover; without one, the newest edition or issue cover. */
export function mainCover<C>(w: Work<C>): C | undefined {
  if (w.cover !== undefined) return w.cover;
  return releasesOf(w)
    .filter((r) => r.cover !== undefined)
    .at(-1)?.cover;
}

/** Every year the work was published in, for the date filter (first year first). */
export const allYears = <C>(w: Work<C>) => [
  ...new Set([w.year, ...w.editions.map((e) => e.year), ...w.issues.map((i) => i.year)]),
];

export type GalleryItem<C> = { cover: C; label: string };

/**
 * The edition or issue covers, newest first, labelled ("2nd edition, 2019"), for the
 * carousel. Empty when none differs from the main cover (no carousel then).
 */
export function coverGallery<C>(w: Work<C>): GalleryItem<C>[] {
  const items: GalleryItem<C>[] = releasesOf(w)
    .filter((r) => r.cover !== undefined)
    .reverse()
    .map((r) => ({ cover: r.cover as C, label: `${r.label}, ${r.year}` }));
  const main = mainCover(w);
  return items.some((i) => i.cover !== main) ? items : [];
}
