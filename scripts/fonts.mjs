// Puts the licensed HEX Franklin web fonts in public/fonts/ before dev/build.
// The files are commercial (HEX Projects) and must never be committed to this
// public repo, so they come from one of two places:
//   1. assets/fonts/ on your machine (gitignored), or
//   2. a private URL given at build time: FONTS_BASE_URL (+ optional FONTS_TOKEN,
//      sent as a Bearer token), e.g. a private bucket or repository.
// If neither is available, nothing is copied and the site falls back to Archivo.
import { copyFile, mkdir, writeFile, access } from 'node:fs/promises';

const FILES = {
  'hex-franklin-regular.woff2': 'HEX_Franklin_v0.4-Regular.woff2',
  'hex-franklin-bold.woff2': 'HEX_Franklin_v0.4-Bold.woff2',
};
const OUT = new URL('../public/fonts/', import.meta.url);
const LOCAL = new URL('../assets/fonts/', import.meta.url);
const exists = (u) =>
  access(u).then(
    () => true,
    () => false,
  );

await mkdir(OUT, { recursive: true });
let source = 'none';
for (const [out, name] of Object.entries(FILES)) {
  const dest = new URL(out, OUT);
  if (await exists(new URL(name, LOCAL))) {
    await copyFile(new URL(name, LOCAL), dest);
    source = 'assets/fonts';
  } else if (process.env.FONTS_BASE_URL) {
    const url = `${process.env.FONTS_BASE_URL.replace(/\/$/, '')}/${name}`;
    const headers = process.env.FONTS_TOKEN
      ? { Authorization: `Bearer ${process.env.FONTS_TOKEN}` }
      : {};
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[fonts] ${name}: HTTP ${res.status}; falling back to Archivo.`);
      continue;
    }
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    source = 'FONTS_BASE_URL';
  }
}
console.log(`[fonts] HEX Franklin source: ${source}`);
