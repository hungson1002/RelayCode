import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderClient } from '../src/provider';
import type { AgentRunCheckpoint, RequestMetrics } from '../src/types';

vi.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: vi.fn(async () => new TextEncoder().encode('Reference instructions')),
      createDirectory: vi.fn(async () => undefined),
      writeFile: vi.fn(async () => undefined)
    }
  },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath }))
  }
}));

import { AgentRuntime } from '../src/agentRuntime';

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
  beforeEach(() => vi.clearAllMocks());

  it('does not report completion when a requested edit made no tool calls', async () => {
    const client = clientWithResponses(['Đã hoàn tất.', 'Đã xong.', 'Hoàn thành.']);
    const deltas: string[] = [];
    const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

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
    const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

    await runtime.run('Giải thích project này', 'test-model', {
      onDelta: (delta) => deltas.push(delta),
      onStatus: vi.fn()
    });

    expect(deltas).toEqual(['Project này dùng TypeScript.']);
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
      'C:\\workspace',
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
    const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, (change) => changes.push(change));

    await runtime.run('Tạo ảnh hero cho landing page', 'agent-model', { onDelta: vi.fn(), onStatus: vi.fn() });

    expect(client.generateImage).toHaveBeenCalledWith('image-model', 'A clean product hero', '1024x1024', undefined);
    expect(changes).toEqual([expect.objectContaining({ path: 'C:\\workspace\\assets\\hero.png', added: 1, removed: 1 })]);
    expect(vi.mocked((await import('vscode')).workspace.fs.writeFile)).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: 'C:\\workspace\\assets\\hero.png' }),
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
    const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

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
      onProgress?: (event: { type: 'tool'; name: string; arguments: string }) => void
    ) => {
      onProgress?.({ type: 'tool', name: 'write_file', arguments: '{"path":"src/landing.html","content":"' });
      return { content: 'Đã tạo landing page.', toolCalls: [], metrics };
    });
    const client = {
      listModels: vi.fn(),
      streamChat: vi.fn(),
      checkModel: vi.fn(),
      completeWithTools
    } as unknown as ProviderClient;
    const statuses: string[] = [];
    const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

    await runtime.run('Review cấu trúc dự án hiện tại', 'agent-model', {
      onDelta: vi.fn(),
      onStatus: (status) => statuses.push(status)
    });

    expect(statuses).toContain('Đang sửa file: src/landing.html');
  });

  it('retries only the failed tool and keeps completed model work', async () => {
    const completeWithTools = vi.fn()
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [{ id: 'write-1', name: 'write_file', arguments: '{"path":"index.html","content":"hello"}' }],
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
    const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

    await runtime.run('Tạo file index.html', 'test-model', {
      onDelta: vi.fn(),
      onStatus: vi.fn(),
      onToolFailure: async (failure) => {
        failures.push(failure.message);
        return { action: 'retry' };
      }
    });

    expect(failures).toEqual(['disk busy']);
    expect(vscodeApi.workspace.fs.writeFile).toHaveBeenCalledTimes(2);
    expect(completeWithTools).toHaveBeenCalledTimes(2);
  });

  it('resumes at the next unfinished tool without rerunning a successful tool', async () => {
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
    const firstRuntime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

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
    const resumedRuntime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);
    await resumedRuntime.run('Tạo a.txt và b.txt', 'test-model', {
      onDelta: vi.fn(),
      onStatus: vi.fn()
    }, undefined, saved);

    const writtenPaths = vi.mocked(vscodeApi.workspace.fs.writeFile).mock.calls.map(([uri]) => uri.fsPath);
    expect(writtenPaths).toEqual(['C:\\workspace\\a.txt', 'C:\\workspace\\b.txt']);
    expect(completeWithTools).toHaveBeenCalledTimes(2);
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
    const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

    await runtime.run('Phân tích tác vụ dài', 'test-model', {
      onDelta: (delta) => deltas.push(delta),
      onStatus: vi.fn()
    });

    expect(completeWithTools).toHaveBeenCalledTimes(19);
    expect(deltas).toEqual(['Đã hoàn thành tác vụ dài.']);
  });
});
