// Search and sharing helpers: meta descriptions, titles and the site's identity in
// structured data (JSON-LD). Pure functions, tested in seo.test.ts.

export const SITE_NAME = 'Read About Type';
/** The other names the site goes by (logo, domain), so search engines and AI tools
 *  know they are the same site. */
export const SITE_ALT_NAMES = ['Typereads', 'typereads.xyz'];
export const SITE_DESCRIPTION =
  'A curated library of books, magazines and websites about type design, across cultures, scripts and languages.';
export const REPO_URL = 'https://github.com/guillaumeberry/typereads';

/** Markdown to plain text, enough for descriptions: links keep their text, emphasis,
 *  headings, list markers and code ticks go, whitespace collapses. */
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** At most `max` characters, cut at the last whole word, with "…" when shortened. */
export function summarize(md: string, max = 155): string {
  const text = plainText(md);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** "A", "A and B", or "A et al." for three or more. */
export function authorsText(authors: string[]): string {
  if (authors.length <= 2) return authors.join(' and ');
  return `${authors[0]} et al.`;
}

/** A publication's page title: what people search for, the title and its author. */
export const publicationTitle = (title: string, authors: string[]) =>
  authors.length ? `${title} by ${authorsText(authors)}` : title;

/** Stable ids that link the JSON-LD nodes of different pages together. */
export const siteIds = (site: URL | string) => ({
  website: new URL('/#website', site).href,
  organization: new URL('/#organization', site).href,
});
