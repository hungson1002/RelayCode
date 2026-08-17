import { describe, expect, it, vi } from 'vitest';
import { AgentHarness, type AgentHarnessRuntime } from '../src/agentHarness';
import type { StreamCallbacks } from '../src/types';

describe('AgentHarness', () => {
  it('owns a run lifecycle and routes status updates', async () => {
    const events: string[] = [];
    const statuses: string[] = [];
    const runtime: AgentHarnessRuntime = {
      run: vi.fn(async (_prompt, _model, callbacks) => {
        callbacks.onStatus('Đang đọc workspace');
      })
    };
    const harness = new AgentHarness({
      runId: 'run-1',
      workspaceRoot: process.cwd(),
      workspaceTrusted: true,
      runtime,
      onEvent: (event) => events.push(event.phase)
    });

    await harness.run('Inspect the project', 'test-model', callbacks(statuses));

    expect(events).toEqual(['running', 'completed']);
    expect(statuses).toEqual(['Đang đọc workspace']);
    expect(harness.snapshot()).toEqual(expect.objectContaining({
      runId: 'run-1',
      phase: 'completed',
      model: 'test-model',
      lastStatus: 'Đang đọc workspace'
    }));
  });

  it('propagates parent cancellation and records a cancelled run', async () => {
    const runtime: AgentHarnessRuntime = {
      run: vi.fn((_prompt, _model, _callbacks, signal) => new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      }))
    };
    const harness = new AgentHarness({
      runId: 'run-cancel',
      workspaceRoot: process.cwd(),
      workspaceTrusted: true,
      runtime
    });
    const controller = new AbortController();
    const running = harness.run('Long task', 'test-model', callbacks([]), controller.signal);

    controller.abort(new Error('Stopped by user.'));

    await expect(running).rejects.toThrow('Stopped by user.');
    expect(harness.snapshot().phase).toBe('cancelled');
  });

  it('refuses to start in an untrusted workspace', async () => {
    const runtime: AgentHarnessRuntime = { run: vi.fn(async () => undefined) };
    const harness = new AgentHarness({
      runId: 'run-untrusted',
      workspaceRoot: process.cwd(),
      workspaceTrusted: false,
      runtime
    });

    await expect(harness.run('Edit the project', 'test-model', callbacks([]))).rejects.toThrow('Workspace Trust');
    expect(runtime.run).not.toHaveBeenCalled();
    expect(harness.snapshot().phase).toBe('failed');
  });
});

function callbacks(statuses: string[]): StreamCallbacks {
  return {
    onDelta: () => undefined,
    onStatus: (status) => statuses.push(status)
  };
}
