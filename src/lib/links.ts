// Links to other sites open in a new window, like the publisher links on a
// publication page. Used on HTML rendered from Markdown (the About page), whose
// links can't carry attributes; links to typereads.xyz stay in the tab.
const SITE_HOST = 'typereads.xyz';

export function isExternal(href: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const host = new URL(href).hostname;
    return host !== SITE_HOST && !host.endsWith(`.${SITE_HOST}`);
  } catch {
    return false;
  }
}

/** Adds target="_blank" rel="noopener" to every external <a href> without a target. */
export function externalLinksInNewWindow(html: string): string {
  return html.replace(/<a\s([^>]*)>/gi, (tag, attrs: string) => {
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const url = href?.[1] ?? href?.[2];
    if (!url || !isExternal(url.replace(/&amp;/g, '&')) || /\btarget\s*=/i.test(attrs)) return tag;
    return `<a ${attrs} target="_blank" rel="noopener">`;
  });
}
