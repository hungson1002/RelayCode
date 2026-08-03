const SEARCH_ENDPOINT = 'https://www.bing.com/search';
const SEARCH_MAX_QUERY = 500;
const SEARCH_MAX_RESULTS = 8;
const SEARCH_MAX_BYTES = 2_000_000;
const SEARCH_MAX_TEXT = 24_000;
const SEARCH_TIMEOUT_MS = 15_000;

export const WEB_SEARCH_TOOL: Record<string, unknown> = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Tìm kiếm thông tin hiện tại trên Internet và trả về các kết quả có tiêu đề, URL và tóm tắt. Dùng khi người dùng yêu cầu tìm trên mạng, tra cứu hoặc cần thông tin mới; không dùng để tìm file trong workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Từ khóa tìm kiếm ngắn, cụ thể' },
        maxResults: { type: 'integer', minimum: 1, maximum: SEARCH_MAX_RESULTS, description: 'Số kết quả muốn nhận, mặc định 6' }
      },
      required: ['query'],
      additionalProperties: false
    }
  }
};

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

export function compactDomain(value: string): string {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
    return hostname.length > 34 ? `${hostname.slice(0, 31)}…` : hostname;
  } catch {
    return 'web';
  }
}

function safeCitationTitle(value: string): string {
  return value.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) || compactDomain(value);
}

export function formatWebSearchContext(response: WebSearchResponse): string {
  if (!response.results.length) return `Không tìm thấy kết quả web rõ ràng cho: ${response.query}`;
  return [
    `Search query: ${response.query}`,
    'Source: Bing web results',
    '',
    ...response.results.map((result, index) => [
      `${index + 1}. ${result.title}`,
      `Domain: ${compactDomain(result.url)}`,
      `URL: ${result.url}`,
      result.snippet ? `Snippet: ${result.snippet}` : ''
    ].filter(Boolean).join('\n'))
  ].join('\n\n').slice(0, SEARCH_MAX_TEXT);
}

export function formatWebCitations(results: WebSearchResult[], maxResults = 6): string {
  const lines = results.slice(0, Math.max(1, maxResults)).map((result) =>
    `- [${compactDomain(result.url)}](${result.url}) — ${safeCitationTitle(result.title)}`
  );
  return lines.length ? `\n\n**Sources**\n${lines.join('\n')}` : '';
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (full, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#')) {
      const isHex = lower.startsWith('#x');
      const codePoint = Number.parseInt(lower.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : full;
    }
    return named[lower] ?? full;
  });
}

function cleanMarkup(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attribute(tag: string, name: string): string {
  const match = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match?.[2] ? decodeHtmlEntities(match[2]) : '';
}

function resultUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value, SEARCH_ENDPOINT);
    const duckDuckGoTarget = parsed.searchParams.get('uddg');
    let target = duckDuckGoTarget ? new URL(duckDuckGoTarget) : parsed;
    const bingTarget = target.hostname.endsWith('.bing.com') && target.pathname === '/ck/a'
      ? target.searchParams.get('u')
      : undefined;
    if (bingTarget?.startsWith('a1')) {
      try {
        target = new URL(Buffer.from(bingTarget.slice(2), 'base64url').toString('utf8'));
      } catch {
        return undefined;
      }
    }
    if (!['http:', 'https:'].includes(target.protocol)) return undefined;
    target.username = '';
    target.password = '';
    return target.toString();
  } catch {
    return undefined;
  }
}

export function parseWebSearchResults(html: string, maxResults = 6): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const bingBlocks = html.match(/<li\b[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][\s\S]*?<\/li>/gi) ?? [];
  for (const block of bingBlocks) {
    if (results.length >= Math.max(1, Math.min(SEARCH_MAX_RESULTS, maxResults))) break;
    const heading = /<h2\b[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(block);
    if (!heading) continue;
    const url = resultUrl(attribute(heading[1] ?? '', 'href'));
    const title = cleanMarkup(heading[2] ?? '');
    const caption = /<div\b[^>]*class=["'][^"']*\bb_caption\b[^"']*["'][\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    const snippet = cleanMarkup(caption?.[1] ?? '');
    if (url && title) results.push({ title, url, snippet });
  }
  if (results.length) return results;

  const anchors = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchors.exec(html)) && results.length < Math.max(1, Math.min(SEARCH_MAX_RESULTS, maxResults))) {
    const tag = match[1] ?? '';
    const classes = attribute(tag, 'class').split(/\s+/);
    if (!classes.includes('result__a')) continue;
    const url = resultUrl(attribute(tag, 'href'));
    const title = cleanMarkup(match[2] ?? '');
    if (!url || !title) continue;

    const rest = html.slice(anchors.lastIndex, anchors.lastIndex + 2_000);
    const snippetMatch = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(rest);
    const snippetTag = snippetMatch?.[1] ?? '';
    const snippet = attribute(snippetTag, 'class').split(/\s+/).includes('result__snippet')
      ? cleanMarkup(snippetMatch?.[2] ?? '')
      : '';
    results.push({ title, url, snippet });
  }
  return results;
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_QUERY);
}

function compactPreviousSearchQuery(value: string): string {
  const quoted = /["“”']([^"“”']{2,120})["“”']/.exec(value)?.[1];
  if (quoted) return normalizeQuery(quoted);
  return normalizeQuery(value)
    .replace(/^(?:xin\s+chào|chào|hello|hi)\b[^,!?]{0,80}[,!?]\s*/i, '')
    .replace(/^(?:bạn\s+)?(?:có\s+)?biết\s+/i, '')
    .replace(/\s+(?:không|ko|chứ|nào)\s*[?!.]*$/i, '')
    .trim();
}

export function shouldSearchWeb(prompt: string): boolean {
  return /(?:tìm(?:\s+kiếm)?|tra\s+cứu|search|look\s+up|find|google|bing)\s+(?:trên\s+(?:mạng|web|internet)|online|the\s+web)|\b(?:trên\s+mạng|trên\s+web|trên\s+internet|online|internet search|web search)\b|\b(?:latest|current|recent|today(?:'s)?)\s+(?:news|information|status|version|release|price|pricing|events?)\b/i.test(prompt);
}

export function buildWebSearchQuery(prompt: string, previousUserPrompt = ''): string | undefined {
  if (!shouldSearchWeb(prompt)) return undefined;
  const current = normalizeQuery(prompt);
  const previous = normalizeQuery(previousUserPrompt);
  const isBareSearchRequest = /^(?:hãy\s+)?(?:tìm(?:\s+kiếm)?|tra\s+cứu|search|look\s+up|find|google|bing)\s+(?:trên\s+(?:mạng|web|internet)|online|the\s+web)(?:\s+(?:đi|giúp(?:\s+mình)?|cho\s+(?:mình|tôi)|nhé|bạn))*[.!?]*$/i.test(current);
  const previousTopic = previous ? compactPreviousSearchQuery(previous) : '';
  return (isBareSearchRequest && previousTopic ? previousTopic : current).slice(0, SEARCH_MAX_QUERY);
}

export async function searchWebSources(query: string, signal?: AbortSignal, maxResults = 6): Promise<WebSearchResponse> {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) throw new Error('Web search cần có từ khóa tìm kiếm.');

  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error('Web search timeout after 15 seconds.')), SEARCH_TIMEOUT_MS);
  try {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set('q', normalizedQuery);
    url.searchParams.set('kl', 'wt-wt');
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html',
        'user-agent': 'RelayCode/1.0 (+web search)'
      }
    });
    if (!response.ok) throw new Error(`Web search trả HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > SEARCH_MAX_BYTES) throw new Error('Phản hồi web search lớn hơn giới hạn 2 MB.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > SEARCH_MAX_BYTES) throw new Error('Phản hồi web search lớn hơn giới hạn 2 MB.');
    const results = parseWebSearchResults(new TextDecoder().decode(bytes), maxResults);
    return { query: normalizedQuery, results };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function searchWeb(query: string, signal?: AbortSignal, maxResults = 6): Promise<string> {
  return formatWebSearchContext(await searchWebSources(query, signal, maxResults));
}
