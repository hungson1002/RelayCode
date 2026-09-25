export type ChatMode = 'chat' | 'agent' | 'plan';
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface RequestTuning {
  reasoningEffort?: ReasoningEffort;
  serviceTier?: 'default' | 'fast';
}

export interface ConnectionConfig {
  endpoint: string;
  apiKey: string;
  allowEmptyApiKey?: boolean;
}

export interface RouterModel {
  id: string;
  name: string;
  kind?: string;
  capabilities?: {
    tools: boolean;
    vision: boolean;
    reasoning: boolean;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
}

export interface StreamCallbacks {
  onDelta(delta: string): void;
  onIntermediateStep?(content?: string): void;
  onStatus(status: string): void;
  onCommentary?(content: string): void;
  onActivityComplete?(): void;
  onToolOutput?(event: { tool: string; command?: string; chunk: string; stream: 'stdout' | 'stderr'; elapsedMs: number }): void;
  onMetrics?(metrics: RequestMetrics): void;
  onToolFailure?(failure: AgentToolFailure): Promise<AgentToolFailureDecision>;
  onCheckpoint?(checkpoint: AgentRunCheckpoint): void | Promise<void>;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AgentToolFailure {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  message: string;
  model: string;
  attempt: number;
}

export type AgentToolFailureDecision =
  | { action: 'retry' }
  | { action: 'skip' }
  | { action: 'change-model'; model: string };

export type AgentGoalPhase = 'planning' | 'implementation' | 'validation' | 'repair';
export type AgentGoalMilestoneState = 'pending' | 'active' | 'complete' | 'blocked';

export interface AgentGoalMilestone {
  title: string;
  acceptanceCriteria: string;
  status: AgentGoalMilestoneState;
}

export interface AgentGoalProgressUpdate {
  phase: AgentGoalPhase;
  summary: string;
  plan: string;
  milestones: AgentGoalMilestone[];
}

export interface AgentRunCheckpoint {
  version: 1;
  model: string;
  messages: Array<Record<string, unknown>>;
  step: number;
  successfulMutations: number;
  completionWithoutActionCount: number;
  mutatedPaths?: string[];
  lastValidatedMutationCount?: number;
  validationFailureCount?: number;
  pendingToolCalls: AgentToolCall[];
  nextToolIndex: number;
  inFlightToolCallId?: string;
  lastStatus: string;
  updatedAt: number;
}

export interface RequestMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimated: boolean;
  rateLimit?: {
    requestsLimit?: string;
    requestsRemaining?: string;
    tokensLimit?: string;
    tokensRemaining?: string;
    reset?: string;
  };
}
