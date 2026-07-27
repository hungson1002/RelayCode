export type ChatMode = 'chat' | 'agent' | 'plan';

export interface ConnectionConfig {
  endpoint: string;
  apiKey: string;
  allowEmptyApiKey?: boolean;
}

export interface RouterModel {
  id: string;
  name: string;
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
  onStatus(status: string): void;
  onToolOutput?(event: { tool: string; command?: string; chunk: string; stream: 'stdout' | 'stderr'; elapsedMs: number }): void;
  onMetrics?(metrics: RequestMetrics): void;
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
