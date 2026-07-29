import { spawn } from 'node:child_process';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import * as vscode from 'vscode';
import type { ProviderClient, ToolCompletionProgress } from './provider';
import type { ExternalAgentTool } from './mcpManager';
import type { AgentRunCheckpoint, AgentToolCall, RequestTuning, StreamCallbacks } from './types';
import { validateCommandPolicy } from './safetyPolicy';
import { countLineChanges } from './diffHunks';
import { requiresWorkspaceMutation } from './agentIntent';

const tools: Array<Record<string, unknown>> = [
  tool('read_file', 'Đọc một file trong workspace.', { path: stringField('Đường dẫn tương đối') }, ['path']),
  tool('read_skill_file', 'Đọc file tham chiếu nằm trong một skill đang được kích hoạt.', {
    skill: stringField('Tên skill đã được kích hoạt'),
    path: stringField('Đường dẫn tương đối tính từ thư mục chứa SKILL.md')
  }, ['skill', 'path']),
  tool('list_files', 'Liệt kê file trong workspace theo glob.', { pattern: stringField('Glob, ví dụ src/**/*.ts') }, ['pattern']),
  tool('search_text', 'Tìm một chuỗi trong các file của workspace.', { query: stringField('Chuỗi cần tìm'), pattern: stringField('Glob tùy chọn, ví dụ **/*.ts') }, ['query']),
  tool('list_models', 'Liệt kê model từ provider hiện tại. Dùng để tìm model image hoặc image-generation trước khi tạo ảnh.', {}, []),
  tool('generate_image', 'Tạo ảnh bằng API image generation của provider hiện tại và lưu file vào workspace. Chỉ dùng trong Agent mode.', {
    prompt: stringField('Mô tả chi tiết ảnh cần tạo'),
    path: stringField('Đường dẫn ảnh đầu ra trong workspace, ví dụ assets/hero.png'),
    model: stringField('Model tạo ảnh. Nếu bỏ trống sẽ dùng model Agent hiện tại'),
    size: stringField('Kích thước, ví dụ 1024x1024, 1536x1024 hoặc 1024x1536')
  }, ['prompt', 'path']),
  tool('write_file', 'Ghi toàn bộ nội dung file trong workspace.', { path: stringField('Đường dẫn tương đối'), content: stringField('Nội dung mới') }, ['path', 'content']),
  tool('apply_patch', 'Thay thế một đoạn chính xác trong file, giữ nguyên các phần khác.', { path: stringField('Đường dẫn tương đối'), oldText: stringField('Đoạn cũ chính xác'), newText: stringField('Đoạn mới') }, ['path', 'oldText', 'newText']),
  tool('run_command', 'Chạy lệnh PowerShell trong workspace.', { command: stringField('Lệnh cần chạy') }, ['command']),
  tool('run_tests', 'Chạy test của project, mặc định là npm test.', { command: stringField('Lệnh test tùy chọn') }, [])
];

const IMAGE_MODEL_PATTERN = /(image|imagen|gpt-image|dall-e|flux|stable[- ]?diffusion|sdxl|seedream|recraft)/i;

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

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } };
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
    private readonly requestTuning?: RequestTuning
  ) {}
  private mutationPreparation: Promise<void> | undefined;
  private readonly mutatedPaths = new Set<string>();

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
    let lastValidatedMutationCount = 0;
    let completionWithoutActionCount = resume?.completionWithoutActionCount ?? 0;
    const baseInstruction = this.readOnly
      ? 'Bạn là coding planner trong IDE. Đọc workspace và lập kế hoạch cụ thể. Không được sửa file hoặc chạy lệnh trong Plan mode. Trả lời bằng Markdown ngắn gọn.'
      : 'Bạn là coding agent trong IDE. Dùng tools để kiểm tra workspace trước khi kết luận. Chỉ thao tác trong workspace. Nếu người dùng yêu cầu tạo, sửa, thêm hoặc xóa file, bạn bắt buộc phải gọi write_file, apply_patch hoặc generate_image và kiểm tra kết quả; không được chỉ tuyên bố đã hoàn tất. Khi người dùng yêu cầu tạo ảnh, hãy dùng list_models để tìm model image phù hợp rồi gọi generate_image; không tạo ảnh giả bằng SVG/CSS trừ khi người dùng yêu cầu rõ. Nếu API ảnh không được hỗ trợ, hãy tìm pipeline Python tạo ảnh đã có trong workspace và chỉ dùng run_command khi pipeline đó thực sự tồn tại; không tự cài model nặng hoặc tuyên bố đã tạo ảnh khi chưa có file. Sau khi sửa, chạy kiểm tra phù hợp. Phản hồi cuối phải ngắn gọn: nói chính xác kết quả trước, liệt kê những file hoặc nội dung đã thay đổi bằng bullet tròn, dùng chữ đậm cho ý chính, bọc tên hàm/lệnh trong backtick, và viết đường dẫn file dạng liên kết Markdown [tên file](đường/dẫn/file:line) để người dùng có thể bấm mở. Không dùng emoji hoặc icon trang trí trong câu trả lời. Nếu chưa thực hiện được, nói rõ chưa hoàn thành và nguyên nhân. Không thuật lại từng bước suy luận hay lặp lại log công cụ.';
    const continuityInstruction = 'Treat follow-up requests as continuation of the same workspace task. Inspect the current workspace state before changing files, reuse existing files and directories, and never recreate the project in a new directory unless the user explicitly asks.';
    const messages: Array<Record<string, unknown>> = resume?.messages?.length ? resume.messages : [
      {
        role: 'system',
        content: [baseInstruction, continuityInstruction, this.runtimeInstructions].filter(Boolean).join('\n\n')
      },
      ...this.conversationHistory.slice(-12).map((message) => ({ role: message.role, content: message.content.slice(0, 16_000) })),
      { role: 'user', content: prompt }
    ];
    let pendingToolCalls: AgentToolCall[] = resume?.pendingToolCalls ?? [];
    let nextToolIndex = resume?.nextToolIndex ?? 0;
    const checkpoint = async (step: number, lastStatus: string) => {
      await callbacks.onCheckpoint?.({
        version: 1,
        model: activeModel,
        messages,
        step,
        successfulMutations,
        completionWithoutActionCount,
        pendingToolCalls,
        nextToolIndex,
        lastStatus,
        updatedAt: Date.now()
      });
    };
    for (let step = resume?.step ?? 0; ; step++) {
      if (!pendingToolCalls.length) {
        this.compactMessages(messages);
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
          const command = await this.detectValidationCommand();
          if (command) {
            callbacks.onStatus(`Đang tự động kiểm tra thay đổi: ${command}`);
            const validation = await this.execute('run_tests', { command }, callbacks, activeModel, signal);
            lastValidatedMutationCount = successfulMutations;
            messages.push({ role: 'assistant', content: response.content || null });
            messages.push({
              role: 'user',
              content: `RelayCode automatically ran the required validation command after your edits.\nCommand: ${command}\nResult:\n${validation.slice(0, 30_000)}\nReview this result. If it failed, fix the cause and validate again. If it passed, give the final concise summary.`
            });
            await checkpoint(step + 1, `Đã chạy kiểm tra tự động: ${command}`);
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
        callbacks.onDelta(response.content || 'Không có nội dung phản hồi từ model.');
        callbacks.onStatus('Hoàn tất');
        return;
        }
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }))
        });
        pendingToolCalls = response.toolCalls;
        nextToolIndex = 0;
        await checkpoint(step, 'Model đã trả về thao tác');
      }
      for (; nextToolIndex < pendingToolCalls.length;) {
        const call = pendingToolCalls[nextToolIndex]!;
        let args: Record<string, unknown>;
        try { args = JSON.parse(call.arguments) as Record<string, unknown>; }
        catch { args = {}; }
        const toolStatus = this.toolStatus(call.name, args);
        callbacks.onStatus(toolStatus);
        await checkpoint(step, toolStatus);
        let result: string;
        let attempt = 0;
        while (true) {
          attempt++;
          try {
            result = await this.execute(call.name, args, callbacks, activeModel, signal);
          } catch (error) {
            result = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
          }
          if (!/^(ERROR|DENIED):?/i.test(result) || !callbacks.onToolFailure) break;
          const decision = await callbacks.onToolFailure({
            id: call.id,
            tool: call.name,
            arguments: args,
            message: result.replace(/^ERROR:\s*/i, ''),
            model: activeModel,
            attempt
          });
          if (decision.action === 'retry') {
            callbacks.onStatus(`Đang thử lại: ${this.toolStatus(call.name, args).replace(/^Đang\s+/i, '')}`);
            continue;
          }
          if (decision.action === 'change-model') {
            activeModel = decision.model;
            result += `\nĐã chuyển sang model ${activeModel}; Agent sẽ lập lại bước hiện tại mà không chạy lại các tool đã thành công.`;
          } else {
            result += '\nNgười dùng đã chọn bỏ qua tool lỗi này.';
          }
          break;
        }
        if (call.name === 'generate_image' && /^ERROR:?/i.test(result)) {
          callbacks.onStatus(`Tạo ảnh thất bại: ${String(args.path ?? 'image.png').slice(0, 140)}`);
        }
        if ((call.name === 'write_file' || call.name === 'apply_patch' || call.name === 'generate_image') && !/^(ERROR|DENIED):?/i.test(result)) {
          successfulMutations++;
          const changedPath = String(args.path ?? '').trim();
          if (changedPath) this.mutatedPaths.add(changedPath);
        }
        if (call.name === 'run_tests' && !/^DENIED:?/i.test(result)) {
          lastValidatedMutationCount = successfulMutations;
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: result.slice(0, 30_000) });
        nextToolIndex++;
        await checkpoint(step, /^(ERROR|DENIED):?/i.test(result) ? `${call.name} chưa hoàn thành` : `${call.name} đã hoàn thành`);
      }
      pendingToolCalls = [];
      nextToolIndex = 0;
      await checkpoint(step + 1, 'Đã hoàn thành bước hiện tại');
    }
  }

  private shouldValidatePath(path: string): boolean {
    return !/\.(?:md|mdx|txt|png|jpe?g|gif|webp|svg|ico|pdf|docx?|xlsx?|pptx?)$/i.test(path);
  }

  private async detectValidationCommand(): Promise<string | undefined> {
    const exists = async (path: string) => {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(resolve(this.workspaceRoot, path)));
        return true;
      } catch {
        return false;
      }
    };

    if (await exists('package.json')) {
      try {
        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(resolve(this.workspaceRoot, 'package.json')));
        const pkg = JSON.parse(new TextDecoder().decode(raw)) as { scripts?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        const script = ['check', 'test', 'typecheck', 'lint', 'build'].find((name) => scripts[name]);
        if (script) {
          const runner = await exists('pnpm-lock.yaml') ? 'pnpm' : await exists('yarn.lock') ? 'yarn' : 'npm';
          if (runner === 'npm') return script === 'test' ? 'npm test' : `npm run ${script}`;
          return `${runner} ${script}`;
        }
      } catch {
        // Fall through to other project types when package.json is not readable.
      }
    }
    if (await exists('Cargo.toml')) return 'cargo test';
    if (await exists('go.mod')) return 'go test ./...';
    if (await exists('pyproject.toml') || await exists('pytest.ini') || await exists('setup.cfg')) return 'python -m pytest';
    if (typeof vscode.workspace.findFiles === 'function'
      && ((await vscode.workspace.findFiles('*.sln', '**/node_modules/**', 1)).length
        || (await vscode.workspace.findFiles('*.csproj', '**/node_modules/**', 1)).length)) return 'dotnet test';
    return undefined;
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
      const touch = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => controller.abort(new Error('Luồng Agent không nhận dữ liệu mới trong 45 giây.')), 45_000);
      };
      const onProgress = (progress: ToolCompletionProgress) => {
        touch();
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
        return await this.client.completeWithTools(model, messages, definitions, controller.signal, onProgress, this.requestTuning);
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
      for (const field of ['path', 'pattern', 'query', 'command', 'skill']) {
        const match = new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)`).exec(raw);
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
    if (name === 'read_file') return `Đang đọc file: ${short(args.path, 'workspace')}`;
    if (name === 'read_skill_file') return `Đang đọc tài nguyên skill: ${short(args.skill, 'skill')} / ${short(args.path, 'file')}`;
    if (name === 'list_files') return `Đang xem cấu trúc dự án: ${short(args.pattern, '**/*')}`;
    if (name === 'search_text') return `Đang tìm trong dự án: ${short(args.query, 'nội dung')}`;
    const external = this.externalTools.find((item) => (item.definition.function as { name?: string } | undefined)?.name === name);
    if (external) return `Đang dùng MCP: ${external.label}`;
    return `Đang dùng công cụ: ${name}`;
  }

  private async execute(name: string, args: Record<string, unknown>, callbacks: StreamCallbacks, currentModel: string, signal?: AbortSignal): Promise<string> {
    const external = this.externalTools.find((item) => (item.definition.function as { name?: string } | undefined)?.name === name);
    if (external) {
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không gọi MCP tool.';
      if (!await this.requestApproval(`Agent muốn dùng MCP: ${external.label}`)) return 'DENIED by user';
      return external.execute(args);
    }
    if (name === 'read_file') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
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
      if (!await this.requestApproval(`Agent muốn tạo ảnh ${relative(this.workspaceRoot, uri.fsPath)} bằng model ${imageModel}`)) return 'DENIED by user';
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
      if (!await this.requestApproval(`Agent muốn sửa ${relative(this.workspaceRoot, uri.fsPath)}`)) return 'DENIED by user';
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
      if (!await this.requestApproval(`Agent muốn sửa ${relative(this.workspaceRoot, uri.fsPath)}`)) return 'DENIED by user';
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
    if (name === 'run_command') {
      const command = String(args.command ?? '').trim();
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được chạy lệnh.';
      if (!await this.requestApproval(`Agent muốn chạy: ${command}`)) return 'DENIED by user';
      const policyError = this.commandPolicyError(command);
      if (policyError) return `DENIED: ${policyError}`;
      return this.commandRunner
        ? this.commandRunner(command, 'run_command', callbacks, signal)
        : this.runStreamingCommand(command, 'run_command', callbacks, signal);
    }
    if (name === 'run_tests') {
      const command = String(args.command ?? '').trim() || 'npm test';
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được chạy lệnh.';
      if (!await this.requestApproval(`Agent muốn chạy test: ${command}`)) return 'DENIED by user';
      const policyError = this.commandPolicyError(command);
      if (policyError) return `DENIED: ${policyError}`;
      return this.commandRunner
        ? this.commandRunner(command, 'run_tests', callbacks, signal)
        : this.runStreamingCommand(command, 'run_tests', callbacks, signal);
    }
    return `Unknown tool: ${name}`;
  }

  private commandPolicyError(command: string): string | undefined {
    return validateCommandPolicy(command, this.commandPolicy);
  }

  private prepareMutation(): Promise<void> {
    if (!this.mutationPreparation) this.mutationPreparation = this.beforeFirstMutation?.() ?? Promise.resolve();
    return this.mutationPreparation;
  }

  private runStreamingCommand(command: string, toolName: string, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const started = Date.now();
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        cwd: this.workspaceRoot,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeout: NodeJS.Timeout;
      const abort = () => {
        child.kill();
        finish(new Error('Đã dừng lệnh.'));
      };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolvePromise(`${stdout}\n${stderr}`.trim().slice(-30_000) || 'Command completed.');
      };
      const emit = (stream: 'stdout' | 'stderr', data: Buffer) => {
        const chunk = data.toString();
        if (stream === 'stdout') stdout = (stdout + chunk).slice(-30_000);
        else stderr = (stderr + chunk).slice(-30_000);
        callbacks.onToolOutput?.({ tool: toolName, command, chunk, stream, elapsedMs: Date.now() - started });
      };
      child.stdout.on('data', (data: Buffer) => emit('stdout', data));
      child.stderr.on('data', (data: Buffer) => emit('stderr', data));
      child.on('error', (error) => finish(error));
      child.on('close', (code) => code === 0 ? finish() : finish(new Error(`${stderr || stdout || `Command exited with code ${code}`}`.trim())));
      signal?.addEventListener('abort', abort, { once: true });
      timeout = setTimeout(() => {
        child.kill();
        finish(new Error('Lệnh quá thời gian 120 giây.'));
      }, 120_000);
    });
  }

  private workspaceUri(input: string): vscode.Uri {
    const target = resolve(this.workspaceRoot, input);
    const root = resolve(this.workspaceRoot);
    if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('Đường dẫn nằm ngoài workspace.');
    return vscode.Uri.file(target);
  }
}

function extensionMatchesMime(extension: string, mimeType: string): boolean {
  const normalized = extension.toLowerCase();
  if (mimeType === 'image/png') return normalized === '.png';
  if (mimeType === 'image/jpeg') return normalized === '.jpg' || normalized === '.jpeg';
  if (mimeType === 'image/webp') return normalized === '.webp';
  return true;
}
