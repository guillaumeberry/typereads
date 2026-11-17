// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Live URL (Cloudflare Workers static assets). Change when a custom domain is added.
  site: 'https://typereads.guillaume-berry.workers.dev',
  // Clean URLs without a trailing slash: /about, /publications/<slug>
  // (Cloudflare serves about.html at /about).
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
});
