import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicClient } from '../src/anthropicClient';
import { createProvider } from '../src/provider';
import { RouterClient } from '../src/routerClient';

afterEach(() => vi.unstubAllGlobals());

describe('provider factory', () => {
  it('uses the native Anthropic client only for Anthropic', () => {
    expect(createProvider({ kind: 'anthropic', endpoint: 'https://api.anthropic.com/v1', apiKey: 'test' })).toBeInstanceOf(AnthropicClient);
    expect(createProvider({ kind: 'openai', endpoint: 'https://api.openai.com/v1', apiKey: 'test' })).toBeInstanceOf(RouterClient);
  });
});

describe('AnthropicClient', () => {
  it('uses Anthropic authentication and converts OpenAI tools', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [
        { type: 'text', text: 'Đang đọc file.' },
        { type: 'tool_use', id: 'tool-1', name: 'read_file', input: { path: 'src/a.ts' } }
      ]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new AnthropicClient({ endpoint: 'https://api.anthropic.com/v1', apiKey: 'anthropic-test-key' });

    const result = await client.completeWithTools('claude-test', [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: 'Read a file.' }
    ], [{ type: 'function', function: { name: 'read_file', description: 'Read', parameters: { type: 'object', properties: { path: { type: 'string' } } } } }]);

    expect(result).toMatchObject({ content: 'Đang đọc file.', toolCalls: [{ id: 'tool-1', name: 'read_file', arguments: '{"path":"src/a.ts"}' }] });
    expect(result.metrics).toMatchObject({ estimated: true, totalTokens: expect.any(Number) });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('x-api-key')).toBe('anthropic-test-key');
    expect(new Headers(init.headers).get('anthropic-version')).toBe('2023-06-01');
    const body = JSON.parse(String(init.body));
    expect(body.system).toBe('You are an agent.');
    expect(body.tools[0]).toMatchObject({ name: 'read_file', input_schema: { type: 'object' } });
  });
});
