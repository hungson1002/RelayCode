import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline';
import * as vscode from 'vscode';
import type { ConnectionConfig, StreamCallbacks } from './types';
import { normalizeEndpoint } from './routerClient';

type JsonObject = Record<string, unknown>;
type RequestId = number | string;
type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

function resolveCodexCommand(command: string): string {
  const requested = command.trim() || 'codex';
  if (existsSync(requested)) return requested;
  if (process.platform !== 'win32' || requested.toLowerCase() !== 'codex') return requested;
  const roots = [
    join(process.env.USERPROFILE ?? '', '.antigravity-ide', 'extensions'),
    join(process.env.USERPROFILE ?? '', '.vscode', 'extensions')
  ];
  for (const root of roots) {
    try {
      const match = readdirSync(root).filter((name) => /^openai\.chatgpt-.*-win32-x64$/i.test(name)).sort().pop();
      if (match) {
        const candidate = join(root, match, 'bin', 'windows-x86_64', 'codex.exe');
        if (existsSync(candidate)) return candidate;
      }
    } catch { /* optional IDE install directory */ }
  }
  return requested;
}

export class CodexAppServer implements vscode.Disposable {
  private process: ChildProcessWithoutNullStreams | undefined;
  private nextId = 1;
  private threadId: string | undefined;
  private pending = new Map<RequestId, PendingRequest>();
  private activeTurn:
    | { resolve(): void; reject(error: Error): void; callbacks: StreamCallbacks }
    | undefined;
  private output = vscode.window.createOutputChannel('Lối · Codex');

  public constructor(
    private readonly codexCommand: string,
    private readonly workspaceRoot: string,
    private readonly config: ConnectionConfig
  ) {}

  public async start(): Promise<void> {
    if (this.process) {
      return;
    }

    const endpoint = new URL(normalizeEndpoint(this.config.endpoint)).origin;
    if (!this.config.apiKey.trim()) throw new Error('Chưa có API key 9Router. Mở Cấu hình và dán key từ Dashboard 9Router.');
    const args = [
      'app-server',
      '--stdio',
      '-c',
      'model_provider="9router"',
      '-c',
      `model_providers.9router.name="9Router"`,
      '-c',
      `model_providers.9router.base_url=${JSON.stringify(endpoint)}`,
      '-c',
      'model_providers.9router.env_key="NINE_ROUTER_API_KEY"',
      '-c',
      'model_providers.9router.wire_api="responses"'
    ];

    this.process = spawn(resolveCodexCommand(this.codexCommand), args, {
      cwd: this.workspaceRoot,
      env: { ...process.env, NINE_ROUTER_API_KEY: this.config.apiKey.trim() },
      windowsHide: true
    });

    this.process.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') this.failAll(new Error('Không tìm thấy Codex CLI. Hãy cài Codex hoặc mở extension trong Antigravity/VS Code.'));
      else this.failAll(error);
    });
    this.process.once('exit', (code) => {
      if (code !== 0) {
        this.failAll(new Error(`Codex app-server đã dừng với mã ${code ?? 'unknown'}.`));
      }
      this.process = undefined;
      this.threadId = undefined;
    });
    this.process.stderr.on('data', (chunk: Buffer) => this.output.append(chunk.toString()));

    readline.createInterface({ input: this.process.stdout }).on('line', (line) => {
      if (!line.trim()) return;
      try {
        this.handleMessage(JSON.parse(line) as JsonObject);
      } catch {
        this.output.appendLine(`[stdout] ${line}`);
      }
    });

    await this.request('initialize', {
      clientInfo: { name: 'loi-agent', title: 'Lối', version: '1.0.0' },
      capabilities: { experimentalApi: true, requestAttestation: false }
    });
    this.notify('initialized');
  }

  public async run(prompt: string, model: string, callbacks: StreamCallbacks, attachments: Array<{ path: string; mimeType: string }> = []): Promise<void> {
    await this.start();
    if (this.activeTurn) {
      throw new Error('Một lượt Codex khác đang chạy.');
    }

    if (!this.threadId) {
      callbacks.onStatus('Khởi tạo Codex thread');
      const result = (await this.request('thread/start', {
        cwd: this.workspaceRoot,
        runtimeWorkspaceRoots: [this.workspaceRoot],
        model,
        modelProvider: '9router',
        approvalPolicy: 'on-request',
        sandbox: 'workspace-write',
        ephemeral: false
      })) as { thread?: { id?: string } };
      this.threadId = result.thread?.id;
      if (!this.threadId) {
        throw new Error('Codex không trả về thread ID.');
      }
    }

    callbacks.onStatus('Codex đang làm việc');
    await new Promise<void>(async (resolve, reject) => {
      this.activeTurn = { resolve, reject, callbacks };
      try {
        const input: Array<Record<string, unknown>> = [{ type: 'text', text: prompt, text_elements: [] }];
        let textInput = prompt;
        for (const attachment of attachments) {
          if (attachment.mimeType.startsWith('image/')) input.push({ type: 'localImage', path: attachment.path });
          else textInput += `\n\nAttached file: ${attachment.path}`;
        }
        input[0]!.text = textInput;
        await this.request('turn/start', {
          threadId: this.threadId,
          input,
          model
        });
      } catch (error) {
        this.activeTurn = undefined;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public resetThread(): void {
    this.threadId = undefined;
  }

  private request(method: string, params?: JsonObject): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ method, id, params });
    });
  }

  private notify(method: string, params?: JsonObject): void {
    this.write(params ? { method, params } : { method });
  }

  private write(message: JsonObject): void {
    if (!this.process?.stdin.writable) {
      throw new Error('Codex app-server chưa sẵn sàng.');
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleMessage(message: JsonObject): void {
    if ((typeof message.id === 'number' || typeof message.id === 'string') && ('result' in message || 'error' in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(this.errorText(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    const method = typeof message.method === 'string' ? message.method : '';
    const params = (message.params ?? {}) as JsonObject;
    if ((typeof message.id === 'number' || typeof message.id === 'string') && method.includes('requestApproval')) {
      void this.handleApproval(message.id, method, params);
      return;
    }

    if (method === 'item/agentMessage/delta') {
      const delta = typeof params.delta === 'string' ? params.delta : '';
      if (delta) this.activeTurn?.callbacks.onDelta(delta);
    } else if (method === 'turn/completed') {
      const turn = params.turn as JsonObject | undefined;
      const status = turn && typeof turn.status === 'string' ? turn.status : 'completed';
      const active = this.activeTurn;
      this.activeTurn = undefined;
      if (!active) return;
      if (status === 'failed') {
        active.reject(new Error(this.errorText(turn?.error ?? 'Codex turn failed.')));
      } else {
        active.callbacks.onStatus('Hoàn tất');
        active.resolve();
      }
    } else if (method === 'error') {
      this.output.appendLine(`[app-server] ${this.errorText(params)}`);
    }
  }

  private async handleApproval(id: RequestId, method: string, params: JsonObject): Promise<void> {
    const isFile = method.includes('fileChange');
    const title = isFile ? 'Codex muốn sửa file' : 'Codex muốn chạy lệnh';
    const detail = isFile
      ? this.errorText(params.grantRoot ?? params.reason ?? 'Thay đổi trong workspace')
      : this.errorText(params.command ?? params.reason ?? 'Lệnh trong workspace');
    const choice = await vscode.window.showWarningMessage(
      `${title}: ${detail}`,
      { modal: true },
      'Cho phép',
      'Từ chối'
    );
    this.write({ id, result: { decision: choice === 'Cho phép' ? 'accept' : 'decline' } });
  }

  private errorText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(' ');
    if (value && typeof value === 'object') {
      const candidate = value as { message?: unknown; additionalDetails?: unknown };
      if (typeof candidate.message === 'string') return candidate.message;
      if (typeof candidate.additionalDetails === 'string') return candidate.additionalDetails;
      return JSON.stringify(value);
    }
    return String(value);
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.activeTurn?.reject(error);
    this.activeTurn = undefined;
  }

  public dispose(): void {
    this.process?.kill();
    this.process = undefined;
    this.output.dispose();
  }
}
