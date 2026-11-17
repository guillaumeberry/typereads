// Content schema: the build's safety net. Mirrors docs/03-content-model.md and must stay in
// sync with the CMS config (public/admin/config.yml, Phase 5). Invalid data fails the build,
// so the previous deploy stays live.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { AVAILABILITY, FORMATS, SCRIPTS, STATUSES, TYPES, keysOf } from './data/taxonomies';
import { isValidIsbn, isValidIssn } from './lib/identifiers';

/**
 * Enrichment switch. The 50 imported entries don't have languages and scripts yet (Phase 1
 * enrichment). While false, those lists may be empty; set it to true once every entry is
 * filled in, so a missing value fails the build again.
 */
const REQUIRE_ENRICHMENT = false;

/** The CMS saves empty optional fields as '' or null: treat both as "not set". */
const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());

const url = z.url({ protocol: /^https?$/ });
const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase ASCII letters, digits and hyphens');
const language = z.string().regex(/^[a-z]{2}$/, 'ISO 639-1 code, e.g. "en"');
const listOf = <T extends z.ZodType>(item: T, required: boolean) =>
  z.preprocess((v) => blank(v) ?? [], required ? z.array(item).min(1) : z.array(item));

const publications = defineCollection({
  loader: glob({ base: './src/content/publications', pattern: '*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      subtitle: opt(z.string()),
      slug,
      status: z.enum(STATUSES),
      type: z.enum(keysOf(TYPES)),
      authors: z.array(z.string().min(1)).min(1),
      publishers: listOf(z.string().min(1), false),
      formats: z.array(z.enum(keysOf(FORMATS))).min(1),
      languages: listOf(language, REQUIRE_ENRICHMENT),
      translations: listOf(
        z.object({
          language,
          title: opt(z.string()),
          publisher: opt(z.string()),
          year: opt(z.number().int()),
          link: opt(url),
        }),
        false,
      ),
      scripts: listOf(z.enum(keysOf(SCRIPTS)), REQUIRE_ENRICHMENT),
      year: z.number().int().min(1450).max(2100),
      date: opt(z.coerce.date()),
      availability: z.preprocess((v) => blank(v) ?? 'unknown', z.enum(keysOf(AVAILABILITY))),
      isbn: opt(
        z
          .string()
          .refine(isValidIsbn, 'Not a valid ISBN-10/13 (digits only; 977… is an ISSN barcode)'),
      ),
      issn: opt(z.string().refine(isValidIssn, 'Not a valid ISSN (1234-567X with check digit)')),
      pages: opt(z.number().int().positive()),
      links: opt(
        z.object({
          publisher: opt(url),
          buy: opt(url),
          read: opt(url),
        }),
      ),
      // Local file next to the entry (optimised at build), or, until covers are downloaded,
      // a remote URL.
      cover: opt(z.union([url, image()])),
      color: opt(z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Hex colour like #1a2b3c')),
      addedAt: z.coerce.date(),
      credit: opt(z.string()),
    }),
});

export const collections = { publications };
