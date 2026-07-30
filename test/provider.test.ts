import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicClient } from '../src/anthropicClient';
import { createProvider } from '../src/provider';
import { RouterClient } from '../src/routerClient';

afterEach(() => vi.unstubAllGlobals());

describe('provider factory', () => {
  it('uses the native Anthropic client only for Anthropic', () => {
    expect(createProvider({ kind: 'anthropic', endpoint: 'https://api.anthropic.com/v1', apiKey: 'test' })).toBeInstanceOf(AnthropicClient);
    expect(createProvider({ kind: 'openai', endpoint: 'https://api.openai.com/v1', apiKey: 'test' })).toBeInstanceOf(RouterClient);
    expect(createProvider({ kind: 'cockpit', endpoint: 'http://127.0.0.1:1455/v1', apiKey: 'client-key' })).toBeInstanceOf(RouterClient);
  });

  it('turns a Cockpit 403 response into an actionable credential message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 })));
    const client = createProvider({ kind: 'cockpit', endpoint: 'http://127.0.0.1:1455/v1', apiKey: 'expired' });

    await expect(client.listModels()).rejects.toThrow(/Client Key|đăng nhập lại/);
  });

  it('creates an image through an OpenAI-compatible provider', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: png.toString('base64'), revised_prompt: 'A refined prompt' }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = createProvider({ kind: 'cockpit', endpoint: 'http://127.0.0.1:1455/v1', apiKey: 'client-key' });

    const result = await client.generateImage?.('image-model', 'A product photo', '1024x1024');

    expect(result).toMatchObject({ mimeType: 'image/png', revisedPrompt: 'A refined prompt' });
    expect([...result!.bytes]).toEqual([...png]);
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:1455/v1/images/generations', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"model":"image-model"')
    }));
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({ model: 'image-model', prompt: 'A product photo', size: '1024x1024' });
  });

  it('streams Agent tool arguments so the UI can show the current file before completion', async () => {
    const stream = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"write_file","arguments":"{\\\"path\\\":\\\"src/index."}}]}}]}',
      '',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"html\\\",\\\"content\\\":\\\"Hello\\\"}"}}]}}]}',
      '',
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":5},"choices":[]}',
      '',
      'data: [DONE]',
      ''
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })));
    const client = new RouterClient({ endpoint: 'http://127.0.0.1:20128/v1', apiKey: 'test-key' });
    const progress: Array<{ name?: string; arguments?: string }> = [];

    const result = await client.completeWithTools(
      'agent-model',
      [{ role: 'user', content: 'Create an HTML file.' }],
      [],
      undefined,
      (event) => progress.push(event)
    );

    expect(result.toolCalls).toEqual([{
      id: 'call-1',
      name: 'write_file',
      arguments: '{"path":"src/index.html","content":"Hello"}'
    }]);
    expect(result.metrics).toMatchObject({ inputTokens: 10, outputTokens: 5, estimated: false });
    expect(progress.some((event) => event.name === 'write_file' && event.arguments?.includes('src/index.'))).toBe(true);
  });

  it('finishes an Agent turn at finish_reason even when the gateway sends no done marker and keeps the socket open', async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode([
          'data: {"choices":[{"delta":{"content":"Done."}}]}',
          '',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2}}',
          '',
          ''
        ].join('\n')));
      },
      cancel: cancelled
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })));
    const client = new RouterClient({ endpoint: 'http://127.0.0.1:20128/v1', apiKey: 'test-key' });

    const result = await client.completeWithTools(
      'agent-model',
      [{ role: 'user', content: 'Say done.' }],
      []
    );

    expect(result.content).toBe('Done.');
    expect(result.toolCalls).toEqual([]);
    expect(result.metrics).toMatchObject({ inputTokens: 4, outputTokens: 2, estimated: false });
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('checks agentic models with a tool request instead of a one-token chat ping', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { tool_calls: [{ id: 'call-1', function: { name: 'read_file', arguments: '{"path":"package.json"}' } }] } }],
      usage: { prompt_tokens: 8, completion_tokens: 4 }
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new RouterClient({ endpoint: 'http://127.0.0.1:20128/v1', apiKey: 'test-key' });

    await client.checkModel('ag/claude-sonnet-4-6');

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.max_tokens).toBeUndefined();
    expect(body.tools[0].function.name).toBe('read_file');
    expect(body.tool_choice).toBe('auto');
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

  it('groups every tool result into the user message immediately after tool use', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Done.' }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new AnthropicClient({ endpoint: 'https://api.anthropic.com/v1', apiKey: 'test-key' });

    await client.completeWithTools('claude-test', [
      { role: 'user', content: 'Inspect the workspace.' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'tool-a', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } },
          { id: 'tool-b', type: 'function', function: { name: 'read_file', arguments: '{"path":"b.ts"}' } }
        ]
      },
      { role: 'tool', tool_call_id: 'tool-a', content: 'A' },
      { role: 'tool', tool_call_id: 'tool-b', content: 'B' },
      { role: 'user', content: 'Continue without restarting.' }
    ], []);

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.messages).toHaveLength(3);
    expect(body.messages[1]).toMatchObject({ role: 'assistant' });
    expect(body.messages[2].role).toBe('user');
    expect(body.messages[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'tool-a', content: 'A' },
      { type: 'tool_result', tool_use_id: 'tool-b', content: 'B' },
      { type: 'text', text: 'Continue without restarting.' }
    ]);
  });

  it('repairs an interrupted Anthropic history with a missing tool result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Recovered.' }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new AnthropicClient({ endpoint: 'https://api.anthropic.com/v1', apiKey: 'test-key' });

    await client.completeWithTools('claude-test', [
      { role: 'user', content: 'Make changes.' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'tool-a', type: 'function', function: { name: 'write_file', arguments: '{"path":"a.ts"}' } },
          { id: 'tool-b', type: 'function', function: { name: 'run_tests', arguments: '{}' } }
        ]
      },
      { role: 'tool', tool_call_id: 'tool-a', content: 'ERROR: disk busy' },
      { role: 'user', content: 'Correct the failure.' }
    ], []);

    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body.messages[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'tool-a', content: 'ERROR: disk busy', is_error: true },
      expect.objectContaining({ type: 'tool_result', tool_use_id: 'tool-b', is_error: true }),
      { type: 'text', text: 'Correct the failure.' }
    ]);
  });
});
