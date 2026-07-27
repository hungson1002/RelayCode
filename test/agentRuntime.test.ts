import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderClient } from '../src/provider';
import type { RequestMetrics } from '../src/types';

vi.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: vi.fn(async () => new TextEncoder().encode('Reference instructions'))
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

    await runtime.run('Đọc tài nguyên skill', 'test-model', { onDelta: vi.fn(), onStatus: vi.fn() });

    expect(completeWithTools).toHaveBeenCalledTimes(2);
    expect(completeWithTools.mock.calls[1]?.[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'tool', content: 'Reference instructions' })
    ]));
  });
});
