import { afterEach, describe, expect, it, vi } from 'vitest';
import { compatibleTextContent, normalizeEndpoint, parseSseData, requestMetrics, RouterClient, tuningBody } from '../src/routerClient';

afterEach(() => vi.unstubAllGlobals());

describe('normalizeEndpoint', () => {
  it('removes trailing slashes', () => {
    expect(normalizeEndpoint(' http://localhost:20128/v1/// ')).toBe('http://localhost:20128/v1');
  });

  it('rejects non-http protocols', () => {
    expect(() => normalizeEndpoint('file:///tmp/router')).toThrow(/http/);
  });
});

describe('parseSseData', () => {
  it('reads every data line and ignores comments', () => {
    expect(parseSseData(': keepalive\ndata: {"ok":true}\ndata: [DONE]')).toEqual([
      '{"ok":true}',
      '[DONE]'
    ]);
  });

  it('reads a final event without a blank terminator', () => {
    expect(parseSseData('data: {"choices":[]}')).toEqual(['{"choices":[]}']);
  });
});

describe('requestMetrics', () => {
  it('reads standard and common compatible-provider rate-limit headers', () => {
    const metrics = requestMetrics(Date.now(), new Headers({
      'ratelimit-limit': '100',
      'ratelimit-remaining': '73',
      'x-ratelimit-reset-tokens': '45s'
    }), 10, 5, false);

    expect(metrics.rateLimit).toEqual({
      requestsLimit: '100',
      requestsRemaining: '73',
      tokensLimit: undefined,
      tokensRemaining: undefined,
      reset: '45s'
    });
  });
});

describe('compatibleTextContent', () => {
  it('reads string and array content used by OpenAI-compatible providers', () => {
    expect(compatibleTextContent('Xin chào')).toBe('Xin chào');
    expect(compatibleTextContent([{ type: 'text', text: 'Xin ' }, { content: 'chào' }])).toBe('Xin chào');
  });

  it('ignores unsupported metadata-only content', () => {
    expect(compatibleTextContent([{ type: 'reasoning', value: 'hidden' }, null])).toBe('');
    expect(compatibleTextContent(undefined)).toBe('');
  });
});

describe('RouterClient compatible chat responses', () => {
  it('accepts a complete JSON response from a provider that ignores stream mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: [{ type: 'text', text: 'Nội dung đầy đủ' }] } }]
    }), { headers: { 'content-type': 'application/json' } })));
    const chunks: string[] = [];
    await new RouterClient({ endpoint: 'http://localhost:20128/v1', apiKey: 'key' })
      .streamChat('model', [{ role: 'user', content: 'test' }], (delta) => chunks.push(delta));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe('Nội dung đầy đủ');
  });

  it('reads array content in SSE and rejects a successful but empty stream', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":[{"text":"Xin chào"}]}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }))
      .mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"  "}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })));
    const client = new RouterClient({ endpoint: 'http://localhost:20128/v1', apiKey: 'key' });
    const chunks: string[] = [];
    await client.streamChat('model', [{ role: 'user', content: 'test' }], (delta) => chunks.push(delta));
    expect(chunks).toEqual(['Xin chào']);
    await expect(client.streamChat('model', [{ role: 'user', content: 'test' }], () => undefined)).rejects.toThrow(/không trả về nội dung/);
  });
});

describe('RouterClient model checks', () => {
  it('uses the same plain chat probe as 9Router for prefixed models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'hi' } }]
    }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await new RouterClient({ endpoint: 'http://localhost:20128/v1', apiKey: 'key' })
      .checkModel('ag/claude-sonnet-4-6');

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      model: 'ag/claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 16,
      stream: false
    });
  });

  it('rejects HTTP 200 responses that do not contain completion choices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }))));
    await expect(new RouterClient({ endpoint: 'http://localhost:20128/v1', apiKey: 'key' })
      .checkModel('model')).rejects.toThrow(/no completion choices/i);
  });

  it('uses the current completion limit field for direct OpenAI reasoning models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'hi' } }]
    })));
    vi.stubGlobal('fetch', fetchMock);
    await new RouterClient({ endpoint: 'https://api.openai.com/v1', apiKey: 'key' }).checkModel('gpt-5');
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.max_completion_tokens).toBe(16);
    expect(body.max_tokens).toBeUndefined();
  });
});

describe('tuningBody', () => {
  it('maps Codex Fast and reasoning controls to OpenAI-compatible request fields', () => {
    expect(tuningBody({ reasoningEffort: 'high', serviceTier: 'fast' })).toEqual({
      reasoning_effort: 'high',
      service_tier: 'priority'
    });
  });

  it('does not send tuning fields when controls are unavailable', () => {
    expect(tuningBody()).toEqual({});
  });
});
