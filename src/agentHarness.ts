import type { AgentRunCheckpoint, StreamCallbacks } from './types';

export type AgentHarnessPhase = 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface AgentHarnessRuntime {
  run(
    prompt: unknown,
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    resume?: AgentRunCheckpoint
  ): Promise<void>;
}

export interface AgentHarnessEvent {
  runId: string;
  phase: Exclude<AgentHarnessPhase, 'idle'>;
  timestamp: number;
  model: string;
  durationMs?: number;
  error?: string;
}

export interface AgentHarnessSnapshot {
  runId: string;
  phase: AgentHarnessPhase;
  workspaceRoot: string;
  model?: string;
  startedAt?: number;
  completedAt?: number;
  lastStatus?: string;
  error?: string;
}

export interface AgentHarnessOptions {
  runId: string;
  workspaceRoot: string;
  workspaceTrusted: boolean;
  runtime: AgentHarnessRuntime;
  onEvent?: (event: AgentHarnessEvent) => void;
}

/**
 * Owns one Agent run: trust gating, lifecycle state, cancellation and callback
 * routing. Tool execution and the lightweight workspace boundary remain in the
 * runtime, while this class gives providers and UI code one stable run API.
 */
export class AgentHarness {
  private phase: AgentHarnessPhase = 'idle';
  private controller: AbortController | undefined;
  private model: string | undefined;
  private startedAt: number | undefined;
  private completedAt: number | undefined;
  private lastStatus: string | undefined;
  private failure: string | undefined;

  public constructor(private readonly options: AgentHarnessOptions) {}

  public snapshot(): AgentHarnessSnapshot {
    return {
      runId: this.options.runId,
      phase: this.phase,
      workspaceRoot: this.options.workspaceRoot,
      model: this.model,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      lastStatus: this.lastStatus,
      error: this.failure
    };
  }

  public cancel(reason: Error = new Error('Agent run was stopped.')): boolean {
    if (this.phase !== 'running' || !this.controller || this.controller.signal.aborted) return false;
    this.controller.abort(reason);
    return true;
  }

  public async run(
    prompt: unknown,
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    resume?: AgentRunCheckpoint
  ): Promise<void> {
    if (this.phase !== 'idle') throw new Error(`Agent harness ${this.options.runId} has already been started.`);
    if (!this.options.workspaceTrusted) {
      this.model = model;
      this.fail(model, new Error('Workspace chưa được tin cậy. Hãy bật Workspace Trust trước khi chạy Agent.'));
      throw new Error('Workspace chưa được tin cậy. Hãy bật Workspace Trust trước khi chạy Agent.');
    }

    const controller = new AbortController();
    this.controller = controller;
    this.model = model;
    this.startedAt = Date.now();
    this.phase = 'running';
    this.emit({ runId: this.options.runId, phase: 'running', timestamp: this.startedAt, model });

    const abortFromParent = () => {
      controller.abort(signal?.reason instanceof Error ? signal.reason : new Error('Agent run was stopped.'));
    };
    if (signal?.aborted) abortFromParent();
    else signal?.addEventListener('abort', abortFromParent, { once: true });

    const routedCallbacks: StreamCallbacks = {
      ...callbacks,
      onStatus: (status) => {
        this.lastStatus = status;
        callbacks.onStatus(status);
      }
    };

    try {
      await this.options.runtime.run(prompt, model, routedCallbacks, controller.signal, resume);
      this.completedAt = Date.now();
      this.phase = 'completed';
      this.emit({
        runId: this.options.runId,
        phase: 'completed',
        timestamp: this.completedAt,
        model,
        durationMs: this.durationMs()
      });
    } catch (error) {
      this.completedAt = Date.now();
      this.failure = errorText(error);
      this.phase = controller.signal.aborted ? 'cancelled' : 'failed';
      this.emit({
        runId: this.options.runId,
        phase: this.phase,
        timestamp: this.completedAt,
        model,
        durationMs: this.durationMs(),
        error: this.failure
      });
      throw error;
    } finally {
      signal?.removeEventListener('abort', abortFromParent);
      this.controller = undefined;
    }
  }

  private fail(model: string, error: Error): void {
    this.phase = 'failed';
    this.failure = error.message;
    this.completedAt = Date.now();
    this.emit({
      runId: this.options.runId,
      phase: 'failed',
      timestamp: this.completedAt,
      model,
      error: error.message
    });
  }

  private durationMs(): number | undefined {
    return this.startedAt === undefined || this.completedAt === undefined
      ? undefined
      : this.completedAt - this.startedAt;
  }

  private emit(event: AgentHarnessEvent): void {
    try {
      this.options.onEvent?.(event);
    } catch {
      // Observability must never interrupt an Agent run.
    }
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
