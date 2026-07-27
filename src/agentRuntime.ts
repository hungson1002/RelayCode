import { spawn } from 'node:child_process';
import { dirname, relative, resolve, sep } from 'node:path';
import * as vscode from 'vscode';
import type { ProviderClient } from './provider';
import type { ExternalAgentTool } from './mcpManager';
import type { StreamCallbacks } from './types';
import { validateCommandPolicy } from './safetyPolicy';

const tools: Array<Record<string, unknown>> = [
  tool('read_file', 'Đọc một file trong workspace.', { path: stringField('Đường dẫn tương đối') }, ['path']),
  tool('list_files', 'Liệt kê file trong workspace theo glob.', { pattern: stringField('Glob, ví dụ src/**/*.ts') }, ['pattern']),
  tool('search_text', 'Tìm một chuỗi trong các file của workspace.', { query: stringField('Chuỗi cần tìm'), pattern: stringField('Glob tùy chọn, ví dụ **/*.ts') }, ['query']),
  tool('write_file', 'Ghi toàn bộ nội dung file trong workspace.', { path: stringField('Đường dẫn tương đối'), content: stringField('Nội dung mới') }, ['path', 'content']),
  tool('apply_patch', 'Thay thế một đoạn chính xác trong file, giữ nguyên các phần khác.', { path: stringField('Đường dẫn tương đối'), oldText: stringField('Đoạn cũ chính xác'), newText: stringField('Đoạn mới') }, ['path', 'oldText', 'newText']),
  tool('run_command', 'Chạy lệnh PowerShell trong workspace.', { command: stringField('Lệnh cần chạy') }, ['command']),
  tool('run_tests', 'Chạy test của project, mặc định là npm test.', { command: stringField('Lệnh test tùy chọn') }, [])
];

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
    private readonly commandRunner?: (command: string, toolName: string, callbacks: StreamCallbacks, signal?: AbortSignal) => Promise<string>
  ) {}

  public async run(prompt: unknown, model: string, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
    const messages: Array<Record<string, unknown>> = [
      {
        role: 'system',
        content: this.readOnly
          ? 'Bạn là coding planner trong IDE. Đọc workspace và lập kế hoạch cụ thể. Không được sửa file hoặc chạy lệnh trong Plan mode. Trả lời bằng Markdown ngắn gọn.'
          : 'Bạn là coding agent trong IDE. Dùng tools để kiểm tra workspace trước khi kết luận. Chỉ thao tác trong workspace. Sau khi sửa, chạy kiểm tra phù hợp. Phản hồi cuối phải ngắn gọn: nói kết quả trước, liệt kê những gì đã làm bằng bullet tròn, dùng chữ đậm cho ý chính, bọc tên hàm/lệnh trong backtick, và viết đường dẫn file dạng liên kết Markdown [tên file](đường/dẫn/file:line) để người dùng có thể bấm mở. Không thuật lại từng bước suy luận hay lặp lại log công cụ.'
      },
      { role: 'user', content: prompt }
    ];
    for (let step = 0; step < 16; step++) {
      callbacks.onStatus(step ? `Agent đang xử lý bước ${step + 1}` : 'Agent đang phân tích');
      const response = await this.client.completeWithTools(model, messages, [...tools, ...this.externalTools.map((item) => item.definition)], signal);
      callbacks.onMetrics?.(response.metrics);
      if (!response.toolCalls.length) {
        callbacks.onDelta(response.content || 'Đã hoàn tất.');
        callbacks.onStatus('Hoàn tất');
        return;
      }
      messages.push({
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }))
      });
      for (const call of response.toolCalls) {
        let args: Record<string, unknown>;
        try { args = JSON.parse(call.arguments) as Record<string, unknown>; }
        catch { args = {}; }
        callbacks.onStatus(this.toolStatus(call.name, args));
        let result: string;
        try { result = await this.execute(call.name, args, callbacks, signal); }
        catch (error) { result = `ERROR: ${error instanceof Error ? error.message : String(error)}`; }
        messages.push({ role: 'tool', tool_call_id: call.id, content: result.slice(0, 30_000) });
      }
    }
    throw new Error('Agent đã đạt giới hạn 16 bước. Hãy chia yêu cầu thành phần nhỏ hơn.');
  }

  private toolStatus(name: string, args: Record<string, unknown>): string {
    const short = (value: unknown, fallback: string) => String(value ?? '').trim().slice(0, 140) || fallback;
    if (name === 'run_command') return `Đang chạy lệnh: ${short(args.command, 'PowerShell')}`;
    if (name === 'run_tests') return `Đang chạy kiểm tra: ${short(args.command, 'npm test')}`;
    if (name === 'write_file' || name === 'apply_patch') return `Đang sửa file: ${short(args.path, 'workspace')}`;
    if (name === 'read_file') return `Đang đọc file: ${short(args.path, 'workspace')}`;
    if (name === 'list_files') return `Đang xem cấu trúc dự án: ${short(args.pattern, '**/*')}`;
    if (name === 'search_text') return `Đang tìm trong dự án: ${short(args.query, 'nội dung')}`;
    const external = this.externalTools.find((item) => (item.definition.function as { name?: string } | undefined)?.name === name);
    if (external) return `Đang dùng MCP: ${external.label}`;
    return `Đang dùng công cụ: ${name}`;
  }

  private async execute(name: string, args: Record<string, unknown>, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<string> {
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
    if (name === 'write_file') {
      const uri = this.workspaceUri(String(args.path ?? ''));
      if (this.readOnly) return 'DENIED: Plan mode chỉ đọc, không được sửa file.';
      if (!await this.requestApproval(`Agent muốn sửa ${relative(this.workspaceRoot, uri.fsPath)}`)) return 'DENIED by user';
      let original: Uint8Array; let existed = true;
      try { original = await vscode.workspace.fs.readFile(uri); } catch { original = new Uint8Array(); existed = false; }
      const updated = new TextEncoder().encode(String(args.content ?? ''));
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname(uri.fsPath)));
      await vscode.workspace.fs.writeFile(uri, updated);
      const before = new TextDecoder().decode(original).split(/\r?\n/);
      const after = new TextDecoder().decode(updated).split(/\r?\n/);
      let added = 0; let removed = 0;
      const max = Math.max(before.length, after.length);
      for (let index = 0; index < max; index++) { if (before[index] !== after[index]) { if (after[index] !== undefined) added++; if (before[index] !== undefined) removed++; } }
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
      await vscode.workspace.fs.writeFile(uri, updated);
      const before = current.split(/\r?\n/); const after = new TextDecoder().decode(updated).split(/\r?\n/);
      let added = 0; let removed = 0; const max = Math.max(before.length, after.length);
      for (let index = 0; index < max; index++) { if (before[index] !== after[index]) { if (after[index] !== undefined) added++; if (before[index] !== undefined) removed++; } }
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
