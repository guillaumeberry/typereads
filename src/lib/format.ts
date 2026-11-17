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

/** "September 23, 2023" when the full date is known, otherwise the year. */
export const dateLabel = (year: number, date?: Date) =>
  date
    ? date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : String(year);
