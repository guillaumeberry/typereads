// Querying publications. Only `status: published` entries ever reach a page.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Publication = CollectionEntry<'publications'>;

/** Published entries in the default order, "Recent first": newest publication year,
 *  then most recently added, then by title. Without JS the library shows this order. */
export async function getPublished(): Promise<Publication[]> {
  const all = await getCollection('publications', ({ data }) => data.status === 'published');
  // Two published entries with one slug would share a URL (e.g. a "Duplicate" in
  // the admin keeps the slug): fail the build rather than silently drop one.
  const seen = new Map<string, string>();
  for (const p of all) {
    const other = seen.get(p.data.slug);
    if (other) throw new Error(`Duplicate slug "${p.data.slug}" in ${other} and ${p.id}`);
    seen.set(p.data.slug, p.id);
  }
  return all.sort(
    (a, b) =>
      b.data.year - a.data.year ||
      b.data.addedAt.getTime() - a.data.addedAt.getTime() ||
      a.data.title.localeCompare(b.data.title, undefined, { sensitivity: 'base' }),
  );
}

export const publicationUrl = (p: Publication) => `/publications/${p.data.slug}`;
