// Colour helpers for publication backgrounds.

const FALLBACK = '#3a3a3a';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** The publication colour, or a neutral fallback when none is set. */
export const bgColor = (color?: string) => color ?? FALLBACK;

/** Black or white text, whichever contrasts more with the background. */
export function textColorFor(bg: string): '#ffffff' | '#141414' {
  const l = luminance(bg);
  return contrast(l, 1) >= contrast(l, luminance('#141414')) ? '#ffffff' : '#141414';
}
