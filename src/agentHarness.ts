import type { AgentRunCheckpoint, AgentToolLifecycleEvent, RequestMetrics, StreamCallbacks } from './types';

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
  stats?: AgentHarnessStats;
}

export interface AgentHarnessToolTrace {
  id: string;
  tool: string;
  kind: AgentToolLifecycleEvent['kind'];
  target?: string;
  startedAt: number;
  durationMs?: number;
  ok?: boolean;
}

export interface AgentHarnessStats {
  steps: number;
  toolCalls: number;
  failedTools: number;
  filesRead: number;
  filesEdited: number;
  commandsRun: number;
  totalTokens: number;
  totalToolDurationMs: number;
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
  stats: AgentHarnessStats;
  recentTools: AgentHarnessToolTrace[];
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
  private readonly stats: AgentHarnessStats = {
    steps: 0,
    toolCalls: 0,
    failedTools: 0,
    filesRead: 0,
    filesEdited: 0,
    commandsRun: 0,
    totalTokens: 0,
    totalToolDurationMs: 0
  };
  private readonly toolTraces: AgentHarnessToolTrace[] = [];
  private readonly activeTools = new Map<string, AgentHarnessToolTrace>();

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
      error: this.failure,
      stats: { ...this.stats },
      recentTools: this.toolTraces.slice(-24).map((item) => ({ ...item }))
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
    if (signal?.aborted) {
      abortFromParent();
      const reason = controller.signal.reason instanceof Error ? controller.signal.reason : new Error('Agent run was stopped.');
      this.completedAt = Date.now();
      this.failure = errorText(reason);
      this.phase = 'cancelled';
      this.emit({
        runId: this.options.runId,
        phase: 'cancelled',
        timestamp: this.completedAt,
        model,
        durationMs: this.durationMs(),
        error: this.failure
      });
      this.controller = undefined;
      throw reason;
    }
    signal?.addEventListener('abort', abortFromParent, { once: true });

    const routedCallbacks: StreamCallbacks = {
      ...callbacks,
      onStatus: (status) => {
        this.lastStatus = status;
        callbacks.onStatus(status);
      },
      onMetrics: (metrics: RequestMetrics) => {
        this.stats.steps += 1;
        this.stats.totalTokens += Math.max(0, metrics.totalTokens || 0);
        callbacks.onMetrics?.(metrics);
      },
      onToolEvent: (event: AgentToolLifecycleEvent) => {
        if (event.phase === 'start') {
          this.stats.toolCalls += 1;
          if (event.kind === 'edit') this.stats.filesEdited += 1;
          else if (event.kind === 'command') this.stats.commandsRun += 1;
          else if (event.tool === 'read_file') this.stats.filesRead += 1;
          const trace: AgentHarnessToolTrace = {
            id: event.id,
            tool: event.tool,
            kind: event.kind,
            target: event.target,
            startedAt: Date.now()
          };
          this.activeTools.set(event.id, trace);
          this.toolTraces.push(trace);
          if (this.toolTraces.length > 80) this.toolTraces.shift();
        } else {
          const existing = this.activeTools.get(event.id);
          if (existing) {
            existing.durationMs = event.durationMs ?? Math.max(0, Date.now() - existing.startedAt);
            existing.ok = event.ok;
            this.activeTools.delete(event.id);
          }
          if (event.durationMs) this.stats.totalToolDurationMs += Math.max(0, event.durationMs);
          if (event.ok === false) this.stats.failedTools += 1;
        }
        callbacks.onToolEvent?.(event);
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
        durationMs: this.durationMs(),
        stats: { ...this.stats }
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
        error: this.failure,
        stats: { ...this.stats }
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
