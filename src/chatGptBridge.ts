import * as vscode from 'vscode';
import * as http from 'node:http';
import { randomBytes } from 'node:crypto';
import { dirname, relative, resolve, sep } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as z from 'zod/v4';
import { countLineChanges } from './diffHunks';
import { runShellCommand } from './commandRuntime';
import { validateCommandPolicy } from './safetyPolicy';
import { ChatGptTunnelSetup } from './chatGptTunnelSetup';

const BRIDGE_TOKEN_SECRET = 'nineRouter.chatGptBridge.pathToken';
const BRIDGE_ACTIVITY_STATE = 'nineRouter.chatGptBridge.activity';
const MAX_FILE_BYTES = 240_000;
const MAX_ACTIVITY = 100;

export interface ChatGptBridgeChange {
  path: string;
  original: Uint8Array;
  updated: Uint8Array;
  existed: boolean;
  added: number;
  removed: number;
}

export interface ChatGptBridgeActivity {
  id: string;
  tool: string;
  summary: string;
  ok: boolean;
  timestamp: number;
  durationMs: number;
}

export interface ChatGptBridgeCallbacks {
  requestApproval(description: string): Promise<boolean>;
  registerChange(change: ChatGptBridgeChange): void;
  pendingChanges(): Array<{ id: string; path: string; added: number; removed: number; taskId: string }>;
  onActivity(activity: ChatGptBridgeActivity): void;
  openActivityTimeline(): Promise<void>;
}

export interface ChatGptBridgeStatus {
  running: boolean;
  url?: string;
  port?: number;
  activityCount: number;
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { ok: boolean; summary: string; data?: unknown };
  isError?: boolean;
};

export class ChatGptBridge implements vscode.Disposable {
  private server: http.Server | undefined;
  private localUrl: string | undefined;
  private activities: ChatGptBridgeActivity[];
  private readonly tunnelSetup: ChatGptTunnelSetup;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly callbacks: ChatGptBridgeCallbacks
  ) {
    this.activities = context.workspaceState.get<ChatGptBridgeActivity[]>(BRIDGE_ACTIVITY_STATE, []);
    this.tunnelSetup = new ChatGptTunnelSetup(context);
  }

  public status(): ChatGptBridgeStatus {
    const address = this.server?.address();
    return {
      running: Boolean(this.server?.listening),
      url: this.localUrl,
      port: address && typeof address === 'object' ? address.port : undefined,
      activityCount: this.activities.length
    };
  }

  public activity(): ChatGptBridgeActivity[] {
    return [...this.activities];
  }

  public async start(): Promise<ChatGptBridgeStatus> {
    if (this.server?.listening) return this.status();
    if (!vscode.workspace.isTrusted) throw new Error('Hãy Trust workspace trước khi bật ChatGPT Web Bridge.');
    if (!this.workspaceRoot()) throw new Error('Hãy mở một thư mục workspace trước khi bật ChatGPT Web Bridge.');

    const token = await this.pathToken();
    const route = `/mcp/${token}`;
    const configuredPort = vscode.workspace.getConfiguration('nineRouter').get<number>('chatGptBridge.port', 43119);
    const port = Number.isSafeInteger(configuredPort) && configuredPort > 0 && configuredPort < 65_536 ? configuredPort : 43119;

    const nodeServer = http.createServer((request, response) => {
      void this.handleHttpRequest(route, request, response);
    });
    await new Promise<void>((resolvePromise, reject) => {
      const fail = (error: Error) => reject(error);
      nodeServer.once('error', fail);
      nodeServer.listen(port, '127.0.0.1', () => {
        nodeServer.off('error', fail);
        resolvePromise();
      });
    });
    this.server = nodeServer;
    this.localUrl = `http://127.0.0.1:${port}${route}`;
    void this.tunnelSetup.resume(this.localUrl).catch(() => undefined);
    return this.status();
  }

  public async stop(): Promise<void> {
    const current = this.server;
    this.server = undefined;
    this.localUrl = undefined;
    if (!current) return;
    await new Promise<void>((resolvePromise) => current.close(() => resolvePromise()));
  }

  public async manage(): Promise<void> {
    let current = this.status();
    if (!current.running) {
      current = await this.start();
      await vscode.workspace.getConfiguration('nineRouter').update('chatGptBridge.autoStart', true, vscode.ConfigurationTarget.Global);
    }
    if (!this.tunnelSetup.status().configured) {
      await this.configureTunnel(current.url!);
      return;
    }
    const tunnel = this.tunnelSetup.status();
    const choices: Array<vscode.QuickPickItem & { id: string }> = [
      { id: 'open', label: '$(link-external) Hoàn tất trên ChatGPT', description: tunnel.running ? 'Xem checklist tạo và bật RelayCode Workspace' : 'Tunnel đang dừng' },
      { id: 'reconnect', label: '$(sync) Kết nối lại', description: 'Kiểm tra và chạy lại tunnel tự động' },
      { id: 'activity', label: '$(history) Mở timeline ChatGPT Web', description: `${current.activityCount} lượt gọi công cụ trong lịch sử chat` },
      { id: 'copy', label: '$(copy) Sao chép Tunnel ID', description: tunnel.tunnelId },
      { id: 'forget', label: '$(trash) Thiết lập lại kết nối', description: 'Xóa Tunnel ID và API key đã lưu' }
    ];
    const picked = await vscode.window.showQuickPick(choices, {
      title: tunnel.running ? 'ChatGPT Web · Đã kết nối' : 'ChatGPT Web · Cần kết nối lại',
      placeHolder: 'Chọn thao tác'
    });
    if (!picked) return;
    if (picked.id === 'open') {
      if (!tunnel.running) await this.tunnelSetup.reconnect(current.url!);
      await this.tunnelSetup.showCompletionGuide();
    } else if (picked.id === 'reconnect') {
      try {
        const connected = await this.tunnelSetup.reconnect(current.url!);
        void vscode.window.showInformationMessage(connected ? 'ChatGPT Web đã kết nối lại.' : 'Chưa thể kết nối. Hãy kiểm tra Tunnel ID và API key.');
      } catch (error) {
        void vscode.window.showErrorMessage(`Không thể kết nối ChatGPT: ${this.errorText(error)}`);
      }
    } else if (picked.id === 'copy' && tunnel.tunnelId) {
      await vscode.env.clipboard.writeText(tunnel.tunnelId);
      void vscode.window.showInformationMessage('Đã sao chép Tunnel ID.');
    } else if (picked.id === 'activity') {
      await this.callbacks.openActivityTimeline();
    } else if (picked.id === 'forget') {
      await this.tunnelSetup.forget();
      await this.configureTunnel(current.url!);
    }
  }

  private async configureTunnel(localMcpUrl: string): Promise<void> {
    try {
      await this.tunnelSetup.configure(localMcpUrl);
    } catch (error) {
      void vscode.window.showErrorMessage(`Không thể hoàn tất kết nối ChatGPT: ${this.errorText(error)}`);
    }
  }

  public dispose(): void {
    this.tunnelSetup.dispose();
    void this.stop();
  }

  private async handleHttpRequest(route: string, request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, service: 'relaycode-chatgpt-bridge' }));
      return;
    }
    if (requestUrl.pathname !== route) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    if (request.method !== 'POST') {
      response.writeHead(405, { 'content-type': 'application/json', allow: 'POST' });
      response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }));
      return;
    }

    const mcp = this.createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: this.errorText(error) }, id: null }));
      }
    } finally {
      await transport.close().catch(() => undefined);
      await mcp.close().catch(() => undefined);
    }
  }

  private createMcpServer(): McpServer {
    const server = new McpServer({
      name: 'relaycode-workspace',
      version: String(this.context.extension.packageJSON.version || '1.3.0'),
      title: 'RelayCode Workspace'
    }, {
      instructions: 'Work only inside the open RelayCode workspace. Read before editing. File writes are applied to the RelayCode Review queue so the user can Accept or Undo them in VS Code. Use run_workspace_command only when file tools are insufficient.'
    });
    const outputSchema = {
      ok: z.boolean(),
      summary: z.string(),
      data: z.unknown().optional()
    };

    server.registerTool('workspace_status', {
      title: 'Workspace status',
      description: 'Show the open RelayCode workspace, Git branch, diagnostics count, and pending review changes.',
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, () => this.track('workspace_status', {}, async () => {
      const root = this.requiredWorkspaceRoot();
      const diagnostics = this.workspaceDiagnostics();
      const branch = await this.gitBranch(root);
      const data = { workspace: root, branch, diagnostics: diagnostics.length, pendingChanges: this.callbacks.pendingChanges().length };
      return this.ok(`Workspace ${root} on ${branch || 'no Git branch'}.`, data);
    }));

    server.registerTool('list_workspace_files', {
      title: 'List workspace files',
      description: 'List files in the current RelayCode workspace using a glob pattern. Build outputs and dependency folders are excluded.',
      inputSchema: { pattern: z.string().default('**/*'), limit: z.number().int().min(1).max(1000).default(300) },
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, ({ pattern, limit }) => this.track('list_workspace_files', { pattern, limit }, async () => {
      const root = this.requiredWorkspaceRoot();
      const uris = await vscode.workspace.findFiles(pattern, '**/{.git,node_modules,dist,out,build,coverage,.next,target,.venv,venv,__pycache__}/**', limit);
      const files = uris.filter((uri) => this.isInside(root, uri.fsPath)).map((uri) => relative(root, uri.fsPath).replace(/\\/g, '/'));
      return this.ok(`Found ${files.length} workspace files.`, { files });
    }));

    server.registerTool('read_workspace_file', {
      title: 'Read workspace file',
      description: 'Read a UTF-8 text file from the current RelayCode workspace, optionally selecting a line range.',
      inputSchema: { path: z.string().min(1), startLine: z.number().int().min(1).default(1), endLine: z.number().int().min(1).max(10000).optional() },
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, ({ path, startLine, endLine }) => this.track('read_workspace_file', { path, startLine, endLine }, async () => {
      const uri = this.workspaceUri(path);
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`File is larger than ${MAX_FILE_BYTES} bytes.`);
      if (bytes.includes(0)) throw new Error('Binary files cannot be returned as text.');
      const lines = new TextDecoder().decode(bytes).split(/\r?\n/);
      const first = Math.min(startLine, Math.max(lines.length, 1));
      const last = Math.min(Math.max(endLine ?? Math.min(first + 499, lines.length), first), lines.length);
      return this.ok(`Read ${path}:${first}-${last}.`, { path, startLine: first, endLine: last, totalLines: lines.length, content: lines.slice(first - 1, last).join('\n') });
    }));

    server.registerTool('search_workspace', {
      title: 'Search workspace',
      description: 'Search text across workspace files and return matching file names, line numbers, and snippets.',
      inputSchema: { query: z.string().min(1), pattern: z.string().default('**/*'), limit: z.number().int().min(1).max(200).default(100) },
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, ({ query, pattern, limit }) => this.track('search_workspace', { query, pattern, limit }, async () => {
      const root = this.requiredWorkspaceRoot();
      const uris = await vscode.workspace.findFiles(pattern, '**/{.git,node_modules,dist,out,build,coverage,.next,target,.venv,venv,__pycache__}/**', 500);
      const matches: Array<{ path: string; line: number; text: string }> = [];
      const needle = query.toLocaleLowerCase();
      for (const uri of uris) {
        if (matches.length >= limit) break;
        if (!this.isInside(root, uri.fsPath)) continue;
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          if (bytes.byteLength > MAX_FILE_BYTES || bytes.includes(0)) continue;
          new TextDecoder().decode(bytes).split(/\r?\n/).forEach((line, index) => {
            if (matches.length < limit && line.toLocaleLowerCase().includes(needle)) matches.push({ path: relative(root, uri.fsPath).replace(/\\/g, '/'), line: index + 1, text: line.trim().slice(0, 300) });
          });
        } catch { /* Ignore inaccessible and binary files. */ }
      }
      return this.ok(`Found ${matches.length} matches for ${query}.`, { matches });
    }));

    server.registerTool('get_workspace_diagnostics', {
      title: 'Get workspace diagnostics',
      description: 'Return current VS Code errors and warnings for files inside the workspace.',
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, () => this.track('get_workspace_diagnostics', {}, async () => {
      const diagnostics = this.workspaceDiagnostics();
      return this.ok(`Found ${diagnostics.length} workspace diagnostics.`, { diagnostics });
    }));

    server.registerTool('get_git_diff', {
      title: 'Get Git diff',
      description: 'Return the current unstaged and staged Git diff for the RelayCode workspace.',
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, () => this.track('get_git_diff', {}, async () => {
      const root = this.requiredWorkspaceRoot();
      const unstaged = await runShellCommand({ command: 'git diff --no-ext-diff --', cwd: root, timeoutMs: 30_000 }).catch((error) => this.errorText(error));
      const staged = await runShellCommand({ command: 'git diff --cached --no-ext-diff --', cwd: root, timeoutMs: 30_000 }).catch((error) => this.errorText(error));
      return this.ok('Loaded the current Git diff.', { unstaged: unstaged.slice(-60_000), staged: staged.slice(-60_000) });
    }));

    server.registerTool('list_pending_changes', {
      title: 'List pending RelayCode changes',
      description: 'List file edits currently waiting for Accept or Undo in RelayCode Review.',
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, () => this.track('list_pending_changes', {}, async () => {
      const changes = this.callbacks.pendingChanges();
      return this.ok(`${changes.length} changes are waiting for review.`, { changes });
    }));

    server.registerTool('write_workspace_file', {
      title: 'Write workspace file',
      description: 'Create or replace a UTF-8 text file inside the workspace. The edit appears in RelayCode Review and can be accepted or undone by the user.',
      inputSchema: { path: z.string().min(1), content: z.string().max(2_000_000) },
      outputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true }
    }, ({ path, content }) => this.track('write_workspace_file', { path }, async () => {
      const uri = this.workspaceUri(path);
      if (!await this.callbacks.requestApproval(`ChatGPT Web muốn sửa ${path}`)) throw new Error('Denied by user.');
      let original: Uint8Array = new Uint8Array(); let existed = true;
      try { original = await vscode.workspace.fs.readFile(uri); } catch { existed = false; }
      const updated = new TextEncoder().encode(content);
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname(uri.fsPath)));
      await vscode.workspace.fs.writeFile(uri, updated);
      const counts = countLineChanges(original, updated);
      this.callbacks.registerChange({ path: uri.fsPath, original, updated, existed, ...counts });
      return this.ok(`Saved ${path}; the edit is waiting in RelayCode Review.`, { path, review: 'pending', ...counts });
    }));

    server.registerTool('apply_workspace_patch', {
      title: 'Apply workspace patch',
      description: 'Replace exactly one matching text block in a workspace file. The edit appears in RelayCode Review and can be accepted or undone.',
      inputSchema: { path: z.string().min(1), oldText: z.string().min(1).max(500_000), newText: z.string().max(500_000) },
      outputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true }
    }, ({ path, oldText, newText }) => this.track('apply_workspace_patch', { path }, async () => {
      const uri = this.workspaceUri(path);
      const original = await vscode.workspace.fs.readFile(uri);
      const current = new TextDecoder().decode(original);
      const occurrences = current.split(oldText).length - 1;
      if (occurrences !== 1) throw new Error(`Expected exactly one oldText match, found ${occurrences}.`);
      if (!await this.callbacks.requestApproval(`ChatGPT Web muốn sửa ${path}`)) throw new Error('Denied by user.');
      const updated = new TextEncoder().encode(current.replace(oldText, newText));
      await vscode.workspace.fs.writeFile(uri, updated);
      const counts = countLineChanges(original, updated);
      this.callbacks.registerChange({ path: uri.fsPath, original, updated, existed: true, ...counts });
      return this.ok(`Patched ${path}; the edit is waiting in RelayCode Review.`, { path, review: 'pending', ...counts });
    }));

    server.registerTool('delete_workspace_file', {
      title: 'Delete workspace file',
      description: 'Delete one file inside the workspace. Recursive directory deletion is not supported. The deletion can be undone in RelayCode Review.',
      inputSchema: { path: z.string().min(1) },
      outputSchema,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true }
    }, ({ path }) => this.track('delete_workspace_file', { path }, async () => {
      const uri = this.workspaceUri(path);
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type & vscode.FileType.Directory) throw new Error('Only files can be deleted; recursive directory deletion is blocked.');
      if (!await this.callbacks.requestApproval(`ChatGPT Web muốn xóa ${path}`)) throw new Error('Denied by user.');
      const original = await vscode.workspace.fs.readFile(uri);
      await vscode.workspace.fs.delete(uri, { recursive: false, useTrash: false });
      const removed = new TextDecoder().decode(original).split(/\r?\n/).length;
      this.callbacks.registerChange({ path: uri.fsPath, original, updated: new Uint8Array(), existed: true, added: 0, removed });
      return this.ok(`Deleted ${path}; the deletion is waiting in RelayCode Review.`, { path, review: 'pending', added: 0, removed });
    }));

    server.registerTool('run_workspace_command', {
      title: 'Run workspace command',
      description: 'Run a non-interactive shell command in the workspace after explicit approval in VS Code. File changes made by the command are added to RelayCode Review.',
      inputSchema: { command: z.string().min(1).max(20_000), timeoutSeconds: z.number().int().min(5).max(900).default(120) },
      outputSchema,
      annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: true }
    }, ({ command, timeoutSeconds }) => this.track('run_workspace_command', { command }, async () => {
      const root = this.requiredWorkspaceRoot();
      const configuration = vscode.workspace.getConfiguration('nineRouter');
      const policyError = validateCommandPolicy(command, {
        allow: configuration.get<string[]>('commandAllowList', []),
        deny: configuration.get<string[]>('commandDenyList', [])
      });
      if (policyError) throw new Error(policyError);
      if (!await this.callbacks.requestApproval(`ChatGPT Web muốn chạy: ${command}`)) throw new Error('Denied by user.');
      const before = await this.captureSnapshot(root);
      let output: string;
      try {
        output = await runShellCommand({ command, cwd: root, timeoutMs: timeoutSeconds * 1000 });
      } finally {
        const after = await this.captureSnapshot(root);
        this.registerSnapshotChanges(before, after);
      }
      return this.ok('Command completed.', { command, output });
    }));

    return server;
  }

  private async track(tool: string, args: unknown, action: () => Promise<ToolResult>): Promise<ToolResult> {
    const started = Date.now();
    try {
      const result = await action();
      await this.recordActivity({ id: `chatgpt-${started}-${Math.random().toString(36).slice(2)}`, tool, summary: result.structuredContent.summary, ok: true, timestamp: started, durationMs: Date.now() - started });
      return result;
    } catch (error) {
      const summary = this.errorText(error);
      await this.recordActivity({ id: `chatgpt-${started}-${Math.random().toString(36).slice(2)}`, tool, summary, ok: false, timestamp: started, durationMs: Date.now() - started });
      return this.fail(summary, { arguments: this.redactArgs(args) });
    }
  }

  private ok(summary: string, data?: unknown): ToolResult {
    const structuredContent = data === undefined ? { ok: true, summary } : { ok: true, summary, data };
    return { structuredContent, content: [{ type: 'text', text: data === undefined ? summary : `${summary}\n${JSON.stringify(data, null, 2)}` }] };
  }

  private fail(summary: string, data?: unknown): ToolResult {
    const structuredContent = data === undefined ? { ok: false, summary } : { ok: false, summary, data };
    return { structuredContent, content: [{ type: 'text', text: summary }], isError: true };
  }

  private async recordActivity(activity: ChatGptBridgeActivity): Promise<void> {
    this.activities = [activity, ...this.activities].slice(0, MAX_ACTIVITY);
    await this.context.workspaceState.update(BRIDGE_ACTIVITY_STATE, this.activities);
    this.callbacks.onActivity(activity);
  }

  private workspaceDiagnostics(): Array<{ path: string; line: number; severity: string; message: string }> {
    const root = this.requiredWorkspaceRoot();
    return vscode.languages.getDiagnostics().flatMap(([uri, diagnostics]) => {
      if (!this.isInside(root, uri.fsPath)) return [];
      return diagnostics.slice(0, 100).map((item) => ({
        path: relative(root, uri.fsPath).replace(/\\/g, '/'),
        line: item.range.start.line + 1,
        severity: vscode.DiagnosticSeverity[item.severity] || String(item.severity),
        message: item.message
      }));
    }).slice(0, 300);
  }

  private async gitBranch(root: string): Promise<string> {
    try {
      return (await runShellCommand({ command: 'git branch --show-current', cwd: root, timeoutMs: 10_000 })).trim();
    } catch {
      return '';
    }
  }

  private async captureSnapshot(root: string): Promise<Map<string, Uint8Array>> {
    const snapshot = new Map<string, Uint8Array>();
    const uris = await vscode.workspace.findFiles('**/*', '**/{.git,node_modules,dist,out,build,coverage,.next,target,.venv,venv,__pycache__}/**', 2500);
    let total = 0;
    for (const uri of uris) {
      if (!this.isInside(root, uri.fsPath)) continue;
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        if (bytes.byteLength > 2_000_000 || total + bytes.byteLength > 32_000_000) continue;
        total += bytes.byteLength;
        snapshot.set(resolve(uri.fsPath), bytes);
      } catch { /* Ignore transient files. */ }
    }
    return snapshot;
  }

  private registerSnapshotChanges(before: Map<string, Uint8Array>, after: Map<string, Uint8Array>): void {
    for (const path of new Set([...before.keys(), ...after.keys()])) {
      const original = before.get(path) ?? new Uint8Array();
      const updated = after.get(path) ?? new Uint8Array();
      if (this.bytesEqual(original, updated)) continue;
      this.callbacks.registerChange({ path, original, updated, existed: before.has(path), ...countLineChanges(original, updated) });
    }
  }

  private workspaceUri(input: string): vscode.Uri {
    const root = this.requiredWorkspaceRoot();
    const target = resolve(root, input);
    if (!this.isInside(root, target) || !this.realPathIsInside(root, target)) throw new Error('Path is outside the workspace or crosses an unsafe symlink/junction.');
    return vscode.Uri.file(target);
  }

  private workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private requiredWorkspaceRoot(): string {
    const root = this.workspaceRoot();
    if (!root) throw new Error('No workspace folder is open.');
    return resolve(root);
  }

  private isInside(root: string, target: string): boolean {
    const normalizedRoot = process.platform === 'win32' ? resolve(root).toLowerCase() : resolve(root);
    const normalizedTarget = process.platform === 'win32' ? resolve(target).toLowerCase() : resolve(target);
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`);
  }

  private realPathIsInside(root: string, target: string): boolean {
    if (!existsSync(root)) return this.isInside(root, target);
    const realRoot = realpathSync.native(root);
    let existing = target;
    while (!existsSync(existing)) {
      const parent = dirname(existing);
      if (parent === existing) return false;
      existing = parent;
    }
    return this.isInside(realRoot, realpathSync.native(existing));
  }

  private async pathToken(): Promise<string> {
    const existing = await this.context.secrets.get(BRIDGE_TOKEN_SECRET);
    if (existing) return existing;
    const created = randomBytes(24).toString('hex');
    await this.context.secrets.store(BRIDGE_TOKEN_SECRET, created);
    return created;
  }

  private redactArgs(args: unknown): unknown {
    if (!args || typeof args !== 'object') return args;
    const record = { ...(args as Record<string, unknown>) };
    if ('content' in record) record.content = '[redacted]';
    if ('oldText' in record) record.oldText = '[redacted]';
    if ('newText' in record) record.newText = '[redacted]';
    return record;
  }

  private bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((value, index) => value === right[index]);
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
