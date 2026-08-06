import * as vscode from 'vscode';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { clearMcpOAuth, hasMcpOAuthTokens, McpOAuthProvider } from './mcpOAuthProvider';
import { exposedToolName, normalizeMcpInputSchema, ResilientMcpJsonSchemaValidator } from './mcpSchema';
import type { UserInteraction } from './userInteraction';
import { renderMcpOAuthResult, type McpOAuthResultReason } from './webview/mcpOAuthResult';

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
  execute(args: Record<string, unknown>, signal?: AbortSignal): Promise<string>;
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

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly interaction?: UserInteraction
  ) {}

  private createClient(): Client {
    return new Client(
      { name: 'relaycode', version: '1.0.0' },
      { jsonSchemaValidator: new ResilientMcpJsonSchemaValidator() }
    );
  }

  private async listAllTools(client: Client): Promise<Connection['tools']> {
    const tools: Connection['tools'] = [];
    const names = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < 100; page += 1) {
      const listed = await client.listTools(cursor ? { cursor } : undefined);
      for (const tool of listed.tools) {
        if (names.has(tool.name)) continue;
        names.add(tool.name);
        tools.push(tool);
      }
      cursor = listed.nextCursor;
      if (!cursor || cursors.has(cursor)) break;
      cursors.add(cursor);
    }
    return tools;
  }

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
    const previous = index >= 0 ? servers[index] : undefined;
    const oauthIdentityChanged = Boolean(previous && (
      previous.url !== normalized.url
      || previous.transport !== normalized.transport
      || previous.authMode !== normalized.authMode
    ));
    if (oauthIdentityChanged) {
      await this.cancelPendingOAuth(normalized.id);
      await clearMcpOAuth(this.context, normalized.id);
    }
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
    await this.cancelPendingOAuth(id);
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
        authPending: this.pendingOAuth.has(server.id) && !connection
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
    const client = this.createClient();
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
      const tools = await this.listAllTools(client);
      this.connections.set(id, { client, tools });
      clearTimeout(timeout);
      this.pendingOAuth.delete(id);
      this.changeEmitter.fire();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        const current = this.pendingOAuth.get(id);
        if (this.connections.has(id) || !current || current.state !== state) {
          this.pendingOAuth.delete(id);
          this.errors.delete(id);
          this.changeEmitter.fire();
          return;
        }
        this.errors.set(id, 'Hoàn tất đăng nhập trong trình duyệt.');
        this.changeEmitter.fire();
        return;
      }
      if (this.connections.has(id)) {
        this.pendingOAuth.delete(id);
        this.errors.delete(id);
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
        const exposedName = exposedToolName(server.id, server.name, tool.name);
        result.push({
          label: `${server.name} / ${tool.name}`,
          definition: {
            type: 'function',
            function: {
              name: exposedName,
              description: `[MCP ${server.name}] ${tool.description || tool.name}`,
              parameters: normalizeMcpInputSchema(tool.inputSchema)
            }
          },
          execute: async (args, signal) => {
            const response = await connection.client.callTool(
              { name: tool.name, arguments: args },
              undefined,
              { timeout: 120_000, signal }
            );
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
    const client = this.createClient();
    try {
      if (server.transport === 'stdio') {
        if (!vscode.workspace.isTrusted) {
          throw new Error('Workspace chưa được tin cậy. Hãy Trust workspace trước khi chạy MCP stdio.');
        }
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
      const tools = await this.listAllTools(client);
      const connection = { client, tools };
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
    const apiKey = this.interaction
      ? await this.interaction.prompt({
          title: `Kết nối ${preset.name}`,
          message: 'Đăng nhập trên trình duyệt, tạo API key rồi dán vào đây.',
          label: 'API key',
          placeholder: 'Dán API key',
          password: true,
          required: true,
          confirmLabel: 'Lưu và kết nối',
          icon: 'key'
        })
      : await vscode.window.showInputBox({
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
    const message = 'Figma đã chặn OAuth trước khi tạo trang đăng nhập vì RelayCode chưa nằm trong MCP Catalog của Figma.';
    this.errors.set(server.id, 'OAuth Remote bị Figma từ chối · có thể dùng Figma Desktop');
    this.changeEmitter.fire();
    const choice = this.interaction
      ? await this.interaction.choose({
          title: 'Figma Remote OAuth bị từ chối',
          message,
          detail: 'Bạn có thể dùng MCP tích hợp trong Figma Desktop mà không cần OAuth.',
          tone: 'warning',
          icon: 'warning',
          actions: [
            { id: 'cancel', label: 'Đóng', kind: 'secondary' },
            { id: 'guide', label: 'Mở hướng dẫn', kind: 'secondary' },
            { id: 'desktop', label: 'Dùng Figma Desktop', kind: 'primary' }
          ]
        })
      : await vscode.window.showWarningMessage(
          `${message}\n\nBạn có thể dùng MCP tích hợp trong Figma Desktop mà không cần OAuth.`,
          { modal: true },
          'Dùng Figma Desktop',
          'Mở hướng dẫn'
        );
    if (choice === 'guide' || choice === 'Mở hướng dẫn') {
      await vscode.env.openExternal(vscode.Uri.parse(FIGMA_DESKTOP_GUIDE));
      return;
    }
    if (choice !== 'desktop' && choice !== 'Dùng Figma Desktop') return;

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
      this.notifyFigmaDesktopConnected(connection.tools.length);
      return;
    }

    await this.waitForFigmaDesktop(desktopServer);
  }

  private notifyFigmaDesktopConnected(toolCount: number): void {
    const message = `Figma Desktop đã kết nối · ${toolCount} công cụ sẵn sàng.`;
    if (this.interaction) this.interaction.notify(message, 'success');
    else void vscode.window.showInformationMessage(message);
  }

  private async waitForFigmaDesktop(server: McpServerConfig): Promise<void> {
    const unavailable = 'Figma Desktop chưa sẵn sàng · mở file Design, bật Dev Mode và Enable desktop MCP server.';
    this.errors.set(server.id, unavailable);
    this.changeEmitter.fire();

    if (!this.interaction) {
      const action = await vscode.window.showInformationMessage(
        'RelayCode đã cấu hình Figma Desktop nhưng server chưa chạy. Mở một file Figma Design, nhấn Shift+D, rồi bật Enable desktop MCP server.',
        'Kiểm tra lại',
        'Mở hướng dẫn'
      );
      if (action === 'Mở hướng dẫn') {
        await vscode.env.openExternal(vscode.Uri.parse(FIGMA_DESKTOP_GUIDE));
        return;
      }
      if (action !== 'Kiểm tra lại') return;
      await this.reconnect(server.id).catch(() => undefined);
      const connection = this.connections.get(server.id);
      if (connection) this.notifyFigmaDesktopConnected(connection.tools.length);
      else void vscode.window.showWarningMessage(unavailable);
      return;
    }

    while (!this.connections.has(server.id)) {
      const action = await this.interaction.choose({
        title: 'Figma Desktop chưa sẵn sàng',
        message: 'RelayCode đã lưu cấu hình, nhưng chưa tìm thấy Desktop MCP server.',
        detail: 'Mở một file Figma Design trong ứng dụng Desktop → nhấn Shift+D để vào Dev Mode → trong mục MCP server, chọn Enable desktop MCP server.',
        tone: 'warning',
        icon: 'plugsConnected',
        actions: [
          { id: 'close', label: 'Đóng', kind: 'secondary' },
          { id: 'guide', label: 'Mở hướng dẫn', kind: 'secondary' },
          { id: 'retry', label: 'Kiểm tra lại', kind: 'primary' }
        ]
      });
      if (!action || action === 'close') return;
      if (action === 'guide') {
        await vscode.env.openExternal(vscode.Uri.parse(FIGMA_DESKTOP_GUIDE));
        continue;
      }

      this.errors.delete(server.id);
      this.changeEmitter.fire();
      this.interaction.notify('Đang kiểm tra Figma Desktop…', 'neutral');
      await this.reconnect(server.id).catch(() => undefined);
      const connection = this.connections.get(server.id);
      if (connection) {
        this.notifyFigmaDesktopConnected(connection.tools.length);
        return;
      }
      this.errors.set(server.id, unavailable);
      this.changeEmitter.fire();
    }
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
    this.callbackUrl = `http://localhost:${address.port}/relaycode/callback`;
    return this.callbackUrl;
  }

  private async handleOAuthCallback(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const callback = new URL(request.url || '/', this.callbackUrl || 'http://127.0.0.1');
    if (callback.pathname !== '/relaycode/callback') {
      response.writeHead(404).end('Not found');
      return;
    }
    const code = callback.searchParams.get('code');
    const state = callback.searchParams.get('state');
    const oauthError = callback.searchParams.get('error');
    const pending = [...this.pendingOAuth.values()].find((item) => item.state === state);
    if (!pending || !state) {
      this.respondToBrowser(response, false, undefined, 'expired');
      return;
    }
    if (oauthError || !code) {
      this.pendingOAuth.delete(pending.server.id);
      clearTimeout(pending.timeout);
      this.errors.set(pending.server.id, callback.searchParams.get('error_description') || oauthError || 'Đăng nhập bị hủy.');
      await pending.client.close().catch(() => undefined);
      this.changeEmitter.fire();
      this.respondToBrowser(response, false, pending.server.name, 'cancelled');
      return;
    }
    try {
      await pending.transport.finishAuth(code);
      this.pendingOAuth.delete(pending.server.id);
      clearTimeout(pending.timeout);
      await pending.client.close().catch(() => undefined);
      await this.connect(pending.server);
      this.pendingOAuth.delete(pending.server.id);
      this.errors.delete(pending.server.id);
      this.changeEmitter.fire();
      this.interaction?.notify(`${pending.server.name} đã kết nối MCP thành công.`, 'success');
      this.respondToBrowser(response, true, pending.server.name);
    } catch (error) {
      this.pendingOAuth.delete(pending.server.id);
      clearTimeout(pending.timeout);
      this.errors.set(pending.server.id, error instanceof Error ? error.message : String(error));
      await pending.client.close().catch(() => undefined);
      this.changeEmitter.fire();
      this.interaction?.notify(`Không thể kết nối ${pending.server.name}: ${error instanceof Error ? error.message : String(error)}`, 'danger');
      this.respondToBrowser(response, false, pending.server.name, 'failed');
    }
  }

  private respondToBrowser(response: http.ServerResponse, ok: boolean, serverName?: string, reason?: McpOAuthResultReason): void {
    const language = vscode.workspace.getConfiguration('nineRouter').get<'vi' | 'en'>('language', 'en');
    response.writeHead(ok ? 200 : 400, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    });
    response.end(renderMcpOAuthResult({ language, ok, serverName, reason }));
  }

  private async disconnect(id: string): Promise<void> {
    const connection = this.connections.get(id);
    this.connections.delete(id);
    if (connection) await connection.client.close().catch(() => undefined);
  }

  private async cancelPendingOAuth(id: string): Promise<void> {
    const pending = this.pendingOAuth.get(id);
    this.pendingOAuth.delete(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    await pending.client.close().catch(() => undefined);
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
