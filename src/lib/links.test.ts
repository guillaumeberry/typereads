import { describe, expect, it } from 'vitest';
import { externalLinksInNewWindow, isExternal } from './links';

describe('isExternal', () => {
  it('is true for other sites', () => {
    expect(isExternal('https://hex.xyz/')).toBe(true);
    expect(isExternal('http://example.com/a?b=1')).toBe(true);
  });
  it('is false for this site, relative links, mailto and anchors', () => {
    expect(isExternal('https://typereads.xyz/about')).toBe(false);
    expect(isExternal('https://www.typereads.xyz/')).toBe(false);
    expect(isExternal('/publications/x')).toBe(false);
    expect(isExternal('mailto:hi@example.com')).toBe(false);
    expect(isExternal('#faq')).toBe(false);
  });
});

describe('externalLinksInNewWindow', () => {
  it('adds target and rel to external links only', () => {
    const html =
      '<p><a href="https://hex.xyz/">HEX</a> and <a href="/about">about</a> and <a href="mailto:a@b.c">mail</a></p>';
    expect(externalLinksInNewWindow(html)).toBe(
      '<p><a href="https://hex.xyz/" target="_blank" rel="noopener">HEX</a> and <a href="/about">about</a> and <a href="mailto:a@b.c">mail</a></p>',
    );
  });
  it('keeps an existing target', () => {
    const html = '<a href="https://hex.xyz/" target="_self">HEX</a>';
    expect(externalLinksInNewWindow(html)).toBe(html);
  });
  it('handles other attributes and single quotes', () => {
    expect(externalLinksInNewWindow(`<a class="x" href='https://a.com'>a</a>`)).toBe(
      `<a class="x" href='https://a.com' target="_blank" rel="noopener">a</a>`,
    );
  });
});
