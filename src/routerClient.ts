import type { ChatMessage, ConnectionConfig, RequestMetrics, RouterModel } from './types';

export function normalizeEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Endpoint không được để trống.');
  }

  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Endpoint phải bắt đầu bằng http:// hoặc https://.');
  }
  return url.toString().replace(/\/$/, '');
}

export function parseSseData(block: string): string[] {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
}

export function estimateTokens(value: unknown): number {
  return Math.max(0, Math.ceil(JSON.stringify(value ?? '').length / 4));
}

function rateLimit(headers: Headers): RequestMetrics['rateLimit'] {
  const read = (...names: string[]): string | undefined => names.map((name) => headers.get(name)).find((value): value is string => Boolean(value)) ?? undefined;
  const result = {
    requestsLimit: read('x-ratelimit-limit-requests', 'anthropic-ratelimit-requests-limit'),
    requestsRemaining: read('x-ratelimit-remaining-requests', 'anthropic-ratelimit-requests-remaining'),
    tokensLimit: read('x-ratelimit-limit-tokens', 'anthropic-ratelimit-tokens-limit'),
    tokensRemaining: read('x-ratelimit-remaining-tokens', 'anthropic-ratelimit-tokens-remaining'),
    reset: read('x-ratelimit-reset-requests', 'anthropic-ratelimit-requests-reset', 'retry-after')
  };
  return Object.values(result).some(Boolean) ? result : undefined;
}

export function requestMetrics(startedAt: number, headers: Headers, inputTokens: number, outputTokens: number, estimated: boolean): RequestMetrics {
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, latencyMs: Date.now() - startedAt, estimated, rateLimit: rateLimit(headers) };
}

export class RouterClient {
  public constructor(private readonly config: ConnectionConfig) {}

  private headers(): Record<string, string> {
    if (!this.config.apiKey.trim() && !this.config.allowEmptyApiKey) throw new Error('Chưa có API key. Mở Cấu hình và nhập key của provider.');
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
    if (this.config.apiKey.trim()) headers.Authorization = `Bearer ${this.config.apiKey.trim()}`;
    return headers;
  }

  public async listModels(signal?: AbortSignal): Promise<RouterModel[]> {
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/models`, {
      headers: this.headers(),
      signal
    });
    if (!response.ok) {
      throw new Error(await this.describeError(response));
    }

    const body = (await response.json()) as { data?: Array<{ id?: string; name?: string }> };
    return (body.data ?? [])
      .filter((item): item is { id: string; name?: string } => typeof item.id === 'string')
      .map((item) => ({ id: item.id, name: item.name || item.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async streamChat(
    model: string,
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<RequestMetrics> {
    const startedAt = Date.now();
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, messages, stream: true }),
      signal
    });
    if (!response.ok) {
      throw new Error(await this.describeError(response));
    }
    if (!response.body) {
      throw new Error('9Router không trả về luồng dữ liệu.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';

      if (done && buffer.trim()) {
        blocks.push(buffer);
        buffer = '';
      }

      for (const block of blocks) {
        for (const data of parseSseData(block)) {
          if (data === '[DONE]') {
            return requestMetrics(startedAt, response.headers, usage?.prompt_tokens ?? estimateTokens(messages), usage?.completion_tokens ?? estimateTokens(output), !usage);
          }
          try {
            const event = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            if (event.usage) usage = event.usage;
            const delta = event.choices?.[0]?.delta?.content;
            if (delta) {
              output += delta;
              onDelta(delta);
            }
          } catch {
            // Ignore non-JSON keepalive messages from compatible providers.
          }
        }
      }
      if (done) {
        break;
      }
    }
    return requestMetrics(startedAt, response.headers, usage?.prompt_tokens ?? estimateTokens(messages), usage?.completion_tokens ?? estimateTokens(output), !usage);
  }

  public async checkModel(model: string, signal?: AbortSignal): Promise<RequestMetrics> {
    const startedAt = Date.now();
    const messages = [{ role: 'user', content: 'Reply OK.' }];
    const completionLimit = /^(gpt-5|o[1-4])/.test(model) && this.config.endpoint.includes('api.openai.com') ? { max_completion_tokens: 1 } : { max_tokens: 1 };
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, messages, ...completionLimit, stream: false }),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    const body = (await response.json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return requestMetrics(startedAt, response.headers, body.usage?.prompt_tokens ?? estimateTokens(messages), body.usage?.completion_tokens ?? 1, !body.usage);
  }

  public async completeWithTools(
    model: string,
    messages: Array<Record<string, unknown>>,
    tools: Array<Record<string, unknown>>,
    signal?: AbortSignal
  ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }>; metrics: RequestMetrics }> {
    const startedAt = Date.now();
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', stream: false }),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const message = body.choices?.[0]?.message;
    return {
      content: message?.content ?? '',
      toolCalls: (message?.tool_calls ?? []).flatMap((call) =>
        call.id && call.function?.name
          ? [{ id: call.id, name: call.function.name, arguments: call.function.arguments ?? '{}' }]
          : []
      ),
      metrics: requestMetrics(startedAt, response.headers, body.usage?.prompt_tokens ?? estimateTokens(messages), body.usage?.completion_tokens ?? estimateTokens(message), !body.usage)
    };
  }

  private async describeError(response: Response): Promise<string> {
    const text = await response.text();
    try {
      const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      const detail = typeof body.error === 'string' ? body.error : body.error?.message;
      const message = detail || body.message;
      return message ? `HTTP ${response.status} · ${message}` : `9Router trả về HTTP ${response.status}.`;
    } catch {
      const message = text.slice(0, 300);
      return message ? `HTTP ${response.status} · ${message}` : `9Router trả về HTTP ${response.status}.`;
    }
  }
}
