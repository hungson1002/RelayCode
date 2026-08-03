import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildWebSearchQuery, compactDomain, formatWebCitations, parseWebSearchResults, searchWeb, shouldSearchWeb } from '../src/webSearch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('web search', () => {
  it('recognizes explicit web-search intent and carries a previous question forward', () => {
    expect(shouldSearchWeb('tìm trên mạng đi bạn')).toBe(true);
    expect(buildWebSearchQuery('tìm trên mạng đi bạn', 'Bạn biết 9router không')).toBe('9router');
    expect(buildWebSearchQuery('tìm kiếm trên web đi bạn', 'Bạn biết 9router không')).toBe('9router');
    expect(buildWebSearchQuery('tìm kiếm trên web đi bạn', 'Chào bạn nhé, bạn có biết 9Router không')).toBe('9Router');
    expect(buildWebSearchQuery('Explain this project')).toBeUndefined();
    expect(shouldSearchWeb('Review the current changes')).toBe(false);
  });

  it('parses result links, redirect URLs and snippets', () => {
    const html = [
      '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdocs&amp;rut=x">Docs &amp; Guide</a>',
      '<a class="result__snippet" href="https://example.com/docs">Install the SDK &amp; read the guide.</a>'
    ].join('');
    expect(parseWebSearchResults(html)).toEqual([{
      title: 'Docs & Guide',
      url: 'https://example.com/docs',
      snippet: 'Install the SDK & read the guide.'
    }]);
  });

  it('parses Bing result cards and decodes Bing redirect URLs', () => {
    const encodedUrl = Buffer.from('https://github.com/hungson1002/RelayCode').toString('base64url');
    const html = `<li class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=a1${encodedUrl}">RelayCode</a></h2><div class="b_caption"><p>AI coding workspace</p></div></li>`;
    expect(parseWebSearchResults(html)).toEqual([{
      title: 'RelayCode',
      url: 'https://github.com/hungson1002/RelayCode',
      snippet: 'AI coding workspace'
    }]);
  });

  it('returns bounded search context to the Agent', async () => {
    const fetchMock = vi.fn(async (_input: URL | string) => new Response(
      '<a class="result__a" href="https://example.com/docs">Docs</a><a class="result__snippet">Useful result</a>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
    ));
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchWeb('9router');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('https://www.bing.com/search?q=9router');
    expect(result).toContain('Search query: 9router');
    expect(result).toContain('Source: Bing web results');
    expect(result).toContain('URL: https://example.com/docs');
    expect(result).toContain('Snippet: Useful result');
  });

  it('keeps citation labels compact while preserving the full link target', () => {
    expect(compactDomain('https://www.example.com/docs?a=1')).toBe('example.com');
    expect(formatWebCitations([{ title: 'RelayCode docs', url: 'https://github.com/hungson1002/RelayCode/releases?tab=tags', snippet: '' }]))
      .toContain('- [github.com](https://github.com/hungson1002/RelayCode/releases?tab=tags) — RelayCode docs');
  });
});
