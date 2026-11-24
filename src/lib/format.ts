// Display helpers: labels for taxonomy values, languages, dates.
import { AVAILABILITY, FORMATS, SCRIPTS, TYPES } from '../data/taxonomies';
import type { AvailabilityKey, FormatKey, ScriptKey, TypeKey } from '../data/taxonomies';

export const typeLabel = (t: TypeKey) => TYPES[t];
export const formatsLabel = (f: FormatKey[]) => f.map((x) => FORMATS[x]).join(' + ');
export const scriptLabel = (s: ScriptKey) => `${SCRIPTS[s].label} ${SCRIPTS[s].glyph}`;
export const availabilityLabel = (a: AvailabilityKey) =>
  a === 'unknown' ? undefined : AVAILABILITY[a];

/** A language's own name, e.g. fr → "Français", ko → "한국어". */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}

/**
 * Is the month known? The admin's date field always stores a full date, so
 * 1 January stands for "only the year is known" (the imported entries use it so).
 */
export const monthKnown = (date?: Date): date is Date =>
  !!date && !(date.getUTCMonth() === 0 && date.getUTCDate() === 1);

/** "December 2022" when the month is known, otherwise the year: "2022". No day. */
export const dateLabel = (year: number, date?: Date) =>
  monthKnown(date)
    ? date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : String(year);

/** For JSON-LD `datePublished`: the full date when the month is known, else the year. */
export const isoDate = (year: number, date?: Date) =>
  monthKnown(date) ? date.toISOString().slice(0, 10) : String(year);
