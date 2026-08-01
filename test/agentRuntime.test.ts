import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join, resolve } from 'node:path';
import type { ProviderClient } from '../src/provider';
import type { AgentRunCheckpoint, RequestMetrics } from '../src/types';

vi.mock('vscode', () => ({
  workspace: {
    findFiles: vi.fn(async () => []),
    fs: {
      readFile: vi.fn(async () => new TextEncoder().encode('Reference instructions')),
      stat: vi.fn(async () => { throw new Error('missing'); }),
      readDirectory: vi.fn(async () => []),
      createDirectory: vi.fn(async () => undefined),
      writeFile: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined)
    }
  },
  FileType: { File: 1, Directory: 2 },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath }))
  }
}));

import {
  AgentRuntime,
  compactAgentFinalResponse,
  compactProgressCommentary,
  normalizeCompletedToolHistory
} from '../src/agentRuntime';

const WORKSPACE_ROOT = resolve('test-workspace');

const metrics: RequestMetrics = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  latencyMs: 1,
  estimated: true
};

function clientWithResponses(contents: string[]): ProviderClient {
  const completeWithTools = vi.fn(async () => ({
    content: contents.shift() ?? '',
    toolCalls: [],
    metrics
  }));
  return {
    listModels: vi.fn(),
    streamChat: vi.fn(),
    checkModel: vi.fn(),
    completeWithTools
  } as unknown as ProviderClient;
}

describe('AgentRuntime completion verification', () => {
  it('normalizes function-call turns for strict Gemini-compatible gateways', () => {
    const messages: Array<Record<string, unknown>> = [
      { role: 'system', content: 'System instructions' },
      { role: 'assistant', content: 'I will inspect it.' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call-a', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } },
          { id: 'call-b', type: 'function', function: { name: 'read_file', arguments: '{"path":"b.ts"}' } }
        ]
      },
      { role: 'tool', tool_call_id: 'call-a', content: 'A' }
    ];

    normalizeCompletedToolHistory(messages);

    const assistantIndex = messages.findIndex((message) => Array.isArray(message.tool_calls));
    expect(messages[assistantIndex - 1]?.role).toBe('user');
    expect(messages.slice(assistantIndex + 1, assistantIndex + 3)).toEqual([
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-a', content: 'A' }),
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-b', content: expect.stringContaining('interrupted run') })
    ]);
  });

  it('keeps project tool-call failures inside the Agent repair loop without asking to change model', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'bad-1', name: 'move_file', arguments: '{"from":"same.ts","to":"same.ts"}' }], metrics })
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'bad-2', name: 'move_file', arguments: '{"from":"same.ts","to":"same.ts"}' }], metrics })
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'bad-3', name: 'move_file', arguments: '{"from":"same.ts","to":"same.ts"}' }], metrics })
      .mockResolvedValueOnce({ content: 'Continued safely with Gemini.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const runtime = new AgentRuntime(
      client,
      WORKSPACE_ROOT,
      async () => true,
      () => undefined,
      false,
      [],
      { allow: [], deny: [] },
      undefined,
      '',
      [],
      undefined,
      [],
      undefined,
      true,
      { reasoningEffort: 'high', serviceTier: 'fast' }
    );

    const onToolFailure = vi.fn().mockResolvedValue({ action: 'change-model', model: 'antigravity/gemini-3.5-flash-low' });
    await runtime.run('Inspect the project', 'openai/gpt-5-codex', {
      onDelta: vi.fn(),
      onStatus: vi.fn(),
      onToolFailure
    });

    expect(completeWithTools).toHaveBeenCalledTimes(4);
    expect(completeWithTools.mock.calls[0]?.[0]).toBe('openai/gpt-5-codex');
    expect(completeWithTools.mock.calls[0]?.[5]).toEqual({ reasoningEffort: 'high', serviceTier: 'fast' });
    expect(completeWithTools.mock.calls.map((call) => call[0])).toEqual([
      'openai/gpt-5-codex',
      'openai/gpt-5-codex',
      'openai/gpt-5-codex',
      'openai/gpt-5-codex'
    ]);
    expect(completeWithTools.mock.calls[3]?.[5]).toEqual({ reasoningEffort: 'high', serviceTier: 'fast' });
    expect(onToolFailure).not.toHaveBeenCalled();
  });

  it('returns an unknown tool call to the model as a repairable error', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'unknown-1', name: 'made_up_tool', arguments: '{}' }], metrics })
      .mockResolvedValueOnce({ content: 'Recovered after the invalid tool.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(), streamChat: vi.fn(), checkModel: vi.fn(), completeWithTools
    } as unknown as ProviderClient;
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Inspect this workspace', 'agent-model', { onDelta: vi.fn(), onStatus: vi.fn() });

    const secondMessages = completeWithTools.mock.calls[1]?.[1] as Array<Record<string, unknown>>;
    expect(secondMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'tool', tool_call_id: 'unknown-1', content: expect.stringContaining('ERROR: Unknown tool') }),
      expect.objectContaining({ role: 'user', content: expect.stringContaining('issue a corrected tool call') })
    ]));
  });
  beforeEach(() => vi.clearAllMocks());

  it('does not report completion when a requested edit made no tool calls', async () => {
    const client = clientWithResponses(['Đã hoàn tất.', 'Đã xong.', 'Hoàn thành.']);
    const deltas: string[] = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await expect(runtime.run('Tạo file index.html', 'test-model', {
      onDelta: (delta) => deltas.push(delta),
      onStatus: vi.fn()
    })).rejects.toThrow('chưa tạo hoặc sửa file nào');

    expect(client.completeWithTools).toHaveBeenCalledTimes(3);
    expect(deltas).toEqual([]);
  });

  it('allows a read-only answer without a mutation', async () => {
    const client = clientWithResponses(['Project này dùng TypeScript.']);
    const deltas: string[] = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Giải thích project này', 'test-model', {
      onDelta: (delta) => deltas.push(delta),
      onStatus: vi.fn()
    });

    expect(deltas).toEqual(['Project này dùng TypeScript.']);
  });

  it('emits phase commentary separately from the final answer', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: 'I finished locating the relevant modules and found that the failing behavior is isolated to the transcript renderer. I will correct that path and verify it with the focused UI tests.',
        toolCalls: [{ id: 'inspect-1', name: 'made_up_tool', arguments: '{}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'The inspection is complete.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);
    const onCommentary = vi.fn();
    const onActivityComplete = vi.fn();
    const onDelta = vi.fn();

    await runtime.run('Inspect this workspace', 'test-model', {
      onDelta,
      onStatus: vi.fn(),
      onCommentary,
      onActivityComplete
    });

    expect(onCommentary).toHaveBeenCalledWith('I finished locating the relevant modules and found that the failing behavior is isolated to the transcript renderer. I will correct that path and verify it with the focused UI tests.');
    expect(onActivityComplete).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith('The inspection is complete.');
  });

  it('bounds verbose model narration and keeps the final outcome', () => {
    const verbose = `${'First analysis and repeated internal planning. '.repeat(90)}

Validation passed. The implementation is complete and the production build succeeds.

Mọi thứ đã được tối ưu hóa hoàn hảo. Tôi sẵn sàng hỗ trợ thêm nếu bạn cần chỉnh sửa tính năng nào khác!`;

    const commentary = compactProgressCommentary(verbose);
    const finalAnswer = compactAgentFinalResponse(verbose);

    expect(commentary.length).toBeLessThanOrEqual(621);
    expect(finalAnswer.length).toBeLessThanOrEqual(1_400);
    expect(finalAnswer).toContain('Validation passed');
    expect(finalAnswer).not.toContain('Tôi sẵn sàng hỗ trợ thêm');
  });

  it('suppresses short routine narration between tool calls', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: 'Run the build now.',
        toolCalls: [{ id: 'routine-1', name: 'made_up_tool', arguments: '{}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Finished.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);
    const onCommentary = vi.fn();

    await runtime.run('Inspect this workspace', 'test-model', {
      onDelta: vi.fn(),
      onStatus: vi.fn(),
      onCommentary
    });

    expect(onCommentary).not.toHaveBeenCalled();
  });

  it('throttles routine progress paragraphs but immediately reports a real error', async () => {
    const first = 'I have mapped the current implementation and isolated the relevant rendering path. I will now update the shared state flow and verify the result through the existing UI tests.';
    const routine = 'The state flow is now updated and the routine inspection found the expected components in place. I will continue through the remaining verification commands before drawing a conclusion.';
    const error = 'The implementation is in place, but the build failed because one imported module cannot be resolved. I will correct that import and run the build again.';
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({ content: first, toolCalls: [{ id: 'phase-1', name: 'made_up_tool', arguments: '{}' }], metrics })
      .mockResolvedValueOnce({ content: routine, toolCalls: [{ id: 'phase-2', name: 'made_up_tool', arguments: '{}' }], metrics })
      .mockResolvedValueOnce({ content: error, toolCalls: [{ id: 'phase-3', name: 'made_up_tool', arguments: '{}' }], metrics })
      .mockResolvedValueOnce({ content: 'Finished after repairing the import.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);
    const onCommentary = vi.fn();

    await runtime.run('Inspect this workspace', 'test-model', {
      onDelta: vi.fn(),
      onStatus: vi.fn(),
      onCommentary
    });

    expect(onCommentary.mock.calls.map(([content]) => content)).toEqual([first, error]);
  });

  it('lets an active skill read its referenced files without exposing other paths', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'skill-call', name: 'read_skill_file', arguments: '{"skill":"frontend-design","path":"references/layout.md"}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Đã áp dụng tài nguyên skill.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const runtime = new AgentRuntime(
      client,
      WORKSPACE_ROOT,
      async () => true,
      () => undefined,
      false,
      [],
      { allow: [], deny: [] },
      undefined,
      '',
      [],
      undefined,
      [{ name: 'frontend-design', path: 'C:\\skills\\frontend-design\\SKILL.md' }]
    );

    const statuses: string[] = [];
    await runtime.run('Đọc tài nguyên skill', 'test-model', { onDelta: vi.fn(), onStatus: (status) => statuses.push(status) });

    expect(completeWithTools).toHaveBeenCalledTimes(2);
    expect(statuses).toContain('Đang đọc tài nguyên skill: frontend-design / references/layout.md');
    expect(statuses).toContain('Đang suy nghĩ bước tiếp theo');
    expect(statuses.some((status) => status.includes('Agent đang xử lý bước'))).toBe(false);
    expect(completeWithTools.mock.calls[1]?.[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'tool', content: 'Reference instructions' })
    ]));
  });

  it('generates an image as a reviewed Agent mutation', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{
          id: 'image-call',
          name: 'generate_image',
          arguments: '{"prompt":"A clean product hero","path":"assets/hero.png","model":"image-model","size":"1024x1024"}'
        }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Đã tạo ảnh.', toolCalls: [], metrics });
    const generated = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1]);
    const client = {
      listModels: vi.fn(async () => [{ id: 'image-model', name: 'Image Model', kind: 'image' }]),
      generateImage: vi.fn(async () => ({ bytes: generated, mimeType: 'image/png' })),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const changes: Array<{ path: string; added: number; removed: number }> = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, (change) => changes.push(change));

    await runtime.run('Tạo ảnh hero cho landing page', 'agent-model', { onDelta: vi.fn(), onStatus: vi.fn() });

    expect(client.generateImage).toHaveBeenCalledWith('image-model', 'A clean product hero', '1024x1024', undefined);
    expect(changes).toEqual([expect.objectContaining({ path: join(WORKSPACE_ROOT, 'assets', 'hero.png'), added: 1, removed: 1 })]);
    expect(vi.mocked((await import('vscode')).workspace.fs.writeFile)).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: join(WORKSPACE_ROOT, 'assets', 'hero.png') }),
      generated
    );
  });

  it('selects an image-capable model instead of sending the current Claude model to the image API', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{
          id: 'image-call',
          name: 'generate_image',
          arguments: '{"prompt":"A cute cat","path":"cute_cat.png"}'
        }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Đã tạo ảnh.', toolCalls: [], metrics });
    const generated = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1]);
    const client = {
      listModels: vi.fn(async () => [
        { id: 'ag/claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'ag/gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', kind: 'image' }
      ]),
      generateImage: vi.fn(async () => ({ bytes: generated, mimeType: 'image/png' })),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Tạo cho tôi ảnh mèo', 'ag/claude-sonnet-4-6', { onDelta: vi.fn(), onStatus: vi.fn() });

    expect(client.generateImage).toHaveBeenCalledWith(
      'ag/gemini-3.1-flash-image',
      'A cute cat',
      '1024x1024',
      undefined
    );
  });

  it('reports the exact file while streamed tool arguments are still arriving', async () => {
    const completeWithTools = vi.fn(async (
      _model: string,
      _messages: Array<Record<string, unknown>>,
      _tools: Array<Record<string, unknown>>,
      _signal?: AbortSignal,
      onProgress?: (event: { type: 'tool'; name: string; arguments: string } | { type: 'content' }) => void
    ) => {
      onProgress?.({ type: 'tool', name: 'write_file', arguments: '{"path":"src/landing.html","content":"' });
      onProgress?.({ type: 'content' });
      return { content: 'Đã tạo landing page.', toolCalls: [], metrics };
    });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const statuses: string[] = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Review cấu trúc dự án hiện tại', 'agent-model', {
      onDelta: vi.fn(),
      onStatus: (status) => statuses.push(status)
    });

    expect(statuses).toContain('Đang sửa file: src/landing.html');
    expect(statuses.slice(statuses.indexOf('Đang sửa file: src/landing.html') + 1)).not.toContain('Đang phân tích hướng thực hiện');
  });

  it('reads a linked webpage and returns clean text to the Agent', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'web-1', name: 'read_webpage', arguments: '{"url":"https://example.com/docs"}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'The documentation explains how to install the SDK.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(), streamChat: vi.fn(), checkModel: vi.fn(), completeWithTools
    } as unknown as ProviderClient;
    const fetchMock = vi.fn(async (_input: URL | string) => new Response(
      '<html><head><title>Docs &amp; Guide</title><style>.hidden{display:none}</style></head><body><main><h1>Quickstart</h1><p>Install the SDK.</p><script>bad()</script></main></body></html>',
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
    ));
    vi.stubGlobal('fetch', fetchMock);
    const statuses: string[] = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    try {
      await runtime.run('Read https://example.com/docs', 'agent-model', {
        onDelta: vi.fn(),
        onStatus: (status) => statuses.push(status)
      });
    } finally {
      vi.unstubAllGlobals();
    }

    const firstTools = completeWithTools.mock.calls[0]?.[2] as Array<{ function?: { name?: string } }>;
    const secondMessages = completeWithTools.mock.calls[1]?.[1] as Array<Record<string, unknown>>;
    const webpageResult = secondMessages.find((message) => message.role === 'tool' && message.tool_call_id === 'web-1');
    expect(firstTools.some((item) => item.function?.name === 'read_webpage')).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://example.com/docs');
    expect(webpageResult?.content).toContain('Title: Docs & Guide');
    expect(webpageResult?.content).toContain('Quickstart');
    expect(webpageResult?.content).toContain('Install the SDK.');
    expect(webpageResult?.content).not.toContain('bad()');
    expect(statuses).toContain('Đang đọc trang web: https://example.com/docs');
  });

  it('returns a failed tool to the Agent so it can issue a corrected call', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'write-1', name: 'write_file', arguments: '{"path":"index.html","content":"hello"}' }],
        metrics
      })
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'write-2', name: 'write_file', arguments: '{"path":"index.html","content":"hello"}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Đã tạo file.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const vscodeApi = await import('vscode');
    vi.mocked(vscodeApi.workspace.fs.writeFile)
      .mockRejectedValueOnce(new Error('disk busy'))
      .mockResolvedValueOnce(undefined);
    const failures: string[] = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Tạo file index.html', 'test-model', {
      onDelta: vi.fn(),
      onStatus: vi.fn(),
      onToolFailure: async (failure) => {
        failures.push(failure.message);
        return { action: 'retry' };
      }
    });

    expect(failures).toEqual([]);
    expect(vscodeApi.workspace.fs.writeFile).toHaveBeenCalledTimes(2);
    expect(completeWithTools).toHaveBeenCalledTimes(3);
    expect(completeWithTools.mock.calls[1]?.[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'tool', content: expect.stringContaining('disk busy') })
    ]));
  });

  it('closes every tool call when an earlier call fails in the same model turn', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'write-a', name: 'write_file', arguments: '{"path":"a.txt","content":"A"}' },
          { id: 'write-b', name: 'write_file', arguments: '{"path":"b.txt","content":"B"}' }
        ],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Recovered.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const vscodeApi = await import('vscode');
    vi.mocked(vscodeApi.workspace.fs.writeFile).mockRejectedValueOnce(new Error('disk busy'));
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Inspect both files.', 'test-model', {
      onDelta: vi.fn(),
      onStatus: vi.fn()
    });

    expect(vscodeApi.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
    const retryMessages = completeWithTools.mock.calls[1]?.[1] as Array<Record<string, unknown>>;
    expect(retryMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'tool', tool_call_id: 'write-a', content: expect.stringContaining('disk busy') }),
      expect.objectContaining({ role: 'tool', tool_call_id: 'write-b', content: expect.stringContaining('skipped write_file') })
    ]));
  });

  it('resumes with a different model at the next unfinished tool without rerunning a successful tool', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'write-a', name: 'write_file', arguments: '{"path":"a.txt","content":"A"}' },
          { id: 'write-b', name: 'write_file', arguments: '{"path":"b.txt","content":"B"}' }
        ],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Đã hoàn thành cả hai file.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const vscodeApi = await import('vscode');
    vi.mocked(vscodeApi.workspace.fs.writeFile).mockResolvedValue(undefined);
    let saved: AgentRunCheckpoint | undefined;
    const firstRuntime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await expect(firstRuntime.run('Tạo a.txt và b.txt', 'test-model', {
      onDelta: vi.fn(),
      onStatus: vi.fn(),
      onCheckpoint: (checkpoint) => {
        saved = structuredClone(checkpoint);
        if (checkpoint.pendingToolCalls.length === 2 && checkpoint.nextToolIndex === 1) {
          throw new Error('simulate reload');
        }
      }
    })).rejects.toThrow('simulate reload');

    expect(saved?.nextToolIndex).toBe(1);
    const resumedRuntime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);
    await resumedRuntime.run('Tạo a.txt và b.txt', 'antigravity/gemini-3.5-flash-low', {
      onDelta: vi.fn(),
      onStatus: vi.fn()
    }, undefined, saved);

    const writtenPaths = vi.mocked(vscodeApi.workspace.fs.writeFile).mock.calls.map(([uri]) => uri.fsPath);
    expect(writtenPaths).toEqual([join(WORKSPACE_ROOT, 'a.txt'), join(WORKSPACE_ROOT, 'b.txt')]);
    expect(completeWithTools).toHaveBeenCalledTimes(2);
    expect(completeWithTools.mock.calls[1]?.[0]).toBe('antigravity/gemini-3.5-flash-low');
  });

  it('continues beyond the former 16-step ceiling until the model completes', async () => {
    let round = 0;
    const completeWithTools = vi.fn(async () => {
      round++;
      return round <= 18
        ? {
            content: '',
            toolCalls: [{ id: `read-${round}`, name: 'read_file', arguments: '{"path":"status.txt"}' }],
            metrics
          }
        : { content: 'Đã hoàn thành tác vụ dài.', toolCalls: [], metrics };
    });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const deltas: string[] = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Phân tích tác vụ dài', 'test-model', {
      onDelta: (delta) => deltas.push(delta),
      onStatus: vi.fn()
    });

    expect(completeWithTools).toHaveBeenCalledTimes(19);
    expect(deltas).toEqual(['Đã hoàn thành tác vụ dài.']);
  });

  it('automatically runs validation, returns the failure to the Agent, fixes code and validates again', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'write-bad', name: 'write_file', arguments: '{"path":"src/app.ts","content":"broken"}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Checking the change.', toolCalls: [], metrics })
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'write-fix', name: 'write_file', arguments: '{"path":"src/app.ts","content":"fixed"}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Checking the fix.', toolCalls: [], metrics })
      .mockResolvedValueOnce({ content: 'Validation passed and the fix is complete.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const vscodeApi = await import('vscode');
    vi.mocked(vscodeApi.workspace.fs.stat).mockImplementation(async (uri) => {
      if (uri.fsPath === join(WORKSPACE_ROOT, 'package.json')) return { type: 1, ctime: 0, mtime: 0, size: 0 };
      if (uri.fsPath === WORKSPACE_ROOT) return { type: 2, ctime: 0, mtime: 0, size: 0 };
      throw new Error('missing');
    });
    vi.mocked(vscodeApi.workspace.fs.readFile).mockImplementation(async (uri) => new TextEncoder().encode(
      uri.fsPath.endsWith('package.json') ? '{"scripts":{"test":"vitest run"}}' : 'old'
    ));
    const commandRunner = vi.fn()
      .mockRejectedValueOnce(new Error('expected 1 but received 2'))
      .mockResolvedValueOnce('Tests passed.');
    const deltas: string[] = [];
    const runtime = new AgentRuntime(
      client,
      WORKSPACE_ROOT,
      async () => true,
      () => undefined,
      false,
      [],
      { allow: [], deny: [] },
      commandRunner
    );

    await runtime.run('Fix src/app.ts and run tests', 'test-model', {
      onDelta: (delta) => deltas.push(delta),
      onStatus: vi.fn()
    });

    expect(commandRunner).toHaveBeenCalledTimes(2);
    expect(commandRunner).toHaveBeenNthCalledWith(1, 'npm test', 'run_tests', expect.any(Object), undefined);
    expect(completeWithTools.mock.calls[2]?.[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: expect.stringContaining('expected 1 but received 2') })
    ]));
    expect(deltas).toEqual(['Validation passed and the fix is complete.']);
  });

  it('runs automatic validation from the nearest nested project directory', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'nested-write', name: 'write_file', arguments: '{"path":"apps/demo/src/app.ts","content":"fixed"}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Ready to validate.', toolCalls: [], metrics })
      .mockResolvedValueOnce({ content: 'Nested project validated.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(), streamChat: vi.fn(), checkModel: vi.fn(), completeWithTools
    } as unknown as ProviderClient;
    const vscodeApi = await import('vscode');
    vi.mocked(vscodeApi.workspace.fs.stat).mockImplementation(async (uri) => {
      if (uri.fsPath === join(WORKSPACE_ROOT, 'apps', 'demo', 'package.json')) return { type: 1, ctime: 0, mtime: 0, size: 0 };
      if (uri.fsPath === join(WORKSPACE_ROOT, 'apps', 'demo')) return { type: 2, ctime: 0, mtime: 0, size: 0 };
      throw new Error('missing');
    });
    vi.mocked(vscodeApi.workspace.fs.readFile).mockImplementation(async (uri) => new TextEncoder().encode(
      uri.fsPath.endsWith('package.json') ? '{"scripts":{"test":"vitest run"}}' : 'old'
    ));
    const commandRunner = vi.fn().mockResolvedValue('Tests passed.');
    const statuses: string[] = [];
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined, false, [], { allow: [], deny: [] }, commandRunner);

    await runtime.run('Fix the nested app', 'test-model', { onDelta: vi.fn(), onStatus: (status) => statuses.push(status) });

    expect(commandRunner).toHaveBeenCalledWith('npm test', 'run_tests', expect.any(Object), undefined);
    expect(statuses.some((status) => status.includes(join('apps', 'demo')))).toBe(true);
    expect(completeWithTools.mock.calls[2]?.[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: expect.stringContaining(`Working directory: ${join('apps', 'demo')}`) })
    ]));
  });

  it('preserves pending automatic validation across an IDE reload', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'write-before-reload', name: 'write_file', arguments: '{"path":"src/app.ts","content":"fixed"}' }],
        metrics
      })
      .mockResolvedValueOnce({ content: 'Ready to validate after reload.', toolCalls: [], metrics })
      .mockResolvedValueOnce({ content: 'Validation survived reload.', toolCalls: [], metrics });
    const client = {
      listModels: vi.fn(), streamChat: vi.fn(), checkModel: vi.fn(), completeWithTools
    } as unknown as ProviderClient;
    const vscodeApi = await import('vscode');
    vi.mocked(vscodeApi.workspace.fs.stat).mockImplementation(async (uri) => {
      if (uri.fsPath === join(WORKSPACE_ROOT, 'package.json')) return { type: 1, ctime: 0, mtime: 0, size: 0 };
      if (uri.fsPath === WORKSPACE_ROOT) return { type: 2, ctime: 0, mtime: 0, size: 0 };
      throw new Error('missing');
    });
    vi.mocked(vscodeApi.workspace.fs.readFile).mockImplementation(async (uri) => new TextEncoder().encode(
      uri.fsPath.endsWith('package.json') ? '{"scripts":{"test":"vitest run"}}' : 'old'
    ));
    let saved: AgentRunCheckpoint | undefined;
    const firstRuntime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);
    await expect(firstRuntime.run('Fix src/app.ts', 'test-model', {
      onDelta: vi.fn(), onStatus: vi.fn(),
      onCheckpoint: (checkpoint) => {
        saved = structuredClone(checkpoint);
        if (checkpoint.successfulMutations === 1) throw new Error('simulate reload before validation');
      }
    })).rejects.toThrow('simulate reload before validation');

    expect(saved?.mutatedPaths).toContain('src/app.ts');
    const commandRunner = vi.fn().mockResolvedValue('Tests passed.');
    const resumedRuntime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined, false, [], { allow: [], deny: [] }, commandRunner);
    await resumedRuntime.run('Fix src/app.ts', 'test-model', { onDelta: vi.fn(), onStatus: vi.fn() }, undefined, saved);

    expect(commandRunner).toHaveBeenCalledWith('npm test', 'run_tests', expect.any(Object), undefined);
  });

  it('refreshes runtime and shell instructions when resuming an older checkpoint', async () => {
    const client = clientWithResponses(['Continued safely.']);
    const checkpoint: AgentRunCheckpoint = {
      version: 1,
      model: 'old-model',
      messages: [{ role: 'system', content: 'old runtime instructions' }, { role: 'user', content: 'Continue' }],
      step: 3,
      successfulMutations: 0,
      completionWithoutActionCount: 0,
      pendingToolCalls: [],
      nextToolIndex: 0,
      lastStatus: 'Interrupted',
      updatedAt: Date.now()
    };
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Continue', 'new-model', { onDelta: vi.fn(), onStatus: vi.fn() }, undefined, checkpoint);

    const sentMessages = vi.mocked(client.completeWithTools).mock.calls[0]?.[1] as Array<Record<string, unknown>>;
    const system = String(sentMessages.find((message) => message.role === 'system')?.content ?? '');
    expect(system).not.toContain('old runtime instructions');
    expect(system).toContain(process.platform === 'win32' ? 'PowerShell' : 'POSIX');
    expect(system).toContain('never recreate the project in a new directory');
    expect(system).toContain('put each file on its own Markdown bullet line');
  });

  it('repairs missing tool results in an older completed checkpoint before retrying', async () => {
    const client = clientWithResponses(['Recovered safely.']);
    const checkpoint: AgentRunCheckpoint = {
      version: 1,
      model: 'test-model',
      messages: [
        { role: 'system', content: 'old instructions' },
        { role: 'user', content: 'Inspect files.' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'read-a', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } },
            { id: 'read-b', type: 'function', function: { name: 'read_file', arguments: '{"path":"b.ts"}' } }
          ]
        },
        { role: 'tool', tool_call_id: 'read-a', content: 'A' },
        { role: 'user', content: 'Continue.' }
      ],
      step: 2,
      successfulMutations: 0,
      completionWithoutActionCount: 0,
      pendingToolCalls: [],
      nextToolIndex: 0,
      lastStatus: 'Interrupted',
      updatedAt: Date.now()
    };
    const runtime = new AgentRuntime(client, WORKSPACE_ROOT, async () => true, () => undefined);

    await runtime.run('Continue.', 'test-model', { onDelta: vi.fn(), onStatus: vi.fn() }, undefined, checkpoint);

    const sentMessages = vi.mocked(client.completeWithTools).mock.calls[0]?.[1] as Array<Record<string, unknown>>;
    const assistantIndex = sentMessages.findIndex((message) => message.role === 'assistant' && Array.isArray(message.tool_calls));
    expect(sentMessages.slice(assistantIndex + 1, assistantIndex + 3)).toEqual([
      expect.objectContaining({ role: 'tool', tool_call_id: 'read-a', content: 'A' }),
      expect.objectContaining({ role: 'tool', tool_call_id: 'read-b', content: expect.stringContaining('interrupted run') })
    ]);
  });

  it('stops immediately while an MCP tool is still running', async () => {
    const completeWithTools = vi.fn().mockResolvedValue({
      content: '',
      toolCalls: [{ id: 'mcp-1', name: 'mcp_test_wait', arguments: '{}' }],
      metrics
    });
    const client = {
      listModels: vi.fn(), streamChat: vi.fn(), checkModel: vi.fn(), completeWithTools
    } as unknown as ProviderClient;
    let receivedSignal: AbortSignal | undefined;
    let started!: () => void;
    const toolStarted = new Promise<void>((resolve) => { started = resolve; });
    const runtime = new AgentRuntime(
      client,
      WORKSPACE_ROOT,
      async () => true,
      () => undefined,
      false,
      [{
        label: 'Test / wait',
        definition: { type: 'function', function: { name: 'mcp_test_wait', parameters: { type: 'object' } } },
        execute: async (_args, signal) => {
          receivedSignal = signal;
          started();
          return new Promise<string>(() => undefined);
        }
      }]
    );
    const controller = new AbortController();
    const run = runtime.run('Inspect through MCP', 'test-model', { onDelta: vi.fn(), onStatus: vi.fn() }, controller.signal);
    await toolStarted;
    controller.abort(new Error('Stopped by test.'));

    await expect(run).rejects.toThrow('Stopped by test.');
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('stops immediately while waiting for mutation approval', async () => {
    const completeWithTools = vi.fn().mockResolvedValue({
      content: '',
      toolCalls: [{ id: 'write-approval', name: 'write_file', arguments: '{"path":"src/app.ts","content":"new"}' }],
      metrics
    });
    const client = {
      listModels: vi.fn(), streamChat: vi.fn(), checkModel: vi.fn(), completeWithTools
    } as unknown as ProviderClient;
    let approvalStarted!: () => void;
    const waitingForApproval = new Promise<void>((resolve) => { approvalStarted = resolve; });
    const runtime = new AgentRuntime(
      client,
      WORKSPACE_ROOT,
      async () => {
        approvalStarted();
        return new Promise<boolean>(() => undefined);
      },
      () => undefined
    );
    const controller = new AbortController();
    const run = runtime.run('Update src/app.ts', 'test-model', { onDelta: vi.fn(), onStatus: vi.fn() }, controller.signal);
    await waitingForApproval;
    controller.abort(new Error('Approval cancelled.'));

    await expect(run).rejects.toThrow('Approval cancelled.');
  });
});
