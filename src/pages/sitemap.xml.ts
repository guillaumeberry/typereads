// sitemap.xml generated at build: home, static pages and every published publication.
import type { APIRoute } from 'astro';
import { getPublished, publicationUrl } from '../lib/publications';

export const GET: APIRoute = async ({ site }) => {
  const pubs = await getPublished();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const urls = [
    // The homepage changes when a publication is added: the latest addedAt.
    {
      loc: '/',
      lastmod: pubs.length
        ? day(new Date(Math.max(...pubs.map((p) => p.data.addedAt.getTime()))))
        : undefined,
    },
    { loc: '/about' },
    { loc: '/submit' },
    ...pubs.map((p) => ({ loc: publicationUrl(p), lastmod: day(p.data.addedAt) })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${new URL(u.loc, site).href}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
