// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Live URL: canonical links, sitemap, Open Graph and JSON-LD use it. The custom
  // domain is attached to the Worker in wrangler.jsonc (workers.dev still works).
  site: 'https://typereads.xyz',
  // Clean URLs without a trailing slash: /about, /publications/<slug>
  // (Cloudflare serves about.html at /about).
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
});
