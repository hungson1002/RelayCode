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

  it('tracks structured tool lifecycle events and token metrics in the harness snapshot', async () => {
    const toolEvents: string[] = [];
    const runtime: AgentHarnessRuntime = {
      run: vi.fn(async (_prompt, _model, cb) => {
        cb.onToolEvent?.({ id: 't1', phase: 'start', tool: 'read_file', kind: 'inspect', target: 'src/app.ts', step: 0 });
        cb.onToolEvent?.({ id: 't1', phase: 'end', tool: 'read_file', kind: 'inspect', target: 'src/app.ts', durationMs: 42, ok: true, step: 0 });
        cb.onToolEvent?.({ id: 't2', phase: 'start', tool: 'run_tests', kind: 'command', target: 'npm test', step: 1 });
        cb.onToolEvent?.({ id: 't2', phase: 'end', tool: 'run_tests', kind: 'command', target: 'npm test', durationMs: 1200, ok: false, step: 1 });
        cb.onMetrics?.({ inputTokens: 120, outputTokens: 80, totalTokens: 200, latencyMs: 500, estimated: false });
      })
    };
    const harness = new AgentHarness({
      runId: 'run-metrics',
      workspaceRoot: process.cwd(),
      workspaceTrusted: true,
      runtime
    });

    await harness.run('Check project', 'test-model', {
      onDelta: () => undefined,
      onStatus: () => undefined,
      onToolEvent: (event) => toolEvents.push(`${event.phase}:${event.tool}`)
    });

    const snapshot = harness.snapshot();
    expect(toolEvents).toEqual(['start:read_file', 'end:read_file', 'start:run_tests', 'end:run_tests']);
    expect(snapshot.stats).toEqual({
      steps: 1,
      toolCalls: 2,
      failedTools: 1,
      filesRead: 1,
      filesEdited: 0,
      commandsRun: 1,
      totalTokens: 200,
      totalToolDurationMs: 1242
    });
    expect(snapshot.recentTools).toHaveLength(2);
    expect(snapshot.recentTools[1]).toEqual(expect.objectContaining({ tool: 'run_tests', ok: false, durationMs: 1200 }));
  });
});

function callbacks(statuses: string[]): StreamCallbacks {
  return {
    onDelta: () => undefined,
    onStatus: (status) => statuses.push(status)
  };
}
