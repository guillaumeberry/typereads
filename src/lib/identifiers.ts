// Checksums for book and serial identifiers. Used by the content schema.

/** ISBN-10 or ISBN-13 (978/979), digits only (X allowed as the last ISBN-10 digit). */
export function isValidIsbn(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  if (/^97[89]\d{10}$/.test(s)) {
    const sum = [...s].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((acc, d, i) => acc + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

/** ISSN in the form 1234-567X, with its mod-11 check digit. */
export function isValidIssn(raw: string): boolean {
  const m = /^(\d{4})-(\d{3})([\dX])$/.exec(raw.trim().toUpperCase());
  if (!m) return false;
  const digits = (m[1]! + m[2]!).split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (8 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return m[3] === (check === 10 ? 'X' : String(check));
}

/** A magazine's EAN-13 barcode (977…) encodes its ISSN: digits 4–10 plus a check digit. */
export function issnFromEan(ean: string): string | null {
  if (!/^977\d{10}$/.test(ean)) return null;
  const d = ean.slice(3, 10);
  const sum = [...d].reduce((acc, x, i) => acc + Number(x) * (8 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return `${d.slice(0, 4)}-${d.slice(4)}${check === 10 ? 'X' : check}`;
}
