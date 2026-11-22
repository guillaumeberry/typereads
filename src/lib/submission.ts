// Public submissions (/submit and /submit/fix/<slug>): validation and the Markdown file a
// new suggestion becomes. Pure, so it is unit-tested and shared by the Worker
// (worker/index.ts). The server is the source of truth; the form's HTML constraints only
// help people fill it in.
//
// Privacy: the submitter's email is returned separately and never written into the file
// (the repo is public). A name is only written as `credit` when consent is ticked.
import { stringify } from 'yaml';
import { TYPES } from '../data/taxonomies';

export const MAX_BODY_BYTES = 10_000;

export type Fields = { get(name: string): string | null; getAll(name: string): string[] };
export type Errors = Record<string, string>;

export type NewSubmission = {
  kind: 'new';
  title: string;
  slug: string;
  path: string;
  content: string;
  summary: string;
};
export type Correction = { kind: 'fix'; slug: string; title: string; summary: string };
export type Parsed =
  { ok: false; errors: Errors } | ({ ok: true; email?: string } & (NewSubmission | Correction));

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Deliberately loose: a typo only means no reply.
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Trim, drop control characters (keeping newlines where allowed), collapse whitespace. */
export function clean(v: string | null, multiline = false): string {
  if (!v) return '';
  let s = v.normalize('NFC').replace(/\r\n?/g, '\n');
  s = multiline
    ? s
        .replace(/[^\P{Cc}\n]/gu, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
    : s.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ');
  return s.trim();
}

/** "Über Schrift: 2nd ed." → "uber-schrift-2nd-ed" (ASCII, ≤ 60 chars; may be empty). */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** Neutralises HTML in text that ends up in a Markdown body (Astro renders raw HTML). */
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function text(
  f: Fields,
  errors: Errors,
  name: string,
  max: number,
  opts: { required?: string; multiline?: boolean } = {},
): string {
  const v = clean(f.get(name), opts.multiline);
  if (!v && opts.required) errors[name] = opts.required;
  else if (v.length > max) errors[name] = `Keep it under ${max.toLocaleString('en')} characters.`;
  return v;
}

/** Name, consent and email: shared by both forms. */
function contributor(f: Fields, errors: Errors) {
  const name = text(f, errors, 'name', 100);
  const consent = f.get('consent') === 'yes';
  if (consent && !name) errors.name = 'Add the name to credit, or untick the box.';
  if (name && !consent) errors.consent = 'Tick this to be credited, or leave your name empty.';
  const email = text(f, errors, 'email', 200);
  if (email && !EMAIL.test(email)) errors.email = 'This doesn’t look like an email address.';
  return { name, consent, email: email || undefined };
}

/**
 * Validates a form post. `id` makes the file name unique (6 random characters in
 * production) and `today` is the date stamped on the entry (YYYY-MM-DD).
 */
export function parseSubmission(f: Fields, { id, today }: { id: string; today: string }): Parsed {
  return f.get('mode') === 'fix' ? parseCorrection(f) : parseNew(f, id, today);
}

function parseCorrection(f: Fields): Parsed {
  const errors: Errors = {};
  const slug = clean(f.get('fix'));
  if (!SLUG.test(slug)) errors.form = 'This correction link is broken. Please start again.';
  const title = text(f, errors, 'pubtitle', 300);
  const change = text(f, errors, 'change', 2000, {
    required: 'Tell me what should change.',
    multiline: true,
  });
  const who = contributor(f, errors);
  if (Object.keys(errors).length) return { ok: false, errors };
  const summary = [
    `Correction for: ${title || slug}`,
    `Page: https://typereads.xyz/publications/${slug}`,
    '',
    'What should change:',
    change,
    '',
    `Credit: ${who.consent ? who.name : '(none)'}`,
  ].join('\n');
  return { ok: true, kind: 'fix', slug, title: title || slug, summary, email: who.email };
}

function parseNew(f: Fields, id: string, today: string): Parsed {
  // Fields the form no longer has (link, year, languages, scripts, why) are ignored.
  const errors: Errors = {};
  const title = text(f, errors, 'title', 300, { required: 'Add the title.' });
  const authorsRaw = text(f, errors, 'authors', 300, { required: 'Add at least one author.' });
  const authors = authorsRaw
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);
  if (authorsRaw && !authors.length) errors.authors = 'Add at least one author.';

  const type = clean(f.get('type'));
  if (!type) errors.type = 'Choose a type.';
  else if (type !== 'other' && !(type in TYPES)) errors.type = 'Choose one of the types.';

  // The form (Figma "Submission Form", ADR-013) asks only for these; the editor looks
  // up the rest (link, year, languages, scripts…) when reviewing in the admin Inbox.
  const publisher = text(f, errors, 'publisher', 200);
  const who = contributor(f, errors);

  if (Object.keys(errors).length) return { ok: false, errors };

  const slug = `${slugify(title) || 'submission'}-${id}`;
  // Only fields the schema knows. The editor completes the rest (formats, languages as
  // ISO codes, links, cover…) in the admin Inbox before publishing.
  const data: Record<string, unknown> = {
    title,
    slug,
    status: 'submitted',
    ...(type !== 'other' && { type }),
    authors,
    ...(publisher && { publishers: [publisher] }),
    addedAt: today,
    ...(who.consent && { credit: who.name }),
  };

  const notes = [
    `Submitted through the form on ${today}. Replace these notes with the description before publishing.`,
    type === 'other' && 'Type: Other.',
  ].filter(Boolean) as string[];
  // Front matter via a YAML serialiser (never string concatenation), body escaped.
  const content = `---\n${stringify(data, { lineWidth: 0 })}---\n\n${escapeHtml(notes.join('\n\n'))}\n`;

  const summary = [
    `Title: ${title}`,
    `Author(s): ${authors.join(', ')}`,
    `Type: ${type}`,
    publisher && `Publisher: ${publisher}`,
    `Credit: ${who.consent ? who.name : '(none)'}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ok: true,
    kind: 'new',
    title,
    slug,
    path: `src/content/publications/${slug}.md`,
    content,
    summary,
    email: who.email,
  };
}

/** 6 random lowercase letters/digits for unique file names. */
export function randomId(bytes = crypto.getRandomValues(new Uint8Array(6))): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return [...bytes].map((b) => abc[b % abc.length]).join('');
}
