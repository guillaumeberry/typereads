import { describe, expect, it } from 'vitest';
import { dateLabel, isoDate, monthKnown } from './format';

describe('publication dates', () => {
  it('shows the month and year, never the day', () => {
    expect(dateLabel(2022, new Date('2022-12-14'))).toBe('December 2022');
    expect(dateLabel(2023, new Date('2023-09-01'))).toBe('September 2023');
  });
  it('shows the year alone when there is no date', () => {
    expect(dateLabel(2022)).toBe('2022');
  });
  it('treats 1 January as "only the year is known"', () => {
    expect(monthKnown(new Date('2010-01-01'))).toBe(false);
    expect(dateLabel(2010, new Date('2010-01-01'))).toBe('2010');
    expect(dateLabel(2025, new Date('2025-01-17'))).toBe('January 2025');
  });
  it('gives JSON-LD the full date only when the month is known', () => {
    expect(isoDate(2022, new Date('2022-12-14'))).toBe('2022-12-14');
    expect(isoDate(2010, new Date('2010-01-01'))).toBe('2010');
    expect(isoDate(2010)).toBe('2010');
  });
});
