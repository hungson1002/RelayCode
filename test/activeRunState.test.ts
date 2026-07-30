import { describe, expect, it } from 'vitest';
import { ActiveRunStateCoordinator, activeRunAlreadyFinalized } from '../src/activeRunState';

describe('active Agent run persistence', () => {
  it('leaves a cleared state cleared when an older checkpoint write finishes late', async () => {
    type Run = { runId: string } | undefined;
    const coordinator = new ActiveRunStateCoordinator<Run>();
    const generation = coordinator.begin();
    let releaseWrite!: () => void;
    const delayed = new Promise<void>((resolve) => { releaseWrite = resolve; });
    let stored: Run;

    const staleWrite = coordinator.persist({ runId: 'run-old' }, generation, async (value) => {
      await delayed;
      stored = value;
    });
    const clear = coordinator.clear(async (value) => {
      stored = value;
    }, generation);
    releaseWrite();
    await Promise.all([staleWrite, clear]);

    expect(stored).toBeUndefined();
    await coordinator.persist({ runId: 'run-old' }, generation, async (value) => {
      stored = value;
    });
    expect(stored).toBeUndefined();
  });

  it('recognizes a stale run that already has a final assistant turn', () => {
    const run = { runId: 'run-1', sessionId: 'session-1', startedAt: 100 };
    expect(activeRunAlreadyFinalized(run, [{
      id: 'session-1',
      turns: [
        { role: 'user', timestamp: 100 },
        { role: 'assistant', timestamp: 150 }
      ]
    }])).toBe(true);
    expect(activeRunAlreadyFinalized(run, [{
      id: 'session-1',
      turns: [{ role: 'user', timestamp: 100 }]
    }])).toBe(false);
  });
});
