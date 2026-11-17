// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Live URL (Cloudflare Workers static assets). Change when a custom domain is added.
  site: 'https://typereads.guillaume-berry.workers.dev',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
});
