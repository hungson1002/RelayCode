import { RouterClient } from './routerClient';
import { AnthropicClient } from './anthropicClient';
import type { ChatMessage, RequestMetrics, RequestTuning, RouterModel } from './types';

export type ProviderKind = '9router' | 'cockpit' | 'openai' | 'anthropic' | 'openai-compatible' | 'ollama' | 'lm-studio';

export interface ProviderConfig {
  kind: ProviderKind;
  endpoint: string;
  apiKey: string;
}

export interface ModelCapabilities {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
}

export interface ToolCompletionProgress {
  type: 'content' | 'tool';
  name?: string;
  arguments?: string;
}

export interface ProviderClient {
  listModels(signal?: AbortSignal): Promise<RouterModel[]>;
  generateImage?(
    model: string,
    prompt: string,
    size: string,
    signal?: AbortSignal
  ): Promise<{ bytes: Uint8Array; mimeType: string; revisedPrompt?: string }>;
  streamChat(model: string, messages: ChatMessage[], onDelta: (delta: string) => void, signal?: AbortSignal, tuning?: RequestTuning): Promise<RequestMetrics>;
  checkModel(model: string, signal?: AbortSignal): Promise<RequestMetrics>;
  completeWithTools(
    model: string,
    messages: Array<Record<string, unknown>>,
    tools: Array<Record<string, unknown>>,
    signal?: AbortSignal,
    onProgress?: (progress: ToolCompletionProgress) => void,
    tuning?: RequestTuning
  ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }>; metrics: RequestMetrics }>;
}

export function capabilitiesForModel(model: string): ModelCapabilities {
  const id = model.toLowerCase();
  return {
    tools: !/(embed|audio|tts|image-generation)/.test(id),
    vision: /(vision|vl|gemini|claude|gpt-4o|gpt-5|qwen2-vl|pixtral|step-3\.7)/.test(id),
    reasoning: /(thinking|reason|r1|o1|o3|o4|gpt-5)/.test(id)
  };
}

export function createProvider(config: ProviderConfig): ProviderClient {
  if (config.kind === 'anthropic') {
    return new AnthropicClient({ endpoint: config.endpoint, apiKey: config.apiKey });
  }
  return new RouterClient({ endpoint: config.endpoint, apiKey: config.apiKey, allowEmptyApiKey: config.kind === 'ollama' || config.kind === 'lm-studio' });
}
