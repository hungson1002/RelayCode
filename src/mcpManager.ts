import * as vscode from 'vscode';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { clearMcpOAuth, hasMcpOAuthTokens, McpOAuthProvider } from './mcpOAuthProvider';

const MCP_SERVERS_STATE = 'nineRouter.mcpServers';
const MCP_TOKEN_PREFIX = 'nineRouter.mcpToken.';
const MCP_ENV_PREFIX = 'nineRouter.mcpEnv.';
const FIGMA_DESKTOP_URL = 'http://127.0.0.1:3845/mcp';
const FIGMA_DESKTOP_GUIDE = 'https://developers.figma.com/docs/figma-mcp-server/local-server-installation/';

export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  enabled: boolean;
  authMode?: 'oauth' | 'token' | 'api-key' | 'none';
  catalogId?: string;
  tokenHeader?: string;
  command?: string;
  args?: string[];
  url?: string;
}

export interface McpServerStatus extends McpServerConfig {
  connected: boolean;
  toolCount: number;
  error?: string;
  hasToken: boolean;
  hasOAuthTokens: boolean;
  authPending: boolean;
}

export interface McpPreset {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: 'notion' | 'linear' | 'sentry' | 'figma' | 'stitch';
  authMode?: 'oauth' | 'api-key';
  tokenHeader?: string;
  setupUrl?: string;
}

export const MCP_PRESETS: McpPreset[] = [
  {
    id: 'notion',
    name: 'Notion',
    description: 'Trang, database và tài liệu',
    url: 'https://mcp.notion.com/mcp',
    icon: 'notion'
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issue, project và comment',
    url: 'https://mcp.linear.app/mcp',
    icon: 'linear'
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Lỗi, event và hiệu năng',
    url: 'https://mcp.sentry.dev/mcp',
    icon: 'sentry'
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Design context và canvas',
    url: 'https://mcp.figma.com/mcp',
    icon: 'figma'
  },
  {
    id: 'stitch',
    name: 'Google Stitch',
    description: 'Tạo UI và lấy mã thiết kế',
    url: 'https://stitch.googleapis.com/mcp',
    icon: 'stitch',
    authMode: 'api-key',
    tokenHeader: 'X-Goog-Api-Key',
    setupUrl: 'https://stitch.withgoogle.com/settings'
  }
];

export interface ExternalAgentTool {
  definition: Record<string, unknown>;
  label: string;
  execute(args: Record<string, unknown>): Promise<string>;
}

interface Connection {
  client: Client;
  tools: Awaited<ReturnType<Client['listTools']>>['tools'];
}

interface PendingOAuth {
  server: McpServerConfig;
  client: Client;
  transport: StreamableHTTPClientTransport;
  state: string;
  timeout: NodeJS.Timeout;
}

export class McpManager implements vscode.Disposable {
  private readonly connections = new Map<string, Connection>();
  private readonly errors = new Map<string, string>();
  private readonly pendingOAuth = new Map<string, PendingOAuth>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private callbackServer: http.Server | undefined;
  private callbackUrl = '';

  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public servers(): McpServerConfig[] {
    return this.context.globalState.get<McpServerConfig[]>(MCP_SERVERS_STATE, []);
  }

  public async saveServer(config: McpServerConfig, token?: string, env?: Record<string, string>): Promise<McpServerConfig> {
    const normalized: McpServerConfig = {
      ...config,
      id: config.id || `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: config.name.trim(),
      authMode: config.transport === 'http' ? (config.authMode ?? 'token') : undefined,
      command: config.command?.trim() || undefined,
      url: config.url?.trim() || undefined,
      args: (config.args ?? []).map((arg) => arg.trim()).filter(Boolean)
    };
    if (!normalized.name) throw new Error('MCP server cần có tên.');
    if (normalized.transport === 'stdio' && !normalized.command) throw new Error('MCP stdio cần command.');
    if (normalized.transport === 'http' && !normalized.url) throw new Error('MCP HTTP cần URL.');
    if (normalized.url) new URL(normalized.url);
    const servers = this.servers();
    const index = servers.findIndex((item) => item.id === normalized.id);
    if (index >= 0) servers[index] = normalized;
    else servers.push(normalized);
    await this.context.globalState.update(MCP_SERVERS_STATE, servers);
    if (token !== undefined) {
      if (token.trim()) await this.context.secrets.store(`${MCP_TOKEN_PREFIX}${normalized.id}`, token.trim());
      else await this.context.secrets.delete(`${MCP_TOKEN_PREFIX}${normalized.id}`);
    }
    if (env !== undefined) await this.context.secrets.store(`${MCP_ENV_PREFIX}${normalized.id}`, JSON.stringify(env));
    await this.disconnect(normalized.id);
    const hasStoredToken = Boolean(await this.context.secrets.get(`${MCP_TOKEN_PREFIX}${normalized.id}`));
    if (normalized.enabled && normalized.authMode !== 'oauth' && (normalized.authMode !== 'api-key' || hasStoredToken)) {
      await this.connect(normalized).catch(() => undefined);
    }
    this.changeEmitter.fire();
    return normalized;
  }

  public async removeServer(id: string): Promise<void> {
    await this.disconnect(id);
    await this.context.globalState.update(MCP_SERVERS_STATE, this.servers().filter((item) => item.id !== id));
    await this.context.secrets.delete(`${MCP_TOKEN_PREFIX}${id}`);
    await this.context.secrets.delete(`${MCP_ENV_PREFIX}${id}`);
    await clearMcpOAuth(this.context, id);
    this.errors.delete(id);
    this.changeEmitter.fire();
  }

  public async statuses(): Promise<McpServerStatus[]> {
    const statuses: McpServerStatus[] = [];
    for (const server of this.servers()) {
      const hasOAuthTokens = await hasMcpOAuthTokens(this.context, server.id);
      const hasToken = Boolean(await this.context.secrets.get(`${MCP_TOKEN_PREFIX}${server.id}`));
      const hasCredentials = server.authMode === 'oauth' ? hasOAuthTokens : server.authMode === 'api-key' ? hasToken : true;
      if (server.enabled && !this.connections.has(server.id) && hasCredentials) {
        await this.connect(server).catch(() => undefined);
      }
      const connection = this.connections.get(server.id);
      statuses.push({
        ...server,
        connected: Boolean(connection),
        toolCount: connection?.tools.length ?? 0,
        error: this.errors.get(server.id),
        hasToken,
        hasOAuthTokens,
        authPending: this.pendingOAuth.has(server.id)
      });
    }
    return statuses;
  }

  public async installPreset(presetId: string): Promise<McpServerConfig> {
    const preset = MCP_PRESETS.find((item) => item.id === presetId);
    if (!preset) throw new Error('Không tìm thấy MCP này.');
    const existing = this.servers().find((item) => item.catalogId === preset.id);
    if (existing) {
      if (preset.authMode === 'api-key') await this.configurePresetApiKey(existing, preset);
      else if (preset.id === 'figma' && existing.authMode === 'none') await this.reconnect(existing.id);
      else await this.login(existing.id);
      return existing;
    }
    const server: McpServerConfig = {
      id: `mcp-${preset.id}-${Date.now()}`,
      catalogId: preset.id,
      name: preset.name,
      transport: 'http',
      authMode: preset.authMode ?? 'oauth',
      tokenHeader: preset.tokenHeader,
      enabled: true,
      url: preset.url
    };
    await this.saveServer(server);
    if (preset.authMode === 'api-key') await this.configurePresetApiKey(server, preset);
    else await this.login(server.id);
    return server;
  }

  public async configureApiKey(id: string): Promise<void> {
    const server = this.servers().find((item) => item.id === id);
    if (!server) throw new Error('Không tìm thấy MCP server.');
    const preset = MCP_PRESETS.find((item) => item.id === server.catalogId);
    if (!preset || preset.authMode !== 'api-key') throw new Error('MCP này không dùng API key riêng.');
    await this.configurePresetApiKey(server, preset);
  }

  public async login(id: string): Promise<void> {
    const server = this.servers().find((item) => item.id === id);
    if (!server) throw new Error('Không tìm thấy MCP server.');
    if (server.transport !== 'http' || !server.url) throw new Error('OAuth chỉ dùng cho MCP HTTP.');
    if (this.pendingOAuth.has(id)) return;

    await this.disconnect(id);
    const callbackUrl = await this.ensureCallbackServer();
    const state = randomUUID();
    const provider = new McpOAuthProvider(
      this.context,
      id,
      callbackUrl,
      state,
      async (url) => {
        const opened = await vscode.env.openExternal(vscode.Uri.parse(url.toString()));
        if (!opened) throw new Error('Không thể mở trình duyệt để đăng nhập MCP.');
      }
    );
    const client = new Client({ name: 'loi-agent', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(server.url), { authProvider: provider });
    const timeout = setTimeout(() => {
      const pending = this.pendingOAuth.get(id);
      if (!pending || pending.state !== state) return;
      this.pendingOAuth.delete(id);
      this.errors.set(id, 'Phiên đăng nhập đã hết hạn. Hãy thử lại.');
      void pending.client.close().catch(() => undefined);
      this.changeEmitter.fire();
    }, 10 * 60_000);
    this.pendingOAuth.set(id, { server: { ...server, authMode: 'oauth' }, client, transport, state, timeout });
    this.errors.delete(id);
    this.changeEmitter.fire();
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      this.connections.set(id, { client, tools: listed.tools });
      clearTimeout(timeout);
      this.pendingOAuth.delete(id);
      this.changeEmitter.fire();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        this.errors.set(id, 'Hoàn tất đăng nhập trong trình duyệt.');
        this.changeEmitter.fire();
        return;
      }
      clearTimeout(timeout);
      this.pendingOAuth.delete(id);
      this.errors.set(id, error instanceof Error ? error.message : String(error));
      await client.close().catch(() => undefined);
      this.changeEmitter.fire();
      if (server.catalogId === 'figma' && this.isFigmaClientBlocked(error)) {
        await this.offerFigmaDesktop(server);
        return;
      }
      throw error;
    }
  }

  public async reconnect(id: string): Promise<void> {
    const server = this.servers().find((item) => item.id === id);
    if (!server) throw new Error('Không tìm thấy MCP server.');
    await this.disconnect(id);
    await this.connect(server);
    this.changeEmitter.fire();
  }

  public async logout(id: string): Promise<void> {
    const pending = this.pendingOAuth.get(id);
    this.pendingOAuth.delete(id);
    if (pending) {
      clearTimeout(pending.timeout);
      await pending.client.close().catch(() => undefined);
    }
    await this.disconnect(id);
    await clearMcpOAuth(this.context, id);
    this.errors.delete(id);
    this.changeEmitter.fire();
  }

  public async agentTools(): Promise<ExternalAgentTool[]> {
    const result: ExternalAgentTool[] = [];
    for (const server of this.servers().filter((item) => item.enabled)) {
      if (server.authMode === 'api-key' && !await this.context.secrets.get(`${MCP_TOKEN_PREFIX}${server.id}`)) continue;
      if (server.authMode === 'oauth' && !await hasMcpOAuthTokens(this.context, server.id)) continue;
      const connection = this.connections.get(server.id) ?? await this.connect(server).catch(() => undefined);
      if (!connection) continue;
      for (const tool of connection.tools) {
        const exposedName = `mcp__${safeName(server.name)}__${safeName(tool.name)}`.slice(0, 64);
        result.push({
          label: `${server.name} / ${tool.name}`,
          definition: {
            type: 'function',
            function: {
              name: exposedName,
              description: `[MCP ${server.name}] ${tool.description || tool.name}`,
              parameters: tool.inputSchema
            }
          },
          execute: async (args) => {
            const response = await connection.client.callTool({ name: tool.name, arguments: args }, undefined, { timeout: 120_000 });
            const content = (response.content ?? []) as Array<{ type: string; text?: string; mimeType?: string; data?: string }>;
            const text = content.map((item) => {
              if (item.type === 'text') return item.text;
              if (item.type === 'image') return `[MCP image: ${item.mimeType}, ${item.data?.length ?? 0} base64 chars]`;
              if (item.type === 'audio') return `[MCP audio: ${item.mimeType}, ${item.data?.length ?? 0} base64 chars]`;
              return JSON.stringify(item);
            }).join('\n');
            return response.isError ? `ERROR: ${text}` : text || JSON.stringify(response.structuredContent ?? {});
          }
        });
      }
    }
    return result;
  }

  private async connect(server: McpServerConfig): Promise<Connection> {
    const existing = this.connections.get(server.id);
    if (existing) return existing;
    const client = new Client({ name: 'loi-agent', version: '1.0.0' });
    try {
      if (server.transport === 'stdio') {
        let extraEnv: Record<string, string> = {};
        try { extraEnv = JSON.parse((await this.context.secrets.get(`${MCP_ENV_PREFIX}${server.id}`)) || '{}') as Record<string, string>; } catch { /* Ignore malformed optional env. */ }
        const inherited = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
        await client.connect(new StdioClientTransport({ command: server.command!, args: server.args, env: { ...inherited, ...extraEnv }, cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath }));
      } else {
        if (server.authMode === 'oauth') {
          const callbackUrl = await this.ensureCallbackServer();
          const provider = new McpOAuthProvider(
            this.context,
            server.id,
            callbackUrl,
            randomUUID(),
            async () => { throw new Error('Phiên MCP đã hết hạn. Hãy bấm Đăng nhập lại.'); }
          );
          await client.connect(new StreamableHTTPClientTransport(new URL(server.url!), { authProvider: provider }));
        } else {
          const token = await this.context.secrets.get(`${MCP_TOKEN_PREFIX}${server.id}`);
          const headerName = server.tokenHeader || 'Authorization';
          const headers: Record<string, string> | undefined = token
            ? { [headerName]: headerName.toLowerCase() === 'authorization' ? `Bearer ${token}` : token }
            : undefined;
          await client.connect(new StreamableHTTPClientTransport(new URL(server.url!), { requestInit: { headers } }));
        }
      }
      const listed = await client.listTools();
      const connection = { client, tools: listed.tools };
      this.connections.set(server.id, connection);
      this.errors.delete(server.id);
      return connection;
    } catch (error) {
      this.errors.set(server.id, error instanceof Error ? error.message : String(error));
      await client.close().catch(() => undefined);
      throw error;
    }
  }

  private async configurePresetApiKey(server: McpServerConfig, preset: McpPreset): Promise<void> {
    if (preset.setupUrl) await vscode.env.openExternal(vscode.Uri.parse(preset.setupUrl));
    const apiKey = await vscode.window.showInputBox({
      title: `Kết nối ${preset.name}`,
      prompt: 'Đăng nhập trên trình duyệt, tạo API key rồi dán vào đây.',
      placeHolder: 'Dán API key',
      password: true,
      ignoreFocusOut: true
    });
    if (apiKey === undefined) return;
    if (!apiKey.trim()) throw new Error('API key không được để trống.');
    await this.saveServer({ ...server, authMode: 'api-key', tokenHeader: preset.tokenHeader }, apiKey.trim());
  }

  private isFigmaClientBlocked(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /\b403\b|forbidden|invalid oauth error response/i.test(message);
  }

  private async offerFigmaDesktop(server: McpServerConfig): Promise<void> {
    const message = 'Figma đã chặn OAuth trước khi tạo trang đăng nhập vì Lối chưa nằm trong MCP Catalog của Figma.';
    this.errors.set(server.id, 'OAuth Remote bị Figma từ chối · có thể dùng Figma Desktop');
    this.changeEmitter.fire();
    const choice = await vscode.window.showWarningMessage(
      `${message}\n\nBạn có thể dùng MCP tích hợp trong Figma Desktop mà không cần OAuth.`,
      { modal: true },
      'Dùng Figma Desktop',
      'Mở hướng dẫn'
    );
    if (choice === 'Mở hướng dẫn') {
      await vscode.env.openExternal(vscode.Uri.parse(FIGMA_DESKTOP_GUIDE));
      return;
    }
    if (choice !== 'Dùng Figma Desktop') return;

    const desktopServer: McpServerConfig = {
      ...server,
      name: 'Figma Desktop',
      authMode: 'none',
      url: FIGMA_DESKTOP_URL,
      enabled: true
    };
    await this.saveServer(desktopServer);
    const connection = this.connections.get(server.id);
    if (connection) {
      vscode.window.showInformationMessage(`Figma Desktop đã kết nối · ${connection.tools.length} công cụ sẵn sàng.`);
      return;
    }

    this.errors.set(server.id, 'Hãy bật Dev Mode → Enable desktop MCP server trong Figma, rồi bấm Kết nối lại.');
    this.changeEmitter.fire();
    const setup = await vscode.window.showInformationMessage(
      'Đã chuyển sang Figma Desktop. Hãy bật Desktop MCP server trong Figma rồi bấm lại thẻ Figma.',
      'Mở hướng dẫn'
    );
    if (setup === 'Mở hướng dẫn') await vscode.env.openExternal(vscode.Uri.parse(FIGMA_DESKTOP_GUIDE));
  }

  private async ensureCallbackServer(): Promise<string> {
    if (this.callbackServer?.listening && this.callbackUrl) return this.callbackUrl;
    this.callbackServer = http.createServer((request, response) => {
      void this.handleOAuthCallback(request, response);
    });
    await new Promise<void>((resolve, reject) => {
      const server = this.callbackServer!;
      server.once('error', reject);
      server.listen(0, () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = this.callbackServer.address() as AddressInfo;
    this.callbackUrl = `http://localhost:${address.port}/mcp/oauth/callback`;
    return this.callbackUrl;
  }

  private async handleOAuthCallback(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const callback = new URL(request.url || '/', this.callbackUrl || 'http://127.0.0.1');
    if (callback.pathname !== '/mcp/oauth/callback') {
      response.writeHead(404).end('Not found');
      return;
    }
    const code = callback.searchParams.get('code');
    const state = callback.searchParams.get('state');
    const oauthError = callback.searchParams.get('error');
    const pending = [...this.pendingOAuth.values()].find((item) => item.state === state);
    if (!pending || !state) {
      this.respondToBrowser(response, false, 'Phiên đăng nhập không còn hợp lệ. Hãy quay lại Antigravity và thử lại.');
      return;
    }
    if (oauthError || !code) {
      this.pendingOAuth.delete(pending.server.id);
      clearTimeout(pending.timeout);
      this.errors.set(pending.server.id, callback.searchParams.get('error_description') || oauthError || 'Đăng nhập bị hủy.');
      await pending.client.close().catch(() => undefined);
      this.changeEmitter.fire();
      this.respondToBrowser(response, false, 'Đăng nhập chưa hoàn tất. Bạn có thể đóng tab này.');
      return;
    }
    try {
      await pending.transport.finishAuth(code);
      this.pendingOAuth.delete(pending.server.id);
      clearTimeout(pending.timeout);
      await pending.client.close().catch(() => undefined);
      await this.connect(pending.server);
      this.errors.delete(pending.server.id);
      this.changeEmitter.fire();
      this.respondToBrowser(response, true, `${pending.server.name} đã kết nối với Lối.`);
    } catch (error) {
      this.pendingOAuth.delete(pending.server.id);
      clearTimeout(pending.timeout);
      this.errors.set(pending.server.id, error instanceof Error ? error.message : String(error));
      await pending.client.close().catch(() => undefined);
      this.changeEmitter.fire();
      this.respondToBrowser(response, false, 'Không thể hoàn tất đăng nhập. Hãy quay lại Antigravity để xem lỗi.');
    }
  }

  private respondToBrowser(response: http.ServerResponse, ok: boolean, message: string): void {
    const color = ok ? '#68d7bd' : '#f08c8c';
    const safeMessage = message.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
    response.writeHead(ok ? 200 : 400, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    response.end(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MCP · Lối</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#18191b;color:#e6e7e9;font:15px/1.55 system-ui}.card{width:min(420px,calc(100% - 40px));padding:28px;border:1px solid #3c3e42;border-radius:18px;background:#242527;box-shadow:0 28px 80px #0008}.mark{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:${color}18;color:${color};font-size:22px}.card h1{margin:18px 0 7px;font-size:20px}.card p{margin:0;color:#aeb1b5}.card small{display:block;margin-top:20px;color:#74787e}</style><body><main class="card"><div class="mark">${ok ? '✓' : '×'}</div><h1>${ok ? 'Đã kết nối MCP' : 'Chưa thể kết nối'}</h1><p>${safeMessage}</p><small>Bạn có thể đóng tab này.</small></main></body></html>`);
  }

  private async disconnect(id: string): Promise<void> {
    const connection = this.connections.get(id);
    this.connections.delete(id);
    if (connection) await connection.client.close().catch(() => undefined);
  }

  public dispose(): void {
    for (const connection of this.connections.values()) void connection.client.close().catch(() => undefined);
    for (const pending of this.pendingOAuth.values()) {
      clearTimeout(pending.timeout);
      void pending.client.close().catch(() => undefined);
    }
    this.connections.clear();
    this.pendingOAuth.clear();
    this.callbackServer?.close();
    this.callbackServer = undefined;
    this.changeEmitter.dispose();
  }
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'tool';
}
