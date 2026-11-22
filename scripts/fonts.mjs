// Puts the licensed HEX Franklin web fonts in public/fonts/ before dev/build.
// The files are commercial (HEX Projects) and must never be committed to this
// public repo, so they come from one of two places:
//   1. FONTS_BASE_URL (+ FONTS_TOKEN): the private repo guillaumeberry/typereads-fonts,
//      read through the GitHub API, e.g.
//      FONTS_BASE_URL=https://api.github.com/repos/guillaumeberry/typereads-fonts/contents
//      FONTS_TOKEN=<fine-grained token, Contents: read-only on that repo>
//      (set as build variables in Cloudflare). Any other private URL works too.
//   2. assets/fonts/ on your machine (gitignored), when FONTS_BASE_URL isn't set.
// If neither is available the site falls back to Archivo, unless FONTS_REQUIRED=1:
// then the build fails, so production never silently ships without its typeface
// (a failed deploy leaves the previous version live).
import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';

const FILES = {
  'hex-franklin-regular.woff2': 'HEX_Franklin_v0.4-Regular.woff2',
  'hex-franklin-bold.woff2': 'HEX_Franklin_v0.4-Bold.woff2',
};
// Optional: used for large titles. If it's missing, those titles fall back to Regular
// (the build still passes), so add it to the private fonts repo too.
const OPTIONAL = {
  'hex-franklin-light.woff2': 'HEX_Franklin_v0.4-Light.woff2',
};
const OUT = new URL('../public/fonts/', import.meta.url);
const LOCAL = new URL('../assets/fonts/', import.meta.url);
const { FONTS_BASE_URL: base, FONTS_TOKEN: token, FONTS_REQUIRED: required } = process.env;
const exists = (u) =>
  access(u).then(
    () => true,
    () => false,
  );

async function download(name) {
  const url = `${base.replace(/\/$/, '')}/${encodeURIComponent(name)}`;
  const headers = { 'User-Agent': 'typereads-build' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // The GitHub contents API returns the raw file with this media type.
  if (url.startsWith('https://api.github.com/')) {
    headers.Accept = 'application/vnd.github.raw+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // A WOFF2 file starts with "wOF2"; anything else (an HTML error page) is rejected.
  if (buf.subarray(0, 4).toString('latin1') !== 'wOF2')
    throw new Error(`${name}: not a WOFF2 file`);
  return buf;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
let source = 'none';
try {
  for (const [out, name] of Object.entries(FILES)) {
    const dest = new URL(out, OUT);
    if (base) {
      await writeFile(dest, await download(name));
      source = 'FONTS_BASE_URL';
    } else if (await exists(new URL(name, LOCAL))) {
      await copyFile(new URL(name, LOCAL), dest);
      source = 'assets/fonts';
    }
  }
} catch (err) {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  source = 'none';
  console.warn(`[fonts] ${err.message}`);
}

if (source !== 'none') {
  for (const [out, name] of Object.entries(OPTIONAL)) {
    const dest = new URL(out, OUT);
    try {
      if (base) await writeFile(dest, await download(name));
      else if (await exists(new URL(name, LOCAL))) await copyFile(new URL(name, LOCAL), dest);
      else throw new Error(`${name}: not in assets/fonts/`);
    } catch (err) {
      console.warn(`[fonts] optional ${err.message}`);
    }
  }
}

console.log(`[fonts] HEX Franklin source: ${source}`);
if (source === 'none' && required === '1') {
  console.error('[fonts] FONTS_REQUIRED=1 but HEX Franklin is unavailable: failing the build.');
  process.exit(1);
}
