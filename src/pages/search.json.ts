// Descriptions for full-text search, loaded by the library only when someone starts
// searching (keeps the home page HTML small). Text is pre-normalised.
import type { APIRoute } from 'astro';
import { getPublished } from '../lib/publications';
import { normalize } from '../scripts/library-core';

export const GET: APIRoute = async () => {
  const pubs = await getPublished();
  const index = Object.fromEntries(
    pubs.filter((p) => p.body?.trim()).map((p) => [p.data.slug, normalize(p.body!)]),
  );
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
