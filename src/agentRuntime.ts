import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import * as vscode from 'vscode';
import type { ProviderClient, ToolCompletionProgress } from './provider';
import type { ExternalAgentTool } from './mcpManager';
import type { AgentRunCheckpoint, AgentToolCall, RequestTuning, StreamCallbacks } from './types';
import { validateCommandPolicy } from './safetyPolicy';
import { countLineChanges } from './diffHunks';
import { requiresWorkspaceMutation } from './agentIntent';
import { runShellCommand, shellRuntimeInstruction } from './commandRuntime';
import { sanitizeModelText } from './modelText';

const execFileAsync = promisify(execFile);

const tools: Array<Record<string, unknown>> = [
  tool('read_file', 'Đọc một file trong workspace.', { path: stringField('Đường dẫn tương đối') }, ['path']),
  tool('stat_path', 'Kiểm tra file hoặc thư mục có tồn tại và trả về loại, kích thước.', { path: stringField('Đường dẫn tương đối') }, ['path']),
  tool('list_directory', 'Liệt kê trực tiếp nội dung một thư mục trong workspace.', { path: stringField('Đường dẫn thư mục tương đối; để trống cho workspace root') }, []),
  tool('read_skill_file', 'Đọc file tham chiếu nằm trong một skill đang được kích hoạt.', {
    skill: stringField('Tên skill đã được kích hoạt'),
    path: stringField('Đường dẫn tương đối tính từ thư mục chứa SKILL.md')
  }, ['skill', 'path']),
  tool('list_files', 'Liệt kê file trong workspace theo glob.', { pattern: stringField('Glob, ví dụ src/**/*.ts') }, ['pattern']),
  tool('search_text', 'Tìm một chuỗi trong các file của workspace.', { query: stringField('Chuỗi cần tìm'), pattern: stringField('Glob tùy chọn, ví dụ **/*.ts') }, ['query']),
  tool('read_webpage', 'Đọc nội dung chính của một trang web từ URL HTTP(S) để phân tích. Dùng khi người dùng gửi link hoặc yêu cầu tìm hiểu một trang cụ thể.', {
    url: stringField('URL đầy đủ bắt đầu bằng https:// hoặc http://')
  }, ['url']),
  tool('list_models', 'Liệt kê model từ provider hiện tại. Dùng để tìm model image hoặc image-generation trước khi tạo ảnh.', {}, []),
  tool('generate_image', 'Tạo ảnh bằng API image generation của provider hiện tại và lưu file vào workspace. Chỉ dùng trong Agent mode.', {
    prompt: stringField('Mô tả chi tiết ảnh cần tạo'),
    path: stringField('Đường dẫn ảnh đầu ra trong workspace, ví dụ assets/hero.png'),
    model: stringField('Model tạo ảnh. Nếu bỏ trống sẽ dùng model Agent hiện tại'),
    size: stringField('Kích thước, ví dụ 1024x1024, 1536x1024 hoặc 1024x1536')
  }, ['prompt', 'path']),
  tool('write_file', 'Ghi toàn bộ nội dung file trong workspace. File văn bản phải có đoạn và xuống dòng hợp lý, không dồn cả tài liệu vào một dòng.', { path: stringField('Đường dẫn tương đối'), content: stringField('Nội dung mới, giữ đầy đủ ký tự xuống dòng cần thiết') }, ['path', 'content']),
  tool('apply_patch', 'Thay thế một đoạn chính xác trong file, giữ nguyên các phần khác.', { path: stringField('Đường dẫn tương đối'), oldText: stringField('Đoạn cũ chính xác'), newText: stringField('Đoạn mới') }, ['path', 'oldText', 'newText']),
  tool('create_directory', 'Tạo thư mục trong workspace. Ưu tiên tool này thay vì lệnh shell.', { path: stringField('Đường dẫn thư mục tương đối') }, ['path']),
  tool('delete_file', 'Xóa một file trong workspace theo cách có thể review và undo. Không xóa thư mục.', { path: stringField('Đường dẫn file tương đối') }, ['path']),
  tool('move_file', 'Di chuyển hoặc đổi tên một file trong workspace theo cách có thể review và undo.', { from: stringField('Đường dẫn file nguồn'), to: stringField('Đường dẫn file đích') }, ['from', 'to']),
  tool('git_diff', 'Đọc git diff hiện tại trong workspace mà không thay đổi file.', {}, []),
  tool('run_command', 'Chạy lệnh bằng đúng shell của hệ điều hành trong workspace. Ưu tiên file tools cho thao tác file.', {
    command: stringField('Lệnh tương thích shell hiện tại'),
    cwd: stringField('Thư mục làm việc tương đối trong workspace; tùy chọn'),
    timeoutSeconds: numberField('Timeout từ 5 đến 900 giây; tùy chọn')
  }, ['command']),
  tool('run_tests', 'Chạy test/validation không tương tác của project bằng đúng shell hiện tại.', {
    command: stringField('Lệnh test tùy chọn'),
    cwd: stringField('Thư mục làm việc tương đối trong workspace; tùy chọn'),
    timeoutSeconds: numberField('Timeout từ 30 đến 1800 giây; tùy chọn')
  }, [])
];

const IMAGE_MODEL_PATTERN = /(image|imagen|gpt-image|dall-e|flux|stable[- ]?diffusion|sdxl|seedream|recraft)/i;
const WEBPAGE_MAX_BYTES = 1_000_000;
const WEBPAGE_MAX_TEXT = 40_000;

function shouldEmitProgressCommentary(content: string | null | undefined): content is string {
  const text = content?.replace(/\s+/g, ' ').trim() ?? '';
  if (text.length >= 120) return true;
  return text.length >= 60 && /(?:error|failed|failure|lỗi|thất bại|không thành công|sửa lại|retry)/i.test(text);
}

function clipNaturalText(text: string, limit: number, fromEnd = false): string {
  if (text.length <= limit) return text;
  const slice = fromEnd ? text.slice(-limit) : text.slice(0, limit);
  if (fromEnd) {
    const boundary = slice.search(/(?:^|[.!?]\s+|\n\n)/);
    return (boundary > -1 ? slice.slice(boundary).replace(/^[.!?\s]+/, '') : slice).trim();
  }
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('\n\n'));
  return `${(boundary >= Math.floor(limit * .55) ? slice.slice(0, boundary + 1) : slice).trim()}…`;
}

export function compactProgressCommentary(content: string): string {
  return clipNaturalText(sanitizeModelText(content).replace(/\s+/g, ' ').trim(), 620);
}

export function compactAgentFinalResponse(content: string): string {
  let text = sanitizeModelText(content).trim().replace(/\n{3,}/g, '\n\n');
  text = text
    .replace(/\n*\s*(?:Mọi thứ đã được tối ưu hóa[^.!?]*[.!?]\s*)?Tôi sẵn sàng hỗ trợ thêm[^.!?]*[.!?]?\s*$/i, '')
    .replace(/\n*\s*(?:Everything is now fully optimized[^.!?]*[.!?]\s*)?I(?:'m| am) ready to help with anything else[^.!?]*[.!?]?\s*$/i, '')
    .trim();
  if (text.length <= 1_400) return text;

  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const selected: string[] = [];
  let size = 0;
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index]!;
    if (selected.length && size + block.length > 1_300) break;
    selected.unshift(block);
    size += block.length + 2;
    if (size >= 900) break;
  }
  return clipNaturalText(selected.join('\n\n'), 1_400, selected.length === 1);
}

async function waitForAbortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('Agent stopped.');
  }
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      cleanup();
      rejectPromise(signal.reason instanceof Error ? signal.reason : new Error('Agent stopped.'));
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolvePromise(value);
      },
      (error) => {
        cleanup();
        rejectPromise(error);
      }
    );
  });
}

function isImageModel(model: { id: string; name: string; kind?: string }): boolean {
  return model.kind?.toLowerCase() === 'image' || IMAGE_MODEL_PATTERN.test(`${model.id} ${model.name}`);
}

function providerPrefix(model: string): string {
  return model.includes('/') ? model.slice(0, model.indexOf('/') + 1).toLowerCase() : '';
}

export function chooseImageModel(
  requestedModel: string,
  currentModel: string,
  models: Array<{ id: string; name: string; kind?: string }>
): string | undefined {
  const requested = requestedModel.trim();
  if (requested && IMAGE_MODEL_PATTERN.test(requested)) return requested;
  const currentPrefix = providerPrefix(currentModel);
  return models
    .filter(isImageModel)
    .sort((left, right) => {
      const score = (model: { id: string; name: string; kind?: string }) =>
        (model.kind?.toLowerCase() === 'image' ? 100 : 0)
        + (providerPrefix(model.id) === currentPrefix ? 20 : 0)
        + (/imagen|gpt-image/i.test(`${model.id} ${model.name}`) ? 10 : 0);
      return score(right) - score(left);
    })[0]?.id;
}

function stringField(description: string): Record<string, unknown> {
  return { type: 'string', description };
}

function numberField(description: string): Record<string, unknown> {
  return { type: 'number', description };
}

function normalizeWebpageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('URL không hợp lệ. Hãy dùng URL đầy đủ bắt đầu bằng http:// hoặc https://.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Chỉ cho phép URL HTTP hoặc HTTPS.');
  if (url.username || url.password) throw new Error('URL có thông tin đăng nhập không được phép.');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const privateIpv4 = /^(?:10|127)\.(?:\d{1,3}\.){2}\d{1,3}$|^169\.254\.(?:\d{1,3}\.)\d{1,3}$|^192\.168\.(?:\d{1,3}\.)\d{1,3}$|^172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}$/;
  if (host === 'localhost' || host === 'localhost.localdomain' || host === '::1' || privateIpv4.test(host) || host.endsWith('.local')) {
    throw new Error('Không thể đọc địa chỉ local hoặc mạng riêng để bảo vệ workspace.');
  }
  return url;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (full, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#')) {
      const isHex = lower.startsWith('#x');
      const codePoint = Number.parseInt(lower.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : full;
    }
    return named[lower] ?? full;
  });
}

function webpageText(html: string, url: URL): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  const text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|main|header|footer|h[1-6]|li|tr|pre|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n').map((line) => decodeHtmlEntities(line).replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
    .replace(/\n{3,}/g, '\n\n');
  const heading = decodeHtmlEntities(title).replace(/[ \t\n]+/g, ' ').trim();
  return [`URL: ${url.toString()}`, heading ? `Title: ${heading}` : '', '', text].filter(Boolean).join('\n').slice(0, WEBPAGE_MAX_TEXT);
}

async function readWebpage(value: string, signal?: AbortSignal): Promise<string> {
  const url = normalizeWebpageUrl(value);
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error('Web request timeout after 15 seconds.')), 15_000);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { accept: 'text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.1', 'user-agent': 'RelayCode/1.0 (+web reader)' } });
    const finalUrl = normalizeWebpageUrl(response.url || url.toString());
    if (!response.ok) throw new Error(`Trang web trả HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > WEBPAGE_MAX_BYTES) throw new Error('Trang web lớn hơn giới hạn 1 MB.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > WEBPAGE_MAX_BYTES) throw new Error('Trang web lớn hơn giới hạn 1 MB.');
    const body = new TextDecoder().decode(bytes);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('html') || /<html[\s>]/i.test(body)) return webpageText(body, finalUrl);
    if (contentType.includes('json')) {
      try { return `URL: ${finalUrl.toString()}\n\n${JSON.stringify(JSON.parse(body), null, 2).slice(0, WEBPAGE_MAX_TEXT)}`; } catch { /* fall through as text */ }
    }
    if (contentType.startsWith('text/') || !contentType) return `URL: ${finalUrl.toString()}\n\n${body.slice(0, WEBPAGE_MAX_TEXT)}`;
    throw new Error(`Định dạng ${contentType || 'không xác định'} không phải nội dung văn bản.`);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } };
}

function supportsCodexTuning(model: string): boolean {
  return /(codex|gpt-5|(?:^|[/_-])o[134](?:$|[/_.-]))/i.test(model);
}

export function normalizeCompletedToolHistory(messages: Array<Record<string, unknown>>): void {
  const repaired: Array<Record<string, unknown>> = [];
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index]!;
    if (message.role === 'tool') {
      repaired.push({
        role: 'user',
        content: `Recovered function response from an interrupted history:\n${String(message.content ?? '').slice(0, 8_000)}`
      });
      continue;
    }
    if (message.role !== 'assistant' || !Array.isArray(message.tool_calls)) {
      repaired.push(message);
      continue;
    }
    const ids = (message.tool_calls as Array<Record<string, unknown>>)
      .map((call) => typeof call.id === 'string' ? call.id.trim() : '')
      .filter(Boolean);
    if (!ids.length) {
      repaired.push(message);
      continue;
    }
    const previousRole = repaired.at(-1)?.role;
    if (previousRole !== 'user' && previousRole !== 'tool') {
      repaired.push({
        role: 'user',
        content: 'Continue the existing Agent task from the recovered function-call history. Reuse completed work.'
      });
    }
    repaired.push(message);
    const results = new Map<string, Record<string, unknown>>();
    let resultIndex = index + 1;
    while (resultIndex < messages.length && messages[resultIndex]?.role === 'tool') {
      const result = messages[resultIndex]!;
      const id = String(result.tool_call_id ?? '').trim();
      if (id && ids.includes(id) && !results.has(id)) results.set(id, result);
      resultIndex++;
    }
    for (const id of ids) {
      repaired.push(results.get(id) ?? {
        role: 'tool',
        tool_call_id: id,
        content: 'ERROR: RelayCode recovered an interrupted run. This tool was not executed; issue it again only if it is still needed.'
      });
    }
    index = resultIndex - 1;
  }
  messages.splice(0, messages.length, ...repaired);
}

export class AgentRuntime {
  public constructor(
    private readonly client: ProviderClient,
    private readonly workspaceRoot: string,
    private readonly requestApproval: (message: string) => Promise<boolean>,
    private readonly onChange: (change: { path: string; original: Uint8Array; updated: Uint8Array; existed: boolean; added: number; removed: number }) => void,
    private readonly readOnly = false,
    private readonly externalTools: ExternalAgentTool[] = [],
    private readonly commandPolicy: { allow: string[]; deny: string[] } = { allow: [], deny: [] },
    private readonly commandRunner?: (command: string, toolName: string, callbacks: StreamCallbacks, signal?: AbortSignal) => Promise<string>,
    private readonly runtimeInstructions = '',
    private readonly conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    private readonly beforeFirstMutation?: () => Promise<void>,
    private readonly activeSkills: Array<{ name: string; path: string }> = [],
    private readonly recoverProvider?: () => Promise<void>,
    private readonly autoValidateChanges = true,
    private readonly requestTuning?: RequestTuning,
    private readonly modelInactivityTimeoutMs = 180_000
  ) {}
  private mutationPreparation: Promise<void> | undefined;
  private readonly mutatedPaths = new Set<string>();
  private commandMutationCount = 0;

  public async run(
    prompt: unknown,
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
    resume?: AgentRunCheckpoint
  ): Promise<void> {
    const mutationRequired = !this.readOnly && requiresWorkspaceMutation(prompt);
    let activeModel = model;
    let successfulMutations = resume?.successfulMutations ?? 0;
    let lastValidatedMutationCount = resume?.lastValidatedMutationCount ?? 0;
    let completionWithoutActionCount = resume?.completionWithoutActionCount ?? 0;
    let validationFailureCount = resume?.validationFailureCount ?? 0;
    let lastProgressCommentary = '';
    let lastProgressCommentaryAt = 0;
    const emitProgressCommentary = (content: string | null | undefined): void => {
      if (!shouldEmitProgressCommentary(content)) return;
      const text = content.replace(/\s+/g, ' ').trim();
      const urgent = /(?:error|failed|failure|lỗi|thất bại|không thành công|sửa lại|retry|đổi hướng|change of direction)/i.test(text);
      const looksLikePrematureFinal = /^(?:#{1,6}\s*)?(?:hoàn tất|hoàn thành|completed|done)\b/i.test(text)
        && !urgent
        && !/(?:nhưng|but|tiếp theo|next|sẽ tiếp tục|will continue)/i.test(text);
      const now = Date.now();
      if (looksLikePrematureFinal || text === lastProgressCommentary) return;
      if (lastProgressCommentaryAt && !urgent && now - lastProgressCommentaryAt < 25_000) return;
      lastProgressCommentary = text;
      lastProgressCommentaryAt = now;
      callbacks.onCommentary?.(compactProgressCommentary(content));
    };
    for (const path of resume?.mutatedPaths ?? []) this.mutatedPaths.add(path);
    const toolFailureCounts = new Map<string, number>();
    const baseInstruction = this.readOnly
      ? 'Bạn là coding planner trong IDE. Đọc workspace và lập kế hoạch thực hiện cụ thể, nhưng không được sửa file hoặc chạy lệnh trong Plan mode. Kế hoạch phải là Markdown có tiêu đề rõ ràng, tóm tắt mục tiêu, phần cần người dùng xác nhận hoặc giả định quan trọng, các thay đổi đề xuất theo file/module, trình tự thực hiện, cách kiểm thử và rủi ro cần lưu ý. Nêu đường dẫn thật sau khi đã kiểm tra workspace; không bịa file. Khi cần trình bày cấu trúc thư mục, dùng đúng một fenced code block ```text, mỗi file hoặc thư mục nằm trên một dòng liên tiếp theo ký hiệu ├── và └──, thư mục luôn kết thúc bằng /, chú thích ngắn đặt sau " # ", tuyệt đối không chèn dòng trống giữa các node. Mỗi node chỉ ghi tên tương đối với thư mục cha; không lặp lại đường dẫn đầy đủ ở từng dòng. Nếu người dùng gửi URL, dùng read_webpage trước khi lập kế hoạch. Không tuyên bố đã thực hiện kế hoạch.'
      : 'Bạn là coding agent trong IDE. Dùng tools để kiểm tra workspace trước khi kết luận. Nếu người dùng gửi URL hoặc yêu cầu đọc một trang web, bắt buộc dùng read_webpage trước khi trả lời thay vì đoán nội dung. Chỉ thao tác trong workspace. Nếu người dùng yêu cầu tạo, sửa, thêm hoặc xóa file, bạn bắt buộc phải gọi write_file, apply_patch hoặc generate_image và kiểm tra kết quả; không được chỉ tuyên bố đã hoàn tất. Khi người dùng yêu cầu tạo ảnh, hãy dùng list_models để tìm model image phù hợp rồi gọi generate_image; không tạo ảnh giả bằng SVG/CSS trừ khi người dùng yêu cầu rõ. Nếu API ảnh không được hỗ trợ, hãy tìm pipeline Python tạo ảnh đã có trong workspace và chỉ dùng run_command khi pipeline đó thực sự tồn tại; không tự cài model nặng hoặc tuyên bố đã tạo ảnh khi chưa có file. Sau khi sửa, chạy kiểm tra phù hợp. Phản hồi cuối phải ngắn gọn, tối đa 120 từ: nói chính xác kết quả trước, dùng tối đa 2-4 bullet cho thay đổi chính và kiểm tra đã chạy. Không liệt kê lại toàn bộ file vì Review card đã hiển thị chúng. Dùng chữ đậm cho ý chính, bọc tên hàm/lệnh trong backtick, và chỉ viết liên kết Markdown [tên file](đường/dẫn/file:line) khi một file cụ thể thực sự cần được nhấn mạnh. Không dùng emoji hoặc icon trang trí trong câu trả lời. Nếu chưa thực hiện được, nói rõ chưa hoàn thành và nguyên nhân. Không thuật lại từng bước suy luận, không tự khen kết quả, không mời người dùng yêu cầu thêm và không lặp lại log công cụ.';
    const continuityInstruction = 'Treat follow-up requests as continuation of the same workspace task. Inspect the current workspace state before changing files, reuse existing files and directories, and never recreate the project in a new directory unless the user explicitly asks.';
    const identityInstruction = `You are RelayCode, the AI coding agent inside the RelayCode IDE extension. The selected underlying model identifier for this run is "${activeModel}". When asked who you are, identify the product agent as RelayCode and state the selected model identifier when useful. Never claim to be Codex, Claude, Gemini, DeepSeek, or another model unless that identity is explicitly present in the selected model identifier. Do not infer the provider or model family from writing style or workspace instructions.`;
    const presentationInstruction = 'Present file references in RelayCode style: when mentioning two or more files, put each file on its own Markdown bullet line. Use clickable Markdown links such as [App.jsx](src/App.jsx:1), not a sentence containing several inline-code file names. Keep the explanation after each link short and plain. Never emit provider control tokens such as DSML or function_calls as visible text. When writing prose-oriented files such as .txt or .md, use meaningful paragraphs and physical line breaks instead of putting the whole document on one line.';
    const commentaryInstruction = 'Use RelayCode communication rhythm. At the start of a nontrivial task, write one natural paragraph in the user language that confirms your understanding and states the overall direction; then continue through routine reads, edits, commands, and tests without narrating each tool. Do not introduce individual tool calls with headings, colons, file lists, or phrases such as "I will run", "Starting", or "Check this file". Send another substantive progress paragraph only at a meaningful phase boundary, after a concrete result or error, when the direction changes, or after about 25-30 seconds of substantial work. Keep each progress paragraph under 90 words and combine what was completed, the concrete result or problem, and what you will do next; it must never map one message to one tool call. Leave response.content empty for routine intermediate tool calls. Never expose internal reasoning, proposed tool arguments, repeated plans, or self-review. Do not announce completion while issuing more tools. After all tool work is complete, return one separate concise final answer; do not repeat every changed file because the Review card already shows them.';
    const systemContent = [identityInstruction, baseInstruction, continuityInstruction, presentationInstruction, commentaryInstruction, shellRuntimeInstruction(this.workspaceRoot), this.runtimeInstructions].filter(Boolean).join('\n\n');
    const messages: Array<Record<string, unknown>> = resume?.messages?.length ? resume.messages : [
      {
        role: 'system',
        content: systemContent
      },
      ...this.conversationHistory.slice(-12).map((message) => ({ role: message.role, content: message.content.slice(0, 16_000) })),
      { role: 'user', content: prompt }
    ];
    if (resume?.messages?.length) {
      const systemMessage = messages.find((message) => message.role === 'system');
      if (systemMessage) systemMessage.content = systemContent;
      else messages.unshift({ role: 'system', content: systemContent });
    }
    let pendingToolCalls: AgentToolCall[] = resume?.pendingToolCalls ?? [];
    let nextToolIndex = resume?.nextToolIndex ?? 0;
    if (!pendingToolCalls.length) normalizeCompletedToolHistory(messages);
    const checkpoint = async (step: number, lastStatus: string) => {
      await callbacks.onCheckpoint?.({
        version: 1,
        model: activeModel,
        messages,
        step,
        successfulMutations,
        completionWithoutActionCount,
        mutatedPaths: [...this.mutatedPaths],
        lastValidatedMutationCount,
        validationFailureCount,
        pendingToolCalls,
        nextToolIndex,
        lastStatus,
        updatedAt: Date.now()
      });
    };
    for (let step = resume?.step ?? 0; ; step++) {
      if (!pendingToolCalls.length) {
        this.compactMessages(messages);
        normalizeCompletedToolHistory(messages);
        const thinkingStatus = step ? 'Đang suy nghĩ bước tiếp theo' : 'Đang phân tích yêu cầu';
        callbacks.onStatus(thinkingStatus);
        await checkpoint(step, thinkingStatus);
        const response = await this.completeStep(
          activeModel,
          messages,
          [...tools, ...this.externalTools.map((item) => item.definition)],
          callbacks,
          signal
        );
        callbacks.onMetrics?.(response.metrics);
        if (!response.toolCalls.length) {
        if (
          this.autoValidateChanges
          && successfulMutations > lastValidatedMutationCount
          && [...this.mutatedPaths].some((path) => this.shouldValidatePath(path))
        ) {
          const commands = await this.detectValidationCommands();
          if (commands.length) {
            emitProgressCommentary(response.content);
            const validationResults: string[] = [];
            let validationFailed = false;
            for (const validation of commands) {
              const location = validation.cwd && validation.cwd !== '.' ? ` · ${validation.cwd}` : '';
              callbacks.onStatus(`Đang tự động kiểm tra thay đổi: ${validation.command}${location}`);
              try {
                const output = await this.execute('run_tests', { command: validation.command, cwd: validation.cwd, timeoutSeconds: 600 }, callbacks, activeModel, signal);
                validationResults.push(`Command: ${validation.command}\nWorking directory: ${validation.cwd || '.'}\nResult:\n${output.slice(0, 30_000)}`);
              } catch (error) {
                validationFailed = true;
                const detail = error instanceof Error ? error.message : String(error);
                validationResults.push(`Command: ${validation.command}\nWorking directory: ${validation.cwd || '.'}\nERROR:\n${detail.slice(0, 30_000)}`);
                break;
              }
            }
            if (!validationFailed) {
              lastValidatedMutationCount = successfulMutations;
              validationFailureCount = 0;
            } else {
              validationFailureCount++;
            }
            messages.push({ role: 'assistant', content: response.content || null });
            messages.push({
              role: 'user',
              content: `RelayCode automatically ran validation after your edits.\n\n${validationResults.join('\n\n')}\n\n${validationFailed
                ? 'Validation failed. Inspect the error, fix the actual cause with tools, then let RelayCode validate again. Do not merely repeat the same failing command or claim completion.'
                : 'Validation passed. Give the final concise summary unless another necessary check remains.'}`
            });
            if (validationFailed && validationFailureCount >= 6) {
              throw new Error(`Agent đã tự sửa và chạy validation lại ${validationFailureCount} lần nhưng lỗi dự án vẫn còn.\n\n${validationResults.at(-1) ?? 'Validation failed.'}`);
            }
            await checkpoint(step + 1, validationFailed ? 'Kiểm tra tự động thất bại · Agent đang sửa lỗi' : 'Kiểm tra tự động đã hoàn thành');
            continue;
          }
        }
        if (mutationRequired && successfulMutations === 0) {
          completionWithoutActionCount++;
          if (completionWithoutActionCount >= 3) {
            throw new Error('Agent chưa tạo hoặc sửa file nào sau 3 lần yêu cầu thực hiện. Model hiện tại có thể không hỗ trợ tool calling ổn định; hãy thử model Agent/agentic khác.');
          }
          messages.push({ role: 'assistant', content: response.content || null });
          messages.push({
            role: 'user',
            content: 'Bạn chưa tạo hoặc sửa file nào. Hãy tiếp tục ngay bằng write_file, apply_patch hoặc generate_image. Chỉ kết luận hoàn thành sau khi tool trả về thành công.'
          });
          callbacks.onStatus('Agent chưa tạo thay đổi · đang yêu cầu model tiếp tục');
          await checkpoint(step + 1, 'Agent chưa tạo thay đổi · đang yêu cầu model tiếp tục');
          continue;
        }
        callbacks.onActivityComplete?.();
        callbacks.onDelta(compactAgentFinalResponse(response.content || 'Không có nội dung phản hồi từ model.'));
        callbacks.onStatus('Hoàn tất');
        return;
        }
        emitProgressCommentary(response.content);
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }))
        });
        pendingToolCalls = response.toolCalls;
        nextToolIndex = 0;
        await checkpoint(step, 'Model đã trả về thao tác');
      }
      let repairRequested = false;
      for (; nextToolIndex < pendingToolCalls.length;) {
        const call = pendingToolCalls[nextToolIndex]!;
        let args: Record<string, unknown>;
        let argumentError = '';
        try { args = JSON.parse(call.arguments) as Record<string, unknown>; }
        catch (error) {
          args = {};
          argumentError = `ERROR: Invalid JSON arguments for ${call.name}: ${error instanceof Error ? error.message : String(error)}.`;
        }
        const toolStatus = this.toolStatus(call.name, args);
        callbacks.onStatus(toolStatus);
        await checkpoint(step, toolStatus);
        let result: string;
        let attempt = 0;
        const commandMutationCountBefore = this.commandMutationCount;
        while (true) {
          attempt++;
          try {
            result = argumentError || await this.execute(call.name, args, callbacks, activeModel, signal);
          } catch (error) {
            if (signal?.aborted) {
              throw signal.reason instanceof Error ? signal.reason : error;
            }
            result = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
          }
          if (!/^ERROR:?/i.test(result)) break;
          const failureKey = `${call.name}:${result.replace(/\s+/g, ' ').slice(0, 500)}`;
          const failureCount = (toolFailureCounts.get(failureKey) ?? 0) + 1;
          toolFailureCounts.set(failureKey, failureCount);
          const extensionFailure = this.isExtensionRuntimeFailure(result);
          if (!extensionFailure) {
            if (failureCount >= 6) {
              throw new Error(`Agent đã thử sửa lỗi ${call.name} ${failureCount} lần nhưng cùng lỗi vẫn còn.\n\n${result.replace(/^ERROR:\s*/i, '')}`);
            }
            repairRequested = true;
            result += `\nRelayCode will return this project/tool-call error to the Agent for automatic repair (attempt ${failureCount}/6). Inspect the actual code or arguments and do not repeat the identical failing command.`;
            break;
          }
          if (!callbacks.onToolFailure) throw new Error(result.replace(/^ERROR:\s*/i, ''));
          const decision = await waitForAbortable(callbacks.onToolFailure({
            id: call.id,
            tool: call.name,
            arguments: args,
            message: result.replace(/^ERROR:\s*/i, ''),
            model: activeModel,
            attempt
          }), signal);
          if (decision.action === 'retry') {
            repairRequested = true;
            result += '\nNgười dùng yêu cầu Agent phân tích lỗi và tạo một tool call đã sửa.';
          }
          if (decision.action === 'change-model') {
            activeModel = decision.model;
            repairRequested = true;
            result += `\nĐã chuyển sang model ${activeModel}; Agent sẽ lập lại bước hiện tại mà không chạy lại các tool đã thành công.`;
          } else {
            if (decision.action === 'skip') result += '\nNgười dùng đã chọn bỏ qua tool lỗi này.';
          }
          break;
        }
        if (call.name === 'generate_image' && /^ERROR:?/i.test(result)) {
          callbacks.onStatus(`Tạo ảnh thất bại: ${String(args.path ?? 'image.png').slice(0, 140)}`);
        }
        if (['write_file', 'apply_patch', 'generate_image', 'create_directory', 'delete_file', 'move_file'].includes(call.name) && !/^(ERROR|DENIED):?/i.test(result)) {
          successfulMutations++;
          for (const changedPath of [args.path, args.from, args.to].map((value) => String(value ?? '').trim()).filter(Boolean)) {
            this.mutatedPaths.add(changedPath);
          }
        }
        if ((call.name === 'run_command' || call.name === 'run_tests') && this.commandMutationCount > commandMutationCountBefore) {
          successfulMutations += this.commandMutationCount - commandMutationCountBefore;
        }
        if (call.name === 'run_tests' && !/^(ERROR|DENIED):?/i.test(result)) {
          lastValidatedMutationCount = successfulMutations;
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: result.slice(0, 30_000) });
        nextToolIndex++;
        await checkpoint(step, /^(ERROR|DENIED):?/i.test(result) ? `${call.name} chưa hoàn thành` : `${call.name} đã hoàn thành`);
        if (repairRequested) {
          // A model turn with multiple tool calls must receive one result for
          // every call before the next turn. Mark unprocessed calls as skipped
          // so Anthropic and OpenAI-compatible histories remain valid.
          for (const skipped of pendingToolCalls.slice(nextToolIndex)) {
            messages.push({
              role: 'tool',
              tool_call_id: skipped.id,
              content: `ERROR: RelayCode skipped ${skipped.name} because an earlier tool call in the same model response failed. This tool was not executed; issue it again only if it is still needed.`
            });
          }
          pendingToolCalls = [];
          nextToolIndex = 0;
          messages.push({
            role: 'user',
            content: 'The previous tool call failed. Inspect its exact error and issue a corrected tool call appropriate for the current OS and shell. Reuse completed work; do not restart the project or repeat the identical failing call.'
          });
          break;
        }
      }
      if (repairRequested) continue;
      pendingToolCalls = [];
      nextToolIndex = 0;
      await checkpoint(step + 1, 'Đã hoàn thành bước hiện tại');
    }
  }

  private shouldValidatePath(path: string): boolean {
    return !/\.(?:md|mdx|txt|png|jpe?g|gif|webp|svg|ico|pdf|docx?|xlsx?|pptx?)$/i.test(path);
  }

  private isExtensionRuntimeFailure(result: string): boolean {
    return /\b(?:RELAYCODE_INTERNAL_ERROR|EXTENSION_HOST_ERROR|TOOL_RUNTIME_UNAVAILABLE)\b/i.test(result);
  }

  private async detectValidationCommands(): Promise<Array<{ command: string; cwd: string }>> {
    const exists = async (directory: string, name: string) => {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(resolve(this.workspaceRoot, directory, name)));
        return true;
      } catch {
        return false;
      }
    };
    const hasDotNetProject = async (directory: string) => {
      try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(resolve(this.workspaceRoot, directory)));
        return entries.some(([name, type]) => (type & vscode.FileType.File) && /\.(?:sln|csproj)$/i.test(name));
      } catch {
        return false;
      }
    };
    const markers = ['package.json', 'Cargo.toml', 'go.mod', 'pom.xml', 'gradlew.bat', 'gradlew', 'Package.swift', 'composer.json', 'Gemfile', 'pyproject.toml', 'pytest.ini', 'setup.cfg', 'requirements.txt', 'CMakeLists.txt'];
    const hasProject = async (directory: string) => {
      for (const marker of markers) if (await exists(directory, marker)) return true;
      return hasDotNetProject(directory);
    };
    const projectDirectories = new Set<string>();
    const changedPaths = [...this.mutatedPaths].filter((path) => this.shouldValidatePath(path));
    for (const changedPath of changedPaths.length ? changedPaths : ['.']) {
      let current = dirname(resolve(this.workspaceRoot, changedPath));
      if (changedPath === '.') current = resolve(this.workspaceRoot);
      while (this.isWorkspacePath(current)) {
        const relativeDirectory = relative(this.workspaceRoot, current) || '.';
        if (await hasProject(relativeDirectory)) {
          projectDirectories.add(relativeDirectory);
          break;
        }
        if (current === resolve(this.workspaceRoot)) break;
        current = dirname(current);
      }
    }
    if (!projectDirectories.size && await hasProject('.')) projectDirectories.add('.');

    const detected: Array<{ command: string; cwd: string }> = [];
    for (const directory of projectDirectories) {
      const commands = await this.validationCommandsForDirectory(directory, exists, hasDotNetProject);
      detected.push(...commands.map((command) => ({ command, cwd: directory })));
    }
    return detected.slice(0, 12);
  }

  private async validationCommandsForDirectory(
    directory: string,
    exists: (directory: string, name: string) => Promise<boolean>,
    hasDotNetProject: (directory: string) => Promise<boolean>
  ): Promise<string[]> {
    if (await exists(directory, 'package.json')) {
      try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(resolve(this.workspaceRoot, directory, 'package.json')));
        const pkg = JSON.parse(new TextDecoder().decode(raw)) as { scripts?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        const selected = scripts.check
          ? ['check']
          : ['test', 'typecheck', 'lint', 'build'].filter((name) => scripts[name]).slice(0, 3);
        if (selected.length) {
          const runner = await exists(directory, 'pnpm-lock.yaml') ? 'pnpm' : await exists(directory, 'yarn.lock') ? 'yarn' : 'npm';
          return selected.map((script) => runner === 'npm'
            ? script === 'test' ? 'npm test' : `npm run ${script}`
            : `${runner} ${script}`);
        }
      } catch {
        // Fall through to other project types when package.json is not readable.
      }
    }
    if (await exists(directory, 'Cargo.toml')) return ['cargo test'];
    if (await exists(directory, 'go.mod')) return ['go test ./...'];
    if (await exists(directory, 'pom.xml')) return ['mvn test'];
    if (await exists(directory, 'gradlew.bat') && process.platform === 'win32') return ['.\\gradlew.bat test'];
    if (await exists(directory, 'gradlew')) return ['./gradlew test'];
    if (await exists(directory, 'Package.swift')) return ['swift test'];
    if (await exists(directory, 'composer.json')) return ['composer test'];
    if (await exists(directory, 'Gemfile')) return ['bundle exec rspec'];
    if (await exists(directory, 'pyproject.toml') || await exists(directory, 'pytest.ini') || await exists(directory, 'setup.cfg') || await exists(directory, 'requirements.txt')) return ['python -m pytest'];
    if (await hasDotNetProject(directory)) return ['dotnet test'];
    if (await exists(directory, 'CMakeLists.txt') && await exists(directory, 'build')) return ['cmake --build build', 'ctest --test-dir build --output-on-failure'];
    return [];
  }

  private compactMessages(messages: Array<Record<string, unknown>>, maxChars = 120_000): void {
    const size = () => {
      try { return JSON.stringify(messages).length; } catch { return maxChars + 1; }
    };
    if (size() <= maxChars || messages.length < 12) return;

    const firstUser = messages.find((message) => message.role === 'user');
    const originalRequest = typeof firstUser?.content === 'string'
      ? firstUser.content.slice(0, 8_000)
      : '[Original request included structured content.]';
    let keepFrom = Math.max(2, messages.length - 24);
    while (keepFrom < messages.length && messages[keepFrom]?.role === 'tool') keepFrom++;
    const recent = messages.slice(keepFrom);
    messages.splice(1, messages.length - 1,
      {
        role: 'system',
        content: `Earlier Agent activity was compacted to keep this long-running task within the model context window. Original request:\n${originalRequest}\nInspect the current workspace and git diff when details from earlier tool calls are needed. Do not recreate work that already exists.`
      },
      ...recent
    );

    if (size() <= maxChars) return;
    for (let index = 1; index < messages.length - 8 && size() > maxChars; index++) {
      const message = messages[index]!;
      if (typeof message.content === 'string' && message.content.length > 2_000) {
        message.content = `${message.content.slice(0, 2_000)}\n[content compacted]`;
      }
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls as Array<Record<string, unknown>> : [];
      for (const call of calls) {
        const fn = call.function as Record<string, unknown> | undefined;
        if (fn && typeof fn.arguments === 'string' && fn.arguments.length > 1_000) {
          fn.arguments = '{"compacted":true}';
        }
      }
    }
  }

  private async completeStep(
    model: string,
    messages: Array<Record<string, unknown>>,
    definitions: Array<Record<string, unknown>>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<Awaited<ReturnType<ProviderClient['completeWithTools']>>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const abortFromParent = () => controller.abort(signal?.reason);
      signal?.addEventListener('abort', abortFromParent, { once: true });
      let idleTimer: NodeJS.Timeout | undefined;
      let lastUiStatus = '';
      let lastUiAt = 0;
      let hasConcreteToolProgress = false;
      const touch = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(
          () => controller.abort(new Error(`Luồng Agent không nhận dữ liệu mới trong ${Math.ceil(this.modelInactivityTimeoutMs / 1_000)} giây.`)),
          this.modelInactivityTimeoutMs
        );
      };
      const onProgress = (progress: ToolCompletionProgress) => {
        touch();
        if (progress.type === 'tool' && progress.name) hasConcreteToolProgress = true;
        if (progress.type !== 'tool' && hasConcreteToolProgress) return;
        const status = this.progressStatus(progress);
        const now = Date.now();
        if (status !== lastUiStatus || now - lastUiAt >= 2_500) {
          lastUiStatus = status;
          lastUiAt = now;
          callbacks.onStatus(status);
        }
      };
      try {
        touch();
        const response = await this.client.completeWithTools(
          model,
          messages,
          definitions,
          controller.signal,
          onProgress,
          supportsCodexTuning(model) ? this.requestTuning : undefined
        );
        return { ...response, content: sanitizeModelText(response.content) };
      } catch (error) {
        lastError = controller.signal.reason instanceof Error && !signal?.aborted ? controller.signal.reason : error;
        if (signal?.aborted || attempt === 1 || !this.retryableAgentError(lastError)) throw lastError;
        callbacks.onStatus('Kết nối model gián đoạn · đang khôi phục provider');
        await this.recoverProvider?.();
        callbacks.onStatus('Provider đã hoạt động lại · đang gửi lại bước hiện tại');
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 700));
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
        signal?.removeEventListener('abort', abortFromParent);
      }
    }
    throw lastError;
  }

  private retryableAgentError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    if (/HTTP 40[013]|API key|Client Key|từ chối quyền|không hợp lệ|không hỗ trợ/i.test(message)) return false;
    return /fetch failed|network|socket|timeout|timed out|không nhận dữ liệu|HTTP 408|HTTP 409|HTTP 429|HTTP 5\d\d|abort/i.test(message)
      || error instanceof TypeError;
  }

  private progressStatus(progress: ToolCompletionProgress): string {
    if (progress.type !== 'tool' || !progress.name) return 'Đang phân tích hướng thực hiện';
    const raw = progress.arguments ?? '';
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Streaming providers send tool arguments character by character. Do
      // not expose a field until its closing quote has arrived; otherwise a
      // single command becomes dozens of growing activity rows.
      for (const field of ['path', 'pattern', 'query', 'command', 'skill']) {
        const match = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(raw);
        if (match?.[1]) args[field] = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }
    return this.toolStatus(progress.name, args);
  }

  private toolStatus(name: string, args: Record<string, unknown>): string {
    const short = (value: unknown, fallback: string) => String(value ?? '').trim().slice(0, 140) || fallback;
    if (name === 'run_command') return `Đang chạy lệnh: ${short(args.command, 'PowerShell')}`;
    if (name === 'run_tests') return `Đang chạy kiểm tra: ${short(args.command, 'npm test')}`;
    if (name === 'generate_image') return `Đang tạo ảnh: ${short(args.path, 'image.png')}`;
    if (name === 'list_models') return 'Đang tìm model tạo ảnh';
    if (name === 'write_file' || name === 'apply_patch') return `Đang sửa file: ${short(args.path, 'workspace')}`;
    if (name === 'create_directory') return `Đang tạo thư mục: ${short(args.path, 'workspace')}`;
    if (name === 'delete_file') return `Đang xóa file: ${short(args.path, 'workspace')}`;
    if (name === 'move_file') return `Đang di chuyển file: ${short(args.from, 'source')} → ${short(args.to, 'destination')}`;
    if (name === 'read_file') return `Đang phân tích file: ${short(args.path, 'workspace')}`;
    if (name === 'stat_path') return `Đang kiểm tra đường dẫn: ${short(args.path, 'workspace')}`;
    if (name === 'list_directory') return `Đang xem thư mục: ${short(args.path, 'workspace')}`;
    if (name === 'git_diff') return 'Đang đọc Git diff';
    if (name === 'read_skill_file') return `Đang đọc tài nguyên skill: ${short(args.skill, 'skill')} / ${short(args.path, 'file')}`;
    if (name === 'list_files') return `Đang xem cấu trúc dự án: ${short(args.pattern, '**/*')}`;
    if (name === 'search_text') return `Đang tìm trong dự án: ${short(args.query, 'nội dung')}`;
    if (name === 'read_webpage') return `Đang đọc trang web: ${short(args.url, 'URL')}`;
    const external = this.externalTools.find((item) => (item.definition.function as { name?: string } | undefined)?.name === name);
    if (external) return `Đang dùng MCP: ${external.label}`;
    return `Đang dùng công cụ: ${name}`;
  }

  private async execute(name: string, args: Record<string, unknown>, callbacks: StreamCallbacks, currentModel: string, signal?: AbortSignal): Promise<string> {
    const external = this.externalTools.find((item) => (item.definition.function as { name?: string } | undefined)?.name === name);
    if (external) {
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không gọi MCP tool.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn dùng MCP: ${external.label}`), signal)) return 'DENIED by user';
      return waitForAbortable(external.execute(args, signal), signal);
    }
    if (name === 'read_file') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    }
    if (name === 'stat_path') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        const type = stat.type & vscode.FileType.Directory ? 'directory' : stat.type & vscode.FileType.File ? 'file' : 'other';
        return JSON.stringify({ exists: true, type, size: stat.size, modifiedAt: stat.mtime });
      } catch {
        return JSON.stringify({ exists: false });
      }
    }
    if (name === 'list_directory') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      const entries = await vscode.workspace.fs.readDirectory(uri);
      return entries.slice(0, 500).map(([entry, type]) => `${type & vscode.FileType.Directory ? '[dir]' : '[file]'} ${entry}`).join('\n') || 'Directory is empty.';
    }
    if (name === 'read_skill_file') {
      const skillName = String(args.skill ?? '').trim().toLowerCase();
      const resourcePath = String(args.path ?? '').trim();
      const skill = this.activeSkills.find((item) => item.name.toLowerCase() === skillName);
      if (!skill) return `DENIED: Skill "${skillName || 'unknown'}" chưa được kích hoạt trong cuộc trò chuyện này.`;
      if (!resourcePath) return 'ERROR: path cannot be empty.';
      const root = resolve(dirname(skill.path));
      const target = resolve(root, resourcePath);
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        return 'DENIED: Đường dẫn nằm ngoài thư mục skill.';
      }
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(target));
      if (bytes.byteLength > 120_000) return 'ERROR: Tài nguyên skill lớn hơn giới hạn 120 KB.';
      return new TextDecoder().decode(bytes);
    }
    if (name === 'list_files') {
      const uris = await vscode.workspace.findFiles(String(args.pattern ?? '**/*'), '**/{node_modules,.git,dist,out}/**', 300);
      return uris.map((uri) => relative(this.workspaceRoot, uri.fsPath)).join('\n');
    }
    if (name === 'search_text') {
      const query = String(args.query ?? '');
      if (!query) return 'No query provided.';
      const pattern = String(args.pattern ?? '**/*');
      const uris = await vscode.workspace.findFiles(pattern, '**/{node_modules,.git,dist,out}/**', 250);
      const hits: string[] = [];
      for (const uri of uris) {
        if (hits.length >= 100) break;
        try {
          const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
          text.split(/\r?\n/).forEach((line, index) => { if (line.includes(query) && hits.length < 100) hits.push(`${relative(this.workspaceRoot, uri.fsPath)}:${index + 1}: ${line.trim().slice(0, 240)}`); });
        } catch { /* Ignore binary files. */ }
      }
      return hits.join('\n') || 'No matches.';
    }
    if (name === 'read_webpage') {
      return readWebpage(String(args.url ?? ''), signal);
    }
    if (name === 'list_models') {
      const models = await this.client.listModels(signal);
      const imageModels = models.filter((item) => /(image|imagen|dall-e|gpt-image|flux|stable-diffusion|sdxl)/i.test(`${item.id} ${item.name}`));
      const ordered = [...imageModels, ...models.filter((item) => !imageModels.includes(item))].slice(0, 120);
      return ordered.map((item) => `${item.id}${imageModels.includes(item) ? ' [image]' : ''}`).join('\n') || 'Provider không trả về model nào.';
    }
    if (name === 'generate_image') {
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được tạo ảnh.';
      if (!this.client.generateImage) return 'ERROR: Provider hiện tại không hỗ trợ API tạo ảnh. Hãy chuyển sang 9Router, Cockpit, OpenAI hoặc endpoint OpenAI-compatible có /images/generations.';
      const prompt = String(args.prompt ?? '').trim();
      const requestedPath = String(args.path ?? '').trim();
      const requestedModel = String(args.model ?? '').trim();
      const availableModels = await this.client.listModels(signal);
      const imageModel = chooseImageModel(requestedModel, currentModel, availableModels);
      const size = String(args.size ?? '').trim() || '1024x1024';
      if (!prompt) return 'ERROR: prompt cannot be empty.';
      if (!requestedPath) return 'ERROR: path cannot be empty.';
      if (!imageModel) {
        return `ERROR: Provider hiện tại không có model tạo ảnh. Model Agent ${currentModel} chỉ dùng cho văn bản và không được gửi tới API ảnh. Hãy kết nối một provider có model image/imagen/gpt-image/flux.`;
      }
      if (!/^\d{3,4}x\d{3,4}$/.test(size)) return 'ERROR: size phải có dạng 1024x1024.';
      let uri = this.workspaceUri(requestedPath);
      if (!await waitForAbortable(this.requestApproval(`Agent muốn tạo ảnh ${relative(this.workspaceRoot, uri.fsPath)} bằng model ${imageModel}`), signal)) return 'DENIED by user';
      const generated = await this.client.generateImage(imageModel, prompt, size, signal);
      const expectedExtension = generated.mimeType === 'image/jpeg' ? '.jpg' : generated.mimeType === 'image/webp' ? '.webp' : '.png';
      if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extname(uri.fsPath).toLowerCase())) {
        uri = vscode.Uri.file(`${uri.fsPath}${expectedExtension}`);
      } else if (generated.mimeType !== 'application/octet-stream' && !extensionMatchesMime(extname(uri.fsPath), generated.mimeType)) {
        uri = vscode.Uri.file(uri.fsPath.slice(0, -extname(uri.fsPath).length) + expectedExtension);
      }
      let original: Uint8Array; let existed = true;
      try { original = await vscode.workspace.fs.readFile(uri); } catch { original = new Uint8Array(); existed = false; }
      await this.prepareMutation();
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname(uri.fsPath)));
      await vscode.workspace.fs.writeFile(uri, generated.bytes);
      this.onChange({ path: uri.fsPath, original, updated: generated.bytes, existed, added: 1, removed: existed ? 1 : 0 });
      const output = relative(this.workspaceRoot, uri.fsPath).replace(/\\/g, '/');
      return `Ảnh đã được tạo: ${output} (${generated.mimeType}, ${generated.bytes.byteLength} bytes)${generated.revisedPrompt ? `\nPrompt đã tinh chỉnh: ${generated.revisedPrompt}` : ''}`;
    }
    if (name === 'write_file') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được sửa file.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn sửa ${relative(this.workspaceRoot, uri.fsPath)}`), signal)) return 'DENIED by user';
      let original: Uint8Array; let existed = true;
      try { original = await vscode.workspace.fs.readFile(uri); } catch { original = new Uint8Array(); existed = false; }
      const updated = new TextEncoder().encode(String(args.content ?? ''));
      await this.prepareMutation();
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname(uri.fsPath)));
      await vscode.workspace.fs.writeFile(uri, updated);
      const { added, removed } = countLineChanges(original, updated);
      this.onChange({ path: uri.fsPath, original, updated, existed, added, removed });
      return 'File saved.';
    }
    if (name === 'apply_patch') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được sửa file.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn sửa ${relative(this.workspaceRoot, uri.fsPath)}`), signal)) return 'DENIED by user';
      const current = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      const oldText = String(args.oldText ?? '');
      const newText = String(args.newText ?? '');
      if (!oldText) return 'ERROR: oldText cannot be empty.';
      const occurrences = current.split(oldText).length - 1;
      if (occurrences !== 1) return `ERROR: expected exactly one match, found ${occurrences}.`;
      const original = new TextEncoder().encode(current);
      const updated = new TextEncoder().encode(current.replace(oldText, newText));
      await this.prepareMutation();
      await vscode.workspace.fs.writeFile(uri, updated);
      const { added, removed } = countLineChanges(original, updated);
      this.onChange({ path: uri.fsPath, original, updated, existed: true, added, removed });
      return 'Patch applied.';
    }
    if (name === 'create_directory') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được tạo thư mục.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn tạo thư mục ${relative(this.workspaceRoot, uri.fsPath)}`), signal)) return 'DENIED by user';
      await this.prepareMutation();
      await vscode.workspace.fs.createDirectory(uri);
      return 'Directory created.';
    }
    if (name === 'delete_file') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được xóa file.';
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type & vscode.FileType.Directory) return 'ERROR: delete_file only accepts files; recursive directory deletion is not allowed.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn xóa ${relative(this.workspaceRoot, uri.fsPath)}`), signal)) return 'DENIED by user';
      const original = await vscode.workspace.fs.readFile(uri);
      await this.prepareMutation();
      await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
      this.onChange({ path: uri.fsPath, original, updated: new Uint8Array(), existed: true, added: 0, removed: countContentLines(original) });
      return 'File deleted and added to Review.';
    }
    if (name === 'move_file') {
      const source = this.workspaceUri(String(args.from ?? ''));
      const destination = this.workspaceUri(String(args.to ?? ''));
      if (source.fsPath === destination.fsPath) return 'ERROR: source and destination are identical.';
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được di chuyển file.';
      const sourceStat = await vscode.workspace.fs.stat(source);
      if (sourceStat.type & vscode.FileType.Directory) return 'ERROR: move_file only accepts files.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn di chuyển ${relative(this.workspaceRoot, source.fsPath)} đến ${relative(this.workspaceRoot, destination.fsPath)}`), signal)) return 'DENIED by user';
      const sourceBytes = await vscode.workspace.fs.readFile(source);
      let destinationBytes: Uint8Array = new Uint8Array();
      let destinationExisted = true;
      try { destinationBytes = await vscode.workspace.fs.readFile(destination); } catch { destinationExisted = false; }
      await this.prepareMutation();
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname(destination.fsPath)));
      await vscode.workspace.fs.writeFile(destination, sourceBytes);
      await vscode.workspace.fs.delete(source, { recursive: false, useTrash: false });
      this.onChange({ path: source.fsPath, original: sourceBytes, updated: new Uint8Array(), existed: true, added: 0, removed: countContentLines(sourceBytes) });
      const destinationChanges = countLineChanges(destinationBytes, sourceBytes);
      this.onChange({ path: destination.fsPath, original: destinationBytes, updated: sourceBytes, existed: destinationExisted, ...destinationChanges });
      return 'File moved and both paths were added to Review.';
    }
    if (name === 'git_diff') {
      try {
        const { stdout } = await execFileAsync('git', ['diff', '--no-ext-diff', '--'], {
          cwd: this.workspaceRoot,
          windowsHide: true,
          maxBuffer: 2_000_000,
          timeout: 30_000,
          signal
        });
        return stdout.slice(-30_000) || 'Git diff is empty.';
      } catch (error) {
        return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (name === 'run_command') {
      const command = String(args.command ?? '').trim();
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được chạy lệnh.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn chạy: ${command}`), signal)) return 'DENIED by user';
      const policyError = this.commandPolicyError(command);
      if (policyError) return `DENIED: ${policyError}`;
      return this.runTrackedCommand(command, 'run_command', args, callbacks, signal);
    }
    if (name === 'run_tests') {
      const command = String(args.command ?? '').trim() || 'npm test';
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được chạy lệnh.';
      if (!await waitForAbortable(this.requestApproval(`Agent muốn chạy test: ${command}`), signal)) return 'DENIED by user';
      const policyError = this.commandPolicyError(command);
      if (policyError) return `DENIED: ${policyError}`;
      return this.runTrackedCommand(command, 'run_tests', args, callbacks, signal);
    }
    return `ERROR: Unknown tool: ${name}`;
  }

  private commandPolicyError(command: string): string | undefined {
    return validateCommandPolicy(command, this.commandPolicy);
  }

  private prepareMutation(): Promise<void> {
    if (!this.mutationPreparation) this.mutationPreparation = this.beforeFirstMutation?.() ?? Promise.resolve();
    return this.mutationPreparation;
  }

  private async runTrackedCommand(
    command: string,
    toolName: 'run_command' | 'run_tests',
    args: Record<string, unknown>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<string> {
    const cwd = await this.workspaceDirectory(String(args.cwd ?? ''));
    const requestedTimeout = Number(args.timeoutSeconds);
    const defaultSeconds = toolName === 'run_tests' ? 600 : 120;
    const maximumSeconds = toolName === 'run_tests' ? 1_800 : 900;
    const timeoutSeconds = Number.isFinite(requestedTimeout)
      ? Math.max(toolName === 'run_tests' ? 30 : 5, Math.min(maximumSeconds, requestedTimeout))
      : defaultSeconds;
    await this.prepareMutation();
    const before = await this.captureWorkspaceSnapshot();
    try {
      return this.commandRunner
        ? await this.commandRunner(command, toolName, callbacks, signal)
        : await runShellCommand(
            { command, cwd, timeoutMs: timeoutSeconds * 1_000 },
            (event) => callbacks.onToolOutput?.({ tool: toolName, command, ...event }),
            signal
          );
    } finally {
      const after = await this.captureWorkspaceSnapshot();
      this.registerSnapshotChanges(before, after);
    }
  }

  private async workspaceDirectory(input: string): Promise<string> {
    const uri = this.workspaceUri(input || '.');
    const stat = await vscode.workspace.fs.stat(uri);
    if (!(stat.type & vscode.FileType.Directory)) throw new Error(`Working directory is not a directory: ${input || '.'}`);
    return uri.fsPath;
  }

  private async captureWorkspaceSnapshot(): Promise<Map<string, Uint8Array>> {
    const snapshot = new Map<string, Uint8Array>();
    if (typeof vscode.workspace.findFiles !== 'function') return snapshot;
    const uris = await vscode.workspace.findFiles(
      '**/*',
      '**/{.git,node_modules,dist,out,build,coverage,.next,target,.venv,venv,__pycache__}/**',
      2_500
    );
    let totalBytes = 0;
    for (const uri of uris) {
      if (!this.isWorkspacePath(uri.fsPath)) continue;
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        if (bytes.byteLength > 2_000_000 || totalBytes + bytes.byteLength > 32_000_000) continue;
        totalBytes += bytes.byteLength;
        snapshot.set(resolve(uri.fsPath), bytes);
      } catch {
        // Ignore virtual, inaccessible and transient files.
      }
    }
    return snapshot;
  }

  private registerSnapshotChanges(before: Map<string, Uint8Array>, after: Map<string, Uint8Array>): void {
    const paths = new Set([...before.keys(), ...after.keys()]);
    for (const path of paths) {
      const original = before.get(path) ?? new Uint8Array();
      const updated = after.get(path) ?? new Uint8Array();
      if (bytesEqual(original, updated)) continue;
      const { added, removed } = countLineChanges(original, updated);
      this.onChange({ path, original, updated, existed: before.has(path), added, removed });
      this.mutatedPaths.add(relative(this.workspaceRoot, path));
      this.commandMutationCount++;
    }
  }

  private workspaceUri(input: string): vscode.Uri {
    const target = resolve(this.workspaceRoot, input);
    const root = resolve(this.workspaceRoot);
    if (!pathIsInside(root, target) || !this.realPathIsInsideWorkspace(target)) {
      throw new Error('Đường dẫn nằm ngoài workspace hoặc đi qua symlink/junction không an toàn.');
    }
    return vscode.Uri.file(target);
  }

  private isWorkspacePath(input: string): boolean {
    const target = resolve(input);
    const root = resolve(this.workspaceRoot);
    return pathIsInside(root, target) && this.realPathIsInsideWorkspace(target);
  }

  private realPathIsInsideWorkspace(target: string): boolean {
    const root = resolve(this.workspaceRoot);
    if (!existsSync(root)) return pathIsInside(root, target);
    const realRoot = realpathSync.native(root);
    let existing = target;
    while (!existsSync(existing)) {
      const parent = dirname(existing);
      if (parent === existing) return false;
      existing = parent;
    }
    const realExisting = realpathSync.native(existing);
    return pathIsInside(realRoot, realExisting);
  }
}

function pathIsInside(root: string, target: string): boolean {
  const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root;
  const normalizedTarget = process.platform === 'win32' ? target.toLowerCase() : target;
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function countContentLines(bytes: Uint8Array): number {
  if (!bytes.byteLength) return 0;
  return new TextDecoder().decode(bytes).split(/\r?\n/).filter((line) => line.length > 0).length;
}

function extensionMatchesMime(extension: string, mimeType: string): boolean {
  const normalized = extension.toLowerCase();
  if (mimeType === 'image/png') return normalized === '.png';
  if (mimeType === 'image/jpeg') return normalized === '.jpg' || normalized === '.jpeg';
  if (mimeType === 'image/webp') return normalized === '.webp';
  return true;
}
