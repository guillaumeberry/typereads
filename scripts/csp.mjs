// Runs after `astro build` (postbuild). The public pages' CSP (public/_headers, `/*`) only
// allows inline scripts listed by hash. This fails the build if a page has an inline
// script whose hash is missing, and prints the value to add. JSON-LD isn't executed, so
// it needs no hash.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const headers = readFileSync('dist/_headers', 'utf8');
const site = headers.split(/^\/\*\s*$/m)[1]?.split(/^\S/m)[0] ?? '';
const csp = site.match(/Content-Security-Policy:(.*)/)?.[1] ?? '';
if (!csp) throw new Error('No Content-Security-Policy for /* in public/_headers');

const pages = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === 'admin'
        ? []
        : pages(join(dir, e.name))
      : e.name.endsWith('.html')
        ? [join(dir, e.name)]
        : [],
  );

const missing = new Map();
for (const file of pages('dist')) {
  const html = readFileSync(file, 'utf8');
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(attrs) || /application\/ld\+json/.test(attrs)) continue;
    const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
    if (!csp.includes(hash)) missing.set(hash, file);
  }
}
if (missing.size) {
  for (const [hash, file] of missing) console.error(`CSP: inline script in ${file} needs ${hash}`);
  console.error('Add it to script-src under /* in public/_headers (and remove stale hashes).');
  process.exit(1);
}
console.log('CSP: every inline script is allowed by hash.');
