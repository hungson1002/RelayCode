export interface ActiveRunIdentity {
  runId: string;
  sessionId?: string;
  startedAt: number;
}

export interface StoredSessionIdentity {
  id: string;
  turns: Array<{ role: 'user' | 'assistant'; timestamp: number }>;
}

export function activeRunAlreadyFinalized(
  run: ActiveRunIdentity,
  sessions: StoredSessionIdentity[]
): boolean {
  if (!run.sessionId) return false;
  const session = sessions.find((item) => item.id === run.sessionId);
  return Boolean(session?.turns.some((turn) => turn.role === 'assistant' && turn.timestamp >= run.startedAt));
}

export class ActiveRunStateCoordinator<T> {
  private generation = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  public begin(): number {
    return ++this.generation;
  }

  public isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  public persist(value: T, generation: number, write: (value: T) => Promise<void>): Promise<void> {
    const operation = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        if (!this.isCurrent(generation)) return;
        await write(value);
      });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  public async clear(write: (value: undefined) => Promise<void>, generation?: number): Promise<boolean> {
    if (generation !== undefined && !this.isCurrent(generation)) return false;
    const clearGeneration = ++this.generation;
    await this.persist(undefined as T, clearGeneration, write as (value: T) => Promise<void>);
    return true;
  }
}
