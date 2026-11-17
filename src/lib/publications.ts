// Querying publications. Only `status: published` entries ever reach a page.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Publication = CollectionEntry<'publications'>;

/** Published entries, "Recently added" first (the default sort), then by title. */
export async function getPublished(): Promise<Publication[]> {
  const all = await getCollection('publications', ({ data }) => data.status === 'published');
  return all.sort(
    (a, b) =>
      b.data.addedAt.getTime() - a.data.addedAt.getTime() ||
      a.data.title.localeCompare(b.data.title, undefined, { sensitivity: 'base' }),
  );
}

export const publicationUrl = (p: Publication) => `/publications/${p.data.slug}`;
