import { estimateTokens, normalizeEndpoint, parseSseData, requestMetrics } from './routerClient';
import type { ChatMessage, ChatMode, ConnectionConfig, RequestMetrics, RouterModel } from './types';
import type { ToolCompletionProgress } from './provider';

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = { role: 'user' | 'assistant'; content: string | AnthropicContent[] };

export class AnthropicClient {
  public constructor(private readonly config: ConnectionConfig) {}

  private headers(): Record<string, string> {
    if (!this.config.apiKey.trim()) throw new Error('Chưa có Anthropic API key. Mở Cài đặt và nhập key từ Claude Console.');
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': this.config.apiKey.trim()
    };
  }

  public async listModels(signal?: AbortSignal): Promise<RouterModel[]> {
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/models?limit=1000`, {
      headers: this.headers(),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    const body = (await response.json()) as { data?: Array<{ id?: string; display_name?: string }> };
    return (body.data ?? [])
      .filter((item): item is { id: string; display_name?: string } => typeof item.id === 'string')
      .map((item) => ({ id: item.id, name: item.display_name || item.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public async streamChat(
    model: string,
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    signal?: AbortSignal
  ): Promise<RequestMetrics> {
    const startedAt = Date.now();
    const converted = this.convertChatMessages(messages);
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: converted.system || undefined,
        messages: converted.messages,
        stream: true
      }),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    if (!response.body) throw new Error('Anthropic không trả về luồng dữ liệu.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let output = '';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';
      if (done && buffer.trim()) blocks.push(buffer);
      for (const block of blocks) {
        for (const data of parseSseData(block)) {
          let event: { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string }; message?: { usage?: { input_tokens?: number; output_tokens?: number } }; usage?: { input_tokens?: number; output_tokens?: number } };
          try {
            event = JSON.parse(data) as typeof event;
          } catch {
            // Ignore non-JSON keepalive events.
            continue;
          }
          if (event.type === 'error') throw new Error(event.error?.message || 'Anthropic stream error.');
          if (event.message?.usage?.input_tokens !== undefined) inputTokens = event.message.usage.input_tokens;
          if (event.message?.usage?.output_tokens !== undefined) outputTokens = event.message.usage.output_tokens;
          if (event.usage?.input_tokens !== undefined) inputTokens = event.usage.input_tokens;
          if (event.usage?.output_tokens !== undefined) outputTokens = event.usage.output_tokens;
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
            output += event.delta.text;
            onDelta(event.delta.text);
          }
        }
      }
      if (done) break;
    }
    return requestMetrics(startedAt, response.headers, inputTokens ?? estimateTokens(converted), outputTokens ?? estimateTokens(output), inputTokens === undefined || outputTokens === undefined);
  }

  public async checkModel(model: string, signal?: AbortSignal, mode?: ChatMode): Promise<RequestMetrics> {
    if (mode === 'chat' || mode === 'plan') {
      let output = '';
      return this.streamChat(
        model,
        [{ role: 'user', content: 'Reply with OK only.' }],
        (delta) => { output += delta; },
        signal
      ).then((metrics) => {
        if (!output.trim()) throw new Error('Model kết thúc luồng nhưng không trả về nội dung.');
        return metrics;
      });
    }
    if (mode === 'agent') {
      const result = await this.completeWithTools(
        model,
        [{ role: 'user', content: 'Call the relaycode_probe tool exactly once with an empty object. Do not answer with text.' }],
        [{ type: 'function', function: { name: 'relaycode_probe', description: 'A harmless RelayCode capability probe.', parameters: { type: 'object', properties: {} } } }],
        signal
      );
      if (!result.toolCalls.length) throw new Error('Model phản hồi Chat nhưng không trả về tool-call cho Agent.');
      return result.metrics;
    }
    const startedAt = Date.now();
    const messages = [{ role: 'user', content: 'Reply OK.' }];
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, max_tokens: 1, messages }),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    const body = (await response.json()) as { usage?: { input_tokens?: number; output_tokens?: number } };
    return requestMetrics(startedAt, response.headers, body.usage?.input_tokens ?? estimateTokens(messages), body.usage?.output_tokens ?? 1, !body.usage);
  }

  public async completeWithTools(
    model: string,
    messages: Array<Record<string, unknown>>,
    tools: Array<Record<string, unknown>>,
    signal?: AbortSignal,
    onProgress?: (progress: ToolCompletionProgress) => void
  ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: string }>; metrics: RequestMetrics }> {
    const startedAt = Date.now();
    const converted = this.convertAgentMessages(messages);
    const anthropicTools = tools.flatMap((tool) => {
      const fn = tool.function as { name?: unknown; description?: unknown; parameters?: unknown } | undefined;
      if (!fn || typeof fn.name !== 'string') return [];
      return [{
        name: fn.name,
        description: typeof fn.description === 'string' ? fn.description : undefined,
        input_schema: fn.parameters ?? { type: 'object', properties: {} }
      }];
    });
    const response = await fetch(`${normalizeEndpoint(this.config.endpoint)}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: converted.system || undefined,
        messages: converted.messages,
        tools: anthropicTools,
        tool_choice: { type: 'auto' }
      }),
      signal
    });
    if (!response.ok) throw new Error(await this.describeError(response));
    const body = (await response.json()) as {
      content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const blocks = body.content ?? [];
    for (const block of blocks) {
      if (block.type === 'text' && block.text) onProgress?.({ type: 'content' });
      if (block.type === 'tool_use' && block.name) {
        onProgress?.({ type: 'tool', name: block.name, arguments: JSON.stringify(block.input ?? {}) });
      }
    }
    return {
      content: blocks.filter((block) => block.type === 'text').map((block) => block.text ?? '').join(''),
      toolCalls: blocks.flatMap((block) => block.type === 'tool_use' && block.id && block.name
        ? [{ id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) }]
        : []),
      metrics: requestMetrics(startedAt, response.headers, body.usage?.input_tokens ?? estimateTokens(converted), body.usage?.output_tokens ?? estimateTokens(blocks), !body.usage)
    };
  }

  private convertChatMessages(messages: ChatMessage[]): { system: string; messages: AnthropicMessage[] } {
    const system: string[] = [];
    const converted: AnthropicMessage[] = [];
    for (const message of messages) {
      if (message.role === 'system') {
        system.push(typeof message.content === 'string' ? message.content : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n'));
        continue;
      }
      converted.push({ role: message.role, content: this.convertContent(message.content) });
    }
    return { system: system.join('\n\n'), messages: converted };
  }

  private convertAgentMessages(messages: Array<Record<string, unknown>>): { system: string; messages: AnthropicMessage[] } {
    const system: string[] = [];
    const converted: AnthropicMessage[] = [];
    const append = (role: 'user' | 'assistant', content: string | AnthropicContent[]) => {
      const blocks: AnthropicContent[] = typeof content === 'string'
        ? (content ? [{ type: 'text', text: content }] : [])
        : content;
      if (!blocks.length) return;
      const previous = converted.at(-1);
      if (previous?.role === role) {
        const previousBlocks: AnthropicContent[] = typeof previous.content === 'string'
          ? (previous.content ? [{ type: 'text', text: previous.content }] : [])
          : previous.content;
        previous.content = [...previousBlocks, ...blocks];
        return;
      }
      converted.push({ role, content: blocks });
    };

    for (let index = 0; index < messages.length; index++) {
      const message = messages[index]!;
      const role = String(message.role ?? '');
      if (role === 'system') {
        system.push(String(message.content ?? ''));
        continue;
      }
      // Tool results are consumed together with the assistant tool_use message below.
      // Ignoring an orphan here is safer than sending an invalid Anthropic sequence.
      if (role === 'tool') continue;
      if (role !== 'user' && role !== 'assistant') continue;
      const content: AnthropicContent[] = [];
      const rawContent = message.content;
      if (typeof rawContent === 'string' && rawContent) content.push({ type: 'text', text: rawContent });
      else if (Array.isArray(rawContent)) content.push(...this.convertContent(rawContent as ChatMessage['content']) as AnthropicContent[]);
      const toolUseIds: string[] = [];
      if (role === 'assistant' && Array.isArray(message.tool_calls)) {
        for (const rawCall of message.tool_calls as Array<Record<string, unknown>>) {
          const fn = rawCall.function as Record<string, unknown> | undefined;
          const id = typeof rawCall.id === 'string' ? rawCall.id.trim() : '';
          if (!id || !fn || typeof fn.name !== 'string') continue;
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(String(fn.arguments ?? '{}')) as Record<string, unknown>; } catch { /* Keep empty input. */ }
          content.push({ type: 'tool_use', id, name: fn.name, input });
          toolUseIds.push(id);
        }
      }
      append(role, content);

      if (role === 'assistant' && toolUseIds.length) {
        const results = new Map<string, string>();
        let resultIndex = index + 1;
        while (resultIndex < messages.length && String(messages[resultIndex]?.role ?? '') === 'tool') {
          const result = messages[resultIndex]!;
          const id = String(result.tool_call_id ?? '').trim();
          if (id && toolUseIds.includes(id) && !results.has(id)) results.set(id, String(result.content ?? ''));
          resultIndex++;
        }
        const resultBlocks: AnthropicContent[] = toolUseIds.map((id) => {
          const result = results.get(id);
          if (result === undefined) {
            return {
              type: 'tool_result',
              tool_use_id: id,
              content: 'ERROR: RelayCode recovered an interrupted run. This tool was not executed; issue it again only if it is still needed.',
              is_error: true
            };
          }
          return {
            type: 'tool_result',
            tool_use_id: id,
            content: result,
            ...(/^(ERROR|DENIED):?/i.test(result) ? { is_error: true } : {})
          };
        });
        append('user', resultBlocks);
        index = resultIndex - 1;
      }
    }
    return { system: system.join('\n\n'), messages: converted };
  }

  private convertContent(content: ChatMessage['content']): string | AnthropicContent[] {
    if (typeof content === 'string') return content;
    const converted: AnthropicContent[] = [];
    for (const part of content) {
      if (part.type === 'text') {
        converted.push({ type: 'text', text: part.text });
        continue;
      }
      const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i.exec(part.image_url.url);
      if (match) converted.push({ type: 'image', source: { type: 'base64', media_type: match[1]!, data: match[2]! } });
    }
    return converted;
  }

  private async describeError(response: Response): Promise<string> {
    const text = await response.text();
    if (response.status === 403) return 'Anthropic từ chối quyền truy cập. Hãy kiểm tra API key và quyền sử dụng model.';
    if (response.status === 401) return 'Anthropic API key không hợp lệ hoặc đã hết hạn. Hãy cập nhật khóa trong Cài đặt.';
    try {
      const body = JSON.parse(text) as { error?: { message?: string }; message?: string };
      return body.error?.message || body.message || `Anthropic trả về HTTP ${response.status}.`;
    } catch {
      return text.slice(0, 300) || `Anthropic trả về HTTP ${response.status}.`;
    }
  }
}
