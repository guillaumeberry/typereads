import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { clean, escapeHtml, parseSubmission, randomId, slugify } from './submission';

const form = (o: Record<string, string | string[]>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) [v].flat().forEach((x) => p.append(k, x));
  return p;
};
const opts = { id: 'abc123', today: '2026-11-18' };
const valid = {
  title: 'New East Asian Type',
  authors: 'Peter Biľak, Shoko Mugikura',
  type: 'book',
};
const frontMatter = (content: string) => parse(content.split('---\n')[1]);

describe('slugify', () => {
  it('makes ASCII kebab-case', () => {
    expect(slugify('Über Schrift: 2nd ed.')).toBe('uber-schrift-2nd-ed');
    expect(slugify('Typography: When, Who, How')).toBe('typography-when-who-how');
  });
  it('is empty for non-Latin titles (the caller falls back)', () => {
    expect(slugify('新しい書体')).toBe('');
  });
  it('caps the length without a trailing hyphen', () => {
    const s = slugify('a '.repeat(80));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('clean', () => {
  it('drops control characters and collapses spaces', () => {
    expect(clean('  a\u0000b \t c\nd ')).toBe('a b c d');
  });
  it('keeps paragraph breaks when multiline', () => {
    expect(clean('one\r\n\r\n\r\n\r\ntwo\u0007', true)).toBe('one\n\ntwo');
  });
});

describe('parseSubmission: new publication', () => {
  it('builds a submitted entry with safe YAML', () => {
    const r = parseSubmission(form({ ...valid, publisher: 'Typotheque' }), opts);
    expect(r.ok).toBe(true);
    if (!r.ok || r.kind !== 'new') return;
    expect(r.path).toBe('src/content/publications/new-east-asian-type-abc123.md');
    const d = frontMatter(r.content);
    expect(d).toEqual({
      title: 'New East Asian Type',
      slug: 'new-east-asian-type-abc123',
      status: 'submitted',
      type: 'book',
      authors: ['Peter Biľak', 'Shoko Mugikura'],
      publishers: ['Typotheque'],
      addedAt: '2026-11-18',
    });
  });

  it('reports every missing required field', () => {
    const r = parseSubmission(form({}), opts);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['authors', 'title', 'type']);
  });

  it('rejects unknown types', () => {
    const r = parseSubmission(form({ ...valid, type: 'zine' }), opts);
    expect(!r.ok && Object.keys(r.errors)).toEqual(['type']);
  });

  it('ignores fields the form no longer has', () => {
    const r = parseSubmission(
      form({ ...valid, link: 'javascript:alert(1)', year: '1200', scripts: 'Klingon' }),
      opts,
    );
    if (!r.ok || r.kind !== 'new') throw new Error('expected ok');
    const d = frontMatter(r.content);
    expect(d.links).toBeUndefined();
    expect(d.year).toBeUndefined();
    expect(d.scripts).toBeUndefined();
  });

  it('rejects oversized fields', () => {
    const r = parseSubmission(form({ ...valid, publisher: 'x'.repeat(201) }), opts);
    expect(!r.ok && r.errors.publisher).toMatch(/under 200/);
  });

  it('cannot inject YAML keys or front matter', () => {
    const title = 'Evil\nstatus: published\n---\n<script>alert(1)</script>';
    const r = parseSubmission(form({ ...valid, title, publisher: '---\nstatus: published' }), opts);
    if (!r.ok || r.kind !== 'new') throw new Error('expected ok');
    const d = frontMatter(r.content);
    expect(d.status).toBe('submitted');
    expect(d.title).toBe('Evil status: published --- <script>alert(1)</script>');
    // The body never carries raw HTML.
    expect(r.content.split('---\n').slice(2).join('---\n')).not.toMatch(/<script/);
  });

  it('never writes the email; credits only with consent', () => {
    const withConsent = parseSubmission(
      form({ ...valid, name: 'Ada', consent: 'yes', email: 'ada@example.com' }),
      opts,
    );
    if (!withConsent.ok || withConsent.kind !== 'new') throw new Error('expected ok');
    expect(withConsent.email).toBe('ada@example.com');
    expect(withConsent.content).not.toContain('ada@example.com');
    expect(frontMatter(withConsent.content).credit).toBe('Ada');

    const noConsent = parseSubmission(form({ ...valid, name: 'Ada' }), opts);
    expect(!noConsent.ok && noConsent.errors.consent).toBeTruthy();
  });

  it('keeps "other" out of the type field', () => {
    const other = parseSubmission(form({ ...valid, type: 'other' }), opts);
    if (!other.ok || other.kind !== 'new') throw new Error('expected ok');
    expect(frontMatter(other.content).type).toBeUndefined();
    expect(other.content).toContain('Type: Other.');
  });

  it('falls back to "submission" for non-Latin titles', () => {
    const r = parseSubmission(form({ ...valid, title: '新しい書体' }), opts);
    expect(r.ok && r.slug).toBe('submission-abc123');
  });
});

describe('parseSubmission: correction', () => {
  it('needs a valid slug and a change', () => {
    const r = parseSubmission(form({ mode: 'fix', fix: '../etc', change: '' }), opts);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['change', 'form']);
  });
  it('summarises the correction for the email', () => {
    const r = parseSubmission(
      form({ mode: 'fix', fix: 'primarium', pubtitle: 'Primarium', change: 'Year is 2019.' }),
      opts,
    );
    expect(r.ok && r.kind).toBe('fix');
    expect(r.ok && r.summary).toContain('https://typereads.xyz/publications/primarium');
  });
});

describe('helpers', () => {
  it('escapes HTML', () =>
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href="x"&gt;&amp;&lt;/a&gt;'));
  it('makes 6-character ids', () => expect(randomId()).toMatch(/^[a-z0-9]{6}$/));
});
