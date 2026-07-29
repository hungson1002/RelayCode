import { expect, it, vi } from 'vitest';
import type { ProviderClient } from '../src/provider';
import type { AgentRunCheckpoint, RequestMetrics } from '../src/types';

const { writeFile } = vi.hoisted(() => ({
  writeFile: vi.fn(async (_uri: { fsPath: string }, _bytes: Uint8Array) => undefined)
}));

vi.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: vi.fn(async () => new Uint8Array()),
      createDirectory: vi.fn(async () => undefined),
      writeFile
    }
  },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath }))
  }
}));

import { AgentRuntime } from '../src/agentRuntime';

const metrics: RequestMetrics = {
  inputTokens: 2,
  outputTokens: 2,
  totalTokens: 4,
  latencyMs: 1,
  estimated: true
};

it('persists an interrupted Agent cursor and resumes without replaying completed writes', async () => {
  const completeWithTools = vi.fn()
    .mockResolvedValueOnce({
      content: '',
      toolCalls: [
        { id: 'first', name: 'write_file', arguments: '{"path":"first.txt","content":"first"}' },
        { id: 'second', name: 'write_file', arguments: '{"path":"second.txt","content":"second"}' }
      ],
      metrics
    })
    .mockResolvedValueOnce({ content: 'Completed.', toolCalls: [], metrics });
  const client = {
    listModels: vi.fn(),
    streamChat: vi.fn(),
    checkModel: vi.fn(),
    completeWithTools
  } as unknown as ProviderClient;
  const workspaceState = new Map<string, unknown>();
  const runtime = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);

  await expect(runtime.run('Create both files', 'agent-model', {
    onDelta: vi.fn(),
    onStatus: vi.fn(),
    onCheckpoint: (checkpoint) => {
      workspaceState.set('activeRun', structuredClone(checkpoint));
      if (checkpoint.pendingToolCalls.length === 2 && checkpoint.nextToolIndex === 1) {
        throw new Error('extension host reloaded');
      }
    }
  })).rejects.toThrow('extension host reloaded');

  const recovered = workspaceState.get('activeRun') as AgentRunCheckpoint;
  const resumed = new AgentRuntime(client, 'C:\\workspace', async () => true, () => undefined);
  await resumed.run('Create both files', 'agent-model', {
    onDelta: vi.fn(),
    onStatus: vi.fn()
  }, undefined, recovered);

  expect(writeFile.mock.calls.map(([uri]: [{ fsPath: string }, Uint8Array]) => uri.fsPath)).toEqual([
    'C:\\workspace\\first.txt',
    'C:\\workspace\\second.txt'
  ]);
  expect(completeWithTools).toHaveBeenCalledTimes(2);
});
