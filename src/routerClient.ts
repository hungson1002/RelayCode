import type { ChatMessage, ConnectionConfig, RequestMetrics, RequestTuning, RouterModel } from './types';
import type { ToolCompletionProgress } from './provider';

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

export function tuningBody(tuning?: RequestTuning): Record<string, string> {
  return {
    ...(tuning?.reasoningEffort ? { reasoning_effort: tuning.reasoningEffort } : {}),
    ...(tuning?.serviceTier === 'fast' ? { service_tier: 'priority' } : {})
  };
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

    const body = (await response.json()) as { data?: Array<{ id?: string; name?: string; kind?: string; type?: string }> };
    return (body.data ?? [])
      .filter((item): item is { id: string; name?: string; kind?: string; type?: string } => typeof item.id === 'string')
      .map((item) => ({ id: item.id, name: item.name || item.id, kind: item.kind || item.type }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async generateImage(
    model: string,
    prompt: string,
    size: string,
    signal?: AbortSignal
  ): Promise<{ bytes: Uint8Array; mimeType: string; revisedPrompt?: string }> {
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/images/generations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, prompt, size }),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    const body = await response.json() as {
      data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    };
    const image = body.data?.[0];
    if (!image) throw new Error('Provider không trả về ảnh.');
    if (image.b64_json) {
      const bytes = Uint8Array.from(Buffer.from(image.b64_json, 'base64'));
      if (!bytes.byteLength) throw new Error('Provider trả về dữ liệu ảnh rỗng.');
      if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('Ảnh tạo ra lớn hơn giới hạn 25 MB.');
      return { bytes, mimeType: detectImageMime(bytes), revisedPrompt: image.revised_prompt };
    }
    if (image.url) {
      const target = new URL(image.url);
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Provider trả về URL ảnh không an toàn.');
      const download = await fetch(target, { signal });
      if (!download.ok) throw new Error(`Không tải được ảnh do provider tạo, HTTP ${download.status}.`);
      const bytes = new Uint8Array(await download.arrayBuffer());
      if (!bytes.byteLength) throw new Error('Provider trả về file ảnh rỗng.');
      if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('Ảnh tạo ra lớn hơn giới hạn 25 MB.');
      return {
        bytes,
        mimeType: download.headers.get('content-type')?.split(';')[0] || detectImageMime(bytes),
        revisedPrompt: image.revised_prompt
      };
    }
    throw new Error('Provider không trả về base64 hoặc URL ảnh.');
  }

  public async streamChat(
    model: string,
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    signal?: AbortSignal,
    tuning?: RequestTuning
  ): Promise<RequestMetrics> {
    const startedAt = Date.now();
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, messages, stream: true, ...tuningBody(tuning) }),
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
    const agentic = /(^ag\/|[-/]agentic(?:$|[-/]))/i.test(model);
    const messages = agentic
      ? [
          { role: 'system', content: 'Call the read_file tool exactly once.' },
          { role: 'user', content: 'Read package.json.' }
        ]
      : [{ role: 'user', content: 'Reply OK.' }];
    const completionLimit = agentic
      ? {}
      : /^(gpt-5|o[1-4])/.test(model) && this.config.endpoint.includes('api.openai.com')
        ? { max_completion_tokens: 1 }
        : { max_tokens: 1 };
    const healthTool = {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a workspace file.',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
          additionalProperties: false
        }
      }
    };
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages,
        ...completionLimit,
        ...(agentic ? { tools: [healthTool], tool_choice: 'auto' } : {}),
        stream: false
      }),
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
    signal?: AbortSignal,
    onProgress?: (progress: ToolCompletionProgress) => void,
    tuning?: RequestTuning
  ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }>; metrics: RequestMetrics }> {
    const startedAt = Date.now();
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', stream: true, ...tuningBody(tuning) }),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    if (!response.body) throw new Error('Provider không trả về luồng dữ liệu cho Agent.');

    const contentType = response.headers.get('content-type') ?? '';
    if (!/text\/event-stream/i.test(contentType)) {
      const body = await response.json() as {
        choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const message = body.choices?.[0]?.message;
      const toolCalls = (message?.tool_calls ?? []).flatMap((call) =>
        call.id && call.function?.name
          ? [{ id: call.id, name: call.function.name, arguments: call.function.arguments ?? '{}' }]
          : []
      );
      for (const call of toolCalls) onProgress?.({ type: 'tool', name: call.name, arguments: call.arguments });
      return {
        content: message?.content ?? '',
        toolCalls,
        metrics: requestMetrics(startedAt, response.headers, body.usage?.prompt_tokens ?? estimateTokens(messages), body.usage?.completion_tokens ?? estimateTokens(message), !body.usage)
      };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const calls = new Map<number, { id: string; name: string; arguments: string }>();
    let buffer = '';
    let content = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    stream: while (true) {
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
            // Some OpenAI-compatible gateways keep the HTTP connection alive
            // after the protocol-level end marker. Waiting for the socket to
            // close leaves the Agent turn permanently "running".
            void reader.cancel().catch(() => undefined);
            break stream;
          }
          try {
            const event = JSON.parse(data) as {
              choices?: Array<{
                delta?: {
                  content?: string | null;
                  tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
                };
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            if (event.usage) usage = event.usage;
            const delta = event.choices?.[0]?.delta;
            if (delta?.content) {
              content += delta.content;
              onProgress?.({ type: 'content' });
            }
            for (const raw of delta?.tool_calls ?? []) {
              const index = raw.index ?? 0;
              const current = calls.get(index) ?? { id: '', name: '', arguments: '' };
              if (raw.id) current.id = raw.id;
              if (raw.function?.name) current.name += raw.function.name;
              if (raw.function?.arguments) current.arguments += raw.function.arguments;
              calls.set(index, current);
              onProgress?.({ type: 'tool', name: current.name, arguments: current.arguments });
            }
            if (event.choices?.some((choice) => choice.finish_reason != null)) {
              // Kiro and some other compatible providers use finish_reason as
              // the only protocol-level terminator: no [DONE] event follows.
              void reader.cancel().catch(() => undefined);
              break stream;
            }
          } catch {
            // Compatible gateways may emit keepalive events that are not JSON.
          }
        }
      }
      if (done) break;
    }
    const toolCalls = [...calls.values()]
      .filter((call) => call.id && call.name)
      .map((call) => ({ ...call, arguments: call.arguments || '{}' }));
    return {
      content,
      toolCalls,
      metrics: requestMetrics(startedAt, response.headers, usage?.prompt_tokens ?? estimateTokens(messages), usage?.completion_tokens ?? estimateTokens(content + JSON.stringify(toolCalls)), !usage)
    };
  }

  private async describeError(response: Response): Promise<string> {
    const text = await response.text();
    if (response.status === 403) {
      return 'Provider từ chối quyền truy cập. Hãy kiểm tra API key, Client Key hoặc đăng nhập lại tài khoản upstream.';
    }
    if (response.status === 401) {
      return 'API key hoặc Client Key không hợp lệ hay đã hết hạn. Hãy cập nhật khóa trong Cài đặt.';
    }
    try {
      const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      const detail = typeof body.error === 'string' ? body.error : body.error?.message;
      const message = detail || body.message;
      return message ? `HTTP ${response.status} · ${message}` : `Provider trả về HTTP ${response.status}.`;
    } catch {
      const message = text.slice(0, 300);
      return message ? `HTTP ${response.status} · ${message}` : `Provider trả về HTTP ${response.status}.`;
    }
  }
}

function detectImageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
  return 'application/octet-stream';
}
