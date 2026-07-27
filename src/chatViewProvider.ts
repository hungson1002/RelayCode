import * as vscode from 'vscode';
import { relative, resolve } from 'node:path';
import { AgentRuntime } from './agentRuntime';
import { normalizeEndpoint } from './routerClient';
import { RouterProcessManager, type RouterLaunchProgress } from './routerProcessManager';
import type { ChatMessage, ChatMode, RouterModel } from './types';
import { capabilitiesForModel, createProvider, type ProviderKind } from './provider';
import { ProviderProfileStore, TelemetryStore, type ProviderProfile } from './providerProfiles';
import { MCP_PRESETS, McpManager, type McpServerConfig } from './mcpManager';
import { GitCheckpointManager } from './gitCheckpoint';
import { LocalRuntimeManager } from './localRuntimeManager';
import { SandboxRuntime, type SandboxMode, type SandboxSession } from './sandboxRuntime';
import { applyForward, applyReverse, createDiffHunks } from './diffHunks';

const API_KEY_SECRET = 'nineRouter.apiKey';
const DISCONNECTED_STATE = 'nineRouter.manuallyDisconnected';
const DEFAULT_MODEL_STATE = 'nineRouter.defaultModel';
const CUSTOM_MODELS_STATE = 'nineRouter.customModels';
const PERMISSION_MODE_STATE = 'nineRouter.permissionMode';
const CHAT_SESSIONS_STATE = 'nineRouter.chatSessions';
const PROVIDER_KIND_STATE = 'nineRouter.providerKind';
const PENDING_CHANGES_STATE = 'nineRouter.pendingChanges';
const ONBOARDING_STATE = 'nineRouter.onboardingSeen';
const FAVORITE_MODELS_STATE = 'nineRouter.favoriteModels';
const RECENT_MODELS_STATE = 'nineRouter.recentModels';
const LAST_TERMINAL_STATE = 'nineRouter.lastTerminalOutput';
const ACTIVE_RUN_STATE = 'nineRouter.activeRun';
const SANDBOX_MODE_STATE = 'nineRouter.sandboxMode';

interface StoredAttachment {
  name: string;
  path?: string;
}

interface StoredTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  error?: boolean;
  attachments?: StoredAttachment[];
}

interface StoredSession {
  id: string;
  title: string;
  updatedAt: number;
  mode: ChatMode;
  model: string;
  turns: StoredTurn[];
}

interface PendingChange {
  path: string;
  original: string;
  updated: string;
  existed: boolean;
  added: number;
  removed: number;
  taskId: string;
  staged?: boolean;
}

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'setLanguage'; language: 'vi' | 'en' }
  | { type: 'addCustomModel'; model: string }
  | { type: 'approval'; id: string; allow: boolean }
  | { type: 'acceptChange'; id: string }
  | { type: 'undoChange'; id: string }
  | { type: 'reviewChange'; id: string }
  | { type: 'openFullDiff'; id: string }
  | { type: 'applyChangeHunk'; id: string; hunkId: number; action: 'accept' | 'undo' }
  | { type: 'acceptAllChanges' }
  | { type: 'undoAllChanges' }
  | { type: 'acceptTaskChanges'; taskId: string }
  | { type: 'undoTaskChanges'; taskId: string }
  | { type: 'setPermissionMode'; mode: 'ask' | 'edit' | 'full' }
  | { type: 'setSandboxMode'; mode: SandboxMode }
  | { type: 'checkSandbox' }
  | { type: 'toggleFavoriteModel'; model: string }
  | { type: 'exportDiagnostics' }
  | { type: 'showLogs' }
  | { type: 'connect'; endpoint: string; apiKey?: string; model?: string; provider?: ProviderKind; profileId?: string; profileName?: string; inputPricePerMillion?: number; outputPricePerMillion?: number }
  | { type: 'activateProfile'; id: string }
  | { type: 'deleteProfile'; id: string }
  | { type: 'checkModels' }
  | { type: 'cancelModelCheck' }
  | { type: 'restoreCheckpoint'; id: string }
  | { type: 'getTelemetry' }
  | { type: 'openTelemetryDashboard' }
  | { type: 'clearTelemetry' }
  | { type: 'getMcpServers' }
  | { type: 'saveMcpServer'; server: McpServerConfig; token?: string; env?: Record<string, string> }
  | { type: 'removeMcpServer'; id: string }
  | { type: 'installMcpPreset'; presetId: string }
  | { type: 'loginMcp'; id: string }
  | { type: 'reconnectMcp'; id: string }
  | { type: 'logoutMcp'; id: string }
  | { type: 'configureMcpApiKey'; id: string }
  | { type: 'setupLocalProvider' }
  | { type: 'diagnostics' }
  | { type: 'stopTurn' }
  | { type: 'startRouter' }
  | { type: 'retryConnection' }
  | { type: 'openDashboard' }
  | { type: 'openExternal'; url: string }
  | { type: 'openFile'; path: string }
  | { type: 'pickFiles'; kind: 'files' | 'images' }
  | { type: 'pasteImage'; name: string; mimeType: string; dataUrl: string }
  | { type: 'removeAttachment'; index: number }
  | { type: 'loadSession'; id: string }
  | { type: 'deleteSession'; id: string }
  | { type: 'stopRouter' }
  | { type: 'disconnectProvider' }
  | { type: 'send'; prompt: string; mode: ChatMode; model: string; includeSelection: boolean }
  | { type: 'newThread' }
  | { type: 'openSettings' };

export class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'nineRouter.chatView';
  private view: vscode.WebviewView | undefined;
  private models: RouterModel[] = [];
  private history: ChatMessage[] = [];
  private abortController: AbortController | undefined;
  private routerProcess = new RouterProcessManager();
  private pendingAttachments: Array<{ path: string; name: string; mimeType: string; size: number }> = [];
  private approvals = new Map<string, (allow: boolean) => void>();
  private changes = new Map<string, { path: string; original: Uint8Array; updated: Uint8Array; existed: boolean; added: number; removed: number; taskId: string; staged?: boolean }>();
  private currentSessionId = this.createSessionId();
  private transcript: StoredTurn[] = [];
  private readonly profileStore: ProviderProfileStore;
  private readonly telemetryStore: TelemetryStore;
  private readonly mcpManager: McpManager;
  private readonly checkpointManager: GitCheckpointManager;
  private readonly localRuntimeManager = new LocalRuntimeManager();
  private modelCheckController: AbortController | undefined;
  private metricsPanel: vscode.WebviewPanel | undefined;
  private currentTaskId = '';
  private recoveryTimer: NodeJS.Timeout | undefined;
  private readonly output = vscode.window.createOutputChannel('Lối · Agent');
  private readonly sandboxRuntime: SandboxRuntime;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.profileStore = new ProviderProfileStore(context);
    this.telemetryStore = new TelemetryStore(context);
    this.mcpManager = new McpManager(context);
    context.subscriptions.push(this.mcpManager.onDidChange(() => void this.postMcpServers()));
    this.checkpointManager = new GitCheckpointManager(context);
    this.sandboxRuntime = new SandboxRuntime(context.globalStorageUri.fsPath, this.output);
    for (const [index, change] of context.workspaceState.get<PendingChange[]>(PENDING_CHANGES_STATE, []).entries()) {
      this.changes.set(`recovered-${index}-${Date.now()}`, {
        ...change,
        original: Buffer.from(change.original, 'base64'),
        updated: Buffer.from(change.updated, 'base64')
      });
    }
  }

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((message: WebviewMessage) => void this.onMessage(message));
  }

  public reveal(): void {
    this.view?.show?.(true);
  }

  public showLogs(): void {
    this.output.show(true);
  }

  public async configure(): Promise<void> {
    const current = this.endpoint;
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const endpoint = await vscode.window.showInputBox({
      title: 'Kết nối 9Router',
      prompt: 'OpenAI-compatible endpoint',
      value: current,
      ignoreFocusOut: true
    });
    if (endpoint === undefined) return;
    const currentKey = await this.getApiKey(provider);
    const apiKey = await vscode.window.showInputBox({
      title: 'API key 9Router',
      prompt: 'Được lưu an toàn trong Secret Storage. Để trống nếu gateway local không yêu cầu key.',
      value: currentKey,
      password: true,
      ignoreFocusOut: true
    });
    if (apiKey === undefined) return;
    await this.connect(endpoint, apiKey, undefined, provider);
  }

  public newThread(): void {
    this.history = [];
    this.transcript = [];
    this.currentSessionId = this.createSessionId();
    this.pendingAttachments = [];
    void this.post({ type: 'reset' });
    void this.postAttachments();
  }

  private get endpoint(): string {
    return vscode.workspace.getConfiguration('nineRouter').get(
      'endpoint',
      'http://localhost:20128/v1'
    );
  }

  private apiKeySecret(provider: ProviderKind): string {
    return provider === '9router' ? API_KEY_SECRET : `${API_KEY_SECRET}.${provider}`;
  }

  private async getApiKey(provider: ProviderKind): Promise<string> {
    const profile = this.profileStore.active();
    if (profile?.kind === provider) return this.profileStore.apiKey(profile);
    return (await this.context.secrets.get(this.apiKeySecret(provider))) ?? '';
  }

  private async applyProfile(profile: ProviderProfile): Promise<void> {
    await this.context.globalState.update(PROVIDER_KIND_STATE, profile.kind);
    await vscode.workspace.getConfiguration('nineRouter').update('endpoint', profile.endpoint, vscode.ConfigurationTarget.Global);
  }

  private async postProfileState(): Promise<void> {
    const active = this.profileStore.active();
    await this.post({ type: 'profiles', profiles: this.profileStore.list(), activeProfileId: active?.id ?? '' });
  }

  private async onMessage(message: WebviewMessage): Promise<void> {
    try {
      if (message.type === 'ready') {
        const profile = await this.profileStore.ensure(this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router'), this.endpoint);
        await this.applyProfile(profile);
        const provider = profile.kind;
        await this.post({
          type: 'bootstrap',
          endpoint: profile.endpoint,
          mode: 'agent',
          hasApiKey: Boolean(await this.profileStore.apiKey(profile))
          ,defaultModel: this.context.globalState.get(DEFAULT_MODEL_STATE, '')
          ,permissionMode: this.context.globalState.get(PERMISSION_MODE_STATE, 'ask')
          ,provider: this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router')
          ,profiles: this.profileStore.list()
          ,activeProfileId: profile.id
          ,profileName: profile.name
          ,inputPricePerMillion: profile.inputPricePerMillion
          ,outputPricePerMillion: profile.outputPricePerMillion
          ,sessions: this.sessionSummaries()
          ,favoriteModels: this.context.globalState.get<string[]>(FAVORITE_MODELS_STATE, [])
          ,recentModels: this.context.globalState.get<string[]>(RECENT_MODELS_STATE, [])
          ,sandboxMode: this.context.workspaceState.get<SandboxMode>(SANDBOX_MODE_STATE, 'preferred')
          ,workspaceTrusted: vscode.workspace.isTrusted
        });
        void this.postSandboxStatus();
        await this.postChangesState();
        const recoveredRun = this.context.workspaceState.get<{ prompt: string; answer: string; mode: ChatMode; model: string; startedAt: number }>(ACTIVE_RUN_STATE);
        if (recoveredRun) {
          await this.post({ type: 'recoveredTurn', ...recoveredRun });
          await this.context.workspaceState.update(ACTIVE_RUN_STATE, undefined);
        }
        if (!this.context.globalState.get<boolean>(ONBOARDING_STATE, false)) {
          await this.context.globalState.update(ONBOARDING_STATE, true);
          await this.post({ type: 'onboarding', message: 'Chọn model, dùng Agent để sửa code, gõ @ để thêm ngữ cảnh hoặc / để xem lệnh nhanh.' });
        }
        if (this.context.globalState.get(DISCONNECTED_STATE, false)) {
          await this.post({ type: 'connection', connected: false, endpoint: this.endpoint, models: [], canStop: false, message: 'Đã ngắt kết nối.' });
        } else await this.refreshConnection(false);
      } else if (message.type === 'addCustomModel') {
        const model = message.model.trim();
        if (!model) throw new Error('Tên model không được để trống.');
        const custom = this.context.globalState.get<string[]>(CUSTOM_MODELS_STATE, []);
        await this.context.globalState.update(CUSTOM_MODELS_STATE, [...new Set([...custom, model])]);
        await this.refreshConnection(false);
        await this.post({ type: 'selectModel', model });
      } else if (message.type === 'approval') {
        this.approvals.get(message.id)?.(message.allow);
        this.approvals.delete(message.id);
      } else if (message.type === 'acceptChange') {
        const change = this.changes.get(message.id);
        if (change?.staged && !await this.applyStagedChange(change)) return;
        this.changes.delete(message.id);
        await this.postChangesState();
      } else if (message.type === 'undoChange') {
        const change = this.changes.get(message.id);
        if (change) {
          if (!await this.restoreChange(change)) return;
          this.changes.delete(message.id);
          await this.postChangesState();
        }
      } else if (message.type === 'reviewChange') {
        await this.reviewChange(message.id);
      } else if (message.type === 'openFullDiff') {
        await this.openFullDiff(message.id);
      } else if (message.type === 'applyChangeHunk') {
        await this.applyChangeHunk(message.id, message.hunkId, message.action);
      } else if (message.type === 'acceptAllChanges') {
        for (const [id, change] of [...this.changes]) {
          if (change.staged && !await this.applyStagedChange(change)) continue;
          this.changes.delete(id);
        }
        await this.postChangesState();
      } else if (message.type === 'undoAllChanges') {
        if (!this.changes.size) return;
        const choice = await vscode.window.showWarningMessage(
          `Undo all sẽ khôi phục ${this.changes.size} file về trước khi Agent sửa và xóa các file Agent vừa tạo. Tiếp tục?`,
          { modal: true },
          'Undo all'
        );
        if (choice !== 'Undo all') return;
        for (const [id, change] of this.changes.entries()) {
          if (await this.restoreChange(change)) this.changes.delete(id);
        }
        await this.postChangesState();
      } else if (message.type === 'acceptTaskChanges') {
        for (const [id, change] of this.changes) {
          if (change.taskId !== message.taskId) continue;
          if (change.staged && !await this.applyStagedChange(change)) continue;
          this.changes.delete(id);
        }
        await this.postChangesState();
      } else if (message.type === 'undoTaskChanges') {
        const entries = [...this.changes.entries()].filter(([, change]) => change.taskId === message.taskId);
        const choice = await vscode.window.showWarningMessage(`Hoàn tác ${entries.length} file của tác vụ này?`, { modal: true }, 'Hoàn tác tác vụ');
        if (choice !== 'Hoàn tác tác vụ') return;
        for (const [id, change] of entries) if (await this.restoreChange(change)) this.changes.delete(id);
        await this.postChangesState();
      } else if (message.type === 'setPermissionMode') {
        await this.context.globalState.update(PERMISSION_MODE_STATE, message.mode);
        await this.post({ type: 'permissionMode', mode: message.mode });
      } else if (message.type === 'setLanguage') {
        await vscode.workspace.getConfiguration('nineRouter').update('language', message.language, vscode.ConfigurationTarget.Global);
        if (this.view) this.view.webview.html = this.html(this.view.webview);
      } else if (message.type === 'setSandboxMode') {
        await this.context.workspaceState.update(SANDBOX_MODE_STATE, message.mode);
        await this.post({ type: 'sandboxMode', mode: message.mode });
        await this.postSandboxStatus();
      } else if (message.type === 'checkSandbox') {
        await this.postSandboxStatus();
      } else if (message.type === 'toggleFavoriteModel') {
        const favorites = this.context.globalState.get<string[]>(FAVORITE_MODELS_STATE, []);
        const next = favorites.includes(message.model) ? favorites.filter((item) => item !== message.model) : [message.model, ...favorites].slice(0, 20);
        await this.context.globalState.update(FAVORITE_MODELS_STATE, next);
        await this.post({ type: 'favoriteModels', models: next });
      } else if (message.type === 'exportDiagnostics') {
        await this.exportDiagnostics();
      } else if (message.type === 'showLogs') {
        this.showLogs();
      } else if (message.type === 'connect') {
        await this.connect(message.endpoint, message.apiKey, message.model, message.provider, message.profileId, message.profileName, message.inputPricePerMillion, message.outputPricePerMillion);
      } else if (message.type === 'diagnostics') {
        await this.diagnostics();
      } else if (message.type === 'stopTurn') {
        this.abortController?.abort();
      } else if (message.type === 'startRouter') {
        await this.startRouter();
      } else if (message.type === 'retryConnection') {
        await this.refreshConnection(false);
      } else if (message.type === 'openDashboard') {
        await this.openDashboard();
      } else if (message.type === 'openExternal') {
        const target = new URL(message.url);
        if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Chỉ cho phép mở liên kết HTTP hoặc HTTPS.');
        await vscode.env.openExternal(vscode.Uri.parse(target.toString()));
      } else if (message.type === 'openFile') {
        await this.openWorkspaceFile(message.path);
      } else if (message.type === 'pickFiles') {
        await this.pickFiles(message.kind);
      } else if (message.type === 'pasteImage') {
        await this.pasteImage(message);
      } else if (message.type === 'removeAttachment') {
        this.pendingAttachments.splice(message.index, 1);
        await this.postAttachments();
      } else if (message.type === 'loadSession') {
        await this.loadSession(message.id);
      } else if (message.type === 'deleteSession') {
        await this.deleteSession(message.id);
      } else if (message.type === 'stopRouter') {
        await this.stopRouter();
      } else if (message.type === 'disconnectProvider') {
        await this.disconnectProvider();
      } else if (message.type === 'activateProfile') {
        const profile = await this.profileStore.activate(message.id);
        await this.applyProfile(profile);
        await this.context.globalState.update(DISCONNECTED_STATE, false);
        await this.postProfileState();
        await this.post({ type: 'profileLoaded', profile, hasApiKey: Boolean(await this.profileStore.apiKey(profile)) });
        await this.refreshConnection(false);
      } else if (message.type === 'deleteProfile') {
        const profile = await this.profileStore.remove(message.id);
        await this.applyProfile(profile);
        await this.postProfileState();
        await this.post({ type: 'profileLoaded', profile, hasApiKey: Boolean(await this.profileStore.apiKey(profile)) });
        await this.refreshConnection(false);
      } else if (message.type === 'checkModels') {
        await this.checkModels();
      } else if (message.type === 'cancelModelCheck') {
        this.modelCheckController?.abort();
      } else if (message.type === 'restoreCheckpoint') {
        await this.restoreCheckpoint(message.id);
      } else if (message.type === 'getTelemetry') {
        await this.postTelemetry();
      } else if (message.type === 'openTelemetryDashboard') {
        this.openTelemetryDashboard();
      } else if (message.type === 'clearTelemetry') {
        await this.telemetryStore.clear();
        await this.postTelemetry();
      } else if (message.type === 'getMcpServers') {
        await this.postMcpServers();
      } else if (message.type === 'saveMcpServer') {
        const saved = await this.mcpManager.saveServer(message.server, message.token, message.env);
        if (message.server.authMode === 'oauth' && saved) await this.mcpManager.login(saved.id);
        await this.postMcpServers();
      } else if (message.type === 'removeMcpServer') {
        await this.mcpManager.removeServer(message.id);
        await this.postMcpServers();
      } else if (message.type === 'installMcpPreset') {
        await this.mcpManager.installPreset(message.presetId);
        await this.postMcpServers();
      } else if (message.type === 'loginMcp') {
        await this.mcpManager.login(message.id);
        await this.postMcpServers();
      } else if (message.type === 'reconnectMcp') {
        await this.mcpManager.reconnect(message.id);
        await this.postMcpServers();
      } else if (message.type === 'logoutMcp') {
        await this.mcpManager.logout(message.id);
        await this.postMcpServers();
      } else if (message.type === 'configureMcpApiKey') {
        await this.mcpManager.configureApiKey(message.id);
        await this.postMcpServers();
      } else if (message.type === 'setupLocalProvider') {
        await this.setupLocalProvider();
      } else if (message.type === 'send') {
        await this.send(message);
      } else if (message.type === 'newThread') {
        this.newThread();
      } else if (message.type === 'openSettings') {
        await this.configure();
      }
    } catch (error) {
      await this.post({ type: 'error', message: this.errorText(error) });
    }
  }

  private async connect(endpoint: string, apiKey?: string, model?: string, provider?: ProviderKind, profileId?: string, profileName?: string, inputPricePerMillion?: number, outputPricePerMillion?: number): Promise<void> {
    const normalized = normalizeEndpoint(endpoint);
    const selectedProvider = provider ?? this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const current = profileId === '__new__' ? undefined : profileId ? this.profileStore.list().find((item) => item.id === profileId) : this.profileStore.active();
    const profile = await this.profileStore.save({
      id: current?.id ?? '',
      name: profileName?.trim() || current?.name || selectedProvider,
      kind: selectedProvider,
      endpoint: normalized,
      inputPricePerMillion,
      outputPricePerMillion
    }, apiKey);
    await this.applyProfile(profile);
    await this.context.globalState.update(DISCONNECTED_STATE, false);
    await this.refreshConnection(true);
    await this.postProfileState();
    await this.post({
      type: 'configSaved',
      endpoint: normalized,
      defaultModel: this.context.globalState.get(DEFAULT_MODEL_STATE, ''),
      hasApiKey: Boolean(await this.profileStore.apiKey(profile))
      ,provider: selectedProvider
      ,profile
    });
  }

  public async openDashboard(): Promise<void> {
    try {
      const url = await this.routerProcess.ensureRunning(
        this.endpoint,
        vscode.workspace.getConfiguration('nineRouter').get('routerCommand', '9router'),
        () => undefined
      );
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (error) {
      vscode.window.showErrorMessage(this.errorText(error));
    }
  }

  private async startRouter(): Promise<void> {
    await this.context.globalState.update(DISCONNECTED_STATE, false);
    const routerCommand = vscode.workspace.getConfiguration('nineRouter').get('routerCommand', '9router');
    if (!(await this.routerProcess.isInstalled(routerCommand))) {
      const choice = await vscode.window.showInformationMessage(
        '9Router chưa được cài trên máy này. Cài tự động ngay bây giờ?',
        { modal: true },
        'Cài 9Router',
        'Để sau'
      );
      if (choice !== 'Cài 9Router') {
        await this.post({ type: 'routerLaunch', progress: 'stopped', message: '9Router chưa chạy' });
        return;
      }
      await this.post({ type: 'routerLaunch', progress: 'installing', message: 'Đang cài 9Router' });
      await this.routerProcess.install(routerCommand, (message) => void this.post({ type: 'routerLaunch', progress: 'installing', message }));
    }
    const progressLabel: Record<RouterLaunchProgress, string> = {
      checking: 'Đang kiểm tra cổng 9Router',
      installing: 'Đang cài 9Router',
      starting: 'Đang khởi động 9Router',
      waiting: 'Đang chờ Dashboard sẵn sàng',
      ready: '9Router đã sẵn sàng',
      stopped: '9Router đã tắt'
    };
    const url = await this.routerProcess.ensureRunning(
      this.endpoint,
      routerCommand,
      (progress) => void this.post({ type: 'routerLaunch', progress, message: progressLabel[progress] })
    );
    await vscode.env.openExternal(vscode.Uri.parse(url));
    await this.post({ type: 'browserOpened', url });
    await this.refreshConnection(false);
  }

  private async stopRouter(): Promise<void> {
    const stopped = await this.routerProcess.stop(this.endpoint);
    this.abortController?.abort();
    await this.context.globalState.update(DISCONNECTED_STATE, true);
    await this.post({ type: 'routerLaunch', progress: 'stopped', message: '9Router đã tắt' });
    await this.post({ type: 'connection', connected: false, endpoint: this.endpoint, models: [], canStop: false, message: stopped ? '9Router đã tắt.' : 'Đã ngắt kết nối khỏi 9Router.' });
    if (!stopped && await this.routerProcess.isRunning(this.endpoint)) {
      vscode.window.showWarningMessage('Không thể tắt tiến trình 9Router này. Hãy kiểm tra quyền chạy của tiến trình.');
    }
  }

  private async disconnectProvider(): Promise<void> {
    this.abortController?.abort();
    await this.context.globalState.update(DISCONNECTED_STATE, true);
    await this.post({ type: 'connection', connected: false, endpoint: this.endpoint, models: [], canStop: false, provider: this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router'), message: 'Đã ngắt provider.' });
  }

  private async refreshConnection(showSuccess: boolean): Promise<void> {
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const apiKey = await this.getApiKey(provider);
    const requiresKey = provider !== 'ollama' && provider !== 'lm-studio';
    if (requiresKey && !apiKey.trim()) {
      this.models = [];
      await this.post({ type: 'connection', connected: false, endpoint: this.endpoint, models: [], canStop: this.routerProcess.canStop(), provider, message: 'Chưa có API key. Mở Cấu hình và nhập key của provider.' });
      return;
    }
    try {
      this.models = (await createProvider({ kind: provider, endpoint: this.endpoint, apiKey }).listModels()).map((model) => ({ ...model, capabilities: capabilitiesForModel(model.id) }));
      for (const id of this.context.globalState.get<string[]>(CUSTOM_MODELS_STATE, [])) {
        if (!this.models.some((item) => item.id === id)) this.models.push({ id, name: `${id} · tùy chỉnh` });
      }
      await this.post({
        type: 'connection',
        connected: true,
        endpoint: this.endpoint,
        models: this.models,
        canStop: this.routerProcess.canStop()
        ,defaultModel: this.context.globalState.get(DEFAULT_MODEL_STATE, '')
        ,provider
      });
      if (showSuccess) vscode.window.showInformationMessage(`Đã kết nối provider ${provider}.`);
    } catch (error) {
      this.models = [];
      const rawMessage = this.errorText(error);
      await this.post({
        type: 'connection',
        connected: false,
        endpoint: this.endpoint,
        models: [],
        canStop: this.routerProcess.canStop(),
        provider,
        message: rawMessage === 'fetch failed'
          ? provider === 'ollama'
            ? 'Không tìm thấy Ollama. Hãy cài Ollama, tải model và bảo đảm server local đang chạy.'
            : provider === 'lm-studio'
              ? 'Không tìm thấy LM Studio. Hãy mở Local Server và tải một model trước.'
              : provider === '9router'
                ? 'Không tìm thấy 9Router tại endpoint này.'
                : `Không thể kết nối endpoint của provider ${provider}.`
          : rawMessage
      });
    }
  }

  private async diagnostics(): Promise<void> {
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const apiKey = await this.getApiKey(provider);
    const started = Date.now();
    try {
      const models = await createProvider({ kind: provider, endpoint: this.endpoint, apiKey }).listModels();
      await this.post({ type: 'diagnosticsResult', ok: true, provider, endpoint: this.endpoint, latency: Date.now() - started, modelCount: models.length, message: `Kết nối tốt · ${models.length} model · ${Date.now() - started} ms` });
    } catch (error) {
      await this.post({ type: 'diagnosticsResult', ok: false, provider, endpoint: this.endpoint, latency: Date.now() - started, modelCount: 0, message: this.errorText(error) });
    }
  }

  private async postSandboxStatus(): Promise<void> {
    const status = await this.sandboxRuntime.status();
    await this.post({
      type: 'sandboxStatus',
      available: status.running,
      runtime: status.runtime,
      installed: status.installed,
      message: status.message,
      mode: this.context.workspaceState.get<SandboxMode>(SANDBOX_MODE_STATE, 'preferred')
    });
  }

  private async exportDiagnostics(): Promise<void> {
    const profile = this.profileStore.active();
    const payload = {
      generatedAt: new Date().toISOString(),
      extensionVersion: this.context.extension.packageJSON.version,
      provider: profile ? { name: profile.name, kind: profile.kind, endpoint: profile.endpoint } : undefined,
      models: this.models.map((item) => ({ id: item.id, capabilities: item.capabilities })),
      telemetry: this.telemetryStore.list().slice(0, 50),
      mcp: await this.mcpManager.statuses(),
      pendingChanges: this.changes.size
    };
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`loi-diagnostics-${Date.now()}.json`),
      filters: { JSON: ['json'] },
      saveLabel: 'Xuất chẩn đoán'
    });
    if (!uri) return;
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(payload, null, 2)));
    vscode.window.showInformationMessage('Đã xuất gói chẩn đoán. API key và token không được đưa vào file.');
  }

  private async checkModels(): Promise<void> {
    if (!this.models.length) throw new Error('Chưa có model để kiểm tra.');
    const choice = await vscode.window.showWarningMessage(
      `Kiểm tra ${this.models.length} model sẽ gửi một request rất ngắn đến từng model và có thể phát sinh phí hoặc rate limit. Tiếp tục?`,
      { modal: true },
      'Kiểm tra tất cả'
    );
    if (choice !== 'Kiểm tra tất cả') return;
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const apiKey = await this.getApiKey(provider);
    const client = createProvider({ kind: provider, endpoint: this.endpoint, apiKey });
    this.modelCheckController?.abort();
    const runController = new AbortController();
    this.modelCheckController = runController;
    await this.post({ type: 'modelCheckStart', total: this.models.length });
    let cursor = 0;
    let completed = 0;
    const workers = Array.from({ length: Math.min(6, this.models.length) }, async () => {
      while (cursor < this.models.length && !runController.signal.aborted) {
        const model = this.models[cursor++];
        if (!model) break;
        await this.post({ type: 'modelCheck', model: model.id, status: 'checking' });
        const requestController = new AbortController();
        const cancelRequest = () => requestController.abort();
        runController.signal.addEventListener('abort', cancelRequest, { once: true });
        const timeout = setTimeout(() => requestController.abort(), 12_000);
        try {
          const metrics = await client.checkModel(model.id, requestController.signal);
          await this.post({ type: 'modelCheck', model: model.id, status: 'ok', latencyMs: metrics.latencyMs });
        } catch (error) {
          const timedOut = requestController.signal.aborted && !runController.signal.aborted;
          await this.post({ type: 'modelCheck', model: model.id, status: 'error', message: timedOut ? 'Timeout sau 12 giây' : runController.signal.aborted ? 'Đã hủy' : this.errorText(error) });
        } finally {
          clearTimeout(timeout);
          runController.signal.removeEventListener('abort', cancelRequest);
          completed++;
          await this.post({ type: 'modelCheckProgress', completed, total: this.models.length });
        }
      }
    });
    try {
      await Promise.all(workers);
    } finally {
      if (this.modelCheckController === runController) this.modelCheckController = undefined;
      await this.post({ type: 'modelCheckEnd', completed, total: this.models.length, cancelled: runController.signal.aborted });
    }
  }

  private async recordMetrics(model: string, metrics: import('./types').RequestMetrics): Promise<void> {
    const profile = this.profileStore.active();
    if (!profile) return;
    await this.telemetryStore.record(profile, model, metrics);
    await this.postTelemetry();
  }

  private async postTelemetry(): Promise<void> {
    await this.post({ type: 'telemetry', records: this.telemetryStore.list() });
  }

  private openTelemetryDashboard(): void {
    if (this.metricsPanel) {
      this.metricsPanel.reveal(vscode.ViewColumn.Active);
      this.metricsPanel.webview.html = this.telemetryDashboardHtml(this.metricsPanel.webview);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'nineRouter.telemetryDashboard',
      'Số liệu sử dụng',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.metricsPanel = panel;
    panel.webview.html = this.telemetryDashboardHtml(panel.webview);
    panel.webview.onDidReceiveMessage(async (message: { type?: string }) => {
      if (message.type === 'refresh') panel.webview.html = this.telemetryDashboardHtml(panel.webview);
      if (message.type === 'clear') {
        const choice = await vscode.window.showWarningMessage('Xóa toàn bộ lịch sử số liệu?', { modal: true }, 'Xóa');
        if (choice === 'Xóa') {
          await this.telemetryStore.clear();
          panel.webview.html = this.telemetryDashboardHtml(panel.webview);
        }
      }
    });
    panel.onDidDispose(() => { if (this.metricsPanel === panel) this.metricsPanel = undefined; });
  }

  private telemetryDashboardHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const records = this.telemetryStore.list();
    const totalTokens = records.reduce((sum, item) => sum + item.totalTokens, 0);
    const totalCost = records.reduce((sum, item) => sum + (item.cost ?? 0), 0);
    const avgLatency = records.length ? Math.round(records.reduce((sum, item) => sum + item.latencyMs, 0) / records.length) : 0;
    const grouped = new Map<string, {
      profile: string;
      provider: string;
      model: string;
      calls: number;
      tokens: number;
      latency: number;
      cost: number;
      latest?: (typeof records)[number];
    }>();
    for (const record of records) {
      const key = `${record.profileId}:${record.model}`;
      const item = grouped.get(key) ?? {
        profile: record.profileName,
        provider: record.provider,
        model: record.model,
        calls: 0,
        tokens: 0,
        latency: 0,
        cost: 0
      };
      item.calls++;
      item.tokens += record.totalTokens;
      item.latency += record.latencyMs;
      item.cost += record.cost ?? 0;
      if (!item.latest || record.timestamp > item.latest.timestamp) item.latest = record;
      grouped.set(key, item);
    }
    const cards = [...grouped.values()]
      .sort((left, right) => (right.latest?.timestamp ?? 0) - (left.latest?.timestamp ?? 0))
      .map((item) => {
        const remaining = item.latest?.rateLimit?.requestsRemaining;
        const limit = item.latest?.rateLimit?.requestsLimit;
        const percent = remaining && limit && Number(limit) > 0
          ? Math.max(0, Math.min(100, Math.round((Number(remaining) / Number(limit)) * 100)))
          : undefined;
        const rate = percent === undefined
          ? '<p class="rate-empty">Provider chưa gửi rate limit</p>'
          : `<div class="rate-head"><span>Rate limit còn lại</span><b>${percent}%</b></div><div class="rate-track"><i style="width:${percent}%"></i></div>`;
        return `<article class="usage-card"><div class="card-top"><div><strong>${escapeDocument(item.model)}</strong><span>${escapeDocument(item.profile)}</span></div><em>${escapeDocument(item.provider)}</em></div><div class="card-grid"><div><b>${item.calls}</b><span>Requests</span></div><div><b>${formatDashboardNumber(item.tokens)}</b><span>Tokens</span></div><div><b>${Math.round(item.latency / item.calls)} ms</b><span>Latency</span></div></div>${rate}<footer><span>${item.latest ? new Date(item.latest.timestamp).toLocaleString() : ''}</span><span>${item.cost ? `$${item.cost.toFixed(4)}` : 'Chưa cấu hình giá'}</span></footer></article>`;
      }).join('');
    const latestRows = records.slice(0, 30).map((item) =>
      `<div class="request-row"><span><strong>${escapeDocument(item.model)}</strong><small>${escapeDocument(item.profileName)} · ${new Date(item.timestamp).toLocaleString()}</small></span><b>${formatDashboardNumber(item.totalTokens)} tok</b><em>${item.latencyMs} ms</em></div>`
    ).join('');
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#171819;color:#e7e8ea;font:13px/1.55 var(--vscode-font-family,Arial,sans-serif)}button{font:inherit}.dashboard{width:min(1320px,100%);margin:0 auto;padding:28px 30px 42px}.dashboard-head{display:flex;align-items:flex-start;gap:20px;margin-bottom:22px}.dashboard-head>div{flex:1}.dashboard-head h1{margin:0 0 4px;font-size:23px;letter-spacing:-.025em}.dashboard-head p{margin:0;color:#969ba2}.actions{display:flex;gap:8px}.actions button{border:1px solid #404348;border-radius:9px;background:#25272a;color:#d9dbde;padding:8px 12px;cursor:pointer}.actions button:hover{background:#303236}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:20px}.summary-card{padding:15px 16px;border:1px solid #36393e;border-radius:13px;background:#222427}.summary-card b{display:block;font-size:22px;letter-spacing:-.025em}.summary-card span{color:#969ba2;font-size:11px}.section-head{display:flex;align-items:center;margin:24px 0 11px}.section-head h2{flex:1;margin:0;font-size:14px}.section-head span{color:#868b92;font-size:11px}.usage-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.usage-card{min-width:0;padding:15px;border:1px solid #373a3f;border-radius:14px;background:#232528}.card-top{display:flex;gap:10px;align-items:flex-start}.card-top>div{display:grid;min-width:0;flex:1}.card-top strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.card-top span{color:#94999f;font-size:10px}.card-top em{border-radius:6px;background:#303337;color:#b8bcc1;padding:3px 7px;font-size:9px;font-style:normal}.card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:16px 0}.card-grid div{display:grid;gap:1px}.card-grid b{font-size:14px}.card-grid span,.rate-empty{color:#8e9399;font-size:9px}.rate-head{display:flex;color:#aeb2b7;font-size:10px}.rate-head span{flex:1}.rate-head b{color:#6bd2b9}.rate-track{height:4px;margin-top:6px;border-radius:999px;background:#34373a;overflow:hidden}.rate-track i{display:block;height:100%;border-radius:inherit;background:#58cdb2}.rate-empty{margin:8px 0 0}.usage-card footer{display:flex;gap:8px;margin-top:14px;padding-top:10px;border-top:1px solid #34373b;color:#858a90;font-size:9px}.usage-card footer span:first-child{flex:1}.requests{border:1px solid #35383c;border-radius:14px;background:#222427;overflow:hidden}.request-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:18px;align-items:center;padding:10px 13px;border-bottom:1px solid #32353a}.request-row:last-child{border-bottom:0}.request-row>span{display:grid;min-width:0}.request-row strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.request-row small,.request-row em{color:#8f949a;font-size:9px;font-style:normal}.request-row b{color:#73d7c0;font-size:10px}@media(max-width:760px){.dashboard{padding:20px 14px 32px}.summary{grid-template-columns:repeat(2,1fr)}.dashboard-head{display:grid}}@media(max-width:430px){.summary{grid-template-columns:1fr}.usage-grid{grid-template-columns:1fr}.request-row{grid-template-columns:minmax(0,1fr) auto}.request-row em{display:none}}
    </style></head><body><main class="dashboard"><header class="dashboard-head"><div><h1>Số liệu sử dụng</h1><p>Token, chi phí, tốc độ phản hồi và giới hạn theo model.</p></div><nav class="actions"><button id="refresh">Làm mới</button><button id="clear">Xóa dữ liệu</button></nav></header><section class="summary"><div class="summary-card"><b>${records.length}</b><span>Tổng requests</span></div><div class="summary-card"><b>${formatDashboardNumber(totalTokens)}</b><span>Tổng token</span></div><div class="summary-card"><b>${avgLatency} ms</b><span>Latency trung bình</span></div><div class="summary-card"><b>${totalCost ? `$${totalCost.toFixed(4)}` : 'Chưa có'}</b><span>Chi phí ước tính</span></div></section><div class="section-head"><h2>Model và tài khoản</h2><span>${grouped.size} cấu hình hoạt động</span></div><section class="usage-grid">${cards || '<article class="usage-card"><strong>Chưa có dữ liệu</strong><p class="rate-empty">Gửi một tin nhắn để bắt đầu ghi nhận số liệu.</p></article>'}</section><div class="section-head"><h2>Request gần đây</h2><span>Tối đa 30 mục</span></div><section class="requests">${latestRows || '<div class="request-row"><span><strong>Chưa có request</strong><small>Dữ liệu sẽ xuất hiện tại đây</small></span></div>'}</section></main><script nonce="${nonce}">const vscode=acquireVsCodeApi();document.getElementById('refresh').onclick=()=>vscode.postMessage({type:'refresh'});document.getElementById('clear').onclick=()=>vscode.postMessage({type:'clear'});</script></body></html>`;
  }

  private async postMcpServers(): Promise<void> {
    await this.post({ type: 'mcpServers', servers: await this.mcpManager.statuses(), presets: MCP_PRESETS });
  }

  private async setupLocalProvider(): Promise<void> {
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const status = await this.localRuntimeManager.setup(provider, this.endpoint, (message) => void this.post({ type: 'localRuntime', message }));
    if (!status) throw new Error('Tính năng này chỉ dùng cho Ollama hoặc LM Studio.');
    await this.post({ type: 'localRuntime', ...status });
    if (status.serverRunning) await this.refreshConnection(false);
  }

  private async openWorkspaceFile(input: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) throw new Error('Chưa mở workspace.');
    const normalized = decodeURIComponent(input).replace(/^file:\/\//i, '').trim();
    const location = normalized.match(/^(.*):(\d+)(?::(\d+))?$/);
    const rawPath = location?.[1] || normalized;
    const path = await import('node:path');
    const root = path.resolve(workspaceRoot);
    const target = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(root, rawPath);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('File nằm ngoài workspace.');
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
    const editor = await vscode.window.showTextDocument(document, { preview: true });
    const line = Math.max(0, Number(location?.[2] || 1) - 1);
    const column = Math.max(0, Number(location?.[3] || 1) - 1);
    const position = new vscode.Position(Math.min(line, Math.max(0, document.lineCount - 1)), column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  private async restoreCheckpoint(id: string): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'Khôi phục checkpoint sẽ đưa toàn bộ file Git về trạng thái trước tác vụ Agent và xóa file được tạo sau checkpoint. Tiếp tục?',
      { modal: true },
      'Khôi phục checkpoint'
    );
    if (choice !== 'Khôi phục checkpoint') return;
    const checkpoint = await this.checkpointManager.restore(id);
    this.changes.clear();
    await this.postChangesState();
    await this.post({ type: 'checkpointRestored', id, hash: checkpoint.hash.slice(0, 8) });
  }

  private async send(message: Extract<WebviewMessage, { type: 'send' }>): Promise<void> {
    const prompt = message.prompt.trim();
    if (!prompt) return;
    if (await this.handleSlashCommand(prompt)) return;
    if (!message.model) throw new Error('Hãy chọn một model trước khi gửi.');

    const config = vscode.workspace.getConfiguration('nineRouter');
    const monthlyLimit = config.get<number>('monthlyCostLimit', 0);
    if (monthlyLimit > 0) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const spent = this.telemetryStore.list()
        .filter((item) => item.timestamp >= monthStart.getTime())
        .reduce((sum, item) => sum + (item.cost ?? 0), 0);
      if (spent >= monthlyLimit) throw new Error(`Đã chạm giới hạn chi phí tháng $${monthlyLimit.toFixed(2)}.`);
    }

    this.abortController?.abort();
    this.abortController = new AbortController();
    this.currentTaskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const recent = this.context.globalState.get<string[]>(RECENT_MODELS_STATE, []);
    const nextRecent = [message.model, ...recent.filter((item) => item !== message.model)].slice(0, 8);
    await this.context.globalState.update(RECENT_MODELS_STATE, nextRecent);
    await this.post({ type: 'recentModels', models: nextRecent });
    const attachments = this.pendingAttachments.slice();
    const attachmentNote = attachments.length
      ? `\n\nTệp đính kèm:\n${attachments.map((item) => `- ${item.name} (${item.path})`).join('\n')}`
      : '';
    const enrichedPrompt = (await this.withEditorContext(prompt, message.includeSelection)) + attachmentNote;
    const attachmentViews = await this.attachmentViews(attachments);
    const requestContent: ChatMessage['content'] = attachmentViews.some((item) => item.preview)
      ? [
          { type: 'text', text: enrichedPrompt },
          ...attachmentViews.flatMap((item) => item.preview ? [{ type: 'image_url' as const, image_url: { url: item.preview } }] : [])
        ]
      : enrichedPrompt;
    const startedAt = Date.now();
    await this.context.workspaceState.update(ACTIVE_RUN_STATE, { prompt, answer: '', mode: message.mode, model: message.model, startedAt });
    this.transcript.push({ role: 'user', content: prompt, timestamp: startedAt, attachments: attachments.map((item) => ({ name: item.name, path: item.path })) });
    this.pendingAttachments = [];
    await this.postAttachments();
    await this.post({ type: 'turnStart', mode: message.mode, prompt, attachments: attachmentViews, timestamp: startedAt });

    let answer = '';
    let sandboxSession: SandboxSession | undefined;
    const onDelta = (delta: string) => {
      answer += delta;
      void this.post({ type: 'delta', delta });
      if (!this.recoveryTimer) {
        this.recoveryTimer = setTimeout(() => {
          this.recoveryTimer = undefined;
          void this.context.workspaceState.update(ACTIVE_RUN_STATE, { prompt, answer, mode: message.mode, model: message.model, startedAt });
        }, 500);
      }
    };

    try {
      const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
      const apiKey = await this.getApiKey(provider);
      if (message.mode === 'chat') {
        const client = createProvider({ kind: provider, endpoint: this.endpoint, apiKey });
        this.history.push({ role: 'user', content: requestContent });
        const candidates = [message.model, ...config.get<string[]>('fallbackModels', []).filter((item) => item && item !== message.model)];
        let usedModel = message.model;
        let lastError: unknown;
        for (const candidate of candidates) {
          try {
            usedModel = candidate;
            const metrics = await client.streamChat(candidate, this.history, onDelta, this.abortController.signal);
            await this.recordMetrics(candidate, metrics);
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            if (answer || candidate === candidates[candidates.length - 1]) throw error;
            const nextModel = candidates[candidates.indexOf(candidate) + 1]!;
            if (!await this.approveFallback(candidate, nextModel)) throw error;
            await this.post({ type: 'status', message: `Model ${candidate} lỗi · đang chuyển sang model dự phòng` });
          }
        }
        if (lastError) throw lastError;
        if (usedModel !== message.model) await this.post({ type: 'notice', message: `Đã tự chuyển sang model dự phòng \`${usedModel}\`.` });
        this.history.push({ role: 'assistant', content: answer });
      } else {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) throw new Error('Hãy mở một thư mục workspace để chạy Agent mode.');
        if (message.mode === 'agent' && !vscode.workspace.isTrusted) {
          const choice = await vscode.window.showWarningMessage(
            'Workspace chưa được tin cậy. Agent, terminal và MCP đang bị khóa.',
            { modal: true },
            'Quản lý Workspace Trust'
          );
          if (choice === 'Quản lý Workspace Trust') await vscode.commands.executeCommand('workbench.trust.manage');
          throw new Error('Hãy tin cậy workspace trước khi chạy Agent.');
        }
        const sandboxMode = this.context.workspaceState.get<SandboxMode>(SANDBOX_MODE_STATE, 'preferred');
        if (message.mode === 'agent') {
          sandboxSession = await this.sandboxRuntime.create(workspaceRoot, {
            mode: sandboxMode,
            image: config.get<string>('sandboxImage', 'node:22-bookworm'),
            memory: config.get<string>('sandboxMemory', '1g'),
            cpus: config.get<number>('sandboxCpus', 2),
            network: config.get<boolean>('sandboxNetwork', false)
          }, (status) => void this.post({ type: 'status', message: status }));
          if (!sandboxSession && sandboxMode === 'preferred') {
            const sandboxStatus = await this.sandboxRuntime.status();
            const actions = sandboxStatus.installed ? ['Mở Docker Desktop', 'Chạy trực tiếp'] : ['Mở hướng dẫn Docker', 'Chạy trực tiếp'];
            const choice = await vscode.window.showWarningMessage(
              `${sandboxStatus.message}. Chạy tác vụ trực tiếp trong workspace?`,
              { modal: true },
              ...actions
            );
            if (choice === 'Mở Docker Desktop') {
              await vscode.env.openExternal(vscode.Uri.parse('docker-desktop://'));
              throw new Error('Đang mở Docker Desktop. Hãy chờ engine sẵn sàng rồi gửi lại tác vụ.');
            }
            if (choice === 'Mở hướng dẫn Docker') {
              await vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/desktop/setup/install/windows-install/'));
              throw new Error('Đã mở hướng dẫn cài Docker Desktop.');
            }
            if (choice !== 'Chạy trực tiếp') throw new Error('Đã hủy vì sandbox chưa sẵn sàng.');
          }
          await this.post({
            type: 'sandboxRun',
            active: Boolean(sandboxSession),
            runtime: sandboxSession?.runtime,
            message: sandboxSession ? `Đang chạy cách ly bằng ${sandboxSession.runtime}` : 'Đang chạy trực tiếp theo xác nhận của bạn'
          });
        }
        if (message.mode === 'agent') {
          const checkpoint = await this.checkpointManager.create(workspaceRoot);
          if (checkpoint) await this.post({ type: 'checkpoint', checkpoint: { id: checkpoint.id, hash: checkpoint.hash.slice(0, 8), createdAt: checkpoint.createdAt } });
        }
        const externalTools = message.mode === 'agent' && !sandboxSession ? await this.mcpManager.agentTools() : [];
        if (message.mode === 'agent' && sandboxSession) {
          await this.post({ type: 'status', message: 'MCP ghi dữ liệu bị tắt trong sandbox để giữ cách ly' });
        }
        const commandPolicy = {
          allow: config.get<string[]>('commandAllowList', []),
          deny: config.get<string[]>('commandDenyList', [])
        };
        const agentPrompt = config.get<boolean>('planBeforeRun', false) && message.mode === 'agent'
          ? `${enrichedPrompt}\n\nTrước khi dùng tool, hãy nêu kế hoạch ngắn 2-5 bước rồi mới thực hiện.`
          : requestContent;
        const agentRoot = sandboxSession?.root ?? workspaceRoot;
        const runtimePrompt = sandboxSession
          ? `${String(typeof agentPrompt === 'string' ? agentPrompt : enrichedPrompt)}\n\nBạn đang ở sandbox Linux tạm thời. Dùng lệnh shell tương thích Linux. Mọi thay đổi chỉ được đưa vào workspace thật sau khi người dùng Accept.`
          : agentPrompt;
        const candidates = [message.model, ...config.get<string[]>('fallbackModels', []).filter((item) => item && item !== message.model)];
        const changeCountBeforeRun = this.changes.size;
        for (const candidate of candidates) {
          let timeout: NodeJS.Timeout | undefined;
          try {
            const run = new AgentRuntime(
              createProvider({ kind: provider, endpoint: this.endpoint, apiKey }),
              agentRoot,
              (description) => this.askApproval(description),
              (change) => this.registerChange(change, Boolean(sandboxSession), workspaceRoot, agentRoot),
              message.mode === 'plan',
              externalTools,
              commandPolicy,
              sandboxSession ? (command, toolName, callbacks, signal) => sandboxSession!.run(command, toolName, callbacks, signal) : undefined
            ).run(runtimePrompt, candidate, {
              onDelta,
              onStatus: (status) => void this.post({ type: 'status', message: status }),
              onToolOutput: (event) => {
                const previous = this.context.workspaceState.get<string>(LAST_TERMINAL_STATE, '');
                void this.context.workspaceState.update(LAST_TERMINAL_STATE, `${previous}${event.chunk}`.slice(-20_000));
                this.output.append(event.chunk);
                void this.post({ type: 'toolOutput', ...event });
              },
              onMetrics: (metrics) => void this.recordMetrics(candidate, metrics)
            }, this.abortController.signal);
            await Promise.race([
              run,
              new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Provider không phản hồi sau 90 giây. Đã dừng Agent.')), 90_000); })
            ]);
            if (candidate !== message.model) await this.post({ type: 'notice', message: `Agent đã tự chuyển sang model dự phòng \`${candidate}\`.` });
            break;
          } catch (error) {
            const canRetry = !answer && this.changes.size === changeCountBeforeRun && candidate !== candidates[candidates.length - 1];
            if (!canRetry) throw error;
            const nextModel = candidates[candidates.indexOf(candidate) + 1]!;
            if (!await this.approveFallback(candidate, nextModel)) throw error;
            await this.post({ type: 'status', message: `Model ${candidate} lỗi · đang chuyển sang model dự phòng` });
          } finally {
            if (timeout) clearTimeout(timeout);
          }
        }
      }
      const completedAt = Date.now();
      this.transcript.push({ role: 'assistant', content: answer || 'Đã hoàn tất.', timestamp: completedAt });
      await this.saveSession(message.mode, message.model);
      await this.clearActiveRun();
      await this.post({ type: 'turnEnd', timestamp: completedAt });
      if (message.mode === 'agent' && config.get<boolean>('notifyOnComplete', true) && !this.view?.visible) {
        vscode.window.showInformationMessage(`Agent đã hoàn thành · ${this.changes.size} file đang chờ xem lại.`);
      }
    } catch (error) {
      const completedAt = Date.now();
      if (this.abortController?.signal.aborted) {
        this.transcript.push({ role: 'assistant', content: answer || 'Đã dừng.', timestamp: completedAt });
        await this.saveSession(message.mode, message.model);
        await this.clearActiveRun();
        await this.post({ type: 'turnEnd', cancelled: true, timestamp: completedAt });
        return;
      }
      const errorMessage = this.errorText(error);
      this.output.appendLine(`[error] ${errorMessage}`);
      this.transcript.push({ role: 'assistant', content: errorMessage, timestamp: completedAt, error: true });
      await this.saveSession(message.mode, message.model);
      await this.clearActiveRun();
      await this.post({ type: 'turnEnd', error: errorMessage, timestamp: completedAt });
    } finally {
      if (sandboxSession) {
        await sandboxSession.dispose().catch((error) => this.output.appendLine(`[sandbox cleanup] ${this.errorText(error)}`));
        await this.post({ type: 'sandboxRun', active: false, message: 'Sandbox đã được xóa' });
      }
    }
  }

  private askApproval(description: string): Promise<boolean> {
    const permission = this.context.globalState.get<string>(PERMISSION_MODE_STATE, 'ask');
    if (permission === 'full') return Promise.resolve(true);
    if (permission === 'edit' && !/chạy|test/i.test(description)) return Promise.resolve(true);
    const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
      this.approvals.set(id, resolve);
      void this.post({ type: 'approval', id, message: description });
      setTimeout(() => { if (this.approvals.delete(id)) resolve(false); }, 120_000);
    });
  }

  private async approveFallback(from: string, to: string): Promise<boolean> {
    if (!vscode.workspace.getConfiguration('nineRouter').get<boolean>('confirmFallback', true)) return true;
    const choice = await vscode.window.showWarningMessage(
      `Model ${from} không phản hồi. Chuyển sang ${to}? Model dự phòng có thể có chi phí khác.`,
      { modal: true },
      'Chuyển model'
    );
    return choice === 'Chuyển model';
  }

  private async clearActiveRun(): Promise<void> {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    await this.context.workspaceState.update(ACTIVE_RUN_STATE, undefined);
  }

  private registerChange(change: { path: string; original: Uint8Array; updated: Uint8Array; existed: boolean; added: number; removed: number }, staged = false, workspaceRoot?: string, agentRoot?: string): void {
    const targetPath = staged && workspaceRoot && agentRoot
      ? resolve(workspaceRoot, relative(agentRoot, change.path))
      : change.path;
    const normalizedChange = { ...change, path: targetPath, staged };
    const existing = [...this.changes.entries()].find(([, item]) => item.path === targetPath);
    const original = existing?.[1].original ?? change.original;
    const existed = existing?.[1].existed ?? change.existed;
    if (this.bytesEqual(original, normalizedChange.updated)) {
      if (existing) this.changes.delete(existing[0]);
      void this.postChangesState();
      return;
    }
    const counts = this.lineChanges(original, normalizedChange.updated);
    if (existing) this.changes.set(existing[0], { ...normalizedChange, original, existed, taskId: existing[1].taskId, staged: existing[1].staged || staged, ...counts });
    else {
      const id = `change-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.changes.set(id, { ...normalizedChange, taskId: this.currentTaskId || `task-${Date.now()}`, ...counts });
    }
    void this.postChangesState();
  }

  private lineChanges(original: Uint8Array, updated: Uint8Array): { added: number; removed: number } {
    const lines = (bytes: Uint8Array) => bytes.byteLength
      ? new TextDecoder().decode(bytes).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
      : [];
    const before = lines(original);
    const after = lines(updated);
    const counts = new Map<string, number>();
    for (const line of before) counts.set(line, (counts.get(line) ?? 0) + 1);
    let unchanged = 0;
    for (const line of after) {
      const count = counts.get(line) ?? 0;
      if (count > 0) {
        unchanged++;
        counts.set(line, count - 1);
      }
    }
    return { added: after.length - unchanged, removed: before.length - unchanged };
  }

  private async postChangesState(): Promise<void> {
    const changes = [...this.changes.entries()].map(([id, change]) => ({ id, path: vscode.workspace.asRelativePath(change.path), added: change.added, removed: change.removed, taskId: change.taskId, staged: change.staged }));
    const persisted: PendingChange[] = [...this.changes.values()].map((change) => ({
      path: change.path,
      original: Buffer.from(change.original).toString('base64'),
      updated: Buffer.from(change.updated).toString('base64'),
      existed: change.existed,
      added: change.added,
      removed: change.removed,
      taskId: change.taskId
      ,staged: change.staged
    }));
    await this.context.workspaceState.update(PENDING_CHANGES_STATE, persisted);
    await this.post({ type: 'changesState', changes, files: changes.length, added: changes.reduce((sum, item) => sum + item.added, 0), removed: changes.reduce((sum, item) => sum + item.removed, 0) });
  }

  private async reviewChange(id: string): Promise<void> {
    const change = this.changes.get(id);
    if (!change) return;
    const hunks = createDiffHunks(change.original, change.updated);
    await this.post({
      type: 'changeReview',
      id,
      path: vscode.workspace.asRelativePath(change.path),
      staged: change.staged,
      hunks
    });
  }

  private async openFullDiff(id: string): Promise<void> {
    const change = this.changes.get(id);
    if (!change) return;
    const root = this.context.storageUri ?? this.context.globalStorageUri;
    const reviewDir = vscode.Uri.joinPath(root, 'reviews');
    await vscode.workspace.fs.createDirectory(reviewDir);
    const before = vscode.Uri.joinPath(reviewDir, `${id}-${change.path.split(/[\\/]/).pop() ?? 'before'}`);
    const after = vscode.Uri.joinPath(reviewDir, `${id}-after-${change.path.split(/[\\/]/).pop() ?? 'after'}`);
    await vscode.workspace.fs.writeFile(before, change.original);
    if (change.staged) await vscode.workspace.fs.writeFile(after, change.updated);
    await vscode.commands.executeCommand('vscode.diff', before, change.staged ? after : vscode.Uri.file(change.path), `${vscode.workspace.asRelativePath(change.path)} (before / after)`);
  }

  private async applyChangeHunk(id: string, hunkId: number, action: 'accept' | 'undo'): Promise<void> {
    const change = this.changes.get(id);
    if (!change) return;
    const hunk = createDiffHunks(change.original, change.updated).find((item) => item.id === hunkId);
    if (!hunk) throw new Error('Hunk không còn tồn tại; hãy mở Review lại.');
    if (action === 'accept') {
      const previousOriginal = change.original;
      change.original = applyForward(change.original, hunk);
      if (change.staged && !await this.applyStagedChange({ ...change, original: previousOriginal, updated: change.original })) {
        change.original = previousOriginal;
        return;
      }
      if (change.staged) change.existed = true;
    } else {
      change.updated = applyReverse(change.updated, hunk);
      if (!change.staged) await vscode.workspace.fs.writeFile(vscode.Uri.file(change.path), change.updated);
    }
    if (this.bytesEqual(change.original, change.updated)) this.changes.delete(id);
    else {
      const counts = this.lineChanges(change.original, change.updated);
      this.changes.set(id, { ...change, ...counts });
    }
    await this.postChangesState();
    if (this.changes.has(id)) await this.reviewChange(id);
    else await this.post({ type: 'closeChangeReview' });
  }

  private async applyStagedChange(change: { path: string; original?: Uint8Array; updated: Uint8Array; existed: boolean; staged?: boolean }): Promise<boolean> {
    if (!change.staged) return true;
    const uri = vscode.Uri.file(change.path);
    let current: Uint8Array | undefined;
    try { current = await vscode.workspace.fs.readFile(uri); } catch { current = undefined; }
    const conflict = change.existed
      ? !current || (change.original ? !this.bytesEqual(current, change.original) : false)
      : Boolean(current);
    if (conflict) {
      const choice = await vscode.window.showWarningMessage(
        `${vscode.workspace.asRelativePath(change.path)} đã thay đổi trong lúc sandbox chạy. Ghi đè bằng bản sandbox?`,
        { modal: true },
        'Ghi đè'
      );
      if (choice !== 'Ghi đè') return false;
    }
    if (!change.existed && !change.updated.byteLength) return true;
    const path = await import('node:path');
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(change.path)));
    await vscode.workspace.fs.writeFile(uri, change.updated);
    return true;
  }

  private async restoreChange(change: { path: string; original: Uint8Array; updated: Uint8Array; existed: boolean; staged?: boolean }): Promise<boolean> {
    if (change.staged) return true;
    const uri = vscode.Uri.file(change.path);
    if (change.existed) {
      try {
        const current = await vscode.workspace.fs.readFile(uri);
        if (!this.bytesEqual(current, change.updated)) {
          const choice = await vscode.window.showWarningMessage(`File ${vscode.workspace.asRelativePath(change.path)} đã thay đổi sau khi Agent sửa. Khôi phục bản cũ?`, { modal: true }, 'Khôi phục');
          if (choice !== 'Khôi phục') return false;
        }
        await vscode.workspace.fs.writeFile(uri, change.original);
      } catch {
        await vscode.workspace.fs.writeFile(uri, change.original);
      }
    } else {
      try { await vscode.workspace.fs.delete(uri, { useTrash: false }); } catch { /* File đã bị xóa thủ công. */ }
    }
    return true;
  }

  private bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((value, index) => value === right[index]);
  }

  private createSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private sessionSummaries(): Array<Pick<StoredSession, 'id' | 'title' | 'updatedAt'>> {
    return this.context.globalState.get<StoredSession[]>(CHAT_SESSIONS_STATE, [])
      .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
  }

  private async saveSession(mode: ChatMode, model: string): Promise<void> {
    const firstPrompt = this.transcript.find((turn) => turn.role === 'user')?.content.trim() || 'Cuộc trò chuyện mới';
    const session: StoredSession = {
      id: this.currentSessionId,
      title: firstPrompt.length > 58 ? `${firstPrompt.slice(0, 58)}…` : firstPrompt,
      updatedAt: Date.now(),
      mode,
      model,
      turns: this.transcript
    };
    const sessions = this.context.globalState.get<StoredSession[]>(CHAT_SESSIONS_STATE, []);
    await this.context.globalState.update(CHAT_SESSIONS_STATE, [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 30));
    await this.post({ type: 'sessions', sessions: this.sessionSummaries() });
  }

  private async loadSession(id: string): Promise<void> {
    const session = this.context.globalState.get<StoredSession[]>(CHAT_SESSIONS_STATE, []).find((item) => item.id === id);
    if (!session) throw new Error('Không tìm thấy cuộc trò chuyện này.');
    this.currentSessionId = session.id;
    this.transcript = session.turns;
    this.history = session.turns.map((turn) => ({ role: turn.role, content: turn.content }));
    const turns = await Promise.all(session.turns.map(async (turn) => ({
      ...turn,
      attachments: turn.attachments
        ? await this.attachmentViews(await Promise.all(turn.attachments.map(async (attachment) => {
            let size = 0;
            if (attachment.path) {
              try { size = (await vscode.workspace.fs.stat(vscode.Uri.file(attachment.path))).size; } catch { size = 0; }
            }
            return { name: attachment.name, path: attachment.path ?? '', mimeType: '', size };
          })))
        : []
    })));
    await this.post({ type: 'restoreSession', turns, mode: session.mode, model: session.model });
  }

  private async deleteSession(id: string): Promise<void> {
    const sessions = this.context.globalState.get<StoredSession[]>(CHAT_SESSIONS_STATE, []);
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    const choice = await vscode.window.showWarningMessage(
      `Xóa cuộc trò chuyện "${session.title}"?`,
      { modal: true },
      'Xóa'
    );
    if (choice !== 'Xóa') return;
    await this.context.globalState.update(CHAT_SESSIONS_STATE, sessions.filter((item) => item.id !== id));
    if (id === this.currentSessionId) this.newThread();
    await this.post({ type: 'sessions', sessions: this.sessionSummaries() });
  }

  private async attachmentViews(attachments: Array<{ path: string; name: string; mimeType: string; size: number }>): Promise<Array<{ name: string; preview?: string }>> {
    return Promise.all(attachments.map(async (item) => {
      const extension = item.path.split('.').pop()?.toLowerCase() ?? '';
      const mime = item.mimeType.startsWith('image/')
        ? item.mimeType
        : extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg' : extension === 'webp' ? 'image/webp' : extension === 'gif' ? 'image/gif' : '';
      if (!mime || !item.path || item.size > 5 * 1024 * 1024) return { name: item.name };
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(item.path));
        return { name: item.name, preview: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}` };
      } catch {
        return { name: item.name };
      }
    }));
  }

  private async postAttachments(): Promise<void> {
    await this.post({ type: 'attachments', attachments: await this.attachmentViews(this.pendingAttachments) });
  }

  private async pasteImage(message: Extract<WebviewMessage, { type: 'pasteImage' }>): Promise<void> {
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec(message.dataUrl);
    if (!match) throw new Error('Ảnh từ clipboard không đúng định dạng được hỗ trợ.');
    const mimeType = match[1] ?? '';
    const encoded = match[2] ?? '';
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Ảnh dán vào phải nhỏ hơn 5 MB.');
    const extension = mimeType === 'image/jpeg' ? 'jpg' : (mimeType.split('/')[1] || 'png');
    const directory = vscode.Uri.joinPath(this.context.globalStorageUri, 'pasted-images');
    await vscode.workspace.fs.createDirectory(directory);
    const uri = vscode.Uri.joinPath(directory, `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${extension}`);
    await vscode.workspace.fs.writeFile(uri, bytes);
    this.pendingAttachments.push({ path: uri.fsPath, name: message.name || `clipboard.${extension}`, mimeType, size: bytes.byteLength });
    await this.postAttachments();
  }

  private async pickFiles(kind: 'files' | 'images'): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: kind === 'images' ? 'Chọn ảnh' : 'Đính kèm tệp',
      filters: kind === 'images' ? { Images: ['png', 'jpg', 'jpeg', 'webp', 'gif'] } : { Files: ['*'] }
    });
    if (!uris?.length) return;
    const fs = await import('node:fs/promises');
    for (const uri of uris) {
      const stat = await fs.stat(uri.fsPath);
      if (stat.size > 20 * 1024 * 1024) {
        vscode.window.showWarningMessage(`Bỏ qua ${uri.path.split('/').pop()}: tệp lớn hơn 20 MB.`);
        continue;
      }
      this.pendingAttachments.push({ path: uri.fsPath, name: uri.path.split('/').pop() ?? uri.fsPath, mimeType: kind === 'images' ? 'image/*' : 'application/octet-stream', size: stat.size });
    }
    await this.postAttachments();
  }

  private async handleSlashCommand(prompt: string): Promise<boolean> {
    if (!prompt.startsWith('/')) return false;
    const command = prompt.trim().toLowerCase();
    if (command === '/clear' || command === '/new') {
      this.newThread();
      return true;
    }
    if (command === '/settings') {
      await this.post({ type: 'openConfig' });
      return true;
    }
    if (command === '/mcp') {
      await this.postMcpServers();
      await this.post({ type: 'openMcpPanel' });
      return true;
    }
    if (command === '/diagnostics') {
      await this.diagnostics();
      return true;
    }
    if (command === '/export') {
      await this.exportDiagnostics();
      return true;
    }
    if (command === '/logs') {
      this.showLogs();
      return true;
    }
    if (command === '/models') {
      await this.post({ type: 'openModelPicker' });
      return true;
    }
    await this.post({
      type: 'notice',
      message: '**Lệnh nhanh**\n\n• `/new` tạo cuộc chat mới\n• `/models` chọn model\n• `/diagnostics` kiểm tra kết nối\n• `/mcp` mở công cụ MCP\n• `/settings` mở cấu hình\n• `/logs` mở log Agent\n• `/export` xuất gói chẩn đoán'
    });
    return true;
  }

  private async withEditorContext(prompt: string, includeSelection: boolean): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    const sections: string[] = [];
    if (editor) {
      const relative = vscode.workspace.asRelativePath(editor.document.uri);
      const wantsSelection = includeSelection || /@selection\b/i.test(prompt);
      const selection = wantsSelection ? editor.document.getText(editor.selection) : '';
      sections.push(selection ? `<selection file="${relative}">\n${selection}\n</selection>` : `Active file: ${relative}`);
    }
    const fileMatches = [...prompt.matchAll(/@file:([^\s,]+)/gi)].slice(0, 8);
    for (const match of fileMatches) {
      const raw = match[1];
      if (!raw) continue;
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) break;
      const uri = vscode.Uri.joinPath(folders[0]!.uri, raw);
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        sections.push(`<file path="${raw}">\n${new TextDecoder().decode(bytes).slice(0, 30_000)}\n</file>`);
      } catch {
        sections.push(`File context not found: ${raw}`);
      }
    }
    const folderMatches = [...prompt.matchAll(/@folder:([^\s,]+)/gi)].slice(0, 3);
    for (const match of folderMatches) {
      const raw = match[1];
      if (!raw) continue;
      const uris = await vscode.workspace.findFiles(`${raw.replace(/[\\/]+$/, '')}/**/*`, '**/{node_modules,.git,dist,out}/**', 150);
      sections.push(`<folder path="${raw}">\n${uris.map((uri) => vscode.workspace.asRelativePath(uri)).join('\n')}\n</folder>`);
    }
    if (/@problems\b/i.test(prompt)) {
      const problems = vscode.languages.getDiagnostics().flatMap(([uri, diagnostics]) =>
        diagnostics.slice(0, 30).map((item) => `${vscode.workspace.asRelativePath(uri)}:${item.range.start.line + 1} ${item.message}`)
      ).slice(0, 100);
      sections.push(`<problems>\n${problems.join('\n') || 'No workspace problems.'}\n</problems>`);
    }
    if (/@terminal\b/i.test(prompt)) {
      sections.push(`<terminal>\n${this.context.workspaceState.get<string>(LAST_TERMINAL_STATE, 'No captured terminal output.')}\n</terminal>`);
    }
    if (/@git-diff\b/i.test(prompt)) {
      try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) {
          const { execFile } = await import('node:child_process');
          const diff = await new Promise<string>((resolvePromise) => execFile('git', ['diff', '--no-ext-diff'], { cwd: root, windowsHide: true, maxBuffer: 1_000_000 }, (_error, stdout, stderr) => resolvePromise(stdout || stderr)));
          sections.push(`<git-diff>\n${diff.slice(0, 60_000) || 'No working tree diff.'}\n</git-diff>`);
        }
      } catch { sections.push('<git-diff>Unable to read Git diff.</git-diff>'); }
    }
    const full = sections.length ? `${prompt}\n\n${sections.join('\n\n')}` : prompt;
    const limit = vscode.workspace.getConfiguration('nineRouter').get<number>('contextMaxChars', 120_000);
    if (full.length <= limit) {
      await this.post({ type: 'contextBudget', used: full.length, limit, compacted: false });
      return full;
    }
    const available = Math.max(0, limit - prompt.length - 120);
    const compacted = `${prompt}\n\n<context compacted="true">\n${sections.join('\n\n').slice(0, available)}\n</context>`;
    await this.post({ type: 'contextBudget', used: compacted.length, original: full.length, limit, compacted: true });
    return compacted;
  }

  private post(message: unknown): Thenable<boolean> | Promise<boolean> {
    const language = vscode.workspace.getConfiguration('nineRouter').get<'vi' | 'en'>('language', 'vi');
    return this.view?.webview.postMessage(localizeUiPayload(message, language)) ?? Promise.resolve(false);
  }

  private errorText(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      const nested = parsed.error?.message;
      if (nested) return nested.replace(/\\"/g, '"');
    } catch { /* plain error */ }
    if (raw.includes('REQUEST_BODY_INVALID')) return '9Router/provider từ chối payload. Hãy kiểm tra provider và API key của model này trong Dashboard 9Router.';
    return raw;
  }

  private html(webview: vscode.Webview): string {
    const nonce = getNonce();
    const language = vscode.workspace.getConfiguration('nineRouter').get<'vi' | 'en'>('language', 'vi');
    const htmlDocument = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">${styles}${redesignStyles}${interactionStyles}${finalStyles}${bubbleStyles}${polishStyles}${changeStyles}${historyStyles}${compactStyles}${providerStyles}${advancedStyles}${dropdownFixStyles}${mcpGalleryStyles}${chatExperienceStyles}</style>
</head>
<body data-language="${language}">
  <header class="route-header">
    <div class="route-meta"><span id="connectionDot" class="dot"></span><span id="connectionLabel">Đang kiểm tra</span></div>
    <div class="header-actions"><button id="topDisconnect" class="header-action hidden">Ngắt</button><button id="historyToggle" class="header-action">Lịch sử</button><button id="metricsToggle" class="header-action">Số liệu</button><button id="openExternal" class="header-action">Mở</button><button id="settings" class="header-action">Cài đặt</button></div>
  </header>

  <section id="historyPanel" class="history-panel hidden"><div class="history-heading"><strong id="historyTitle">Lịch sử chat</strong><button id="closeHistory" aria-label="Đóng">×</button></div><div id="historyList" class="history-list"></div><button id="viewAllHistory" class="history-view-all hidden" type="button">View all</button></section>

  <section id="telemetryPanel" class="overlay-panel hidden"><div class="panel-heading"><div><strong>Hoạt động provider</strong><span>Token, chi phí ước tính, tốc độ và rate limit</span></div><button id="closeTelemetry" class="header-action">Đóng</button></div><div id="telemetrySummary" class="telemetry-summary"></div><div id="telemetryRate" class="telemetry-rate"></div><div id="telemetryList" class="telemetry-list"></div><button id="clearTelemetry" class="panel-link">Xóa lịch sử số liệu</button></section>

  <section id="mcpPanel" class="overlay-panel hidden">
    <div class="panel-heading"><div><strong>Kết nối công cụ</strong><span>Chọn dịch vụ và đăng nhập trong trình duyệt</span></div><button id="closeMcp" class="header-action">Đóng</button></div>
    <div id="mcpCatalog" class="mcp-catalog" aria-label="MCP có thể kết nối"></div>
    <div class="mcp-section-label">Đã thêm</div>
    <div id="mcpList" class="mcp-list"></div>
    <details class="mcp-custom">
      <summary>Thêm MCP khác</summary>
      <div class="mcp-form">
        <input id="mcpName" placeholder="Tên server">
        <select id="mcpTransport"><option value="stdio">Local process (stdio)</option><option value="http">Streamable HTTP</option></select>
        <select id="mcpAuth" class="hidden"><option value="oauth">Đăng nhập bằng trình duyệt (OAuth)</option><option value="token">Bearer token</option><option value="none">Không xác thực</option></select>
        <input id="mcpCommand" placeholder="Command, ví dụ npx">
        <input id="mcpArgs" placeholder="Args, phân cách bằng dấu cách">
        <input id="mcpUrl" class="hidden" placeholder="https://example.com/mcp">
        <input id="mcpEnv" placeholder='Env JSON, ví dụ {"TOKEN":"…"}'>
        <input id="mcpToken" class="hidden" type="password" placeholder="Bearer token">
        <button id="saveMcp" class="primary">Kết nối server</button>
      </div>
    </details>
  </section>

  <section id="configPanel" class="config-panel hidden">
    <div class="config-heading"><div><strong>Cấu hình provider</strong><span>Chọn nguồn model cho mọi yêu cầu</span></div><button id="closeConfig" class="header-action">Đóng</button></div>
    <label class="language-setting">Ngôn ngữ giao diện<select id="uiLanguage"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
    <div class="profile-bar"><div><span>Hồ sơ đang dùng</span><div id="profileList" class="profile-list"></div></div><button id="newProfile" class="secondary profile-new">+ Hồ sơ mới</button></div>
    <label>Tên hồ sơ<input id="profileName" spellcheck="false" placeholder="Ví dụ: OpenAI cá nhân"></label>
    <div class="provider-field"><span>Provider</span><div class="provider-picker" id="providerPicker"><button id="providerTrigger" class="provider-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span><strong id="providerLabel">9Router</strong><small id="providerHint">Gateway local, nhiều model</small></span></button><div id="providerMenu" class="provider-menu hidden" role="listbox"><button type="button" class="provider-option" data-provider="9router"><strong>9Router</strong><small>Gateway local, nhiều model</small></button><button type="button" class="provider-option" data-provider="openai"><strong>OpenAI</strong><small>API chính thức · cần API key</small></button><button type="button" class="provider-option" data-provider="anthropic"><strong>Anthropic Claude</strong><small>Messages API · cần API key</small></button><button type="button" class="provider-option" data-provider="openai-compatible"><strong>OpenAI-compatible</strong><small>Endpoint tùy chỉnh</small></button><button type="button" class="provider-option" data-provider="ollama"><strong>Ollama</strong><small>Local · không cần API key</small></button><button type="button" class="provider-option" data-provider="lm-studio"><strong>LM Studio</strong><small>Local · không cần API key</small></button></div></div><select id="configProvider" class="hidden" aria-hidden="true" tabindex="-1"><option value="9router">9Router</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="openai-compatible">OpenAI-compatible</option><option value="ollama">Ollama local</option><option value="lm-studio">LM Studio local</option></select></div>
    <label>Endpoint<input id="configEndpoint" spellcheck="false" placeholder="http://localhost:20128/v1"></label>
    <label id="apiKeyField"><span id="apiKeyLabel">API key</span><input id="configApiKey" type="password" autocomplete="off" placeholder="Nhập API key của provider"></label>
    <div class="price-row"><label>Input $ / 1M<input id="inputPrice" type="number" min="0" step="0.01" placeholder="Tùy chọn"></label><label>Output $ / 1M<input id="outputPrice" type="number" min="0" step="0.01" placeholder="Tùy chọn"></label></div>
    <p id="keyState" class="key-state">Chưa lưu API key</p>
    <div class="config-actions"><button id="saveConfig" class="primary">Lưu và kết nối lại</button><button id="runDiagnostics" class="secondary">Chẩn đoán</button></div><div class="config-subactions"><button id="openMcp" class="secondary">MCP tools</button><button id="exportDiagnostics" class="secondary">Xuất chẩn đoán</button><button id="localSetup" class="secondary hidden">Thiết lập local</button></div><p id="diagnosticsResult" class="diagnostics-result hidden" role="status" aria-live="polite"></p>
  </section>

  <section id="setup" class="setup hidden">
    <div class="setup-hero">
      <div id="signalMap" class="signal-map" aria-label="Tuyến kết nối từ IDE qua 9Router đến model">
        <span class="signal-node">IDE</span><span class="signal-wire"><i></i></span><span class="signal-node router-node">9R</span><span class="signal-wire"><i></i></span><span class="signal-node">AI</span>
      </div>
      <h1 id="setupTitle">Kết nối 9Router bằng một nút.</h1>
      <p id="setupCopy">Extension tự chạy dịch vụ nền rồi mở trang quản lý bằng trình duyệt mặc định.</p>
    </div>

    <div class="launch-panel">
      <div class="launch-state">
        <span class="state-mark" aria-hidden="true"></span>
        <div><strong id="launchTitle">9Router chưa chạy</strong><span id="launchDescription">Không cần mở terminal. Một nút là đủ để bắt đầu.</span></div>
      </div>
      <button id="startRouter" class="primary">Kết nối 9Router</button>
      <div class="button-row">
        <button id="openDashboard" class="secondary hidden">Mở lại trình quản lý</button>
        <button id="retryConnection" class="secondary hidden">Kiểm tra lại</button>
        <button id="stopRouter" class="secondary hidden">Tắt 9Router</button>
      </div>
    </div>

    <details id="manualSetup" class="manual-setup">
      <summary>Kết nối thủ công</summary>
      <div class="manual-fields">
        <label>Endpoint<input id="endpoint" value="http://localhost:20128/v1" spellcheck="false"></label>
        <label>API key<input id="apiKey" type="password" autocomplete="off" placeholder="Lưu trong Secret Storage"></label>
        <button id="connect" class="secondary full">Lưu và kết nối</button>
      </div>
    </details>
    <p id="setupError" class="error hidden" role="alert"></p>
  </section>

  <main id="console" class="console hidden">
    <div class="controls hidden"><button id="connectionToggle" class="status-action hidden">Ngắt</button></div>
    <div id="customModelRow" class="custom-model-row hidden"><input id="customModelInput" placeholder="Nhập model ID từ 9Router"><button id="addCustomModel" class="secondary">Dùng model này</button></div>
    <div id="messages" class="messages" aria-live="polite">
      <div class="empty">
        <h2>Nói điều bạn muốn xây.</h2>
        <p>Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.</p>
      </div>
    </div>
    <section id="collapsedChanges" class="collapsed-changes hidden"><span id="collapsedChangeCount">0 files changed</span><button id="expandChanges" type="button">Xem</button></section>
    <section id="changeTray" class="change-tray hidden"><div id="changeList"></div><div class="change-tray-footer"><span id="changeCount">0 files changed</span><button id="hideChanges" class="tray-button">Ẩn</button><button id="undoAllChanges" class="tray-button">Undo all</button><button id="acceptAllChanges" class="tray-accept">Accept all</button></div></section>
    <footer class="composer-shell">
      <div id="attachmentList" class="attachment-list" aria-live="polite"></div>
      <div class="composer-toolbar"><div class="sandbox-wrap" id="sandboxDropdown"><button id="sandboxMode" class="sandbox-trigger" type="button"><span id="sandboxLabel">Sandbox ưu tiên</span></button><div id="sandboxMenu" class="sandbox-menu hidden"><button data-sandbox="required"><strong>Sandbox bắt buộc</strong><span>Chỉ chạy khi có Docker hoặc Podman</span></button><button data-sandbox="preferred"><strong>Sandbox ưu tiên</strong><span>Hỏi trước khi chạy trực tiếp</span></button><button data-sandbox="direct"><strong>Chạy trực tiếp</strong><span>Dùng workspace thật với quyền đã chọn</span></button><button id="checkSandbox" class="sandbox-check"><strong>Kiểm tra Docker/Podman</strong><span id="sandboxStatus">Chưa kiểm tra</span></button></div></div><div class="attach-actions"><button id="attach" class="tool-button plus-button" type="button" aria-label="Đính kèm file">＋</button></div></div>
      <div id="composerMenu" class="composer-menu hidden"></div>
      <textarea id="prompt" rows="1" placeholder="Nhập yêu cầu sửa, chạy hoặc kiểm tra code…"></textarea>
      <div id="contextMeter" class="context-meter" title="Context budget"><i></i></div>
      <div class="composer-actions"><div class="mode-switch" role="tablist" aria-label="Chế độ chat"><button data-mode="agent" role="tab" class="active">Agent</button><button data-mode="chat" role="tab">Chat</button><button data-mode="plan" role="tab">Plan</button></div><div class="perm-wrap" id="permDropdown"><button class="perm-trigger" id="permissionMode" type="button" data-mode="ask"><span id="permLabel">Quyền: Hỏi</span></button><div class="perm-menu hidden" id="permMenu"><button class="perm-opt active" data-perm="ask"><span class="perm-check">✓</span>Hỏi mọi thao tác</button><button class="perm-opt" data-perm="edit"><span class="perm-check">✓</span>Cho phép sửa file</button><button class="perm-opt" data-perm="full"><span class="perm-check">✓</span>Full access</button></div></div><div class="model-picker" id="modelPicker"><button id="modelTrigger" class="model-trigger" type="button"><span id="modelLabel">Chọn model</span></button><div id="modelMenu" class="model-menu hidden"><input id="modelSearch" placeholder="Tìm model…"><button id="checkModels" class="model-check-all" type="button">Kiểm tra model</button><div id="modelOptions" class="model-options"></div></div></div><select id="model" class="hidden" aria-label="Chọn model"><option value="">Chọn model</option></select><button id="send" class="send" aria-label="Gửi" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6.5 10.5 12 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
    </footer>
  </main>
  <div id="accessConfirm" class="modal-backdrop hidden"><section class="access-dialog"><strong>Bật Full access?</strong><p>Agent có thể sửa file và chạy lệnh mà không hỏi lại. Chỉ bật khi bạn tin tưởng model và workspace này.</p><div><button id="cancelFull" class="secondary">Hủy</button><button id="confirmFull" class="danger-confirm">Bật Full access</button></div></section></div>
  <div id="changeReviewPanel" class="modal-backdrop hidden"><section class="change-review-dialog"><header><div><strong id="changeReviewTitle">Review changes</strong><span id="changeReviewMeta"></span></div><button id="closeChangeReview" type="button">×</button></header><div id="hunkList" class="hunk-list"></div><footer><button id="openFullDiff" class="secondary">Mở diff đầy đủ</button></footer></section></div>
  <div id="imageLightbox" class="image-lightbox hidden" role="dialog" aria-modal="true" aria-label="Xem ảnh"><button id="closeImage" aria-label="Đóng ảnh">×</button><img id="lightboxImage" alt="Ảnh đính kèm"></div>
  <script nonce="${nonce}">${script}</script>
</body>
</html>`;
    return localizeUiDocument(htmlDocument, language);
  }

  public dispose(): void {
    this.abortController?.abort();
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.modelCheckController?.abort();
    this.metricsPanel?.dispose();
    this.routerProcess.dispose();
    this.mcpManager.dispose();
    this.output.dispose();
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function escapeDocument(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char] || char);
}

function localizeUiDocument(document: string, language: 'vi' | 'en'): string {
  if (language !== 'en') return document;
  const translations: Record<string, string> = {
    'Agent có thể sửa file và chạy lệnh mà không hỏi lại. Chỉ bật khi bạn tin tưởng model và workspace này.': 'Agent can edit files and run commands without asking again. Enable this only when you trust the model and this workspace.',
    'Extension tự chạy dịch vụ nền rồi mở trang quản lý bằng trình duyệt mặc định.': 'Lối starts the background service and opens its management page in your default browser.',
    'Token, chi phí ước tính, tốc độ và rate limit': 'Tokens, estimated cost, latency and rate limits',
    'Chọn dịch vụ và đăng nhập trong trình duyệt': 'Choose a service and sign in through your browser',
    'Dùng workspace thật với quyền đã chọn': 'Use the real workspace with the selected approval policy',
    'Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.': 'Agent can read the project, edit files and run commands in the workspace.',
    'Không cần mở terminal hoặc chuyển sang trình duyệt.': 'No terminal or browser switching is required.',
    'Không cần mở terminal. Một nút là đủ để bắt đầu.': 'No terminal required. One click is enough to start.',
    'Chỉ chạy khi có Docker hoặc Podman': 'Run only when Docker or Podman is available',
    'Hỏi trước khi chạy trực tiếp': 'Ask before falling back to direct execution',
    'Chọn nguồn model cho mọi yêu cầu': 'Choose the model source for every request',
    'Kết nối 9Router bằng một nút.': 'Connect 9Router in one click.',
    'Hãy chọn hoặc nhập một model trước khi gửi.': 'Select or enter a model before sending.',
    'Model này không hỗ trợ tools nên không thể chạy Agent mode. Hãy chuyển sang Chat hoặc chọn model khác.': 'This model does not support tools and cannot run in Agent mode. Switch to Chat or choose another model.',
    'Đã lưu API key an toàn': 'API key stored securely',
    'Chưa lưu API key': 'No API key saved',
    'Chưa có API key. Mở Cấu hình và nhập key của provider.': 'No API key is configured. Open Settings and enter the provider key.',
    'Chọn model, dùng Agent để sửa code, gõ @ để thêm ngữ cảnh hoặc / để xem lệnh nhanh.': 'Choose a model, use Agent to edit code, type @ for context or / for quick commands.',
    'MCP ghi dữ liệu bị tắt trong sandbox để giữ cách ly': 'MCP write tools are disabled in the sandbox to preserve isolation',
    'Không cần API key · server local vẫn phải đang chạy': 'No API key required · the local server must still be running',
    'API key được lưu riêng và an toàn cho provider này': 'The API key is stored securely and separately for this provider',
    '9Router đang chạy nền. Trình duyệt đã mở trang quản lý.': '9Router is running in the background. The management page is open in your browser.',
    'Chưa có cuộc trò chuyện nào.': 'No conversations yet.',
    'Đang kiểm tra 0/': 'Checking 0/',
    ' · Bấm để hủy': ' · Click to cancel',
    'Đã mở trình quản lý': 'Management page opened',
    'Sandbox đã được xóa': 'Sandbox removed',
    'Đã ngắt kết nối.': 'Disconnected.',
    'Đã ngắt provider.': 'Provider disconnected.',
    '9Router đã tắt': '9Router stopped',
    'Đang cài 9Router': 'Installing 9Router',
    'Kết nối lại': 'Reconnect',
    'Xóa MCP': 'Remove MCP',
    'Bỏ yêu thích': 'Remove favorite',
    'Yêu thích': 'Favorite',
    'Env MCP phải là JSON hợp lệ.': 'MCP environment values must be valid JSON.',
    'Bỏ ảnh đính kèm': 'Remove attached image',
    'Bỏ tệp đính kèm': 'Remove attached file',
    'Tác vụ ': 'Task ',
    'Nhập API key của provider': 'Enter the provider API key',
    'Gateway local, nhiều model': 'Local gateway, many models',
    'API chính thức · cần API key': 'Official API · API key required',
    'Messages API · cần API key': 'Messages API · API key required',
    'Local · không cần API key': 'Local · no API key required',
    'Endpoint tùy chỉnh': 'Custom endpoint',
    'Đăng nhập bằng trình duyệt (OAuth)': 'Sign in with browser (OAuth)',
    'Args, phân cách bằng dấu cách': 'Arguments separated by spaces',
    'Env JSON, ví dụ {"TOKEN":"…"}': 'Environment JSON, for example {"TOKEN":"…"}',
    'Hoạt động provider': 'Provider activity',
    'Xóa lịch sử số liệu': 'Clear usage history',
    'Kết nối công cụ': 'Tool connections',
    'MCP có thể kết nối': 'Available MCP connections',
    'Thêm MCP khác': 'Add another MCP',
    'Không xác thực': 'No authentication',
    'Kết nối server': 'Connect server',
    'Cấu hình provider': 'Provider settings',
    'Ngôn ngữ giao diện': 'Interface language',
    'Hồ sơ đang dùng': 'Active profile',
    '+ Hồ sơ mới': '+ New profile',
    'Tên hồ sơ': 'Profile name',
    'Ví dụ: OpenAI cá nhân': 'For example: Personal OpenAI',
    'Lưu và kết nối lại': 'Save and reconnect',
    'Xuất chẩn đoán': 'Export diagnostics',
    'Thiết lập local': 'Set up local provider',
    '9Router chưa chạy': '9Router is not running',
    'Đang kết nối 9Router': 'Connecting to 9Router',
    '9Router đang hoạt động': '9Router is running',
    'Mở lại trình quản lý': 'Open management page',
    'Kiểm tra lại': 'Check again',
    'Tắt 9Router': 'Stop 9Router',
    'Kết nối thủ công': 'Connect manually',
    'Lưu trong Secret Storage': 'Stored in SecretStorage',
    'Lưu và kết nối': 'Save and connect',
    'Nhập model ID từ 9Router': 'Enter a model ID from 9Router',
    'Dùng model này': 'Use this model',
    'Nói điều bạn muốn xây.': 'Describe what you want to build.',
    'Nhập yêu cầu sửa, chạy hoặc kiểm tra code…': 'Ask Lối to edit, run or review code…',
    'Sandbox bắt buộc': 'Sandbox required',
    'Sandbox ưu tiên': 'Sandbox preferred',
    'Chạy trực tiếp': 'Run directly',
    'Kiểm tra Docker/Podman': 'Check Docker/Podman',
    'Chưa kiểm tra': 'Not checked',
    'Đính kèm file': 'Attach files',
    'Chế độ chat': 'Chat mode',
    'Quyền: Hỏi': 'Approval: Ask',
    'Hỏi mọi thao tác': 'Ask for every action',
    'Cho phép sửa file': 'Allow file edits',
    'Chọn model': 'Select model',
    'Model tùy chỉnh': 'Custom model',
    'Tìm model…': 'Search models…',
    'Kiểm tra model': 'Check models',
    'Bật Full access?': 'Enable Full access?',
    'Bật Full access': 'Enable Full access',
    'Mở diff đầy đủ': 'Open full diff',
    'Ảnh đính kèm': 'Attached image',
    'Đóng ảnh': 'Close image',
    'Xem ảnh': 'View image',
    'Lịch sử chat': 'Chat history',
    'Chưa có lịch sử': 'No chat history yet',
    'Đang kiểm tra…': 'Checking…',
    'Đang kiểm tra': 'Checking',
    'Chẩn đoán': 'Diagnostics',
    'Tên server': 'Server name',
    'Đã thêm': 'Added',
    'Tiếng Việt': 'Vietnamese',
    'Kết nối 9Router': 'Connect 9Router',
    'Lịch sử': 'History',
    'Số liệu': 'Usage',
    'Cài đặt': 'Settings',
    'Ngắt': 'Disconnect',
    'Đóng': 'Close',
    'Hủy': 'Cancel',
    'Xem': 'View',
    'Ẩn': 'Hide',
    'Gửi': 'Send',
    'Mở': 'Open'
  };
  return Object.entries(translations)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((result, [source, target]) => result.replaceAll(source, target), document);
}

function localizeUiPayload(value: unknown, language: 'vi' | 'en'): unknown {
  if (language !== 'en') return value;
  if (typeof value === 'string') return localizeUiDocument(value, language);
  if (Array.isArray(value)) return value.map((item) => localizeUiPayload(item, language));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeUiPayload(item, language)]));
  }
  return value;
}

function formatDashboardNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, notation: 'compact' }).format(value || 0);
}

const styles = String.raw`
:root{--accent:#4ec9b0;--accent-s:rgba(78,201,176,.11);--accent-ink:#07201b;--hr:rgba(255,255,255,.09);--hr2:rgba(255,255,255,.15);--muted:var(--vscode-descriptionForeground,#858585);--r:10px}*{box-sizing:border-box}body{padding:0;margin:0;color:var(--vscode-foreground);background:var(--vscode-sideBar-background);font:13px/1.5 var(--vscode-font-family);height:100vh;overflow:hidden}button,input,textarea,select{font:inherit;color:inherit}.hidden{display:none!important}:focus-visible{outline:1px solid var(--accent);outline-offset:2px}
.route-header{display:flex;align-items:center;gap:6px;padding:8px 11px;border-bottom:1px solid var(--hr);background:color-mix(in srgb,var(--vscode-sideBar-background) 70%,var(--vscode-editor-background));height:44px}.brand{display:flex;align-items:center;gap:7px;min-width:0;flex:1}.brand-mark{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;background:rgba(78,201,176,.1);color:var(--accent);font:700 9px var(--vscode-editor-font-family);border:1px solid rgba(78,201,176,.22);flex:none}.brand>span:last-child{display:grid;line-height:1.15;min-width:0}.brand strong{font-size:12px;font-weight:600}.brand small{font-size:9px;color:var(--muted)}.route-meta{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:10px;flex:none}.dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.22);flex:none}.dot.online{background:var(--accent)}#connectionLabel{font-size:10px}#endpointLabel{font:9px var(--vscode-editor-font-family);color:var(--muted);opacity:.7;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.header-actions{display:flex;gap:1px;align-items:center}.header-action{border:0;background:transparent;color:var(--muted);font-size:10px;padding:4px 7px;cursor:pointer;border-radius:5px}.header-action:hover{background:rgba(255,255,255,.07);color:var(--vscode-foreground)}
.config-panel{position:absolute;z-index:20;top:44px;left:10px;right:10px;padding:12px 13px;border-radius:12px;border:1px solid var(--hr2);background:color-mix(in srgb,var(--vscode-sideBar-background) 55%,var(--vscode-editor-background));box-shadow:0 16px 40px rgba(0,0,0,.45)}.config-heading{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px}.config-heading>div{display:grid}.config-heading strong{font-size:12px}.config-heading span,.key-state{font-size:10px;color:var(--muted)}.config-panel label{display:grid;gap:5px;margin:9px 0;color:var(--muted);font-size:10px}.config-panel input,.config-panel select{width:100%;border:1px solid var(--hr2);border-radius:7px;background:color-mix(in srgb,var(--vscode-sideBar-background) 40%,var(--vscode-editor-background));padding:7px 9px;outline:none}.config-panel input:focus,.config-panel select:focus{border-color:var(--accent)}.language-setting{padding:9px 0 10px;border-bottom:1px solid var(--hr)}.language-setting select{height:32px;color:var(--vscode-foreground)}.key-state{margin:-4px 0 8px}.key-state.saved{color:var(--accent)}
.attachment-list{display:flex;gap:5px;flex-wrap:wrap;padding:0 0 4px}.attachment-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 7px;border-radius:999px;background:rgba(78,201,176,.1);color:var(--accent);font-size:10px;border:1px solid rgba(78,201,176,.22)}.attachment-chip button{border:0;background:transparent;color:inherit;padding:0;cursor:pointer;line-height:1}
.setup{height:calc(100vh - 44px);overflow:auto;padding:22px 13px 28px}.setup-hero{max-width:340px}.setup-hero h1{font-size:21px;line-height:1.15;letter-spacing:-.03em;margin:16px 0 8px;max-width:300px}.setup-hero p{color:var(--muted);font-size:12px;margin:0;max-width:300px}.signal-map{display:grid;grid-template-columns:32px minmax(14px,1fr) 32px minmax(14px,1fr) 32px;align-items:center;max-width:250px}.signal-node{display:grid;place-items:center;height:28px;border:1px solid var(--hr2);border-radius:7px;color:var(--muted);font:650 9px var(--vscode-editor-font-family);background:color-mix(in srgb,var(--vscode-sideBar-background) 70%,var(--vscode-editor-background))}.router-node{border-color:rgba(78,201,176,.4);color:var(--accent);background:rgba(78,201,176,.08)}.signal-wire{height:1px;background:var(--hr2);overflow:hidden}.signal-wire i{display:none;height:1px;width:38%;background:var(--accent)}.signal-map.launching .signal-wire i{display:block;animation:signal 1.25s ease-in-out infinite}.signal-map.ready .signal-wire{background:rgba(78,201,176,.4)}
.launch-panel{margin-top:20px;padding:12px;border:1px solid var(--hr2);border-radius:var(--r);background:color-mix(in srgb,var(--vscode-sideBar-background) 60%,var(--vscode-editor-background))}.launch-state{display:flex;gap:9px;align-items:flex-start;margin-bottom:12px}.state-mark{flex:none;width:8px;height:8px;margin-top:4px;border:2px solid var(--muted);border-radius:50%}.launch-state>div{display:grid;gap:2px}.launch-state strong{font-size:12px}.launch-state span{font-size:10px;color:var(--muted)}.launch-panel.launching .state-mark{border-color:var(--accent);border-top-color:transparent;animation:spin .8s linear infinite}.launch-panel.ready .state-mark{border:0;background:var(--accent)}
.primary,.secondary{min-height:32px;border-radius:7px;padding:7px 11px;font-weight:600;cursor:pointer;white-space:nowrap}.primary{width:100%;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink)}.primary:hover{filter:brightness(1.07)}.primary:active,.secondary:active{transform:translateY(1px)}.primary:disabled{opacity:.5;cursor:wait}.secondary{border:1px solid var(--hr2);background:color-mix(in srgb,var(--vscode-sideBar-background) 50%,var(--vscode-editor-background));color:var(--vscode-foreground)}.secondary:hover{border-color:rgba(78,201,176,.4)}.button-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}.full{width:100%}
.manual-setup{margin-top:11px;border:1px solid var(--hr);border-radius:var(--r);background:color-mix(in srgb,var(--vscode-sideBar-background) 70%,var(--vscode-editor-background))}.manual-setup summary{padding:10px 12px;cursor:pointer;color:var(--muted);font-size:11px}.manual-setup[open] summary{border-bottom:1px solid var(--hr);color:var(--vscode-foreground)}.manual-fields{padding:4px 12px 12px}.manual-fields label{display:grid;gap:5px;margin:10px 0;color:var(--muted);font-size:10px}.manual-fields input{width:100%;border:1px solid var(--hr2);border-radius:7px;background:color-mix(in srgb,var(--vscode-sideBar-background) 40%,var(--vscode-editor-background));padding:8px 9px;outline:none}.manual-fields input:focus{border-color:var(--accent);box-shadow:0 0 0 1px rgba(78,201,176,.2)}.error{margin:10px 1px 0;padding:9px 10px;border-left:2px solid var(--vscode-errorForeground);background:color-mix(in srgb,var(--vscode-errorForeground) 8%,transparent);color:var(--vscode-errorForeground);font-size:10px}
.console{display:grid;grid-template-rows:auto 1fr auto auto;height:calc(100vh - 44px)}.controls{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;padding:9px 12px;border-bottom:1px solid var(--hr)}.status-action{border:1px solid var(--hr2);border-radius:6px;background:transparent;color:var(--muted);font-size:10px;padding:0 8px;height:26px;cursor:pointer}.status-action:hover{border-color:rgba(78,201,176,.4);color:var(--accent)}
.messages{overflow-y:auto;padding:16px 12px 20px}.empty{margin:18vh auto 0;max-width:220px;text-align:center;color:var(--muted)}.empty-glyph{font:30px var(--vscode-editor-font-family);color:var(--accent);transform:rotate(-10deg)}.empty h2{color:var(--vscode-foreground);font-size:15px;margin:5px 0}.empty p{font-size:11px}.message{margin:0 0 16px}.message .label{font:600 10px var(--vscode-editor-font-family);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px}.message.user .body{padding:8px 11px;background:rgba(255,255,255,.04);border-radius:4px 10px 10px 10px;font-size:12.5px}.message.assistant .label{color:var(--accent)}.message .body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px}.message.error .body{color:var(--vscode-errorForeground)}
.status{display:flex;gap:7px;align-items:center;border-top:1px solid var(--hr);padding:6px 12px;color:var(--muted);font-size:11px}.spinner{width:9px;height:9px;border:1.5px solid var(--hr2);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
.composer-shell{margin:0 9px 9px;border:1px solid var(--hr2);border-radius:12px;background:color-mix(in srgb,var(--vscode-sideBar-background) 60%,var(--vscode-editor-background));padding:8px 10px;transition:border-color .15s}.composer-shell:focus-within{border-color:rgba(78,201,176,.45)}textarea{resize:none;width:100%;border:0;outline:0;background:transparent;padding:2px 0 6px;line-height:1.5;font-size:13px;min-height:20px;max-height:180px;overflow-y:auto}.composer-toolbar{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px}.context-toggle{display:flex;gap:5px;align-items:center;color:var(--muted);font-size:10px;cursor:pointer;user-select:none}.context-toggle input{accent-color:var(--accent);margin:0}.attach-actions{display:flex;gap:4px}.tool-button{border:1px solid var(--hr2);border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;transition:border-color .12s,color .12s}.tool-button:hover{border-color:rgba(78,201,176,.4);color:var(--accent)}.plus-button{font-size:15px;line-height:1;width:26px;height:26px;padding:0;display:grid;place-items:center}
.composer-actions{display:flex;align-items:center;gap:5px;padding-top:4px}.mode-switch{display:flex;border:1px solid var(--hr2);border-radius:7px;padding:2px;gap:1px;flex:none}.mode-switch button{border:0;border-radius:5px;padding:3px 9px;background:transparent;color:var(--muted);font-size:11px;cursor:pointer;font-weight:500;transition:background .12s,color .12s}.mode-switch button.active{background:rgba(78,201,176,.14);color:var(--accent)}.mode-switch button:not(.active):hover{color:var(--vscode-foreground)}
.perm-wrap{position:relative;flex:none}.perm-trigger{display:flex;align-items:center;gap:4px;height:26px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--muted);padding:0 6px;font-size:10px;cursor:pointer;white-space:nowrap;transition:background .12s,color .12s}.perm-trigger:hover,.perm-wrap.open .perm-trigger{background:rgba(255,255,255,.07);color:var(--vscode-foreground)}.perm-arrow{transition:transform .18s;flex:none;opacity:.7}.perm-wrap.open .perm-arrow{transform:rotate(180deg)}.perm-trigger.full{color:#e6c13a}.perm-menu{position:absolute;bottom:calc(100% + 6px);left:0;min-width:170px;border:1px solid var(--hr2);border-radius:9px;background:color-mix(in srgb,var(--vscode-sideBar-background) 30%,#111);box-shadow:0 8px 28px rgba(0,0,0,.5);overflow:hidden;z-index:50;animation:dropIn .15s ease-out}.perm-opt{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:var(--vscode-foreground);padding:8px 12px;font-size:11px;cursor:pointer;text-align:left;transition:background .1s}.perm-opt:hover{background:rgba(78,201,176,.09);color:var(--accent)}.perm-opt:first-child{padding-top:10px}.perm-opt:last-child{padding-bottom:10px}.perm-check{width:12px;font-size:10px;color:var(--accent);visibility:hidden}.perm-opt.active .perm-check{visibility:visible}
select{appearance:none;flex:1;min-width:70px;height:26px;border:1px solid var(--hr2);border-radius:6px;background:color-mix(in srgb,var(--vscode-sideBar-background) 50%,var(--vscode-editor-background));padding:0 18px 0 8px;outline:none;font-size:11px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' fill='none'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23858585' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;color-scheme:dark}select:focus{border-color:rgba(78,201,176,.4)}
.send{display:grid;place-items:center;border:0;width:26px;height:26px;border-radius:50%;background:rgba(78,201,176,.18);color:var(--accent);font-size:13px;font-weight:800;cursor:pointer;transition:background .15s,color .15s;flex:none}.send:not(:disabled):hover{background:var(--accent);color:var(--accent-ink)}.send:disabled{opacity:.3;cursor:default}
.permission-card,.change-card{display:grid;gap:7px;margin:0 0 12px;padding:11px 12px;border:1px solid var(--hr2);border-radius:10px;background:rgba(255,255,255,.03)}.permission-card strong,.change-card strong{font-size:11px;color:var(--accent)}.permission-card span,.change-card span{font-size:11px;overflow-wrap:anywhere;color:var(--muted)}.permission-card div,.change-card div{display:flex;gap:6px}.permission-card button,.change-card button{border:1px solid var(--hr2);border-radius:6px;background:transparent;color:var(--vscode-foreground);padding:4px 10px;cursor:pointer;font-size:10px;font-weight:500;transition:background .1s}.permission-card button:hover,.change-card button:hover{background:rgba(255,255,255,.06)}.permission-allow,.change-accept{background:rgba(78,201,176,.12)!important;color:var(--accent)!important;border-color:rgba(78,201,176,.3)!important}.permission-allow:hover,.change-accept:hover{background:var(--accent)!important;color:var(--accent-ink)!important}.change-summary{display:flex;align-items:center;gap:6px}.diff-add{color:#4ec994;font-weight:600}.diff-remove{color:#f47e7e;font-weight:600}
.custom-model-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 12px;border-bottom:1px solid var(--hr);background:color-mix(in srgb,var(--vscode-sideBar-background) 60%,var(--vscode-editor-background))}.custom-model-row input{min-width:0;border:1px solid var(--hr2);border-radius:7px;background:color-mix(in srgb,var(--vscode-sideBar-background) 40%,var(--vscode-editor-background));padding:6px 9px;outline:none;font-size:12px}.custom-model-row input:focus{border-color:rgba(78,201,176,.4)}.custom-model-row .secondary{min-height:28px}
@keyframes signal{0%{transform:translateX(-120%)}70%,100%{transform:translateX(340%)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes dropIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}@media(max-width:260px){.button-row{grid-template-columns:1fr}.setup{padding-inline:10px}}
`;

const redesignStyles = '';

const interactionStyles = '';
const finalStyles = String.raw`.console{display:flex;flex-direction:column;height:calc(100vh - 44px)}.messages{flex:1 1 auto;min-height:0}.status,.custom-model-row{flex:0 0 auto}.composer-shell{flex:0 0 auto;align-self:stretch;min-height:0}.composer-shell textarea{height:28px;min-height:28px;max-height:180px}`;
const bubbleStyles = String.raw`.message.user{display:flex;flex-direction:column;align-items:flex-end}.message.user .label{display:none}.message.user .body{width:max-content;max-width:82%;padding:9px 13px;border-radius:15px 15px 4px 15px;background:#2a2b2d;color:#e5e5e5;text-align:left}.message.assistant{display:block;max-width:100%}.message.assistant .body{max-width:100%}.user-attachments{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;max-width:82%;margin:0 0 7px;order:-1}.user-attachments img{display:block;width:96px;height:96px;object-fit:cover;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:#202124}.user-file{display:inline-flex;align-items:center;max-width:210px;padding:7px 10px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#252628;color:#c9c9c9;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message.user:has(.user-attachments) .body{margin-top:0}`;
const polishStyles = String.raw`.composer-shell,.composer-shell:focus-within{background:#252628!important;border-color:#3b3d40!important;box-shadow:none!important}.composer-shell textarea,.composer-shell textarea:focus,.composer-shell textarea:focus-visible{background:#252628!important;outline:none!important;box-shadow:none!important;border:0!important}.composer-toolbar{justify-content:flex-end}.model-picker{position:relative;flex:1;min-width:90px}.model-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:28px;border:1px solid #45474b;border-radius:7px;background:#2b2d30;color:#d5d5d5;padding:0 9px;font-size:11px;cursor:pointer}.model-trigger:hover{background:#323437}.model-arrow,.perm-arrow{font-size:14px;line-height:1;opacity:.72;transform:translateY(-1px)}.perm-wrap.open .perm-arrow{transform:rotate(180deg)}.model-menu{position:absolute;z-index:60;bottom:calc(100% + 7px);left:0;right:0;min-width:220px;max-height:330px;padding:7px;border:1px solid #45474b;border-radius:12px;background:#242527;box-shadow:0 18px 50px rgba(0,0,0,.55)}.model-menu input{width:100%;height:31px;margin-bottom:6px;border:1px solid #44474b;border-radius:7px;background:#1b1c1e;color:#e1e1e1;padding:0 9px;outline:none}.model-menu input:focus{border-color:#666b71}.model-options{max-height:275px;overflow-y:auto}.model-option{display:block;width:100%;border:0;border-radius:6px;background:transparent;color:#c9c9c9;padding:7px 9px;text-align:left;font-size:11px;cursor:pointer}.model-option:hover,.model-option.active{background:#343639;color:#fff}.modal-backdrop{position:absolute;z-index:100;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.6);backdrop-filter:blur(3px)}.access-dialog{width:min(360px,100%);padding:17px;border:1px solid #484a4e;border-radius:15px;background:#292a2d;box-shadow:0 24px 70px rgba(0,0,0,.62)}.access-dialog strong{display:block;font-size:14px;margin-bottom:7px}.access-dialog p{margin:0 0 16px;color:#aaaeb3;font-size:11px;line-height:1.55}.access-dialog>div{display:flex;justify-content:flex-end;gap:8px}.danger-confirm{min-height:32px;border:1px solid #d6b52c;border-radius:8px;background:#d6b52c;color:#211b00;padding:6px 11px;font-weight:650;cursor:pointer}.context-toggle{display:none!important}`;
const changeStyles = String.raw`.change-tray{flex:0 0 auto;margin:0 10px 8px;border:1px solid #34363a;border-radius:12px;background:#252628;overflow:hidden}.change-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:6px;align-items:center;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px}.change-row>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d7d7d7}.tray-review,.tray-undo,.tray-button,.tray-accept{border:0;border-radius:7px;background:transparent;color:#b8bdc2;padding:5px 7px;cursor:pointer;font-size:10px}.tray-review:hover,.tray-undo:hover,.tray-button:hover{background:#34363a;color:#fff}.change-tray-footer{display:flex;align-items:center;gap:6px;padding:8px 10px;color:#aeb4ba;font-size:10px}.change-tray-footer span{flex:1}.tray-accept{background:#2188d9;color:#fff;font-weight:650}.tray-accept:hover{background:#3198e8}.chat-change-summary{display:flex;align-items:center;gap:8px;margin:4px 0 15px;padding:10px 12px;border:1px solid #34363a;border-radius:11px;background:#252628;color:#c8cbd0;font-size:11px}.chat-change-summary span{flex:1}.chat-change-summary button{border:1px solid #424449;border-radius:7px;background:transparent;color:#d7d7d7;padding:5px 9px;font-size:10px;cursor:pointer}.chat-change-summary button:hover{background:#34363a;color:#fff}`;
const historyStyles = String.raw`.history-panel{position:absolute;z-index:75;top:48px;right:10px;width:min(340px,calc(100% - 20px));max-height:min(520px,calc(100vh - 64px));overflow:hidden;border:1px solid #414347;border-radius:14px;background:#252628;box-shadow:0 22px 65px rgba(0,0,0,.58)}.history-heading{display:flex;align-items:center;padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.07)}.history-heading strong{flex:1;font-size:12px}.history-heading button{width:25px;height:25px;border:0;border-radius:7px;background:transparent;color:#aeb2b6;cursor:pointer;font-size:16px}.history-heading button:hover{background:#343639;color:#fff}.history-list{max-height:450px;overflow:auto;padding:6px}.history-empty{padding:24px 12px;color:#85898e;text-align:center;font-size:11px}.history-item{display:grid;width:100%;gap:2px;border:0;border-radius:9px;background:transparent;color:#d5d7da;padding:9px 10px;text-align:left;cursor:pointer}.history-item:hover{background:#323437}.history-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.history-item time{color:#85898e;font-size:9px}.message .label{margin:6px 0 0!important;color:#777c81!important;font:9px/1.3 var(--vscode-font-family)!important;text-transform:none!important;letter-spacing:0!important}.message.user .label{display:block!important;align-self:flex-end}.message.assistant .label{color:#777c81!important}.attachment-list{padding:0 0 6px}.attachment-preview{position:relative;width:58px;height:58px;border:1px solid #45484c;border-radius:10px;background:#1d1f21;overflow:hidden;cursor:zoom-in}.attachment-preview img{display:block;width:100%;height:100%;object-fit:cover}.attachment-preview button{position:absolute;top:3px;right:3px;width:18px;height:18px;border:0;border-radius:50%;background:rgba(238,238,238,.9);color:#191a1b;line-height:18px;padding:0;cursor:pointer}.user-attachments img{cursor:zoom-in}.image-lightbox{position:absolute;z-index:120;inset:0;display:grid;place-items:center;padding:32px;background:rgba(8,9,10,.86);backdrop-filter:blur(8px)}.image-lightbox img{display:block;max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 22px 70px rgba(0,0,0,.65)}.image-lightbox button{position:absolute;top:14px;right:14px;width:32px;height:32px;border:1px solid #51545a;border-radius:50%;background:#292b2e;color:#f0f0f0;font-size:19px;cursor:pointer}`;
const compactStyles = String.raw`.route-header{padding:7px 10px}.route-meta{flex:1;min-width:72px}.route-meta #connectionLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8cacc;font-size:11px}.header-actions{min-width:0;flex:none;gap:0}.header-action{padding:4px 6px}.empty{margin-top:20vh}.empty h2{font-size:16px;letter-spacing:-.015em}.empty p{max-width:290px;margin:7px auto 0;line-height:1.6}.console{overflow-x:hidden}.config-actions{display:flex;gap:7px}.config-actions .primary{flex:1}.config-actions .secondary{min-width:88px}.mode-switch button.active{background:#f0f1f2!important;color:#17191b!important}.mode-switch button.active:hover{color:#17191b!important}.model-trigger{justify-content:flex-start}.model-menu{left:auto!important;right:0!important;width:280px!important;min-width:0!important;max-width:calc(100vw - 16px)!important}.send{width:32px!important;height:32px!important;background:#f0f1f2!important;color:#17191b!important}.send svg{width:19px;height:19px;display:block}.send:not(:disabled):hover{background:#fff!important;color:#111315!important}.send:disabled{background:#45484d!important;color:#9b9ea3!important;opacity:.58}.composer-actions{gap:7px}.perm-trigger{padding-inline:5px}@media(max-width:360px){#openExternal{display:none}.header-action{padding-inline:5px}.composer-actions{gap:4px}.mode-switch button{padding-inline:7px}.perm-trigger{max-width:88px;overflow:hidden;text-overflow:ellipsis}.send{width:30px!important;height:30px!important}}`;
const providerStyles = String.raw`.config-panel{z-index:90;background:#242527;border-color:#424449;overflow:visible}.provider-field{display:grid;gap:5px;margin:9px 0;color:#a7abb0;font-size:10px}.provider-field>span,#apiKeyField>span{color:#a7abb0}.provider-picker{position:relative}.provider-trigger{display:flex;align-items:center;width:100%;min-height:44px;border:1px solid #46494e;border-radius:9px;background:#2b2d30;color:#e5e6e7;padding:7px 11px;text-align:left;cursor:pointer}.provider-trigger:hover,.provider-picker.open .provider-trigger{background:#303236;border-color:#5a5d62}.provider-trigger>span{display:grid;gap:1px;min-width:0}.provider-trigger strong{font-size:11px;font-weight:600}.provider-trigger small{color:#92979c;font-size:9px}.provider-menu{position:absolute;z-index:110;top:calc(100% + 6px);left:0;right:0;max-height:min(330px,55vh);overflow:auto;padding:6px;border:1px solid #484b50;border-radius:12px;background:#242527;box-shadow:0 20px 54px rgba(0,0,0,.62);animation:dropIn .12s ease-out}.provider-option{display:grid;width:100%;gap:2px;border:0;border-radius:8px;background:transparent;color:#d8dade;padding:8px 10px;text-align:left;cursor:pointer}.provider-option strong{font-size:11px;font-weight:560}.provider-option small{color:#8f949a;font-size:9px}.provider-option:hover{background:#323438}.provider-option.active{background:#393b3f;color:#fff}.provider-option.active small{color:#b4b8bd}.config-panel input:disabled{opacity:.65;cursor:not-allowed;background:#202123}.config-panel .key-state.local{color:#a9adb2}.config-panel .key-state{min-height:15px}.diagnostics-result{margin:10px 0 0;padding:8px 10px;border:1px solid #404247;border-radius:8px;background:#202123;color:#aeb2b7;font-size:10px;line-height:1.45;overflow-wrap:anywhere}.diagnostics-result.checking{color:#b8bcc1}.diagnostics-result.success{border-color:rgba(78,201,176,.28);background:rgba(78,201,176,.07);color:#79d8c5}.diagnostics-result.failure{border-color:rgba(244,126,126,.28);background:rgba(244,126,126,.07);color:#f08c8c}.config-actions .secondary:disabled{opacity:.58;cursor:wait}`;
const advancedStyles = String.raw`.overlay-panel{position:absolute;z-index:95;top:44px;left:8px;right:8px;max-height:calc(100vh - 54px);overflow:auto;padding:14px;border:1px solid #424449;border-radius:15px;background:#242527;box-shadow:0 24px 70px rgba(0,0,0,.68)}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px}.panel-heading>div{display:grid;gap:2px}.panel-heading strong{font-size:13px}.panel-heading span{color:#959a9f;font-size:10px}.profile-bar{display:flex;align-items:flex-end;gap:8px;margin:4px 0 10px}.profile-bar>div{display:grid;gap:5px;min-width:0;flex:1}.profile-bar>div>span{color:#a7abb0;font-size:10px}.profile-list{display:flex;gap:5px;overflow:auto;padding-bottom:2px}.profile-chip{flex:none;border:1px solid #484b50;border-radius:8px;background:#2b2d30;color:#cdd0d3;padding:6px 9px;font-size:10px;cursor:pointer}.profile-chip.active{border-color:#4ec9b0;background:rgba(78,201,176,.12);color:#8ae0cf}.profile-chip:hover{background:#34363a}.profile-new{min-height:29px;padding:5px 9px;font-size:10px}.price-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.config-subactions{display:flex;gap:7px;margin-top:8px}.config-subactions .secondary{flex:1;font-size:10px}.telemetry-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.metric-card{min-width:0;padding:10px;border:1px solid #3d4045;border-radius:10px;background:#2b2d30}.metric-card strong{display:block;color:#f0f1f2;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.metric-card span{color:#92979f;font-size:9px}.telemetry-rate{margin-top:9px;padding:9px 10px;border:1px solid #3d4045;border-radius:9px;background:#202123;color:#bfc3c7;font-size:10px}.telemetry-list{display:grid;gap:5px;margin-top:9px;max-height:270px;overflow:auto}.telemetry-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:7px 8px;border-radius:8px;background:#2b2d30;color:#c9ccd0;font-size:10px}.telemetry-row small{color:#92979f}.telemetry-row b{color:#79d8c5;font-weight:500}.panel-link{margin-top:10px;border:0;background:transparent;color:#999fa5;font-size:10px;cursor:pointer}.panel-link:hover{color:#fff}.mcp-list{display:grid;gap:6px;margin-bottom:13px}.mcp-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #3d4045;border-radius:9px;background:#2b2d30}.mcp-row strong{display:block;font-size:10px}.mcp-row small{color:#92979f;font-size:9px}.mcp-state{font-size:10px;color:#f08c8c}.mcp-state.online{color:#79d8c5}.mcp-remove{border:0;background:transparent;color:#999fa5;cursor:pointer}.mcp-form{display:grid;gap:7px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08)}.mcp-form strong{font-size:11px}.mcp-form input,.mcp-form select{width:100%;height:31px;border:1px solid #45484d;border-radius:7px;background:#1e2022;color:#d7dadd;padding:0 9px;outline:none}.mcp-form input:focus,.mcp-form select:focus{border-color:#4ec9b0}.mcp-form .primary{min-height:31px}.model-check-all{display:block;width:100%;margin:5px 0 6px;border:1px solid #3e4247;border-radius:7px;background:#2b2d30;color:#bfc3c7;padding:6px 8px;text-align:left;font-size:10px;cursor:pointer}.model-check-all:hover{background:#34363a;color:#fff}.model-option{display:flex!important;align-items:center;gap:7px}.model-health{width:13px;flex:none;font-size:11px;color:#777c81}.model-health.ok{color:#79d8c5}.model-health.error{color:#f08c8c}.model-health.checking{color:#d6b52c}.checkpoint-card{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:9px 10px;border:1px solid #3d4045;border-radius:9px;background:#242b29;color:#a9d7cb;font-size:10px}.checkpoint-card span{flex:1}.checkpoint-card button{border:1px solid #53645f;border-radius:6px;background:transparent;color:#c7e5dc;padding:4px 7px;font-size:10px;cursor:pointer}`;
const dropdownFixStyles = String.raw`.model-picker{min-width:0}.model-menu{box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;height:auto;max-height:min(330px,calc(100vh - 86px));min-height:0}.model-menu>input,.model-menu>.model-check-all{flex:0 0 auto}.model-options{flex:1 1 auto;min-height:0;max-height:none!important;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable}.model-option{min-width:0;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.model-option>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-height:460px){.model-menu{max-height:calc(100vh - 72px)}}`;
const mcpGalleryStyles = String.raw`#mcpPanel{background:#202123}.mcp-catalog{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:15px}.mcp-card{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:9px;min-width:0;min-height:62px;padding:9px;border:1px solid #3b3d41;border-radius:12px;background:#292a2d;color:#e1e2e4;text-align:left;cursor:pointer}.mcp-card:hover{border-color:#56595e;background:#303135}.mcp-card:focus-visible{outline:1px solid #878b91;outline-offset:2px}.mcp-card.connected{border-color:rgba(104,215,189,.35);cursor:default}.mcp-card.pending{border-color:rgba(214,181,44,.4)}.mcp-card.failed{border-color:rgba(240,140,140,.38)}.mcp-brand-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid #484a4f;border-radius:9px;background:#1d1e20;color:#f0f1f2}.mcp-brand-icon svg{width:20px;height:20px;display:block}.mcp-card-copy{display:grid;gap:1px;min-width:0}.mcp-card-copy strong{font-size:11px;font-weight:620}.mcp-card-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#92969c;font-size:9px}.mcp-card.failed .mcp-card-copy small{color:#f0a0a0}.mcp-card-state{position:absolute;top:7px;right:7px;width:6px;height:6px;border-radius:50%;background:#62666c}.mcp-card.connected .mcp-card-state{background:#68d7bd;box-shadow:0 0 0 3px rgba(104,215,189,.08)}.mcp-card.pending .mcp-card-state{background:#d6b52c}.mcp-card.failed .mcp-card-state{background:#f08c8c}.mcp-section-label{margin:0 0 7px;color:#85898f;font-size:9px;text-transform:uppercase;letter-spacing:.09em}.mcp-list{margin-bottom:10px}.mcp-row{grid-template-columns:minmax(0,1fr) auto!important}.mcp-row-main{display:flex;align-items:center;gap:8px;min-width:0}.mcp-row-main>span{display:grid;min-width:0}.mcp-row-main strong,.mcp-row-main small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcp-row.has-error .mcp-row-main small{color:#f0a0a0}.mcp-row-actions{display:flex;align-items:center;gap:4px}.mcp-action{border:1px solid #484b50;border-radius:7px;background:transparent;color:#c8cbd0;padding:5px 8px;font-size:9px;cursor:pointer}.mcp-action:hover{background:#36383c;color:#fff}.mcp-action:disabled{opacity:.58;cursor:wait}.mcp-action.login{background:#eceef0;color:#17191b;border-color:#eceef0;font-weight:620}.mcp-action.logout{color:#b0b4b9}.mcp-remove{width:24px;height:24px;border-radius:7px!important}.mcp-custom{border-top:1px solid rgba(255,255,255,.07);padding-top:3px}.mcp-custom summary{padding:9px 1px;color:#aeb2b7;font-size:10px;cursor:pointer}.mcp-custom[open] summary{color:#e1e3e5}.mcp-form{gap:7px!important;padding-top:3px!important;border-top:0!important}.mcp-form input,.mcp-form select{height:32px!important;background:#292a2d!important}.mcp-empty{padding:12px;border:1px dashed #3b3d41;border-radius:10px;color:#85898f;text-align:center;font-size:10px}@media(max-width:330px){.mcp-catalog{grid-template-columns:1fr}.mcp-card{min-height:56px}}`;
const chatExperienceStyles = String.raw`
.message.assistant{color:#d9dade}.message.assistant .body{white-space:normal;line-height:1.78;font-size:13.5px;font-weight:450}.message.assistant .body:empty{display:none}.message.assistant .body p{margin:0 0 13px}.message.assistant .body p:last-child{margin-bottom:0}.message.assistant .body h1,.message.assistant .body h2,.message.assistant .body h3,.message.assistant .body h4{margin:18px 0 9px;color:#f2f3f4;font-size:14px;line-height:1.5;font-weight:760}.message.assistant .body strong{color:#f4f5f6;font-weight:760}.message.assistant .body ul,.message.assistant .body ol{margin:9px 0 15px;padding-left:24px}.message.assistant .body ul{list-style:disc}.message.assistant .body li{margin:7px 0;padding-left:4px}.message.assistant .body li::marker{color:#c3c6ca}.message.assistant .body a,.rich-link{border:0;background:transparent;color:#58aee8;padding:0;text-decoration:none;cursor:pointer;font-weight:650}.message.assistant .body a:hover,.rich-link:hover{text-decoration:underline}.inline-code{display:inline-flex;align-items:center;max-width:100%;border:0;border-radius:6px;background:#303236;color:#edf0f2;padding:1px 6px;font:600 11.5px/1.6 var(--vscode-editor-font-family);vertical-align:baseline}.file-link{display:inline-flex;align-items:baseline;gap:4px;max-width:100%;border:0;background:transparent;color:#58aee8;padding:0;font:650 13px/1.65 var(--vscode-font-family);cursor:pointer;vertical-align:baseline}.file-link:hover{text-decoration:underline}.file-glyph{font:700 11px var(--vscode-editor-font-family);color:#58aee8}.file-line{color:#79b9e5;font-weight:550}.message.assistant pre{margin:13px 0;padding:11px 12px;border:1px solid #35383c;border-radius:11px;background:#202123;overflow:auto;color:#e2e4e6;font:11px/1.62 var(--vscode-editor-font-family)}.message.assistant blockquote{margin:11px 0;padding:3px 0 3px 12px;border-left:2px solid #5b5e63;color:#b1b4b8}.message.error{margin:10px 0 18px}.message.error .body{display:block!important;padding:12px 13px;border:1px solid rgba(240,90,90,.24);border-radius:12px;background:rgba(92,28,28,.28);color:#ff8c8c!important;line-height:1.6;font-weight:520}.message.error .body p{margin:0}.message.error .label{padding-left:4px;color:#a96d6d!important}.message.user .body{font-weight:520;line-height:1.65}.agent-activity{display:grid;gap:7px;margin:0 0 14px}.activity-row{display:flex;align-items:center;gap:8px;min-width:0;color:#969aa0;font-size:11.5px}.activity-icon{display:grid;place-items:center;width:16px;height:16px;flex:none;color:#9da1a7;font:600 9px var(--vscode-editor-font-family)}.activity-copy{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.activity-row.active{color:#bfc2c6}.activity-row.active .activity-icon{border:1px solid #666a70;border-top-color:#d7d9dc;border-radius:50%;font-size:0;animation:spin .8s linear infinite}.activity-row.done .activity-icon{color:#8e9399}.activity-row.stopped{color:#d0a36c}.send.running{opacity:1!important;background:#e1e3e5!important;color:#202123!important}.send.running svg{display:none}.send.running::before{content:"";width:8px;height:8px;border-radius:2px;background:currentColor}.send.running:hover{background:#fff!important}.send.stopping{opacity:.55!important;cursor:wait}.message .label{margin-top:9px}.message.assistant .label{color:#7f8388;text-transform:none;letter-spacing:0;font-weight:450}.composer-shell textarea:disabled{opacity:1;color:var(--vscode-foreground)}
.history-panel.expanded{top:12px;bottom:12px;max-height:none}.history-panel.expanded .history-list{max-height:none;flex:1}.history-panel.expanded{display:flex;flex-direction:column}.history-item-row{display:grid;grid-template-columns:minmax(0,1fr) 28px;gap:3px;align-items:center}.history-item-row .history-item{min-width:0}.history-delete{display:grid;place-items:center;width:27px;height:27px;border:0;border-radius:7px;background:transparent;color:#85898e;cursor:pointer}.history-delete:hover{background:#3a3031;color:#ef9999}.history-delete svg{width:14px;height:14px}.history-view-all{display:block;width:calc(100% - 12px);margin:0 6px 7px;border:0;border-top:1px solid rgba(255,255,255,.07);background:transparent;color:#aeb2b7;padding:9px 10px 4px;text-align:left;font-size:10.5px;cursor:pointer}.history-view-all:hover{color:#fff}.change-tray-footer{flex-wrap:wrap}.change-tray-footer #changeCount{min-width:120px}.chat-change-summary span{cursor:pointer}
.collapsed-changes{display:flex;align-items:center;gap:9px;flex:0 0 auto;margin:0 10px 8px;padding:9px 11px;border:1px solid #35383c;border-radius:11px;background:#242629;color:#c8cbd0;font-size:10.5px}.collapsed-changes span{flex:1}.collapsed-changes button{border:1px solid #44474c;border-radius:7px;background:transparent;color:#d8dade;padding:5px 9px;font-size:10px;cursor:pointer}.collapsed-changes button:hover{background:#333539;color:#fff}.model-check-all.checking{color:#e2c85c;border-color:rgba(226,200,92,.35)}.model-check-all.checking:hover{background:#343128}
.composer-menu{position:absolute;z-index:72;left:10px;right:10px;bottom:calc(100% - 8px);display:grid;gap:2px;max-height:230px;overflow:auto;padding:6px;border:1px solid #46494e;border-radius:12px;background:#25272a;box-shadow:0 18px 48px rgba(0,0,0,.55)}.composer-menu button{display:grid;grid-template-columns:76px 1fr;gap:10px;width:100%;border:0;border-radius:7px;background:transparent;color:#dfe1e3;padding:7px 9px;text-align:left;cursor:pointer}.composer-menu button:hover{background:#34363a}.composer-menu button span:last-child{color:#92979d}.composer-shell{position:relative}.terminal-card{margin:7px 0 14px;border:1px solid #383b40;border-radius:11px;background:#202225;overflow:hidden}.terminal-card summary{display:flex;align-items:center;gap:8px;padding:8px 10px;color:#adb1b6;font-size:10.5px;cursor:pointer;list-style:none}.terminal-card summary::before{content:"›";font-size:15px}.terminal-card[open] summary::before{transform:rotate(90deg)}.terminal-card pre{max-height:190px;margin:0!important;border:0!important;border-top:1px solid #34373b!important;border-radius:0!important;background:#191b1d!important;color:#cbd0d4!important;white-space:pre-wrap}.task-group-label{display:flex;align-items:center;gap:5px;padding:8px 6px 4px;color:#858a90;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.task-group-label span{flex:1}.task-group-label button{border:0;background:transparent;color:#aeb2b7;font-size:9px;text-transform:none;letter-spacing:0;cursor:pointer}.task-group-label button:hover{color:#fff}.model-favorite{margin-left:auto;border:0;background:transparent;color:#656a70;font-size:13px;cursor:pointer}.model-favorite.active{color:#e0c761}.model-option-label{min-width:0;overflow:hidden;text-overflow:ellipsis}.onboarding-card{margin:12px 10px;padding:12px 13px;border:1px solid #3b3e42;border-radius:12px;background:#242629;color:#c8cbd0;line-height:1.6}.onboarding-card strong{display:block;color:#f0f1f2;margin-bottom:3px}
.sandbox-wrap{position:relative;min-width:0}.sandbox-trigger{height:26px;border:0;border-radius:7px;background:transparent;color:#9da2a8;padding:0 5px;font-size:10px;cursor:pointer}.sandbox-trigger:hover,.sandbox-wrap.open .sandbox-trigger{background:#303236;color:#e5e7e9}.sandbox-trigger.active{color:#7bd5c0}.sandbox-menu{position:absolute;z-index:78;left:0;bottom:calc(100% + 7px);width:270px;max-width:calc(100vw - 28px);padding:6px;border:1px solid #46494e;border-radius:12px;background:#25272a;box-shadow:0 20px 55px rgba(0,0,0,.6)}.sandbox-menu button{display:grid;width:100%;gap:2px;border:0;border-radius:8px;background:transparent;color:#d9dbde;padding:8px 9px;text-align:left;cursor:pointer}.sandbox-menu button:hover,.sandbox-menu button.active{background:#34363a}.sandbox-menu strong{font-size:10.5px}.sandbox-menu span{color:#8f949a;font-size:9px}.sandbox-menu .sandbox-check{margin-top:4px;border-top:1px solid #3a3d41;border-radius:0;padding-top:10px}.change-review-dialog{display:flex;flex-direction:column;width:min(560px,100%);max-height:min(720px,88vh);border:1px solid #494c51;border-radius:15px;background:#232528;box-shadow:0 25px 75px rgba(0,0,0,.7);overflow:hidden}.change-review-dialog>header{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid #373a3e}.change-review-dialog>header>div{display:grid;min-width:0;flex:1}.change-review-dialog header strong{font-size:12px}.change-review-dialog header span{color:#92979d;font-size:9px}.change-review-dialog header button{border:0;background:transparent;color:#aeb2b7;font-size:18px;cursor:pointer}.hunk-list{display:grid;gap:9px;min-height:80px;overflow:auto;padding:11px}.hunk-card{border:1px solid #3a3d42;border-radius:11px;background:#1d1f21;overflow:hidden}.hunk-card header{display:flex;align-items:center;gap:8px;padding:7px 9px;border-bottom:1px solid #34373b;color:#9da2a8;font:9px var(--vscode-editor-font-family)}.hunk-card header span{flex:1}.hunk-card header button{border:0;border-radius:6px;background:transparent;color:#c5c8cc;padding:4px 7px;font-size:9px;cursor:pointer}.hunk-card header button:hover{background:#35383c;color:#fff}.hunk-lines{max-height:220px;overflow:auto;padding:6px 0;font:10px/1.55 var(--vscode-editor-font-family)}.hunk-line{display:grid;grid-template-columns:16px minmax(0,1fr);padding:1px 8px;white-space:pre-wrap;overflow-wrap:anywhere}.hunk-line.add{background:rgba(73,173,129,.1);color:#9cdbb9}.hunk-line.remove{background:rgba(211,86,86,.1);color:#e6a0a0}.change-review-dialog>footer{display:flex;justify-content:flex-end;padding:10px 12px;border-top:1px solid #373a3e}.context-meter{height:2px;background:#373a3e;overflow:hidden}.context-meter i{display:block;height:100%;background:#777c82}.context-meter.compacted i{background:#d0aa54}
.sandbox-report{margin:2px 12px 12px;color:#858a90;font-size:10px}
`;

const script = String.raw`
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
$('uiLanguage').value = document.body.dataset.language === 'en' ? 'en' : 'vi';
$('uiLanguage').addEventListener('change', () => {
  vscode.postMessage({ type: 'setLanguage', language: $('uiLanguage').value });
});
let mode = 'agent';
let running = false;
let assistantBody = null;
let launchingRouter = false;
let changeSummary = null;
let activeProvider = '9router';
let pendingAssistantText = '';
let typingTimer = 0;
let assistantRawText = '';
let assistantActivity = null;
let activitySteps = new Map();
let pendingTurnEnd = null;
let currentProfileId = '';
let profiles = [];
let modelHealth = {};
let providerChanged = false;
let allSessions = [];
let historyExpanded = false;
let changesHidden = false;
let lastChangeCount = 0;
let checkingModels = false;
let favoriteModels = [];
let recentModels = [];
let activeTerminal = null;
let sandboxMode = 'preferred';
let currentReviewId = '';
let sandboxWasActive = false;
const providerMeta = {
  '9router': { label: '9Router', hint: 'Gateway local, nhiều model', endpoint: 'http://localhost:20128/v1', keyLabel: '9Router API key', local: false },
  openai: { label: 'OpenAI', hint: 'API chính thức · cần API key', endpoint: 'https://api.openai.com/v1', keyLabel: 'OpenAI API key', local: false },
  anthropic: { label: 'Anthropic Claude', hint: 'Messages API · cần API key', endpoint: 'https://api.anthropic.com/v1', keyLabel: 'Anthropic API key', local: false },
  'openai-compatible': { label: 'OpenAI-compatible', hint: 'Endpoint tùy chỉnh', endpoint: '', keyLabel: 'API key', local: false },
  ollama: { label: 'Ollama', hint: 'Local · không cần API key', endpoint: 'http://localhost:11434/v1', keyLabel: 'API key', local: true },
  'lm-studio': { label: 'LM Studio', hint: 'Local · không cần API key', endpoint: 'http://localhost:1234/v1', keyLabel: 'API key', local: true }
};
const knownProviderEndpoints = new Set(Object.values(providerMeta).map(item => item.endpoint).filter(Boolean));

function flushAssistantText() {
  if (typingTimer) { clearTimeout(typingTimer); typingTimer = 0; }
  if (assistantBody && pendingAssistantText) {
    assistantRawText += pendingAssistantText;
    renderMarkdownInto(assistantBody, assistantRawText);
  }
  pendingAssistantText = '';
}

function queueAssistantText(delta) {
  pendingAssistantText += delta;
  if (typingTimer) return;
  const tick = () => {
    if (!assistantBody) { pendingAssistantText = ''; typingTimer = 0; return; }
    const size = Math.min(3, pendingAssistantText.length);
    assistantRawText += pendingAssistantText.slice(0, size);
    pendingAssistantText = pendingAssistantText.slice(size);
    renderMarkdownInto(assistantBody, assistantRawText);
    $('messages').scrollTop = $('messages').scrollHeight;
    if (pendingAssistantText) typingTimer = setTimeout(tick, 10);
    else {
      typingTimer = 0;
      if (pendingTurnEnd) {
        const data = pendingTurnEnd;
        pendingTurnEnd = null;
        finishTurn(data);
      }
    }
  };
  typingTimer = setTimeout(tick, 0);
}

function setMode(next) {
  mode = next;
  document.querySelectorAll('.mode-switch [data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
    button.setAttribute('aria-selected', String(button.dataset.mode === mode));
  });
  $('prompt').placeholder = mode === 'agent'
    ? 'Nhập yêu cầu sửa, chạy hoặc kiểm tra code…'
    : mode === 'plan' ? 'Mô tả mục tiêu để Agent lập kế hoạch…' : 'Hỏi nhanh qua model đang chọn…';
}

function setProvider(next, changeEndpoint = true) {
  const meta = providerMeta[next] || providerMeta['9router'];
  const previous = $('configProvider').value;
  $('configProvider').value = next;
  $('providerLabel').textContent = meta.label;
  $('providerHint').textContent = meta.hint;
  $('apiKeyLabel').textContent = meta.keyLabel;
  document.querySelectorAll('#providerMenu .provider-option').forEach(option => option.classList.toggle('active', option.dataset.provider === next));
  const keyInput = $('configApiKey');
  keyInput.disabled = meta.local;
  keyInput.placeholder = meta.local ? 'Provider local không dùng API key' : 'Nhập key mới hoặc để trống để giữ key đã lưu';
  $('apiKeyField').classList.toggle('local', meta.local);
  if (previous !== next) {
    providerChanged = true;
    keyInput.value = '';
    $('diagnosticsResult').textContent = '';
    $('diagnosticsResult').className = 'diagnostics-result hidden';
  }
  if (meta.local) {
    $('keyState').textContent = 'Không cần API key · server local vẫn phải đang chạy';
    $('keyState').classList.add('local');
    $('keyState').classList.remove('saved');
  } else {
    $('keyState').textContent = 'API key được lưu riêng và an toàn cho provider này';
    $('keyState').classList.remove('local');
  }
  if (changeEndpoint) {
    const current = $('configEndpoint').value.trim();
    if (!current || knownProviderEndpoints.has(current)) $('configEndpoint').value = meta.endpoint;
  }
}

function setPermissionMode(next) {
  const btn = $('permissionMode');
  btn.dataset.mode = next;
  $('permLabel').textContent = next === 'full' ? 'Quyền: Full access' : next === 'edit' ? 'Quyền: Sửa file' : 'Quyền: Hỏi';
  btn.classList.toggle('full', next === 'full');
  document.querySelectorAll('#permMenu .perm-opt').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.perm === next);
  });
}

function setSandboxMode(next) {
  sandboxMode = next;
  const labels = { required: 'Sandbox bắt buộc', preferred: 'Sandbox ưu tiên', direct: 'Chạy trực tiếp' };
  $('sandboxLabel').textContent = labels[next] || labels.preferred;
  $('sandboxMode').classList.toggle('active', next !== 'direct');
  document.querySelectorAll('[data-sandbox]').forEach(button => button.classList.toggle('active', button.dataset.sandbox === next));
}

function renderChangeReview(data) {
  currentReviewId = data.id;
  $('changeReviewTitle').textContent = data.path;
  $('changeReviewMeta').textContent = (data.staged ? 'Đang staging trong sandbox' : 'Đã áp dụng trong workspace') + ' · ' + data.hunks.length + ' hunk';
  const list = $('hunkList'); list.replaceChildren();
  for (const hunk of data.hunks) {
    const card = document.createElement('article'); card.className = 'hunk-card';
    const header = document.createElement('header');
    const location = document.createElement('span'); location.textContent = '@@ -' + (hunk.originalStart + 1) + ',' + hunk.originalCount + ' +' + (hunk.updatedStart + 1) + ',' + hunk.updatedCount + ' @@';
    const undo = document.createElement('button'); undo.type = 'button'; undo.textContent = 'Undo hunk';
    const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = 'Accept hunk';
    undo.addEventListener('click', () => vscode.postMessage({ type: 'applyChangeHunk', id: data.id, hunkId: hunk.id, action: 'undo' }));
    accept.addEventListener('click', () => vscode.postMessage({ type: 'applyChangeHunk', id: data.id, hunkId: hunk.id, action: 'accept' }));
    header.append(location, undo, accept);
    const lines = document.createElement('div'); lines.className = 'hunk-lines';
    for (const value of hunk.before) {
      const line = document.createElement('div'); line.className = 'hunk-line remove';
      const mark = document.createElement('span'); mark.textContent = '−';
      const copy = document.createElement('span'); copy.textContent = value;
      line.append(mark, copy); lines.append(line);
    }
    for (const value of hunk.after) {
      const line = document.createElement('div'); line.className = 'hunk-line add';
      const mark = document.createElement('span'); mark.textContent = '+';
      const copy = document.createElement('span'); copy.textContent = value;
      line.append(mark, copy); lines.append(line);
    }
    card.append(header, lines); list.append(card);
  }
  $('changeReviewPanel').classList.remove('hidden');
}

function renderModelMenu(query = '') {
  const list = $('modelOptions'); list.replaceChildren();
  const needle = query.trim().toLowerCase();
  const options = [...$('model').options]
    .filter(option => option.value && option.value !== '__custom__' && (!needle || option.text.toLowerCase().includes(needle)))
    .sort((left, right) => {
      const leftRank = favoriteModels.includes(left.value) ? 0 : recentModels.includes(left.value) ? 1 : 2;
      const rightRank = favoriteModels.includes(right.value) ? 0 : recentModels.includes(right.value) ? 1 : 2;
      return leftRank - rightRank || left.text.localeCompare(right.text);
    });
  for (const option of options) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'model-option';
    const health = document.createElement('span'); health.className = 'model-health ' + (modelHealth[option.value]?.status || ''); health.textContent = modelHealth[option.value]?.status === 'ok' ? '✓' : modelHealth[option.value]?.status === 'error' ? '×' : modelHealth[option.value]?.status === 'checking' ? '…' : '·';
    const label = document.createElement('span'); label.className = 'model-option-label'; label.textContent = option.text;
    const favorite = document.createElement('span'); favorite.className = 'model-favorite' + (favoriteModels.includes(option.value) ? ' active' : ''); favorite.textContent = '★'; favorite.title = favoriteModels.includes(option.value) ? 'Bỏ yêu thích' : 'Yêu thích'; favorite.setAttribute('role', 'button'); favorite.tabIndex = 0;
    favorite.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'toggleFavoriteModel', model: option.value }); });
    button.append(health, label, favorite); button.title = modelHealth[option.value]?.message || '';
    button.classList.toggle('active', option.value === $('model').value);
    button.addEventListener('click', () => { $('model').value = option.value; $('model').dispatchEvent(new Event('change')); $('modelMenu').classList.add('hidden'); });
    list.append(button);
  }
}

function renderProfiles() {
  const list = $('profileList'); list.replaceChildren();
  for (const profile of profiles) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'profile-chip'; button.textContent = profile.name;
    button.classList.toggle('active', profile.id === currentProfileId); button.title = profile.endpoint;
    button.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'activateProfile', id: profile.id }); });
    list.append(button);
  }
}

function applyProfileUi(profile) {
  if (!profile) return;
  currentProfileId = profile.id;
  $('profileName').value = profile.name || '';
  $('configEndpoint').value = profile.endpoint || '';
  $('inputPrice').value = profile.inputPricePerMillion ?? '';
  $('outputPrice').value = profile.outputPricePerMillion ?? '';
  setProvider(profile.kind, false);
  renderProfiles();
}

function formatCompact(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, notation: 'compact' }).format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function inlineMarkdown(source) {
  const tokens = [];
  const reserve = (html) => {
    const token = '\u0000' + tokens.length + '\u0000';
    tokens.push(html);
    return token;
  };
  let text = escapeHtml(source);
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawTarget) => {
    const target = String(rawTarget).replace(/&amp;/g, '&');
    if (/^https?:\/\//i.test(target)) {
      return reserve('<button type="button" class="rich-link" data-url="' + encodeURIComponent(target) + '">' + label + '</button>');
    }
    const location = target.match(/:(\d+)(?::\d+)?$/);
    const line = location && !/\bline\s+\d+/i.test(label) ? '<span class="file-line">(line ' + location[1] + ')</span>' : '';
    return reserve('<button type="button" class="file-link" data-file="' + encodeURIComponent(target) + '"><span class="file-glyph">▧</span><span>' + label + '</span>' + line + '</button>');
  });
  text = text.replace(/\x60([^\x60]+)\x60/g, (_, code) => {
    const plain = String(code).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const looksLikeFile = /^(?:[a-z]:[\\/]|\.{0,2}[\\/])?.+\.[a-z0-9]{1,10}(?::\d+(?::\d+)?)?$/i.test(plain);
    return reserve(looksLikeFile
      ? '<button type="button" class="file-link" data-file="' + encodeURIComponent(plain) + '"><span class="file-glyph">▧</span><span>' + code + '</span></button>'
      : '<code class="inline-code">' + code + '</code>');
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (_, prefix, url) => prefix + reserve('<button type="button" class="rich-link" data-url="' + encodeURIComponent(url) + '">' + url + '</button>'));
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
}

function bindRichContent(container) {
  container.querySelectorAll('[data-url]').forEach((item) => item.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternal', url: decodeURIComponent(item.dataset.url) });
  }));
  container.querySelectorAll('[data-file]').forEach((item) => item.addEventListener('click', () => {
    vscode.postMessage({ type: 'openFile', path: decodeURIComponent(item.dataset.file) });
  }));
}

function renderMarkdownInto(container, source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let list = '';
  let paragraph = [];
  let code = [];
  let inCode = false;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += '<p>' + paragraph.map(inlineMarkdown).join('<br>') + '</p>';
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    html += '</' + list + '>';
    list = '';
  };
  for (const line of lines) {
    if (/^\s*\x60{3}/.test(line)) {
      flushParagraph(); closeList();
      if (inCode) {
        html += '<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>';
        code = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const nextList = bullet ? 'ul' : 'ol';
      if (list !== nextList) { closeList(); list = nextList; html += '<' + list + '>'; }
      html += '<li>' + inlineMarkdown((bullet || numbered)[1]) + '</li>';
      continue;
    }
    closeList();
    const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(4, heading[1].length + 1);
      html += '<h' + level + '>' + inlineMarkdown(heading[2]) + '</h' + level + '>';
      continue;
    }
    const quote = line.match(/^\s*>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      html += '<blockquote>' + inlineMarkdown(quote[1]) + '</blockquote>';
      continue;
    }
    if (!line.trim()) { flushParagraph(); continue; }
    paragraph.push(line);
  }
  flushParagraph(); closeList();
  if (inCode || code.length) html += '<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>';
  container.innerHTML = html;
  bindRichContent(container);
}

function activityInfo(status) {
  if (/chạy lệnh/i.test(status)) return { kind: 'command', icon: '>_', done: 'Đã chạy lệnh' };
  if (/chạy kiểm tra/i.test(status)) return { kind: 'test', icon: '✓', done: 'Đã chạy kiểm tra' };
  if (/sửa file/i.test(status)) return { kind: 'edit', icon: '✎', done: 'Đã sửa file' };
  if (/đọc file|cấu trúc dự án|tìm trong dự án/i.test(status)) return { kind: 'inspect', icon: '⌕', done: 'Đã đọc workspace' };
  if (/MCP/i.test(status)) return { kind: 'mcp', icon: '◇', done: 'Đã dùng công cụ MCP' };
  return { kind: 'thinking', icon: '·', done: 'Đã phân tích yêu cầu' };
}

function updateActivity(status) {
  if (!assistantBody || !status || status === 'Hoàn tất') return;
  const info = activityInfo(status);
  if (!assistantActivity) {
    assistantActivity = document.createElement('div');
    assistantActivity.className = 'agent-activity';
    assistantBody.closest('.message')?.insertBefore(assistantActivity, assistantBody);
  }
  assistantActivity.querySelectorAll('.activity-row.active').forEach((row) => row.classList.remove('active'));
  let row = activitySteps.get(info.kind);
  if (!row) {
    row = document.createElement('div');
    row.className = 'activity-row';
    row.dataset.done = info.done;
    row.innerHTML = '<span class="activity-icon"></span><span class="activity-copy"></span>';
    activitySteps.set(info.kind, row);
    assistantActivity.append(row);
  }
  row.querySelector('.activity-icon').textContent = info.icon;
  row.querySelector('.activity-copy').textContent = status;
  row.classList.remove('done', 'stopped');
  row.classList.add('active');
  $('messages').scrollTop = $('messages').scrollHeight;
}

function completeActivity(cancelled = false) {
  if (!assistantActivity) return;
  const rows = [...assistantActivity.querySelectorAll('.activity-row')];
  for (const row of rows) {
    if (row.dataset.done === 'Đã phân tích yêu cầu' && rows.length > 1) { row.remove(); continue; }
    row.classList.remove('active');
    row.classList.add(cancelled ? 'stopped' : 'done');
    row.querySelector('.activity-copy').textContent = cancelled ? 'Đã dừng theo yêu cầu' : row.dataset.done;
    if (cancelled) row.querySelector('.activity-icon').textContent = '■';
  }
}

function renderTelemetry(records = []) {
  const totalInput = records.reduce((sum, item) => sum + (item.inputTokens || 0), 0);
  const totalOutput = records.reduce((sum, item) => sum + (item.outputTokens || 0), 0);
  const costs = records.filter(item => typeof item.cost === 'number').reduce((sum, item) => sum + item.cost, 0);
  const avgLatency = records.length ? Math.round(records.reduce((sum, item) => sum + (item.latencyMs || 0), 0) / records.length) : 0;
  $('telemetrySummary').innerHTML = '<div class="metric-card"><strong>' + formatCompact(totalInput + totalOutput) + '</strong><span>Tổng token</span></div><div class="metric-card"><strong>' + (costs ? '$' + costs.toFixed(4) : 'Chưa có') + '</strong><span>Chi phí ước tính</span></div><div class="metric-card"><strong>' + avgLatency + ' ms</strong><span>Latency trung bình</span></div>';
  const latest = records[0]?.rateLimit;
  $('telemetryRate').textContent = latest ? 'Rate limit · requests ' + (latest.requestsRemaining || '?') + ' / ' + (latest.requestsLimit || '?') + ' · tokens ' + (latest.tokensRemaining || '?') + ' / ' + (latest.tokensLimit || '?') + ' · reset ' + (latest.reset || '?') : 'Chưa nhận được header rate limit từ provider.';
  const list = $('telemetryList'); list.replaceChildren();
  for (const item of records.slice(0, 40)) {
    const row = document.createElement('div'); row.className = 'telemetry-row';
    row.innerHTML = '<span><strong>' + escapeHtml(item.model) + '</strong><small>' + escapeHtml(item.profileName) + ' · ' + formatTime(item.timestamp) + '</small></span><b>' + formatCompact((item.inputTokens || 0) + (item.outputTokens || 0)) + ' tok</b><small>' + (item.latencyMs || 0) + ' ms</small>';
    list.append(row);
  }
}

function mcpIcon(kind) {
  if (kind === 'notion') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.8 16.8 4l2.2 1.7v13.1L7.1 20 5 18.3V4.8Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 8h2.2l5 7.6V8H17M8 16V8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  if (kind === 'linear') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 14.2a7.2 7.2 0 0 0 4.6 4.6M5.1 10.5l8.4 8.4M6.6 7.2l10.2 10.2M9.6 5.2l9.2 9.2M13.6 5.1a7.2 7.2 0 0 1 5.3 5.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  if (kind === 'figma') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4.5h3.5v5H8.5a2.5 2.5 0 1 1 0-5Zm3.5 0h3.5a2.5 2.5 0 1 1 0 5H12v-5Zm0 5h3.5a2.5 2.5 0 1 1 0 5H12v-5Zm-3.5 0H12v5H8.5a2.5 2.5 0 1 1 0-5Zm0 5H12V18a3.5 3.5 0 1 1-3.5-3.5Z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>';
  if (kind === 'stitch') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill="currentColor"/></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a7.5 7.5 0 1 1-6.8 4.3M12 8a4 4 0 1 1-3.7 2.5M12 11.3a.8.8 0 1 1-.8.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
}

function renderMcpCatalog(presets = [], servers = []) {
  const catalog = $('mcpCatalog'); catalog.replaceChildren();
  for (const preset of presets) {
    const server = servers.find(item => item.catalogId === preset.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mcp-card' + (server?.connected ? ' connected' : server?.authPending ? ' pending' : server?.error ? ' failed' : '');
    card.title = server?.error || (server?.connected ? preset.name + ' đã kết nối' : preset.authMode === 'api-key' ? 'Mở trang tạo API key' : 'Đăng nhập ' + preset.name);
    const cardStatus = server?.connected
      ? (server.toolCount || 0) + ' công cụ sẵn sàng'
      : server?.authPending
        ? 'Đang chờ đăng nhập'
          : server?.error
            ? server.error
          : server?.hasToken
          ? 'Có API key · cần kết nối lại'
          : preset.description;
    card.innerHTML = '<span class="mcp-brand-icon">' + mcpIcon(preset.icon) + '</span><span class="mcp-card-copy"><strong>' + escapeHtml(preset.name) + '</strong><small>' + escapeHtml(cardStatus) + '</small></span><i class="mcp-card-state"></i>';
    card.addEventListener('click', () => {
      if (server?.connected) return;
      if (preset.authMode === 'api-key') {
        vscode.postMessage({ type: server ? 'configureMcpApiKey' : 'installMcpPreset', ...(server ? { id: server.id } : { presetId: preset.id }) });
        return;
      }
      if (server?.authMode === 'none') vscode.postMessage({ type: 'reconnectMcp', id: server.id });
      else if (server?.hasOAuthTokens) vscode.postMessage({ type: 'loginMcp', id: server.id });
      else vscode.postMessage({ type: 'installMcpPreset', presetId: preset.id });
    });
    catalog.append(card);
  }
}

function renderMcpServers(servers = [], presets = []) {
  renderMcpCatalog(presets, servers);
  const list = $('mcpList'); list.replaceChildren();
  if (!servers.length) { list.innerHTML = '<div class="mcp-empty">Chọn một dịch vụ ở trên hoặc thêm MCP riêng.</div>'; return; }
  for (const server of servers) {
    const row = document.createElement('div'); row.className = 'mcp-row' + (server.error ? ' has-error' : '');
    const main = document.createElement('div'); main.className = 'mcp-row-main';
    const iconKind = presets.find(item => item.id === server.catalogId)?.icon || 'sentry';
    const icon = document.createElement('span'); icon.className = 'mcp-brand-icon'; icon.innerHTML = mcpIcon(iconKind);
    const info = document.createElement('span');
    const stateText = server.connected
      ? (server.toolCount || 0) + ' tools · Đã kết nối'
      : server.error
        ? server.error
      : server.authPending
        ? 'Đang chờ đăng nhập trên trình duyệt'
        : server.hasOAuthTokens
          ? 'Cần kết nối lại'
          : server.authMode === 'oauth' ? 'Chưa đăng nhập' : 'Ngoại tuyến';
    info.innerHTML = '<strong>' + escapeHtml(server.name) + '</strong><small>' + escapeHtml(stateText) + '</small>';
    info.title = server.error || '';
    main.append(icon, info);

    const actions = document.createElement('div'); actions.className = 'mcp-row-actions';
    if (server.authMode === 'oauth') {
      const auth = document.createElement('button'); auth.type = 'button';
      auth.className = 'mcp-action ' + (server.hasOAuthTokens ? 'logout' : 'login');
      auth.textContent = server.hasOAuthTokens ? 'Đăng xuất' : (server.authPending ? 'Đang mở…' : 'Đăng nhập');
      auth.disabled = Boolean(server.authPending);
      auth.addEventListener('click', () => vscode.postMessage({ type: server.hasOAuthTokens ? 'logoutMcp' : 'loginMcp', id: server.id }));
      actions.append(auth);
    } else if (server.authMode === 'api-key') {
      const key = document.createElement('button'); key.type = 'button'; key.className = 'mcp-action ' + (server.hasToken ? 'logout' : 'login');
      key.textContent = server.hasToken ? 'Đổi key' : 'Nhập key';
      key.addEventListener('click', () => vscode.postMessage({ type: 'configureMcpApiKey', id: server.id }));
      actions.append(key);
    } else if (!server.connected) {
      const reconnect = document.createElement('button'); reconnect.type = 'button'; reconnect.className = 'mcp-action login';
      reconnect.textContent = 'Kết nối lại';
      reconnect.addEventListener('click', () => vscode.postMessage({ type: 'reconnectMcp', id: server.id }));
      actions.append(reconnect);
    }
    const remove = document.createElement('button'); remove.className = 'mcp-remove'; remove.type = 'button'; remove.title = 'Xóa MCP'; remove.textContent = '×'; remove.addEventListener('click', () => vscode.postMessage({ type: 'removeMcpServer', id: server.id }));
    actions.append(remove);
    row.append(main, actions); list.append(row);
  }
}

function showSetup(show) {
  $('setup').classList.toggle('hidden', !show);
  $('console').classList.toggle('hidden', show);
}

function showError(message) {
  $('setupError').textContent = message || '';
  $('setupError').classList.toggle('hidden', !message);
}

function setRouterLaunchState(state, message) {
  launchingRouter = state !== 'ready' && state !== 'idle';
  $('startRouter').disabled = launchingRouter;
  $('startRouter').textContent = launchingRouter ? message : 'Kết nối 9Router';
  $('signalMap').classList.toggle('launching', launchingRouter);
  $('signalMap').classList.toggle('ready', state === 'ready');
  document.querySelector('.launch-panel').classList.toggle('launching', launchingRouter);
  document.querySelector('.launch-panel').classList.toggle('ready', state === 'ready');
  if (message) $('launchTitle').textContent = message;
}

function formatTime(value = Date.now()) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function openImage(source) {
  $('lightboxImage').src = source;
  $('imageLightbox').classList.remove('hidden');
}

function appendMessageAttachments(item, attachments) {
  if (!attachments?.length) return;
  const gallery = document.createElement('div'); gallery.className = 'user-attachments';
  for (const attachment of attachments) {
    if (attachment.preview) {
      const img = document.createElement('img'); img.src = attachment.preview; img.alt = attachment.name;
      img.addEventListener('click', () => openImage(attachment.preview));
      gallery.append(img);
    } else {
      const file = document.createElement('span'); file.className = 'user-file'; file.textContent = attachment.name; gallery.append(file);
    }
  }
  item.append(gallery);
}

function renderHistory(sessions = []) {
  allSessions = sessions;
  $('historyPanel').classList.toggle('expanded', historyExpanded);
  $('historyTitle').textContent = historyExpanded ? 'Tất cả lịch sử' : 'Lịch sử chat';
  const list = $('historyList'); list.replaceChildren();
  if (!sessions.length) {
    const empty = document.createElement('div'); empty.className = 'history-empty'; empty.textContent = 'Chưa có cuộc trò chuyện nào.'; list.append(empty);
    $('viewAllHistory').classList.add('hidden');
    return;
  }
  const visible = historyExpanded ? sessions : sessions.slice(0, 5);
  for (const session of visible) {
    const row = document.createElement('div'); row.className = 'history-item-row';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'history-item';
    const title = document.createElement('span'); title.textContent = session.title;
    const time = document.createElement('time'); time.textContent = new Date(session.updatedAt).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    button.append(title, time);
    button.addEventListener('click', () => { $('historyPanel').classList.add('hidden'); vscode.postMessage({ type: 'loadSession', id: session.id }); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'history-delete'; remove.title = 'Xóa cuộc trò chuyện'; remove.setAttribute('aria-label', 'Xóa cuộc trò chuyện');
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12M10 10v6m4-6v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    remove.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'deleteSession', id: session.id }); });
    row.append(button, remove);
    list.append(row);
  }
  $('viewAllHistory').classList.toggle('hidden', historyExpanded || sessions.length <= 5);
}

function appendMessage(role, content, error = false, timestamp = Date.now(), attachments = []) {
  document.querySelector('.empty')?.remove();
  const item = document.createElement('article');
  item.className = 'message ' + role + (error ? ' error' : '');
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = formatTime(timestamp);
  const body = document.createElement('div');
  body.className = 'body';
  if (role === 'assistant') renderMarkdownInto(body, content);
  else body.textContent = content;
  item.append(body, label);
  appendMessageAttachments(item, attachments);
  $('messages').append(item);
  $('messages').scrollTop = $('messages').scrollHeight;
  return body;
}

function appendTerminalOutput(data) {
  if (!assistantBody) return;
  if (!activeTerminal || activeTerminal.dataset.command !== (data.command || '')) {
    activeTerminal = document.createElement('details');
    activeTerminal.className = 'terminal-card';
    activeTerminal.open = true;
    activeTerminal.dataset.command = data.command || '';
    const summary = document.createElement('summary');
    summary.textContent = (data.command || 'Terminal') + ' · đang chạy';
    const output = document.createElement('pre');
    activeTerminal.append(summary, output);
    assistantBody.before(activeTerminal);
  }
  const output = activeTerminal.querySelector('pre');
  output.textContent = (output.textContent + data.chunk).slice(-20000);
  activeTerminal.querySelector('summary').textContent = (data.command || 'Terminal') + ' · ' + Math.max(1, Math.round((data.elapsedMs || 0) / 1000)) + 's';
  output.scrollTop = output.scrollHeight;
  $('messages').scrollTop = $('messages').scrollHeight;
}

function setRunning(value, text = '') {
  running = value;
  const button = $('send');
  button.classList.toggle('running', value);
  button.classList.remove('stopping');
  button.setAttribute('aria-label', value ? 'Dừng phản hồi' : 'Gửi');
  button.title = value ? 'Dừng' : 'Gửi';
  updateSendState();
}

function finishTurn(data) {
  completeActivity(Boolean(data.cancelled));
  if (activeTerminal) {
    const summary = activeTerminal.querySelector('summary');
    if (summary) summary.textContent = activeTerminal.dataset.command + (data.cancelled ? ' · đã dừng' : ' · hoàn tất');
    activeTerminal.open = false;
  }
  if (data.error) {
    if (assistantBody && !assistantRawText && !assistantActivity?.children.length) assistantBody.closest('.message')?.remove();
    appendMessage('assistant', data.error, true, data.timestamp);
  } else if (data.cancelled && assistantBody && !assistantRawText && !assistantActivity?.children.length) {
    renderMarkdownInto(assistantBody, 'Đã dừng.');
  } else if (assistantBody) {
    const label = assistantBody.closest('.message')?.querySelector('.label');
    if (label) label.textContent = formatTime(data.timestamp);
  }
  assistantBody = null;
  assistantRawText = '';
  assistantActivity = null;
  activeTerminal = null;
  activitySteps = new Map();
  pendingTurnEnd = null;
  setRunning(false);
  $('prompt').focus();
}

function updateSendState() {
  $('send').disabled = running ? false : !$('prompt').value.trim();
}

function renderComposerMenu() {
  const value = $('prompt').value;
  const menu = $('composerMenu');
  const slash = [
    ['/new', 'Cuộc chat mới'],
    ['/models', 'Mở danh sách model'],
    ['/diagnostics', 'Kiểm tra kết nối'],
    ['/mcp', 'Mở công cụ MCP'],
    ['/settings', 'Mở cấu hình'],
    ['/logs', 'Mở Output Channel'],
    ['/export', 'Xuất gói chẩn đoán']
  ];
  const mentions = [
    ['@selection', 'Đoạn code đang chọn'],
    ['@file:', 'Một file trong workspace'],
    ['@folder:', 'Cây file của thư mục'],
    ['@terminal', 'Output terminal gần nhất'],
    ['@git-diff', 'Thay đổi Git hiện tại'],
    ['@problems', 'Problems của workspace']
  ];
  const source = value.startsWith('/') ? slash : /(^|\s)@[^\s]*$/.test(value) ? mentions : [];
  const needle = value.startsWith('/') ? value.toLowerCase() : (value.match(/@[^\s]*$/)?.[0] || '').toLowerCase();
  const filtered = source.filter(([key]) => key.toLowerCase().startsWith(needle));
  menu.replaceChildren();
  for (const [key, description] of filtered) {
    const button = document.createElement('button'); button.type = 'button';
    const command = document.createElement('span'); command.textContent = key;
    const copy = document.createElement('span'); copy.textContent = description;
    button.append(command, copy);
    button.addEventListener('click', () => {
      if (value.startsWith('/')) $('prompt').value = key;
      else $('prompt').value = value.replace(/@[^\s]*$/, key);
      menu.classList.add('hidden');
      $('prompt').focus();
      updateSendState();
    });
    menu.append(button);
  }
  menu.classList.toggle('hidden', !filtered.length);
}

function send() {
  const prompt = $('prompt').value.trim();
  if (!prompt || running) return;
  const model = $('model').value;
  if ((!model || model === '__custom__') && !prompt.startsWith('/')) { appendMessage('assistant', 'Hãy chọn hoặc nhập một model trước khi gửi.', true); return; }
  const selected = $('model').selectedOptions[0];
  if (mode === 'agent' && selected?.dataset.tools === 'false') { appendMessage('assistant', 'Model này không hỗ trợ tools nên không thể chạy Agent mode. Hãy chuyển sang Chat hoặc chọn model khác.', true); return; }
  vscode.postMessage({ type: 'send', prompt, mode, model, includeSelection: false });
  $('prompt').value = '';
  updateSendState();
}

document.querySelectorAll('.mode-switch [data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('connect').addEventListener('click', () => {
  showError('');
  vscode.postMessage({ type: 'connect', endpoint: $('endpoint').value, apiKey: $('apiKey').value || undefined, provider: $('configProvider').value });
});
$('startRouter').addEventListener('click', () => {
  showError('');
  setRouterLaunchState('starting', 'Đang kết nối 9Router');
  vscode.postMessage({ type: 'startRouter' });
});
$('openDashboard').addEventListener('click', () => vscode.postMessage({ type: 'openDashboard' }));
$('openExternal').addEventListener('click', () => vscode.postMessage({ type: 'openDashboard' }));
$('historyToggle').addEventListener('click', (event) => {
  event.stopPropagation();
  const opening = $('historyPanel').classList.contains('hidden');
  if (opening) {
    historyExpanded = false;
    renderHistory(allSessions);
    $('historyPanel').classList.remove('hidden');
  } else $('historyPanel').classList.add('hidden');
});
$('historyPanel').addEventListener('click', (event) => event.stopPropagation());
$('closeHistory').addEventListener('click', () => { historyExpanded = false; $('historyPanel').classList.add('hidden'); });
$('viewAllHistory').addEventListener('click', () => { historyExpanded = true; renderHistory(allSessions); });
$('metricsToggle').addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'openTelemetryDashboard' }); });
$('closeTelemetry').addEventListener('click', () => $('telemetryPanel').classList.add('hidden'));
$('telemetryPanel').addEventListener('click', (event) => event.stopPropagation());
$('clearTelemetry').addEventListener('click', () => vscode.postMessage({ type: 'clearTelemetry' }));
$('openMcp').addEventListener('click', (event) => { event.stopPropagation(); $('mcpPanel').classList.remove('hidden'); vscode.postMessage({ type: 'getMcpServers' }); });
$('closeMcp').addEventListener('click', () => $('mcpPanel').classList.add('hidden'));
$('mcpPanel').addEventListener('click', (event) => event.stopPropagation());
function updateMcpForm() {
  const http = $('mcpTransport').value === 'http';
  const token = http && $('mcpAuth').value === 'token';
  $('mcpCommand').classList.toggle('hidden', http);
  $('mcpArgs').classList.toggle('hidden', http);
  $('mcpEnv').classList.toggle('hidden', http);
  $('mcpUrl').classList.toggle('hidden', !http);
  $('mcpAuth').classList.toggle('hidden', !http);
  $('mcpToken').classList.toggle('hidden', !token);
}
$('mcpTransport').addEventListener('change', updateMcpForm);
$('mcpAuth').addEventListener('change', updateMcpForm);
$('saveMcp').addEventListener('click', () => {
  const transport = $('mcpTransport').value;
  let env = {};
  try { env = $('mcpEnv').value.trim() ? JSON.parse($('mcpEnv').value) : {}; } catch { $('diagnosticsResult').textContent = 'Env MCP phải là JSON hợp lệ.'; $('diagnosticsResult').className = 'diagnostics-result failure'; return; }
  vscode.postMessage({ type: 'saveMcpServer', token: $('mcpToken').value || undefined, server: { id: '', name: $('mcpName').value, transport, authMode: transport === 'http' ? $('mcpAuth').value : undefined, enabled: true, command: $('mcpCommand').value, args: $('mcpArgs').value.split(/\s+/).filter(Boolean), url: $('mcpUrl').value }, env });
});
updateMcpForm();
$('closeImage').addEventListener('click', () => $('imageLightbox').classList.add('hidden'));
$('imageLightbox').addEventListener('click', (event) => { if (event.target === $('imageLightbox')) $('imageLightbox').classList.add('hidden'); });
$('sandboxMode').addEventListener('click', (event) => {
  event.stopPropagation();
  $('sandboxDropdown').classList.toggle('open');
  $('sandboxMenu').classList.toggle('hidden');
});
$('sandboxMenu').addEventListener('click', (event) => event.stopPropagation());
document.querySelectorAll('[data-sandbox]').forEach(button => button.addEventListener('click', () => {
  vscode.postMessage({ type: 'setSandboxMode', mode: button.dataset.sandbox });
  $('sandboxMenu').classList.add('hidden');
  $('sandboxDropdown').classList.remove('open');
}));
$('checkSandbox').addEventListener('click', () => {
  $('sandboxStatus').textContent = 'Đang kiểm tra…';
  vscode.postMessage({ type: 'checkSandbox' });
});
$('closeChangeReview').addEventListener('click', () => $('changeReviewPanel').classList.add('hidden'));
$('changeReviewPanel').addEventListener('click', (event) => { if (event.target === $('changeReviewPanel')) $('changeReviewPanel').classList.add('hidden'); });
$('openFullDiff').addEventListener('click', () => { if (currentReviewId) vscode.postMessage({ type: 'openFullDiff', id: currentReviewId }); });
$('attach').addEventListener('click', () => vscode.postMessage({ type: 'pickFiles', kind: 'files' }));
$('acceptAllChanges').addEventListener('click', () => vscode.postMessage({ type: 'acceptAllChanges' }));
$('undoAllChanges').addEventListener('click', () => vscode.postMessage({ type: 'undoAllChanges' }));
$('hideChanges').addEventListener('click', () => {
  changesHidden = true;
  $('changeTray').classList.add('hidden');
  if (lastChangeCount) $('collapsedChanges').classList.remove('hidden');
});
$('expandChanges').addEventListener('click', () => {
  changesHidden = false;
  $('collapsedChanges').classList.add('hidden');
  if (lastChangeCount) $('changeTray').classList.remove('hidden');
});
$('model').addEventListener('change', () => {
  const custom = $('model').value === '__custom__';
  $('customModelRow').classList.toggle('hidden', !custom);
  if (custom) $('customModelInput').focus();
  $('modelLabel').textContent = custom ? 'Model tùy chỉnh' : ($('model').selectedOptions[0]?.textContent || 'Chọn model');
});
$('modelTrigger').addEventListener('click', (event) => { event.stopPropagation(); $('modelMenu').classList.toggle('hidden'); $('modelSearch').value = ''; renderModelMenu(); if (!$('modelMenu').classList.contains('hidden')) $('modelSearch').focus(); });
$('modelMenu').addEventListener('click', (event) => event.stopPropagation());
$('modelSearch').addEventListener('input', () => renderModelMenu($('modelSearch').value));
$('checkModels').addEventListener('click', (event) => {
  event.stopPropagation();
  vscode.postMessage({ type: checkingModels ? 'cancelModelCheck' : 'checkModels' });
});
$('providerTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('providerMenu').classList.contains('hidden');
  $('providerMenu').classList.toggle('hidden', !open);
  $('providerPicker').classList.toggle('open', open);
  $('providerTrigger').setAttribute('aria-expanded', String(open));
});
$('providerMenu').addEventListener('click', (event) => event.stopPropagation());
document.querySelectorAll('#providerMenu .provider-option').forEach(option => option.addEventListener('click', (event) => {
  event.stopPropagation();
  setProvider(option.dataset.provider);
  $('providerMenu').classList.add('hidden');
  $('providerPicker').classList.remove('open');
  $('providerTrigger').setAttribute('aria-expanded', 'false');
}));
$('addCustomModel').addEventListener('click', () => {
  const model = $('customModelInput').value.trim();
  if (model) vscode.postMessage({ type: 'addCustomModel', model });
});
$('retryConnection').addEventListener('click', () => {
  showError('');
  vscode.postMessage({ type: 'retryConnection' });
});
$('stopRouter').addEventListener('click', () => vscode.postMessage({ type: 'stopRouter' }));
$('connectionToggle').addEventListener('click', () => vscode.postMessage({ type: 'stopRouter' }));
$('topDisconnect').addEventListener('click', () => vscode.postMessage({ type: activeProvider === '9router' ? 'stopRouter' : 'disconnectProvider' }));
$('permissionMode').addEventListener('click', (e) => {
  e.stopPropagation();
  const wrap = $('permDropdown');
  const isOpen = wrap.classList.contains('open');
  wrap.classList.toggle('open', !isOpen);
  $('permMenu').classList.toggle('hidden', isOpen);
});
document.querySelectorAll('#permMenu .perm-opt').forEach(opt => {
  opt.addEventListener('click', (e) => {
    e.stopPropagation();
    if (opt.dataset.perm === 'full') $('accessConfirm').classList.remove('hidden');
    else vscode.postMessage({ type: 'setPermissionMode', mode: opt.dataset.perm });
    $('permDropdown').classList.remove('open');
    $('permMenu').classList.add('hidden');
  });
});
$('cancelFull').addEventListener('click', () => $('accessConfirm').classList.add('hidden'));
$('confirmFull').addEventListener('click', () => { $('accessConfirm').classList.add('hidden'); vscode.postMessage({ type: 'setPermissionMode', mode: 'full' }); });
document.addEventListener('click', () => {
  $('permDropdown')?.classList.remove('open');
  $('permMenu')?.classList.add('hidden');
  $('modelMenu')?.classList.add('hidden');
  $('sandboxMenu')?.classList.add('hidden');
  $('sandboxDropdown')?.classList.remove('open');
  $('historyPanel')?.classList.add('hidden');
  historyExpanded = false;
  $('telemetryPanel')?.classList.add('hidden');
  $('mcpPanel')?.classList.add('hidden');
  $('providerMenu')?.classList.add('hidden');
  $('providerPicker')?.classList.remove('open');
  $('providerTrigger')?.setAttribute('aria-expanded', 'false');
});
$('settings').addEventListener('click', () => $('configPanel').classList.toggle('hidden'));
$('closeConfig').addEventListener('click', () => $('configPanel').classList.add('hidden'));
$('newProfile').addEventListener('click', () => { currentProfileId = ''; $('profileName').value = ''; $('configApiKey').value = ''; $('inputPrice').value = ''; $('outputPrice').value = ''; renderProfiles(); });
$('saveConfig').addEventListener('click', () => {
  vscode.postMessage({
    type: 'connect',
    endpoint: $('configEndpoint').value,
    apiKey: $('configApiKey').value || (providerChanged ? '' : undefined),
    provider: $('configProvider').value,
    profileId: currentProfileId || '__new__',
    profileName: $('profileName').value,
    inputPricePerMillion: $('inputPrice').value ? Number($('inputPrice').value) : undefined,
    outputPricePerMillion: $('outputPrice').value ? Number($('outputPrice').value) : undefined,
  });
  $('configPanel').classList.add('hidden');
  providerChanged = false;
});
$('runDiagnostics').addEventListener('click', () => {
  $('diagnosticsResult').textContent = 'Đang kiểm tra…';
  $('diagnosticsResult').className = 'diagnostics-result checking';
  $('runDiagnostics').disabled = true;
  vscode.postMessage({ type: 'diagnostics' });
});
$('localSetup').addEventListener('click', () => vscode.postMessage({ type: 'setupLocalProvider' }));
$('exportDiagnostics').addEventListener('click', () => vscode.postMessage({ type: 'exportDiagnostics' }));
$('send').addEventListener('click', () => {
  if (running) {
    $('send').classList.add('stopping');
    vscode.postMessage({ type: 'stopTurn' });
    return;
  }
  send();
});
$('prompt').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
});
$('prompt').addEventListener('input', () => {
  $('prompt').style.height = '34px';
  $('prompt').style.height = Math.min($('prompt').scrollHeight, 190) + 'px';
  renderComposerMenu();
  updateSendState();
});
$('prompt').addEventListener('paste', (event) => {
  const images = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
  if (!images.length) return;
  event.preventDefault();
  for (const file of images) {
    const reader = new FileReader();
    reader.addEventListener('load', () => vscode.postMessage({ type: 'pasteImage', name: file.name || 'clipboard-image', mimeType: file.type, dataUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  }
});

window.addEventListener('message', ({ data }) => {
  if (data.type === 'bootstrap') {
    $('endpoint').value = data.endpoint;
    $('configEndpoint').value = data.endpoint;
    setProvider(data.provider || '9router', false);
    if (!providerMeta[data.provider || '9router']?.local) {
      $('keyState').textContent = data.hasApiKey ? 'Đã lưu API key an toàn' : 'Chưa lưu API key';
      $('keyState').classList.toggle('saved', data.hasApiKey);
    }
    $('apiKey').placeholder = data.hasApiKey ? 'Đã lưu API key, nhập để thay đổi' : 'Nhập API key nếu endpoint yêu cầu';
    setMode(data.mode || 'agent');
    setPermissionMode(data.permissionMode || 'ask');
    setSandboxMode(data.sandboxMode || 'preferred');
    if (data.workspaceTrusted === false) appendMessage('assistant', 'Workspace chưa được tin cậy. Agent, terminal và MCP sẽ bị khóa cho đến khi bạn bật Workspace Trust.', true);
    profiles = data.profiles || [];
    favoriteModels = data.favoriteModels || [];
    recentModels = data.recentModels || [];
    currentProfileId = data.activeProfileId || '';
    renderProfiles();
    const initialProfile = profiles.find((item) => item.id === currentProfileId);
    if (initialProfile) applyProfileUi(initialProfile);
    renderHistory(data.sessions || []);
  } else if (data.type === 'sessions') {
    renderHistory(data.sessions || []);
  } else if (data.type === 'restoreSession') {
    flushAssistantText();
    setMode(data.mode || 'agent');
    $('messages').replaceChildren();
    changeSummary = null;
    for (const turn of data.turns || []) appendMessage(turn.role, turn.content, Boolean(turn.error), turn.timestamp, turn.attachments || []);
    if ([...$('model').options].some((option) => option.value === data.model)) {
      $('model').value = data.model;
      $('model').dispatchEvent(new Event('change'));
    }
    setRunning(false);
  } else if (data.type === 'connection') {
    activeProvider = data.provider || '9router';
    const isRouter = activeProvider === '9router';
    const providerName = providerMeta[activeProvider]?.label || activeProvider;
    $('connectionDot').classList.toggle('online', data.connected);
    $('connectionLabel').textContent = data.connected ? 'Đã kết nối' : 'Ngoại tuyến';
    if (data.connected) showError('');
    else if (!launchingRouter) showError(data.message || '');
    showSetup(!data.connected);
    $('connectionToggle').classList.toggle('hidden', !data.connected);
    $('connectionToggle').textContent = data.canStop ? 'Tắt' : 'Ngắt';
    $('topDisconnect').classList.toggle('hidden', !data.connected);
    $('topDisconnect').textContent = data.canStop ? 'Tắt' : 'Ngắt';
    $('stopRouter').classList.toggle('hidden', !data.connected || !data.canStop);
    $('localSetup').classList.toggle('hidden', !(activeProvider === 'ollama' || activeProvider === 'lm-studio'));
    $('setupTitle').textContent = isRouter ? 'Kết nối 9Router bằng một nút.' : 'Kết nối ' + providerName + ' để bắt đầu.';
    $('setupCopy').textContent = isRouter
      ? 'Extension tự chạy dịch vụ nền rồi mở trang quản lý bằng trình duyệt mặc định.'
      : activeProvider === 'ollama' || activeProvider === 'lm-studio'
        ? 'Provider local không cần API key, nhưng ứng dụng, model và API server phải đang chạy trên máy.'
        : 'Mở Cài đặt để kiểm tra endpoint và API key của provider này.';
    if (data.connected) {
      setRouterLaunchState('ready', '9Router đang hoạt động');
      $('launchDescription').textContent = !isRouter
        ? 'Đang dùng provider ' + activeProvider + '.'
        : data.canStop
        ? 'Dịch vụ chạy nền. Bạn có thể tắt bất cứ lúc nào.'
        : 'Dịch vụ đang chạy ngoài extension.';
      $('startRouter').classList.toggle('hidden', !isRouter);
      $('openDashboard').classList.toggle('hidden', !isRouter);
      $('retryConnection').classList.remove('hidden');
      $('topDisconnect').textContent = isRouter ? (data.canStop ? 'Tắt' : 'Ngắt') : 'Ngắt';
    } else {
      $('startRouter').classList.toggle('hidden', !isRouter);
      $('openDashboard').classList.add('hidden');
      if (!launchingRouter) setRouterLaunchState('idle', isRouter ? '9Router chưa chạy' : providerName + ' chưa kết nối');
    }
    const select = $('model');
    const previous = select.value;
    modelHealth = {};
    select.replaceChildren(new Option('Chọn model', ''));
    for (const model of data.models || []) {
      const option = new Option(model.name, model.id);
      option.dataset.tools = String(model.capabilities?.tools !== false);
      option.dataset.vision = String(model.capabilities?.vision === true);
      option.dataset.reasoning = String(model.capabilities?.reasoning === true);
      select.add(option);
    }
    select.add(new Option('＋ Nhập model khác…', '__custom__'));
    const preferred = previous;
    if (preferred && ![...select.options].some((option) => option.value === preferred)) select.add(new Option(preferred + ' · tùy chỉnh', preferred));
    if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
    else if (select.options.length > 1) select.selectedIndex = 1;
    $('modelLabel').textContent = select.selectedOptions[0]?.textContent || 'Chọn model';
    renderModelMenu();
  } else if (data.type === 'favoriteModels') {
    favoriteModels = data.models || [];
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'recentModels') {
    recentModels = data.models || [];
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'sandboxMode') {
    setSandboxMode(data.mode);
  } else if (data.type === 'sandboxStatus') {
    setSandboxMode(data.mode || sandboxMode);
    $('sandboxStatus').textContent = data.message || (data.available ? ((data.runtime || 'Container') + ' sẵn sàng') : 'Chưa có Docker/Podman');
  } else if (data.type === 'sandboxRun') {
    if (data.active) sandboxWasActive = true;
    $('sandboxMode').classList.toggle('active', Boolean(data.active));
    $('sandboxLabel').textContent = data.active ? ((data.runtime || 'Sandbox') + ' đang chạy') : (sandboxMode === 'direct' ? 'Chạy trực tiếp' : 'Sandbox ưu tiên');
    if (data.message && running) updateActivity(data.message);
    if (!data.active && sandboxWasActive) {
      sandboxWasActive = false;
      const report = document.createElement('div'); report.className = 'sandbox-report'; report.textContent = data.message || 'Sandbox đã được xóa an toàn';
      $('messages').append(report); $('messages').scrollTop = $('messages').scrollHeight;
    }
  } else if (data.type === 'contextBudget') {
    const meter = $('contextMeter');
    const percent = Math.min(100, Math.round(((data.used || 0) / Math.max(1, data.limit || 1)) * 100));
    meter.querySelector('i').style.width = percent + '%';
    meter.classList.toggle('compacted', Boolean(data.compacted));
    meter.title = data.compacted ? 'Context đã được rút gọn: ' + data.original + ' → ' + data.used + ' ký tự' : 'Context: ' + data.used + '/' + data.limit + ' ký tự';
  } else if (data.type === 'changeReview') {
    renderChangeReview(data);
  } else if (data.type === 'closeChangeReview') {
    $('changeReviewPanel').classList.add('hidden');
  } else if (data.type === 'notice') {
    appendMessage('assistant', data.message, false, Date.now());
  } else if (data.type === 'onboarding') {
    const card = document.createElement('article'); card.className = 'onboarding-card';
    card.innerHTML = '<strong>Bắt đầu nhanh</strong><span>' + escapeHtml(data.message) + '</span>';
    $('messages').append(card);
  } else if (data.type === 'recoveredTurn') {
    appendMessage('user', data.prompt, false, data.startedAt);
    appendMessage('assistant', (data.answer || 'Tác vụ bị gián đoạn khi IDE reload.') + '\n\n> Đã khôi phục nội dung trước khi reload. Bạn có thể gửi tiếp để Agent hoàn tất.', false, Date.now());
  } else if (data.type === 'openConfig') {
    $('configPanel').classList.remove('hidden');
  } else if (data.type === 'openMcpPanel') {
    $('mcpPanel').classList.remove('hidden');
  } else if (data.type === 'openModelPicker') {
    $('modelMenu').classList.remove('hidden');
    $('modelSearch').focus();
  } else if (data.type === 'configSaved') {
    $('configEndpoint').value = data.endpoint;
    setProvider(data.provider || '9router', false);
    $('configApiKey').value = '';
    providerChanged = false;
    if (data.profile) applyProfileUi(data.profile);
    if (!providerMeta[data.provider || '9router']?.local) {
      $('keyState').textContent = data.hasApiKey ? 'Đã lưu API key an toàn' : 'Chưa lưu API key';
      $('keyState').classList.toggle('saved', data.hasApiKey);
    }
  } else if (data.type === 'diagnosticsResult') {
    $('diagnosticsResult').textContent = data.message;
    $('diagnosticsResult').className = 'diagnostics-result ' + (data.ok ? 'success' : 'failure');
      $('runDiagnostics').disabled = false;
  } else if (data.type === 'profiles') {
    profiles = data.profiles || [];
    currentProfileId = data.activeProfileId || currentProfileId;
    renderProfiles();
  } else if (data.type === 'profileLoaded') {
    applyProfileUi(data.profile);
    $('configApiKey').value = '';
    $('keyState').textContent = data.hasApiKey ? 'Đã lưu API key an toàn' : 'Chưa lưu API key';
    $('keyState').classList.toggle('saved', data.hasApiKey);
  } else if (data.type === 'modelCheckStart') {
    checkingModels = true;
    modelHealth = {};
    $('checkModels').textContent = 'Đang kiểm tra 0/' + data.total + ' · Bấm để hủy';
    $('checkModels').classList.add('checking');
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'modelCheck') {
    modelHealth[data.model] = { status: data.status, message: data.message || (data.latencyMs ? 'OK · ' + data.latencyMs + ' ms' : '') };
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'modelCheckProgress') {
    $('checkModels').textContent = 'Đang kiểm tra ' + data.completed + '/' + data.total + ' · Bấm để hủy';
  } else if (data.type === 'modelCheckEnd') {
    checkingModels = false;
    $('checkModels').textContent = data.cancelled ? 'Đã hủy · Kiểm tra lại' : 'Kiểm tra model';
    $('checkModels').classList.remove('checking');
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'telemetry') {
    renderTelemetry(data.records || []);
  } else if (data.type === 'mcpServers') {
    renderMcpServers(data.servers || [], data.presets || []);
  } else if (data.type === 'checkpoint') {
    const card = document.createElement('article'); card.className = 'checkpoint-card';
    card.innerHTML = '<span>Git checkpoint đã tạo · ' + data.checkpoint.hash + '</span><button>Khôi phục</button>';
    card.querySelector('button').addEventListener('click', () => vscode.postMessage({ type: 'restoreCheckpoint', id: data.checkpoint.id }));
    $('messages').append(card); $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'checkpointRestored') {
    appendMessage('assistant', 'Đã khôi phục workspace về Git checkpoint ' + data.hash + '.', false, Date.now());
  } else if (data.type === 'localRuntime') {
    if (data.message) { $('diagnosticsResult').textContent = data.message; $('diagnosticsResult').className = 'diagnostics-result ' + (data.serverRunning || data.models?.length ? 'success' : 'checking'); }
  } else if (data.type === 'selectModel') {
    $('model').value = data.model;
    $('model').dispatchEvent(new Event('change'));
    $('customModelInput').value = '';
    $('customModelRow').classList.add('hidden');
  } else if (data.type === 'permissionMode') {
    setPermissionMode(data.mode);
  } else if (data.type === 'routerLaunch') {
    setRouterLaunchState(data.progress, data.message);
    $('launchDescription').textContent = data.progress === 'checking'
      ? 'Đang kiểm tra dịch vụ cục bộ.'
      : data.progress === 'waiting'
        ? 'Quá trình chạy nền, bạn có thể tiếp tục dùng IDE.'
        : 'Không cần mở terminal. Một nút là đủ để bắt đầu.';
    if (data.progress === 'stopped') {
      $('startRouter').classList.remove('hidden');
      $('openDashboard').classList.add('hidden');
      $('retryConnection').classList.add('hidden');
      $('stopRouter').classList.add('hidden');
      $('connectionToggle').classList.add('hidden');
      $('topDisconnect').classList.add('hidden');
    }
  } else if (data.type === 'browserOpened') {
    setRouterLaunchState('ready', 'Đã mở trình quản lý');
    $('launchDescription').textContent = '9Router đang chạy nền. Trình duyệt đã mở trang quản lý.';
    showError('');
  } else if (data.type === 'attachments') {
    const list = $('attachmentList');
    list.replaceChildren();
    for (const [index, item] of (data.attachments || []).entries()) {
      if (item.preview) {
        const preview = document.createElement('div'); preview.className = 'attachment-preview';
        const image = document.createElement('img'); image.src = item.preview; image.alt = item.name;
        image.addEventListener('click', () => openImage(item.preview));
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Bỏ ảnh đính kèm');
        remove.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'removeAttachment', index }); });
        preview.append(image, remove); list.append(preview); continue;
      }
      const chip = document.createElement('span');
      chip.className = 'attachment-chip';
      chip.textContent = item.name;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Bỏ tệp đính kèm');
      remove.addEventListener('click', () => vscode.postMessage({ type: 'removeAttachment', index }));
      chip.append(remove); list.append(chip);
    }
  } else if (data.type === 'approval') {
    const item = document.createElement('article'); item.className = 'permission-card';
    item.innerHTML = '<strong>Agent cần quyền</strong><span>' + data.message + '</span><div><button class="permission-allow">Cho phép</button><button class="permission-deny">Từ chối</button></div>';
    item.querySelector('.permission-allow').addEventListener('click', () => { vscode.postMessage({ type: 'approval', id: data.id, allow: true }); item.remove(); });
    item.querySelector('.permission-deny').addEventListener('click', () => { vscode.postMessage({ type: 'approval', id: data.id, allow: false }); item.remove(); });
    $('messages').append(item); $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'changesState') {
    const tray = $('changeTray');
    const collapsed = $('collapsedChanges');
    const nextChangeCount = data.changes?.length || 0;
    if (!nextChangeCount || !lastChangeCount) changesHidden = false;
    lastChangeCount = nextChangeCount;
    tray.classList.toggle('hidden', !nextChangeCount || changesHidden);
    collapsed.classList.toggle('hidden', !nextChangeCount || !changesHidden);
    const totals = data.files + ' ' + (data.files === 1 ? 'file' : 'files') + ' changed  +' + data.added + '  -' + data.removed;
    $('changeCount').textContent = totals;
    $('collapsedChangeCount').innerHTML = escapeHtml(data.files + ' ' + (data.files === 1 ? 'file' : 'files') + ' changed  ') + '<b class="diff-add">+' + data.added + '</b> <b class="diff-remove">-' + data.removed + '</b>';
    const list = $('changeList'); list.replaceChildren();
    let renderedTask = '';
    for (const change of data.changes || []) {
      if (change.taskId && change.taskId !== renderedTask) {
        renderedTask = change.taskId;
        const taskLabel = document.createElement('div'); taskLabel.className = 'task-group-label';
        const title = document.createElement('span'); title.textContent = 'Tác vụ ' + change.taskId.replace(/^task-/, '').split('-')[0];
        const undo = document.createElement('button'); undo.type = 'button'; undo.textContent = 'Undo task'; undo.addEventListener('click', () => vscode.postMessage({ type: 'undoTaskChanges', taskId: change.taskId }));
        const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = 'Accept task'; accept.addEventListener('click', () => vscode.postMessage({ type: 'acceptTaskChanges', taskId: change.taskId }));
        taskLabel.append(title, undo, accept);
        list.append(taskLabel);
      }
      const row = document.createElement('div'); row.className = 'change-row';
      row.innerHTML = '<span>' + escapeHtml(change.path) + (change.staged ? ' <small>Sandbox</small>' : '') + '</span><span><b class="diff-add">+' + change.added + '</b> <b class="diff-remove">-' + change.removed + '</b></span><button class="tray-review">Review</button><button class="tray-undo">Undo</button><button class="tray-accept">Accept</button>';
      row.querySelector('.tray-review').addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }));
      row.querySelector('.tray-undo').addEventListener('click', () => vscode.postMessage({ type: 'undoChange', id: change.id }));
      row.querySelector('.tray-accept').addEventListener('click', () => vscode.postMessage({ type: 'acceptChange', id: change.id }));
      list.append(row);
    }
    if (data.changes?.length) {
      if (!changeSummary) {
        changeSummary = document.createElement('article');
        changeSummary.className = 'chat-change-summary';
        changeSummary.innerHTML = '<span></span><button type="button">Review</button>';
        $('messages').append(changeSummary);
      }
      const reviewButton = changeSummary.querySelector('button');
      reviewButton.onclick = () => {
        changesHidden = false;
        tray.classList.remove('hidden');
        collapsed.classList.add('hidden');
        const first = data.changes?.[0];
        if (first) vscode.postMessage({ type: 'reviewChange', id: first.id });
      };
      const summaryText = changeSummary.querySelector('span');
      summaryText.textContent = data.files + ' ' + (data.files === 1 ? 'file' : 'files') + ' changed  +' + data.added + '  -' + data.removed;
      summaryText.onclick = () => { changesHidden = false; tray.classList.remove('hidden'); collapsed.classList.add('hidden'); };
    } else if (changeSummary) {
      changeSummary.remove();
      changeSummary = null;
    }
    $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'turnStart') {
    mode = data.mode;
    flushAssistantText();
    assistantRawText = '';
    assistantActivity = null;
    activeTerminal = null;
    activitySteps = new Map();
    pendingTurnEnd = null;
    appendMessage('user', data.prompt, false, data.timestamp, data.attachments || []);
    assistantBody = appendMessage('assistant', '', false, data.timestamp);
    setRunning(true);
  } else if (data.type === 'delta') {
    queueAssistantText(data.delta);
  } else if (data.type === 'status') {
    if (running) updateActivity(data.message);
  } else if (data.type === 'toolOutput') {
    appendTerminalOutput(data);
  } else if (data.type === 'turnEnd') {
    if (pendingAssistantText || typingTimer) pendingTurnEnd = data;
    else finishTurn(data);
  } else if (data.type === 'reset') {
    flushAssistantText();
    $('messages').innerHTML = '<div class="empty"><h2>Nói điều bạn muốn xây.</h2><p>Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.</p></div>';
    assistantBody = null;
    pendingTurnEnd = null;
    setRunning(false);
  } else if (data.type === 'error') {
    setRouterLaunchState('idle', '9Router chưa chạy');
    $('launchDescription').textContent = 'Không cần mở terminal hoặc chuyển sang trình duyệt.';
    showError(data.message);
    if (!$('console').classList.contains('hidden')) appendMessage('assistant', data.message, true);
    setRunning(false);
  }
});

vscode.postMessage({ type: 'ready' });
`;
