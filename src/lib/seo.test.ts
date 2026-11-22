import { describe, expect, it } from 'vitest';
import { authorsText, plainText, publicationTitle, summarize } from './seo';

describe('plainText', () => {
  it('keeps link text and drops Markdown syntax', () => {
    expect(plainText('A **bold** [link](https://a.com) and `code`\n\n- item')).toBe(
      'A bold link and code item',
    );
  });
  it('drops images and HTML tags', () => {
    expect(plainText('![cover](x.png) Hello <em>there</em>')).toBe('Hello there');
  });
});

describe('summarize', () => {
  it('keeps short text as is', () => {
    expect(summarize('Short text.', 155)).toBe('Short text.');
  });
  it('cuts at a whole word and adds an ellipsis', () => {
    const out = summarize('With carefully selected type specimens and striking layouts', 40);
    expect(out).toBe('With carefully selected type specimens…');
    expect(out.length).toBeLessThanOrEqual(40);
  });
  it('drops trailing punctuation before the ellipsis', () => {
    expect(summarize('One two three, four five six seven', 16)).toBe('One two three…');
  });
});

describe('titles', () => {
  it('names one, two or many authors', () => {
    expect(authorsText(['A'])).toBe('A');
    expect(authorsText(['A', 'B'])).toBe('A and B');
    expect(authorsText(['A', 'B', 'C'])).toBe('A et al.');
  });
  it('builds "Title by Author"', () => {
    expect(publicationTitle('Fine Specimens', ['Elliot Jay Stocks'])).toBe(
      'Fine Specimens by Elliot Jay Stocks',
    );
    expect(publicationTitle('Anonymous', [])).toBe('Anonymous');
  });
});
