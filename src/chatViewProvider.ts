import * as vscode from 'vscode';
import { relative, resolve } from 'node:path';
import { AgentRuntime } from './agentRuntime';
import { normalizeEndpoint } from './routerClient';
import { RouterProcessManager, type RouterLaunchProgress, type RouterRuntimeStatus } from './routerProcessManager';
import type { AgentRunCheckpoint, AgentToolFailureDecision, ChatMessage, ChatMode, RouterModel } from './types';
import { capabilitiesForModel, createProvider, type ProviderKind } from './provider';
import { ProviderProfileStore, TelemetryStore, type ProviderProfile } from './providerProfiles';
import { MCP_PRESETS, McpManager, type McpServerConfig } from './mcpManager';
import { GitCheckpointManager } from './gitCheckpoint';
import { LocalRuntimeManager } from './localRuntimeManager';
import { applyForward, applyReverse, countLineChanges, createDiffHunks } from './diffHunks';
import { discoverSkills, selectedSkills, skillCatalog, skillInstructionsFor, type AgentSkill } from './skillRegistry';
import { formatProjectInstructions, loadProjectInstructions } from './projectInstructions';
import { renderChatViewHtml } from './webview/chatViewHtml';
import { CHAT_VIEW_STYLES } from './webview/chatViewStyles';
import { CHAT_VIEW_CONTROLLER } from './webview/chatViewController';
import { renderTelemetryDashboard } from './webview/telemetryDashboard';
import { registerChatViewMessageHandler, type WebviewMessage } from './chatViewMessages';
import { NineRouterQuotaService, type QuotaSnapshot } from './nineRouterQuota';
import type { ChoiceDialogOptions, PromptDialogOptions, UserInteraction } from './userInteraction';

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
const GOAL_STATE = 'nineRouter.activeGoal';
const IDE_CONTEXT_STATE = 'nineRouter.ideContextEnabled';

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
  activeSkills?: string[];
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

interface StoredActiveRun {
  runId: string;
  prompt: string;
  answer: string;
  mode: ChatMode;
  model: string;
  startedAt: number;
  checkpoint?: AgentRunCheckpoint;
}

interface StoredGoal {
  objective: string;
  status: 'running' | 'paused' | 'ready' | 'failed';
  startedAt: number;
  lastStatus?: string;
}

export class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'nineRouter.chatView';
  private view: vscode.WebviewView | undefined;
  private models: RouterModel[] = [];
  private history: ChatMessage[] = [];
  private abortController: AbortController | undefined;
  private routerProcess = new RouterProcessManager();
  private pendingAttachments: Array<{ path: string; name: string; mimeType: string; size: number }> = [];
  private approvals = new Map<string, (allow: boolean) => void>();
  private toolFailureResolvers = new Map<string, (decision: AgentToolFailureDecision) => void>();
  private changes = new Map<string, { path: string; original: Uint8Array; updated: Uint8Array; existed: boolean; added: number; removed: number; taskId: string; staged?: boolean }>();
  private currentSessionId = this.createSessionId();
  private transcript: StoredTurn[] = [];
  private readonly profileStore: ProviderProfileStore;
  private readonly telemetryStore: TelemetryStore;
  private readonly quotaService: NineRouterQuotaService;
  private readonly mcpManager: McpManager;
  private readonly checkpointManager: GitCheckpointManager;
  private readonly localRuntimeManager = new LocalRuntimeManager();
  private readonly interaction: UserInteraction;
  private readonly dialogResolvers = new Map<string, (result: { action?: string; value?: string }) => void>();
  private modelCheckController: AbortController | undefined;
  private metricsPanel: vscode.WebviewPanel | undefined;
  private quotaSnapshot: QuotaSnapshot | undefined;
  private currentTaskId = '';
  private recoveryTimer: NodeJS.Timeout | undefined;
  private readonly output = vscode.window.createOutputChannel('RelayCode · Agent');
  private skills: AgentSkill[] = [];
  private activeSkillNames = new Set<string>();
  private lastConnectionCheckAt = 0;
  private connectionOnline: boolean | undefined;
  private connectionMonitorTimer: NodeJS.Timeout | undefined;
  private connectionProbeRunning = false;
  private connectionFailureCount = 0;
  private disposing = false;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.profileStore = new ProviderProfileStore(context);
    this.telemetryStore = new TelemetryStore(context);
    this.quotaService = new NineRouterQuotaService(context);
    this.interaction = {
      choose: (options) => this.chooseDialog(options),
      prompt: (options) => this.promptDialog(options),
      notify: (message, tone) => void this.post({ type: 'uiToast', message, tone })
    };
    this.mcpManager = new McpManager(context, this.interaction);
    context.subscriptions.push(this.mcpManager.onDidChange(() => void this.postMcpServers()));
    this.checkpointManager = new GitCheckpointManager(context);
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
    this.context.subscriptions.push(registerChatViewMessageHandler(view.webview, (message) => this.onMessage(message)));
    if (this.connectionMonitorTimer) clearInterval(this.connectionMonitorTimer);
    this.connectionMonitorTimer = setInterval(() => {
      if (this.view?.visible) void this.probeConnection();
    }, 30_000);
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
    const endpoint = await this.interaction.prompt({
      title: 'Kết nối 9Router',
      message: 'Nhập endpoint tương thích OpenAI.',
      label: 'Endpoint',
      value: current,
      placeholder: 'http://localhost:20128/v1',
      required: true,
      confirmLabel: 'Tiếp tục',
      icon: 'link'
    });
    if (endpoint === undefined) return;
    const currentKey = await this.getApiKey(provider);
    const apiKey = await this.interaction.prompt({
      title: 'API key 9Router',
      message: 'Key được lưu riêng trong Secret Storage.',
      detail: 'Để trống nếu gateway local không yêu cầu API key.',
      label: 'API key',
      value: currentKey,
      password: true,
      confirmLabel: 'Kết nối',
      icon: 'key'
    });
    if (apiKey === undefined) return;
    await this.connect(endpoint, apiKey, undefined, provider);
  }

  public newThread(): void {
    this.history = [];
    this.transcript = [];
    this.activeSkillNames.clear();
    this.currentSessionId = this.createSessionId();
    this.pendingAttachments = [];
    void this.context.workspaceState.update(GOAL_STATE, undefined);
    void this.post({ type: 'goalState' });
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
      if (message.type === 'dialogResult') {
        const resolveDialog = this.dialogResolvers.get(message.id);
        if (resolveDialog) {
          this.dialogResolvers.delete(message.id);
          resolveDialog({ action: message.action, value: message.value });
        }
      } else if (message.type === 'ready') {
        this.skills = await discoverSkills(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
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
          ,workspaceTrusted: vscode.workspace.isTrusted
          ,skills: this.skills.map(({ name, description, source }) => ({ name, description, source }))
          ,goal: this.context.workspaceState.get<StoredGoal>(GOAL_STATE)
        });
        await this.postChangesState();
        await this.postTelemetry();
        const recoveredRun = this.context.workspaceState.get<StoredActiveRun>(ACTIVE_RUN_STATE);
        if (recoveredRun) {
          await this.post({ type: 'recoveredTurn', ...recoveredRun });
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
      } else if (message.type === 'resolveToolFailure') {
        const resolveFailure = this.toolFailureResolvers.get(message.id);
        if (resolveFailure) {
          const decision: AgentToolFailureDecision = message.action === 'change-model' && message.model
            ? { action: 'change-model', model: message.model }
            : message.action === 'retry'
              ? { action: 'retry' }
              : { action: 'skip' };
          resolveFailure(decision);
          this.toolFailureResolvers.delete(message.id);
        }
      } else if (message.type === 'resumeAgent') {
        const recovered = this.context.workspaceState.get<StoredActiveRun>(ACTIVE_RUN_STATE);
        if (recovered?.checkpoint && recovered.mode !== 'chat') {
          await this.send({
            type: 'send',
            prompt: recovered.prompt,
            mode: recovered.mode,
            model: message.model || recovered.checkpoint.model || recovered.model,
            includeSelection: false
          }, recovered.checkpoint, recovered.runId);
        }
      } else if (message.type === 'discardAgentRun') {
        await this.clearActiveRun();
        await this.post({ type: 'agentRecoveryDismissed' });
      } else if (message.type === 'pauseGoal') {
        this.abortController?.abort();
        await this.setGoalStatus('paused', 'Đã tạm dừng. Có thể tiếp tục từ checkpoint gần nhất.');
      } else if (message.type === 'resumeGoal') {
        const recovered = this.context.workspaceState.get<StoredActiveRun>(ACTIVE_RUN_STATE);
        const goal = this.context.workspaceState.get<StoredGoal>(GOAL_STATE);
        if (recovered?.checkpoint && recovered.mode !== 'chat') {
          await this.setGoalStatus('running', 'Đang tiếp tục từ checkpoint gần nhất.');
          await this.send({
            type: 'send',
            prompt: recovered.prompt,
            mode: recovered.mode,
            model: message.model || recovered.checkpoint.model || recovered.model,
            includeSelection: false
          }, recovered.checkpoint, recovered.runId);
        } else if (goal?.objective && message.model) {
          await this.setGoalStatus('running', 'Đang tiếp tục mục tiêu.');
          await this.send({
            type: 'send',
            prompt: goal.objective,
            mode: 'agent',
            model: message.model,
            includeSelection: false
          });
        }
      } else if (message.type === 'clearGoal') {
        await this.context.workspaceState.update(GOAL_STATE, undefined);
        if (!this.abortController) {
          await this.clearActiveRun();
          await this.post({ type: 'agentRecoveryDismissed' });
        }
        await this.post({ type: 'goalState' });
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
        const choice = await this.interaction.choose({
          title: 'Hoàn tác tất cả thay đổi?',
          message: `Khôi phục ${this.changes.size} file về trạng thái trước khi Agent sửa.`,
          detail: 'Các file Agent vừa tạo cũng sẽ bị xóa.',
          tone: 'danger',
          icon: 'trash',
          actions: [
            { id: 'cancel', label: 'Hủy', kind: 'secondary' },
            { id: 'confirm', label: 'Undo all', kind: 'danger' }
          ]
        });
        if (choice !== 'confirm') return;
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
        const choice = await this.interaction.choose({
          title: 'Hoàn tác tác vụ?',
          message: `${entries.length} file sẽ được khôi phục.`,
          tone: 'warning',
          icon: 'arrowCounterClockwise',
          actions: [
            { id: 'cancel', label: 'Hủy', kind: 'secondary' },
            { id: 'confirm', label: 'Hoàn tác tác vụ', kind: 'danger' }
          ]
        });
        if (choice !== 'confirm') return;
        for (const [id, change] of entries) if (await this.restoreChange(change)) this.changes.delete(id);
        await this.postChangesState();
      } else if (message.type === 'setPermissionMode') {
        await this.context.globalState.update(PERMISSION_MODE_STATE, message.mode);
        await this.post({ type: 'permissionMode', mode: message.mode });
      } else if (message.type === 'setLanguage') {
        await vscode.workspace.getConfiguration('nineRouter').update('language', message.language, vscode.ConfigurationTarget.Global);
        if (this.view) this.view.webview.html = this.html(this.view.webview);
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
      } else if (message.type === 'checkRouterConnection') {
        await this.checkRouterConnection();
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
      } else if (message.type === 'editMessage') {
        await this.editMessage(message);
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
        const target = this.profileStore.list().find((item) => item.id === message.id);
        if (!target) throw new Error('Không tìm thấy hồ sơ cần xóa.');
        const confirmed = await this.interaction.choose({
          title: 'Xóa hồ sơ?',
          message: `"${target.name}" và API key đã lưu riêng sẽ bị xóa.`,
          detail: 'Thao tác này không thể hoàn tác.',
          tone: 'danger',
          icon: 'trash',
          actions: [
            { id: 'cancel', label: 'Hủy', kind: 'secondary' },
            { id: 'confirm', label: 'Xóa hồ sơ', kind: 'danger' }
          ]
        });
        if (confirmed !== 'confirm') return;
        const profile = await this.profileStore.remove(message.id);
        await this.applyProfile(profile);
        await this.postProfileState();
        await this.post({ type: 'profileLoaded', profile, hasApiKey: Boolean(await this.profileStore.apiKey(profile)) });
        await this.refreshConnection(false);
      } else if (message.type === 'viewTooNarrow') {
        this.view?.show?.(false);
        await vscode.commands.executeCommand('workbench.action.increaseViewWidth');
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
        const recovered = this.context.workspaceState.get<StoredActiveRun>(ACTIVE_RUN_STATE);
        const isContinuation = /^(tiếp tục|tiep tuc|continue|resume|làm tiếp|lam tiep)[\s.!…]*$/i.test(message.prompt.trim());
        if (isContinuation && recovered?.checkpoint && recovered.mode !== 'chat') {
          await this.send({
            ...message,
            prompt: recovered.prompt,
            mode: recovered.mode
          }, recovered.checkpoint, recovered.runId);
        } else {
          await this.send(message);
        }
      } else if (message.type === 'newThread') {
        this.newThread();
      } else if (message.type === 'refreshSkills') {
        this.skills = await discoverSkills(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
        await this.post({ type: 'skills', skills: this.skills.map(({ name, description, source }) => ({ name, description, source })) });
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
      this.interaction.notify(this.errorText(error), 'danger');
    }
  }

  private async startRouter(): Promise<void> {
    await this.context.globalState.update(DISCONNECTED_STATE, false);
    const routerCommand = vscode.workspace.getConfiguration('nineRouter').get('routerCommand', '9router');
    try {
      if (!(await this.routerProcess.isInstalled(routerCommand))) {
        const choice = await this.interaction.choose({
          title: 'Cài 9Router?',
          message: '9Router chưa có trên máy này.',
          detail: 'RelayCode có thể cài và khởi động dịch vụ tự động.',
          icon: 'downloadSimple',
          actions: [
            { id: 'later', label: 'Để sau', kind: 'secondary' },
            { id: 'install', label: 'Cài 9Router', kind: 'primary' }
          ]
        });
        if (choice !== 'install') {
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
    } catch (error) {
      const message = this.errorText(error);
      await this.post({ type: 'routerLaunch', progress: 'stopped', message: 'Không thể khởi động 9Router' });
      await this.post({ type: 'connection', connected: false, endpoint: this.endpoint, models: [], canStop: false, provider: '9router', message });
    }
  }

  private async checkRouterConnection(): Promise<void> {
    await this.context.globalState.update(DISCONNECTED_STATE, false);
    await this.diagnostics();
  }

  private async disconnectProvider(): Promise<void> {
    this.abortController?.abort();
    await this.context.globalState.update(DISCONNECTED_STATE, true);
    await this.post({ type: 'connection', connected: false, endpoint: this.endpoint, models: [], canStop: false, provider: this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router'), message: 'Đã ngắt provider.' });
  }

  private async refreshConnection(showSuccess: boolean): Promise<void> {
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const apiKey = await this.getApiKey(provider);
    let routerRuntime: RouterRuntimeStatus | undefined;
    if (provider === '9router') routerRuntime = await this.routerProcess.inspect(this.endpoint);
    const requiresKey = provider !== 'ollama' && provider !== 'lm-studio';
    if (requiresKey && !apiKey.trim()) {
      this.connectionOnline = false;
      this.models = [];
      await this.post({
        type: 'connection',
        connected: false,
        endpoint: this.endpoint,
        models: [],
        canStop: routerRuntime?.canStop ?? false,
        provider,
        routerRuntimeState: routerRuntime?.state,
        routerRuntimeOwner: routerRuntime?.owner,
        message: 'Chưa có API key. Mở Cấu hình và nhập key của provider.'
      });
      return;
    }
    try {
      this.models = (await createProvider({ kind: provider, endpoint: this.endpoint, apiKey }).listModels(AbortSignal.timeout(10_000))).map((model) => ({ ...model, capabilities: capabilitiesForModel(model.id) }));
      for (const id of this.context.globalState.get<string[]>(CUSTOM_MODELS_STATE, [])) {
        if (!this.models.some((item) => item.id === id)) this.models.push({ id, name: `${id} · tùy chỉnh` });
      }
      await this.post({
        type: 'connection',
        connected: true,
        endpoint: this.endpoint,
        models: this.models,
        canStop: routerRuntime?.canStop ?? this.routerProcess.canStop()
        ,defaultModel: this.context.globalState.get(DEFAULT_MODEL_STATE, '')
        ,provider
        ,routerRuntimeState: routerRuntime?.state
        ,routerRuntimeOwner: routerRuntime?.owner
      });
      this.lastConnectionCheckAt = Date.now();
      this.connectionOnline = true;
      this.connectionFailureCount = 0;
      if (showSuccess) this.interaction.notify(`Đã kết nối provider ${provider}.`, 'success');
    } catch (error) {
      this.lastConnectionCheckAt = 0;
      this.connectionOnline = false;
      this.models = [];
      const rawMessage = this.errorText(error);
      await this.post({
        type: 'connection',
        connected: false,
        endpoint: this.endpoint,
        models: [],
        canStop: routerRuntime?.canStop ?? this.routerProcess.canStop(),
        provider,
        routerRuntimeState: routerRuntime?.state,
        routerRuntimeOwner: routerRuntime?.owner,
        message: rawMessage === 'fetch failed'
          ? provider === 'ollama'
            ? 'Không tìm thấy Ollama. Hãy cài Ollama, tải model và bảo đảm server local đang chạy.'
            : provider === 'lm-studio'
              ? 'Không tìm thấy LM Studio. Hãy mở Local Server và tải một model trước.'
              : provider === 'cockpit'
                ? 'Không tìm thấy Cockpit Tools tại endpoint này. Hãy mở Cockpit, bật API Service và kiểm tra Client Key.'
              : provider === '9router'
                ? 'Không tìm thấy 9Router tại endpoint này.'
                : `Không thể kết nối endpoint của provider ${provider}.`
          : rawMessage
      });
    }
  }

  private async probeConnection(): Promise<void> {
    if (this.connectionProbeRunning || this.abortController || this.modelCheckController) return;
    this.connectionProbeRunning = true;
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    try {
      const apiKey = await this.getApiKey(provider);
      if (provider !== 'ollama' && provider !== 'lm-studio' && !apiKey.trim()) return;
      if (provider === '9router') {
        if (!(await this.routerProcess.isRunning(this.endpoint))) throw new Error('9Router chưa phản hồi health check.');
      } else {
        await createProvider({ kind: provider, endpoint: this.endpoint, apiKey })
          .listModels(AbortSignal.timeout(7_000));
      }
      this.lastConnectionCheckAt = Date.now();
      this.connectionFailureCount = 0;
      if (this.connectionOnline === false) await this.refreshConnection(false);
      else this.connectionOnline = true;
    } catch (error) {
      this.lastConnectionCheckAt = 0;
      this.connectionFailureCount++;
      if (provider === '9router' && this.connectionFailureCount >= 2) {
        try {
          const routerCommand = vscode.workspace.getConfiguration('nineRouter').get('routerCommand', '9router');
          await this.routerProcess.ensureRunning(this.endpoint, routerCommand, () => undefined);
          this.connectionFailureCount = 0;
          await this.refreshConnection(false);
          return;
        } catch {
          // Fall through and surface the offline state after recovery fails.
        }
      }
      if (this.connectionFailureCount < 3) return;
      if (this.connectionOnline !== false) {
        this.connectionOnline = false;
        await this.post({
          type: 'connection',
          connected: false,
          endpoint: this.endpoint,
          models: [],
          canStop: this.routerProcess.canStop(),
          provider,
          message: this.errorText(error)
        });
      }
    } finally {
      this.connectionProbeRunning = false;
    }
  }

  private async diagnostics(): Promise<void> {
    const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
    const apiKey = await this.getApiKey(provider);
    const routerRuntime = provider === '9router' ? await this.routerProcess.inspect(this.endpoint) : undefined;
    const started = Date.now();
    try {
      const models = await createProvider({ kind: provider, endpoint: this.endpoint, apiKey }).listModels(AbortSignal.timeout(10_000));
      this.models = models.map((model) => ({ ...model, capabilities: capabilitiesForModel(model.id) }));
      for (const id of this.context.globalState.get<string[]>(CUSTOM_MODELS_STATE, [])) {
        if (!this.models.some((item) => item.id === id)) this.models.push({ id, name: `${id} · tùy chỉnh` });
      }
      this.connectionOnline = true;
      this.connectionFailureCount = 0;
      this.lastConnectionCheckAt = Date.now();
      await this.post({ type: 'connection', connected: true, endpoint: this.endpoint, models: this.models, canStop: routerRuntime?.canStop ?? this.routerProcess.canStop(), provider, routerRuntimeState: routerRuntime?.state, routerRuntimeOwner: routerRuntime?.owner });
      await this.post({ type: 'diagnosticsResult', ok: true, provider, endpoint: this.endpoint, latency: Date.now() - started, modelCount: models.length, message: `Kết nối tốt · ${models.length} model · ${Date.now() - started} ms` });
    } catch (error) {
      this.connectionOnline = false;
      this.connectionFailureCount = 3;
      this.lastConnectionCheckAt = 0;
      await this.post({ type: 'connection', connected: false, endpoint: this.endpoint, models: [], canStop: routerRuntime?.canStop ?? this.routerProcess.canStop(), provider, routerRuntimeState: routerRuntime?.state, routerRuntimeOwner: routerRuntime?.owner, message: this.errorText(error) });
      await this.post({ type: 'diagnosticsResult', ok: false, provider, endpoint: this.endpoint, latency: Date.now() - started, modelCount: 0, message: this.errorText(error) });
    }
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
    this.interaction.notify('Đã xuất gói chẩn đoán. API key và token không có trong file.', 'success');
  }

  private async checkModels(): Promise<void> {
    if (!this.models.length) throw new Error('Chưa có model để kiểm tra.');
    const choice = await this.interaction.choose({
      title: `Kiểm tra ${this.models.length} model?`,
      message: 'RelayCode sẽ gửi một request ngắn đến từng model.',
      detail: 'Thao tác này có thể phát sinh phí hoặc chạm rate limit.',
      tone: 'warning',
      icon: 'pulse',
      actions: [
        { id: 'cancel', label: 'Hủy', kind: 'secondary' },
        { id: 'confirm', label: 'Kiểm tra tất cả', kind: 'primary' }
      ]
    });
    if (choice !== 'confirm') return;
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
    if (this.metricsPanel) this.metricsPanel.webview.html = this.telemetryDashboardHtml(this.metricsPanel.webview);
  }

  private async postTelemetry(): Promise<void> {
    await this.post({ type: 'telemetry', records: this.telemetryStore.list() });
  }

  private openTelemetryDashboard(): void {
    if (this.metricsPanel) {
      this.metricsPanel.reveal(vscode.ViewColumn.Active);
      this.metricsPanel.webview.html = this.telemetryDashboardHtml(this.metricsPanel.webview);
      void this.refreshQuotaDashboard(this.metricsPanel);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'nineRouter.telemetryDashboard',
      'RelayCode · Model activity',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.metricsPanel = panel;
    panel.webview.html = this.telemetryDashboardHtml(panel.webview);
    void this.refreshQuotaDashboard(panel);
    panel.webview.onDidReceiveMessage(async (message: { type?: string; silent?: boolean; password?: string }) => {
      if (message.type === 'refreshQuota') await this.refreshQuotaDashboard(panel, message.silent === true);
      if (message.type === 'openRouterQuota') {
        const active = this.profileStore.active();
        if (active?.kind === '9router') {
          await vscode.env.openExternal(vscode.Uri.parse(`${this.quotaSnapshot?.origin ?? this.quotaOrigin()}/dashboard/quota`));
        }
      }
      if (message.type === 'loginQuota') {
        const password = message.password?.trim();
        if (password) {
          this.quotaSnapshot = this.quotaService.loading(this.quotaEndpoint());
          panel.webview.html = this.telemetryDashboardHtml(panel.webview);
          try {
            this.quotaSnapshot = await this.quotaService.loginWithPassword(this.quotaEndpoint(), password);
          } catch (error) {
            this.quotaSnapshot = {
              status: 'auth-required',
              origin: this.quotaOrigin(),
              accounts: [],
              message: this.errorText(error)
            };
          }
          panel.webview.html = this.telemetryDashboardHtml(panel.webview);
        }
      }
      if (message.type === 'clearConfirmed') {
        await this.telemetryStore.clear();
        panel.webview.html = this.telemetryDashboardHtml(panel.webview);
      }
    });
    panel.onDidDispose(() => { if (this.metricsPanel === panel) this.metricsPanel = undefined; });
  }

  private telemetryDashboardHtml(webview: vscode.Webview): string {
    const quota = this.quotaSnapshot ?? this.quotaService.loading(this.quotaEndpoint());
    return renderTelemetryDashboard(webview, this.telemetryStore.list(), quota, getNonce(), this.profileStore.active());
  }

  private async refreshQuotaDashboard(panel: vscode.WebviewPanel, silent = false): Promise<void> {
    if (this.metricsPanel !== panel) return;
    if (this.profileStore.active()?.kind !== '9router') {
      panel.webview.html = this.telemetryDashboardHtml(panel.webview);
      return;
    }
    if (!silent) {
      this.quotaSnapshot = this.quotaService.loading(this.quotaEndpoint());
      panel.webview.html = this.telemetryDashboardHtml(panel.webview);
    }
    this.quotaSnapshot = await this.quotaService.load(this.quotaEndpoint());
    if (this.metricsPanel === panel) panel.webview.html = this.telemetryDashboardHtml(panel.webview);
  }

  private quotaEndpoint(): string {
    return this.profileStore.list().find((profile) => profile.kind === '9router')?.endpoint || this.endpoint;
  }

  private quotaOrigin(): string {
    try {
      return new URL(this.quotaEndpoint()).origin;
    } catch {
      return this.quotaEndpoint().replace(/\/v1\/?$/, '').replace(/\/+$/, '');
    }
  }

  private legacyTelemetryDashboardHtml(webview: vscode.Webview): string {
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
    const status = await this.localRuntimeManager.setup(
      provider,
      this.endpoint,
      (message) => void this.post({ type: 'localRuntime', message }),
      this.interaction
    );
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
    const choice = await this.interaction.choose({
      title: 'Khôi phục checkpoint?',
      message: 'Toàn bộ file Git sẽ trở về trạng thái trước tác vụ Agent.',
      detail: 'File được tạo sau checkpoint sẽ bị xóa.',
      tone: 'danger',
      icon: 'clockCounterClockwise',
      actions: [
        { id: 'cancel', label: 'Hủy', kind: 'secondary' },
        { id: 'confirm', label: 'Khôi phục checkpoint', kind: 'danger' }
      ]
    });
    if (choice !== 'confirm') return;
    const checkpoint = await this.checkpointManager.restore(id);
    this.changes.clear();
    await this.postChangesState();
    await this.post({ type: 'checkpointRestored', id, hash: checkpoint.hash.slice(0, 8) });
  }

  private async send(
    message: Extract<WebviewMessage, { type: 'send' }>,
    resumeCheckpoint?: AgentRunCheckpoint,
    resumeRunId?: string
  ): Promise<void> {
    let prompt = message.prompt.trim();
    if (!prompt) return;
    const goalControl = prompt.trim().match(/^\/goal\s+(pause|resume|clear|edit)$/i)?.[1]?.toLowerCase();
    if (goalControl === 'pause') {
      this.abortController?.abort();
      await this.setGoalStatus('paused', 'Đã tạm dừng. Có thể tiếp tục từ checkpoint gần nhất.');
      return;
    }
    if (goalControl === 'clear') {
      await this.context.workspaceState.update(GOAL_STATE, undefined);
      await this.clearActiveRun();
      await this.post({ type: 'goalState' });
      return;
    }
    if (goalControl === 'edit') {
      const goal = this.context.workspaceState.get<StoredGoal>(GOAL_STATE);
      await this.post({ type: 'editGoalComposer', objective: goal?.objective ?? '' });
      return;
    }
    if (goalControl === 'resume') {
      const recovered = this.context.workspaceState.get<StoredActiveRun>(ACTIVE_RUN_STATE);
      const goal = this.context.workspaceState.get<StoredGoal>(GOAL_STATE);
      if (!message.model) throw new Error('Hãy chọn model trước khi tiếp tục goal.');
      if (recovered?.checkpoint && recovered.mode !== 'chat') {
        await this.setGoalStatus('running', 'Đang tiếp tục từ checkpoint gần nhất.');
        await this.send({
          type: 'send',
          prompt: recovered.prompt,
          mode: recovered.mode,
          model: message.model,
          includeSelection: false
        }, recovered.checkpoint, recovered.runId);
      } else if (goal?.objective) {
        await this.setGoalStatus('running', 'Đang tiếp tục mục tiêu.');
        await this.send({ type: 'send', prompt: goal.objective, mode: 'agent', model: message.model, includeSelection: false });
      }
      return;
    }
    const goalMatch = prompt.match(/^\/goal(?:\s+)([\s\S]+)$/i);
    if (goalMatch) {
      prompt = (goalMatch[1] ?? '').trim();
      if (!prompt) return;
      const goal: StoredGoal = {
        objective: prompt,
        status: 'running',
        startedAt: Date.now(),
        lastStatus: 'Đang bắt đầu.'
      };
      await this.context.workspaceState.update(GOAL_STATE, goal);
      await this.post({ type: 'goalState', goal });
    } else if (await this.handleSlashCommand(prompt, message.model, message.mode)) {
      return;
    }
    if (!message.model) throw new Error('Hãy chọn một model trước khi gửi.');

    const config = vscode.workspace.getConfiguration('nineRouter');
    const codexTuning = /(codex|gpt-5|(?:^|[/_-])o[134](?:$|[/_.-]))/i.test(message.model)
      ? {
          reasoningEffort: message.reasoningEffort,
          serviceTier: message.serviceTier
        }
      : undefined;
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
    const attachmentNote = await this.attachmentPrompt(attachments);
    this.skills = await discoverSkills(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
    for (const skill of selectedSkills(prompt, this.skills)) this.activeSkillNames.add(skill.name.toLowerCase());
    const activeSkills = this.skills.filter((skill) => this.activeSkillNames.has(skill.name.toLowerCase()));
    const selectedSkillInstructions = skillInstructionsFor(activeSkills);
    const contextualPrompt = (await this.withEditorContext(prompt, message.includeSelection)) + attachmentNote;
    const enrichedPrompt = contextualPrompt
      + (message.mode === 'chat' && selectedSkillInstructions ? `\n\n${selectedSkillInstructions}` : '');
    const attachmentViews = await this.attachmentViews(attachments);
    const requestContent: ChatMessage['content'] = attachmentViews.some((item) => item.preview)
      ? [
          { type: 'text', text: enrichedPrompt },
          ...attachmentViews.flatMap((item) => item.preview ? [{ type: 'image_url' as const, image_url: { url: item.preview } }] : [])
        ]
      : enrichedPrompt;
    const startedAt = Date.now();
    const lastUserTurn = [...this.transcript].reverse().find((turn) => turn.role === 'user');
    const resumesExistingTurn = Boolean(resumeCheckpoint && lastUserTurn?.content.trim() === prompt);
    if (resumesExistingTurn) {
      while (this.transcript.at(-1)?.error) this.transcript.pop();
    }
    const previousTurns = this.transcript
      .filter((turn) => !turn.error)
      .slice(-12)
      .map((turn) => ({ role: turn.role, content: turn.content }));
    const runId = resumeRunId || `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const activeRun: StoredActiveRun = {
      runId,
      prompt,
      answer: '',
      mode: message.mode,
      model: message.model,
      startedAt,
      checkpoint: resumeCheckpoint
    };
    await this.context.workspaceState.update(ACTIVE_RUN_STATE, activeRun);
    if (!resumesExistingTurn) {
      this.transcript.push({ role: 'user', content: prompt, timestamp: startedAt, attachments: attachments.map((item) => ({ name: item.name, path: item.path })) });
    }
    this.pendingAttachments = [];
    await this.postAttachments();
    await this.post({
      type: 'turnStart',
      mode: message.mode,
      prompt,
      attachments: attachmentViews,
      timestamp: startedAt,
      turnIndex: this.transcript.length - 1,
      resume: resumesExistingTurn
    });

    let answer = '';
    const taskChangedPaths = new Set<string>();
    const onDelta = (delta: string) => {
      answer += delta;
      void this.post({ type: 'delta', delta });
      if (!this.recoveryTimer) {
        this.recoveryTimer = setTimeout(() => {
          this.recoveryTimer = undefined;
          void this.context.workspaceState.update(ACTIVE_RUN_STATE, { ...activeRun, answer });
        }, 500);
      }
    };

    try {
      const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
      const apiKey = await this.getApiKey(provider);
      const providerClient = createProvider({ kind: provider, endpoint: this.endpoint, apiKey });
      const verifySelectedModel = async () => {
        if (provider === '9router' && !(await this.routerProcess.isRunning(this.endpoint))) {
          throw new Error('9Router chưa phản hồi health check.');
        }
        const available = await providerClient.listModels(
          AbortSignal.any([this.abortController!.signal, AbortSignal.timeout(8_000)])
        );
        if (available.length && !available.some((item) => item.id === message.model)) {
          throw new Error(`Model ${message.model} không còn trong danh sách của provider.`);
        }
      };
      if (Date.now() - this.lastConnectionCheckAt > 15_000) {
        await this.post({ type: 'status', message: 'Đang kiểm tra provider' });
        try {
          await verifySelectedModel();
          this.lastConnectionCheckAt = Date.now();
          this.connectionOnline = true;
          this.connectionFailureCount = 0;
        } catch (initialError) {
          this.lastConnectionCheckAt = 0;
          if (provider === '9router') {
            await this.post({ type: 'status', message: 'Mất kết nối 9Router · đang thử kết nối lại' });
            try {
              const routerCommand = vscode.workspace.getConfiguration('nineRouter').get('routerCommand', '9router');
              await this.routerProcess.ensureRunning(this.endpoint, routerCommand, (progress) => {
                const labels: Partial<Record<RouterLaunchProgress, string>> = {
                  checking: 'Đang kiểm tra 9Router',
                  starting: 'Đang khởi động lại 9Router',
                  waiting: 'Đang chờ 9Router sẵn sàng',
                  ready: 'Đã kết nối lại 9Router'
                };
                if (labels[progress]) void this.post({ type: 'status', message: labels[progress] });
              });
              await verifySelectedModel();
              this.lastConnectionCheckAt = Date.now();
              this.connectionOnline = true;
              this.connectionFailureCount = 0;
            } catch {
              this.connectionOnline = false;
              throw initialError;
            }
          } else {
            this.connectionOnline = false;
            throw initialError;
          }
        }
      }
      if (message.mode === 'chat') {
        this.history.push({ role: 'user', content: requestContent });
        const candidates = [message.model, ...config.get<string[]>('fallbackModels', []).filter((item) => item && item !== message.model)];
        let usedModel = message.model;
        let lastError: unknown;
        for (const candidate of candidates) {
          const candidateController = new AbortController();
          const abortCandidate = () => candidateController.abort();
          this.abortController.signal.addEventListener('abort', abortCandidate, { once: true });
          let timeout: NodeJS.Timeout | undefined;
          let heartbeat: NodeJS.Timeout | undefined;
          let lastActivityAt = Date.now();
          const inactivitySeconds = Math.max(60, config.get<number>('agentInactivityTimeoutSeconds', 180));
          const touchActivity = () => {
            lastActivityAt = Date.now();
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => candidateController.abort(new Error(`Provider không phản hồi trong ${inactivitySeconds} giây.`)), inactivitySeconds * 1_000);
          };
          try {
            usedModel = candidate;
            touchActivity();
            heartbeat = setInterval(() => {
              const waitingSeconds = Math.floor((Date.now() - lastActivityAt) / 1_000);
              if (waitingSeconds >= 3) void this.post({ type: 'status', message: `Đang chờ model · ${waitingSeconds}s` });
            }, 3_000);
            const chatHistory: ChatMessage[] = [
              { role: 'system', content: 'Trả lời rõ ràng, gọn và không dùng emoji hoặc icon trang trí.' },
              ...this.history
            ];
            const metrics = await providerClient.streamChat(candidate, chatHistory, (delta) => {
              touchActivity();
              onDelta(delta);
            }, candidateController.signal, codexTuning);
            await this.recordMetrics(candidate, metrics);
            lastError = undefined;
            break;
          } catch (error) {
            lastError = candidateController.signal.reason instanceof Error && !this.abortController.signal.aborted
              ? candidateController.signal.reason
              : error;
            if (answer || candidate === candidates[candidates.length - 1]) throw lastError;
            const nextModel = candidates[candidates.indexOf(candidate) + 1]!;
            if (!await this.approveFallback(candidate, nextModel)) throw lastError;
            await this.post({ type: 'status', message: `Model ${candidate} lỗi · đang chuyển sang model dự phòng` });
          } finally {
            if (timeout) clearTimeout(timeout);
            if (heartbeat) clearInterval(heartbeat);
            this.abortController.signal.removeEventListener('abort', abortCandidate);
          }
        }
        if (lastError) throw lastError;
        if (usedModel !== message.model) await this.post({ type: 'notice', message: `Đã tự chuyển sang model dự phòng \`${usedModel}\`.` });
        this.history.push({ role: 'assistant', content: answer });
      } else {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) throw new Error('Hãy mở một thư mục workspace để chạy Agent mode.');
        if (message.mode === 'agent' && !vscode.workspace.isTrusted) {
          const choice = await this.interaction.choose({
            title: 'Workspace chưa được tin cậy',
            message: 'Agent, terminal và MCP đang bị khóa để bảo vệ workspace.',
            tone: 'warning',
            icon: 'shieldWarning',
            actions: [
              { id: 'cancel', label: 'Đóng', kind: 'secondary' },
              { id: 'manage', label: 'Quản lý Workspace Trust', kind: 'primary' }
            ]
          });
          if (choice === 'manage') await vscode.commands.executeCommand('workbench.trust.manage');
          throw new Error('Hãy tin cậy workspace trước khi chạy Agent.');
        }
        const externalTools = message.mode === 'agent' ? await this.mcpManager.agentTools() : [];
        const commandPolicy = {
          allow: config.get<string[]>('commandAllowList', []),
          deny: config.get<string[]>('commandDenyList', [])
        };
        const projectInstructions = formatProjectInstructions(await loadProjectInstructions(workspaceRoot, vscode.window.activeTextEditor?.document.uri.fsPath));
        const runtimeInstructions = [
          projectInstructions,
          activeSkills.length ? '' : skillCatalog(this.skills),
          selectedSkillInstructions
        ].filter(Boolean).join('\n\n');
        const agentContent: ChatMessage['content'] = attachmentViews.some((item) => item.preview)
          ? [
              { type: 'text', text: contextualPrompt },
              ...attachmentViews.flatMap((item) => item.preview ? [{ type: 'image_url' as const, image_url: { url: item.preview } }] : [])
            ]
          : contextualPrompt;
        const agentPrompt = config.get<boolean>('planBeforeRun', false) && message.mode === 'agent'
          ? typeof agentContent === 'string'
            ? `${agentContent}\n\nTrước khi dùng tool, hãy nêu kế hoạch ngắn 2-5 bước rồi mới thực hiện.`
            : agentContent
          : agentContent;
        const runtimePrompt = agentPrompt;
        const candidates = [message.model, ...config.get<string[]>('fallbackModels', []).filter((item) => item && item !== message.model)];
        const changeCountBeforeRun = this.changes.size;
        const inactivitySeconds = Math.max(60, config.get<number>('agentInactivityTimeoutSeconds', 180));
        for (const candidate of candidates) {
          let timeout: NodeJS.Timeout | undefined;
          let heartbeat: NodeJS.Timeout | undefined;
          let lastActivityAt = Date.now();
          let touchActivity = () => {};
          const candidateController = new AbortController();
          const abortCandidate = () => candidateController.abort();
          this.abortController.signal.addEventListener('abort', abortCandidate, { once: true });
          try {
            const inactivityTimeout = new Promise<never>((_, reject) => {
              touchActivity = () => {
                lastActivityAt = Date.now();
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(() => {
                  candidateController.abort();
                  reject(new Error(`Model chưa trả kết quả Agent sau ${inactivitySeconds} giây. Đã dừng request hiện tại.`));
                }, inactivitySeconds * 1_000);
              };
              touchActivity();
              heartbeat = setInterval(() => {
                const waitingSeconds = Math.floor((Date.now() - lastActivityAt) / 1_000);
                if (waitingSeconds >= 8) {
                  void this.post({ type: 'status', message: `Model đang suy nghĩ · ${waitingSeconds}s` });
                }
              }, 5_000);
            });
            const run = new AgentRuntime(
              providerClient,
              workspaceRoot,
              (description) => this.askApproval(description),
              (change) => {
                taskChangedPaths.add(change.path);
                touchActivity();
                this.registerChange(change);
              },
              message.mode === 'plan',
              externalTools,
              commandPolicy,
              undefined,
              runtimeInstructions,
              previousTurns,
              message.mode === 'agent' ? async () => {
                await this.checkpointManager.create(workspaceRoot);
              } : undefined,
              activeSkills.map((skill) => ({ name: skill.name, path: skill.path })),
              provider === '9router'
                ? async () => {
                    const routerCommand = vscode.workspace.getConfiguration('nineRouter').get('routerCommand', '9router');
                    await this.routerProcess.ensureRunning(this.endpoint, routerCommand, (progress) => {
                      const labels: Partial<Record<RouterLaunchProgress, string>> = {
                        checking: 'Đang kiểm tra tiến trình 9Router',
                        starting: 'Đang khởi động lại 9Router',
                        waiting: 'Đang chờ 9Router sẵn sàng',
                        ready: '9Router đã hoạt động lại'
                      };
                      if (labels[progress]) void this.post({ type: 'status', message: labels[progress]! });
                    });
                  }
                : undefined,
              config.get<boolean>('autoValidateChanges', true),
              codexTuning
            ).run(runtimePrompt, candidate, {
              onDelta: (delta) => {
                touchActivity();
                onDelta(delta);
              },
              onStatus: (status) => {
                touchActivity();
                void this.post({ type: 'status', message: status });
              },
              onToolOutput: (event) => {
                touchActivity();
                const previous = this.context.workspaceState.get<string>(LAST_TERMINAL_STATE, '');
                void this.context.workspaceState.update(LAST_TERMINAL_STATE, `${previous}${event.chunk}`.slice(-20_000));
                this.output.append(event.chunk);
                void this.post({ type: 'toolOutput', ...event });
              },
              onMetrics: (metrics) => void this.recordMetrics(candidate, metrics),
              onToolFailure: (failure) => {
                touchActivity();
                return this.askToolFailure(failure.id, failure.tool, failure.message, failure.model, failure.attempt);
              },
              onCheckpoint: async (checkpoint) => {
                touchActivity();
                activeRun.checkpoint = checkpoint;
                activeRun.model = checkpoint.model;
                activeRun.answer = answer;
                await this.context.workspaceState.update(ACTIVE_RUN_STATE, activeRun);
              }
            }, candidateController.signal, resumeCheckpoint);
            await Promise.race([run, inactivityTimeout]);
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
            if (heartbeat) clearInterval(heartbeat);
            this.abortController.signal.removeEventListener('abort', abortCandidate);
          }
        }
        if (message.mode === 'agent' && taskChangedPaths.size) {
          const taskChanges = [...this.changes.values()].filter((change) => taskChangedPaths.has(change.path));
          if (taskChanges.length) {
            const added = taskChanges.reduce((sum, change) => sum + change.added, 0);
            const removed = taskChanges.reduce((sum, change) => sum + change.removed, 0);
            const files = taskChanges
              .map((change) => {
                const path = vscode.workspace.asRelativePath(change.path).replace(/\\/g, '/');
                return `• [${path}](${path}:1) (+${change.added} -${change.removed})`;
              })
              .join('\n');
            onDelta(`\n\n**Thay đổi thực tế:** ${taskChanges.length} file (+${added} -${removed})\n\n${files}`);
          }
        }
      }
      const completedAt = Date.now();
      this.transcript.push({ role: 'assistant', content: answer || 'Agent kết thúc nhưng model không trả về nội dung.', timestamp: completedAt });
      await this.saveSession(message.mode, message.model);
      await this.clearActiveRun(runId);
      if (this.context.workspaceState.get<StoredGoal>(GOAL_STATE)?.status === 'running') {
        await this.setGoalStatus('ready', 'Hoàn thành và sẵn sàng để review.');
      }
      await this.post({ type: 'turnEnd', timestamp: completedAt });
      if (message.mode === 'agent' && config.get<boolean>('notifyOnComplete', true) && !this.view?.visible) {
        vscode.window.showInformationMessage(`Agent đã kết thúc · ${taskChangedPaths.size} file được thay đổi trong tác vụ này.`);
      }
    } catch (error) {
      const completedAt = Date.now();
      if (this.abortController?.signal.aborted) {
        this.transcript.push({ role: 'assistant', content: answer || 'Đã dừng.', timestamp: completedAt });
        await this.saveSession(message.mode, message.model);
        const goal = this.context.workspaceState.get<StoredGoal>(GOAL_STATE);
        if (goal?.status === 'running') {
          await this.setGoalStatus('paused', 'Đã tạm dừng. Có thể tiếp tục từ checkpoint gần nhất.');
        } else if (!goal && !this.disposing) {
          await this.clearActiveRun(runId);
        }
        await this.post({ type: 'turnEnd', cancelled: true, timestamp: completedAt });
        return;
      }
      const provider = this.context.globalState.get<ProviderKind>(PROVIDER_KIND_STATE, '9router');
      const errorMessage = await this.diagnoseProviderError(error, provider, message.model);
      this.output.appendLine(`[error] ${errorMessage}`);
      this.transcript.push({ role: 'assistant', content: errorMessage, timestamp: completedAt, error: true });
      await this.saveSession(message.mode, message.model);
      await this.post({ type: 'turnEnd', error: errorMessage, timestamp: completedAt });
      if (this.context.workspaceState.get<StoredGoal>(GOAL_STATE)?.status === 'running') {
        await this.setGoalStatus('failed', errorMessage);
      }
      if (message.mode !== 'chat' && activeRun.checkpoint) {
        await this.context.workspaceState.update(ACTIVE_RUN_STATE, activeRun);
        await this.post({ type: 'recoveredTurn', ...activeRun });
      } else {
        await this.clearActiveRun(runId);
      }
    } finally {
      this.abortController = undefined;
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

  private askToolFailure(
    id: string,
    tool: string,
    message: string,
    model: string,
    attempt: number
  ): Promise<AgentToolFailureDecision> {
    return new Promise((resolve) => {
      this.toolFailureResolvers.set(id, resolve);
      void this.post({ type: 'toolFailure', id, tool, message, model, attempt });
      setTimeout(() => {
        if (!this.toolFailureResolvers.delete(id)) return;
        resolve({ action: 'skip' });
      }, 180_000);
    });
  }

  private async approveFallback(from: string, to: string): Promise<boolean> {
    if (!vscode.workspace.getConfiguration('nineRouter').get<boolean>('confirmFallback', true)) return true;
    const choice = await this.interaction.choose({
      title: 'Chuyển sang model dự phòng?',
      message: `${from} không phản hồi. RelayCode có thể tiếp tục bằng ${to}.`,
      detail: 'Model dự phòng có thể có chi phí khác.',
      tone: 'warning',
      icon: 'arrowsClockwise',
      actions: [
        { id: 'cancel', label: 'Dừng', kind: 'secondary' },
        { id: 'switch', label: 'Chuyển model', kind: 'primary' }
      ]
    });
    return choice === 'switch';
  }

  private async clearActiveRun(expectedRunId?: string): Promise<void> {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
    if (expectedRunId) {
      const active = this.context.workspaceState.get<StoredActiveRun>(ACTIVE_RUN_STATE);
      if (active?.runId && active.runId !== expectedRunId) return;
    }
    await this.context.workspaceState.update(ACTIVE_RUN_STATE, undefined);
  }

  private async setGoalStatus(status: StoredGoal['status'], lastStatus: string): Promise<void> {
    const current = this.context.workspaceState.get<StoredGoal>(GOAL_STATE);
    if (!current) return;
    const goal: StoredGoal = { ...current, status, lastStatus };
    await this.context.workspaceState.update(GOAL_STATE, goal);
    await this.post({ type: 'goalState', goal });
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
    if (this.binaryContent(original) || this.binaryContent(updated)) {
      return { added: updated.byteLength ? 1 : 0, removed: original.byteLength ? 1 : 0 };
    }
    return countLineChanges(original, updated);
  }

  private binaryContent(value: Uint8Array): boolean {
    if (!value.byteLength) return false;
    const sample = value.subarray(0, Math.min(value.byteLength, 512));
    return sample.some((byte) => byte === 0 || (byte < 8 && byte !== 9 && byte !== 10 && byte !== 13));
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
    await this.openFullDiff(id);
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
    if (/\.(png|jpe?g|webp|gif)$/i.test(change.path)) {
      await vscode.commands.executeCommand('vscode.open', change.staged ? after : vscode.Uri.file(change.path), { preview: true });
      return;
    }
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
    if (this.changes.has(id)) await this.openFullDiff(id);
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
      const choice = await this.interaction.choose({
        title: 'File đã thay đổi',
        message: `${vscode.workspace.asRelativePath(change.path)} khác với lúc Agent chuẩn bị bản sửa.`,
        detail: 'Ghi đè sẽ thay nội dung hiện tại bằng bản đang chờ duyệt.',
        tone: 'warning',
        icon: 'warning',
        actions: [
          { id: 'cancel', label: 'Giữ file hiện tại', kind: 'secondary' },
          { id: 'overwrite', label: 'Ghi đè', kind: 'danger' }
        ]
      });
      if (choice !== 'overwrite') return false;
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
          const choice = await this.interaction.choose({
            title: 'Khôi phục file đã thay đổi?',
            message: `${vscode.workspace.asRelativePath(change.path)} đã được sửa thêm sau thay đổi của Agent.`,
            detail: 'Khôi phục sẽ thay nội dung hiện tại bằng bản cũ.',
            tone: 'danger',
            icon: 'warning',
            actions: [
              { id: 'cancel', label: 'Giữ file hiện tại', kind: 'secondary' },
              { id: 'restore', label: 'Khôi phục', kind: 'danger' }
            ]
          });
          if (choice !== 'restore') return false;
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
      turns: this.transcript,
      activeSkills: [...this.activeSkillNames]
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
    this.activeSkillNames = new Set(
      session.activeSkills?.map((name) => name.toLowerCase())
      ?? session.turns
        .filter((turn) => turn.role === 'user')
        .flatMap((turn) => selectedSkills(turn.content, this.skills).map((skill) => skill.name.toLowerCase()))
    );
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

  private async editMessage(message: Extract<WebviewMessage, { type: 'editMessage' }>): Promise<void> {
    if (this.abortController) throw new Error('Hãy dừng tác vụ đang chạy trước khi sửa tin nhắn cũ.');
    const prompt = message.prompt.trim();
    if (!prompt) throw new Error('Tin nhắn không được để trống.');
    if (!message.model) throw new Error('Hãy chọn một model trước khi gửi lại.');
    if (!Number.isInteger(message.index) || message.index < 0) throw new Error('Không xác định được tin nhắn cần sửa.');
    const target = this.transcript[message.index];
    if (!target || target.role !== 'user') throw new Error('Chỉ có thể sửa tin nhắn của bạn.');

    const restoredAttachments: typeof this.pendingAttachments = [];
    for (const attachment of target.attachments ?? []) {
      if (!attachment.path) continue;
      try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(attachment.path));
        const extension = attachment.path.split('.').pop()?.toLowerCase() ?? '';
        const mimeType = extension === 'png'
          ? 'image/png'
          : ['jpg', 'jpeg'].includes(extension)
            ? 'image/jpeg'
            : extension === 'webp'
              ? 'image/webp'
              : extension === 'gif'
                ? 'image/gif'
                : 'application/octet-stream';
        restoredAttachments.push({ path: attachment.path, name: attachment.name, mimeType, size: stat.size });
      } catch {
        // Tệp đính kèm đã bị xóa; vẫn cho phép sửa và gửi lại phần văn bản.
      }
    }

    this.transcript = this.transcript.slice(0, message.index);
    this.history = this.transcript
      .filter((turn) => !turn.error)
      .map((turn) => ({ role: turn.role, content: turn.content }));
    this.activeSkillNames = new Set(
      this.transcript
        .filter((turn) => turn.role === 'user')
        .flatMap((turn) => selectedSkills(turn.content, this.skills).map((skill) => skill.name.toLowerCase()))
    );
    this.pendingAttachments = restoredAttachments;
    await this.post({ type: 'truncateTurns', fromIndex: message.index });
    await this.postAttachments();
    await this.send({
      type: 'send',
      prompt,
      mode: message.mode,
      model: message.model,
      includeSelection: false
    });
  }

  private async deleteSession(id: string): Promise<void> {
    const sessions = this.context.globalState.get<StoredSession[]>(CHAT_SESSIONS_STATE, []);
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    const choice = await this.interaction.choose({
      title: 'Xóa cuộc trò chuyện?',
      message: `"${session.title}" sẽ bị xóa khỏi lịch sử.`,
      detail: 'Thao tác này không thể hoàn tác.',
      tone: 'danger',
      icon: 'trash',
      actions: [
        { id: 'cancel', label: 'Hủy', kind: 'secondary' },
        { id: 'delete', label: 'Xóa', kind: 'danger' }
      ]
    });
    if (choice !== 'delete') return;
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
    await this.post({ type: 'attachmentLoading', active: true, count: 1 });
    try {
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
    } finally {
      await this.post({ type: 'attachmentLoading', active: false });
    }
  }

  private async pickFiles(kind: 'files' | 'images' | 'resources'): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: kind === 'resources',
      openLabel: kind === 'images' ? 'Chọn ảnh' : kind === 'resources' ? 'Thêm vào yêu cầu' : 'Đính kèm tệp',
      filters: kind === 'images' ? { Images: ['png', 'jpg', 'jpeg', 'webp', 'gif'] } : { Files: ['*'] }
    });
    if (!uris?.length) return;
    await this.post({ type: 'attachmentLoading', active: true, count: uris.length });
    const fs = await import('node:fs/promises');
    try {
      for (const uri of uris) {
        const stat = await fs.stat(uri.fsPath);
        if (stat.isDirectory()) {
          this.pendingAttachments.push({ path: uri.fsPath, name: uri.path.split('/').pop() ?? uri.fsPath, mimeType: 'application/x-directory', size: 0 });
          continue;
        }
        if (stat.size > 20 * 1024 * 1024) {
          this.interaction.notify(`Bỏ qua ${uri.path.split('/').pop()}: tệp lớn hơn 20 MB.`, 'warning');
          continue;
        }
        this.pendingAttachments.push({ path: uri.fsPath, name: uri.path.split('/').pop() ?? uri.fsPath, mimeType: kind === 'images' ? 'image/*' : 'application/octet-stream', size: stat.size });
      }
      await this.postAttachments();
    } finally {
      await this.post({ type: 'attachmentLoading', active: false });
    }
  }

  private async attachmentPrompt(attachments: Array<{ path: string; name: string; mimeType: string; size: number }>): Promise<string> {
    if (!attachments.length) return '';
    const sections = [`Tệp đính kèm:\n${attachments.map((item) => `- ${item.name} (${item.path})`).join('\n')}`];
    for (const item of attachments.slice(0, 8)) {
      if (item.mimeType.startsWith('image/') || item.size > 200_000) continue;
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(item.path));
        const sample = bytes.slice(0, 60_000);
        if (sample.includes(0)) continue;
        const content = new TextDecoder().decode(sample);
        sections.push(`<attachment name="${item.name}" path="${item.path}">\n${content}\n</attachment>`);
      } catch {
        // The path remains available to Agent tools when it is inside the workspace.
      }
    }
    return `\n\n${sections.join('\n\n')}`;
  }

  private async handleSlashCommand(prompt: string, model = '', mode: ChatMode = 'agent'): Promise<boolean> {
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
    if (command === '/models' || command === '/model') {
      await this.post({ type: 'openModelPicker' });
      return true;
    }
    if (command === '/goal') {
      const goal = this.context.workspaceState.get<StoredGoal>(GOAL_STATE);
      await this.post(goal
        ? { type: 'goalState', goal }
        : {
            type: 'notice',
            message: '**Tác vụ dài**\n\nNhập `/goal <mục tiêu>` để RelayCode giữ mục tiêu, hiển thị tiến độ và cho phép tạm dừng hoặc tiếp tục.'
          });
      return true;
    }
    if (command === '/compact') {
      const before = this.transcript.length;
      if (before > 8) this.transcript = this.transcript.slice(-8);
      await this.post({
        type: 'notice',
        message: before > 8
          ? `**Đã rút gọn ngữ cảnh**\n\nGiữ lại 8 lượt gần nhất từ ${before} lượt. Nội dung chat vẫn còn trong lịch sử đã lưu.`
          : '**Ngữ cảnh đang gọn**\n\nCuộc chat chưa cần rút gọn thêm.'
      });
      return true;
    }
    if (command === '/skills') {
      this.skills = await discoverSkills(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
      await this.post({ type: 'skills', skills: this.skills.map(({ name, description, source }) => ({ name, description, source })) });
      await this.post({ type: 'focusSkillPicker' });
      return true;
    }
    if (command === '/review' || command === '/diff') {
      await this.post({ type: 'openChanges' });
      if (!this.changes.size) await this.post({ type: 'notice', message: '**Không có thay đổi đang chờ review.**' });
      return true;
    }
    if (command === '/status') {
      const profile = this.profileStore.active();
      const ideContext = this.context.workspaceState.get<boolean>(IDE_CONTEXT_STATE, true);
      const goal = this.context.workspaceState.get<StoredGoal>(GOAL_STATE);
      await this.post({
        type: 'notice',
        message: `**Trạng thái RelayCode**\n\n• Chat: \`${this.currentSessionId}\`\n• Model: \`${model || 'chưa chọn'}\`\n• Mode: **${mode}**\n• Provider: \`${profile?.name ?? 'chưa chọn'}\`\n• IDE context: **${ideContext ? 'bật' : 'tắt'}**\n• Goal: **${goal?.status ?? 'không có'}**\n• Skills: **${this.skills.length}**\n• MCP: **${this.mcpManager.servers().length}**\n• Thay đổi chờ review: **${this.changes.size}**`
      });
      return true;
    }
    if (command === '/plan') {
      await this.post({ type: 'setComposerMode', mode: 'plan' });
      return true;
    }
    if (command === '/ide-context') {
      const enabled = !this.context.workspaceState.get<boolean>(IDE_CONTEXT_STATE, true);
      await this.context.workspaceState.update(IDE_CONTEXT_STATE, enabled);
      await this.post({
        type: 'notice',
        message: enabled
          ? '**IDE context đã bật.**\n\nFile đang mở sẽ tự động đi cùng yêu cầu tiếp theo.'
          : '**IDE context đã tắt.**\n\nBạn vẫn có thể dùng `@selection`, `@file:` hoặc `@folder:` khi cần.'
      });
      return true;
    }
    if (command === '/init') {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (!root) {
        await this.post({ type: 'notice', message: '**Không có workspace để tạo `AGENTS.md`.**' });
        return true;
      }
      const uri = vscode.Uri.joinPath(root, 'AGENTS.md');
      let exists = true;
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        exists = false;
        const scaffold = [
          '# AGENTS.md',
          '',
          '## Project',
          '',
          '- Describe the project architecture and important directories.',
          '',
          '## Commands',
          '',
          '- Build: add the project build command.',
          '- Test: add the project test command.',
          '- Lint: add the project lint command.',
          '',
          '## Conventions',
          '',
          '- Add repository-specific coding and review rules here.',
          ''
        ].join('\n');
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(scaffold));
      }
      await vscode.window.showTextDocument(uri, { preview: false });
      await this.post({ type: 'notice', message: exists ? '**Đã mở `AGENTS.md`.**' : '**Đã tạo khung `AGENTS.md`.**\n\nHãy thay các dòng mẫu bằng lệnh và quy ước thật của dự án.' });
      return true;
    }
    await this.post({
      type: 'notice',
      message: '**Lệnh nhanh**\n\n• `/new` tạo cuộc chat mới\n• `/skills` chọn skill bằng `$`\n• `/models` chọn model\n• `/plan` chuyển sang Plan\n• `/review` xem thay đổi\n• `/status` xem trạng thái runtime\n• `/diagnostics` kiểm tra kết nối\n• `/mcp` mở công cụ MCP\n• `/settings` mở cấu hình\n• `/logs` mở log Agent\n• `/export` xuất gói chẩn đoán'
    });
    return true;
  }

  private async withEditorContext(prompt: string, includeSelection: boolean): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    const sections: string[] = [];
    const autoIdeContext = this.context.workspaceState.get<boolean>(IDE_CONTEXT_STATE, true);
    if (editor && (autoIdeContext || includeSelection || /@selection\b/i.test(prompt))) {
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

  private async chooseDialog(options: ChoiceDialogOptions): Promise<string | undefined> {
    if (!this.view) {
      const labels = options.actions.map((action) => action.label);
      const selected = options.tone === 'warning' || options.tone === 'danger'
        ? await vscode.window.showWarningMessage(options.message, { modal: true, detail: options.detail }, ...labels)
        : await vscode.window.showInformationMessage(options.message, { modal: true, detail: options.detail }, ...labels);
      return options.actions.find((action) => action.label === selected)?.id;
    }
    this.reveal();
    const id = `dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await new Promise<{ action?: string; value?: string }>((resolve) => {
      this.dialogResolvers.set(id, resolve);
      void this.post({ type: 'uiDialog', id, ...options, dismissible: true });
    });
    return result.action;
  }

  private async promptDialog(options: PromptDialogOptions): Promise<string | undefined> {
    if (!this.view) {
      return vscode.window.showInputBox({
        title: options.title,
        prompt: options.message,
        placeHolder: options.placeholder,
        value: options.value,
        password: options.password,
        validateInput: options.required ? (value) => value.trim() ? undefined : 'Trường này không được để trống.' : undefined,
        ignoreFocusOut: true
      });
    }
    this.reveal();
    const id = `dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await new Promise<{ action?: string; value?: string }>((resolve) => {
      this.dialogResolvers.set(id, resolve);
      void this.post({
        type: 'uiDialog',
        id,
        title: options.title,
        message: options.message,
        detail: options.detail,
        tone: options.tone,
        icon: options.icon,
        dismissible: true,
        input: {
          label: options.label,
          placeholder: options.placeholder,
          value: options.value,
          password: options.password,
          required: options.required
        },
        actions: [
          { id: 'cancel', label: 'Hủy', kind: 'secondary' },
          { id: 'confirm', label: options.confirmLabel ?? 'Xác nhận', kind: 'primary' }
        ]
      });
    });
    return result.action === 'confirm' ? result.value : undefined;
  }

  private post(message: unknown): Thenable<boolean> | Promise<boolean> {
    const language = vscode.workspace.getConfiguration('nineRouter').get<'vi' | 'en'>('language', 'vi');
    return this.view?.webview.postMessage(localizeUiPayload(message, language)) ?? Promise.resolve(false);
  }

  private errorText(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === 'TimeoutError') {
      return 'Provider không phản hồi trong thời gian kiểm tra. Với 9Router local, hãy khởi động lại dịch vụ rồi thử lại.';
    }
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      const nested = parsed.error?.message;
      if (nested) return nested.replace(/\\"/g, '"');
    } catch { /* plain error */ }
    if (raw.includes('REQUEST_BODY_INVALID')) return '9Router/provider từ chối payload. Hãy kiểm tra provider và API key của model này trong Dashboard 9Router.';
    return raw;
  }

  private async diagnoseProviderError(error: unknown, provider: ProviderKind, model: string): Promise<string> {
    const initial = this.errorText(error);
    if (provider !== '9router') return initial;
    if (/HTTP 403|bearer token|invalid token|unauthorized|forbidden/i.test(initial)) {
      return this.authFailureMessage(model, initial);
    }
    if (!/không phản hồi|không có hoạt động|chưa trả kết quả Agent/i.test(initial)) return initial;

    try {
      const apiKey = await this.getApiKey(provider);
      await createProvider({ kind: provider, endpoint: this.endpoint, apiKey })
        .checkModel(model, AbortSignal.timeout(8_000));
      return `${initial}\n\n9Router đã hoạt động lại và model \`${model}\` hiện phản hồi bình thường. Request trước bị gián đoạn khi 9Router chuyển hoặc khởi động lại tài khoản; hãy gửi lại, không cần khởi động lại extension.`;
    } catch (probeError) {
      const probeMessage = this.errorText(probeError);
      if (/HTTP 403|bearer token|invalid token|unauthorized|forbidden/i.test(probeMessage)) {
        return this.authFailureMessage(model, probeMessage);
      }
      return `${initial}\n\nKiểm tra model \`${model}\` cũng thất bại: ${probeMessage}`;
    }
  }

  private authFailureMessage(model: string, detail: string): string {
    const compactDetail = detail.replace(/\s+/g, ' ').slice(0, 320);
    return `Model \`${model}\` bị 9Router từ chối xác thực (HTTP 403). Token của tài khoản upstream đã hết hạn hoặc không còn hợp lệ. Mở 9Router → Accounts để đăng nhập lại tài khoản tương ứng, hoặc chọn model/provider khác.\n\nChi tiết: ${compactDetail}`;
  }

  private html(webview: vscode.Webview): string {
    const nonce = getNonce();
    const language = vscode.workspace.getConfiguration('nineRouter').get<'vi' | 'en'>('language', 'vi');
    return localizeUiDocument(renderChatViewHtml({
      language,
      nonce,
      cspSource: webview.cspSource,
      styles: CHAT_VIEW_STYLES,
      controller: CHAT_VIEW_CONTROLLER
    }), language);
  }

  public dispose(): void {
    this.disposing = true;
    for (const resolveDialog of this.dialogResolvers.values()) resolveDialog({});
    this.dialogResolvers.clear();
    this.abortController?.abort();
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    if (this.connectionMonitorTimer) clearInterval(this.connectionMonitorTimer);
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
    'Extension tự chạy dịch vụ nền rồi mở trang quản lý bằng trình duyệt mặc định.': 'RelayCode starts the background service and opens its management page in your default browser.',
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
    'Kiểm tra kết nối': 'Check connection',
    'Kiểm tra': 'Check',
    'Kết nối thủ công': 'Connect manually',
    'Lưu trong Secret Storage': 'Stored in SecretStorage',
    'Lưu và kết nối': 'Save and connect',
    'Nhập model ID từ 9Router': 'Enter a model ID from 9Router',
    'Dùng model này': 'Use this model',
    'Nói điều bạn muốn xây.': 'Describe what you want to build.',
    'Nhập yêu cầu sửa, chạy hoặc kiểm tra code…': 'Ask RelayCode to edit, run or review code…',
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
    'Tác vụ dài': 'Long-running task',
    'Sẵn sàng để review': 'Ready for review',
    'Đang làm việc': 'Working',
    'Đã tạm dừng': 'Paused',
    'Cần xử lý': 'Needs attention',
    'Tạm dừng': 'Pause',
    'Tiếp tục': 'Resume',
    'Xóa mục tiêu': 'Clear goal',
    'Tin nhắn tiếp theo': 'Next messages',
    'tin nhắn đang chờ': 'queued messages',
    'Xóa hàng đợi': 'Clear queue',
    'Bỏ tin nhắn khỏi hàng đợi': 'Remove queued message',
    'Xếp tin nhắn tiếp theo': 'Queue next message',
    'Gửi tiếp sau khi tác vụ hiện tại hoàn thành': 'Send after the current task finishes',
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
