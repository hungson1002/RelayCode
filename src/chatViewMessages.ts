import type * as vscode from 'vscode';
import type { ChatMode, ReasoningEffort } from './types';
import type { ProviderKind } from './provider';
import type { McpServerConfig } from './mcpManager';

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'webviewDiagnostic'; level: 'error' | 'rejection'; message: string }
  | { type: 'setLanguage'; language: 'vi' | 'en' }
  | { type: 'approval'; id: string; decision: 'deny' | 'once' | 'similar' }
  | { type: 'resolveToolFailure'; id: string; action: 'retry' | 'skip' | 'change-model'; model?: string }
  | { type: 'resumeAgent'; model?: string }
  | { type: 'discardAgentRun' }
  | { type: 'pauseGoal' }
  | { type: 'resumeGoal'; model?: string }
  | { type: 'clearGoal' }
  | { type: 'acceptChange'; id: string }
  | { type: 'undoChange'; id: string }
  | { type: 'reviewChange'; id: string }
  | { type: 'applyChangeHunk'; id: string; hunkId: number; action: 'accept' | 'undo' }
  | { type: 'acceptAllChanges' }
  | { type: 'undoAllChanges' }
  | { type: 'acceptTaskChanges'; taskId: string }
  | { type: 'undoTaskChanges'; taskId: string }
  | { type: 'setPermissionMode'; mode: 'ask' | 'edit' | 'full' }
  | { type: 'toggleFavoriteModel'; model: string }
  | { type: 'exportDiagnostics' }
  | { type: 'showLogs' }
  | { type: 'connect'; endpoint: string; apiKey?: string; model?: string; provider?: ProviderKind; profileId?: string; profileName?: string; inputPricePerMillion?: number; outputPricePerMillion?: number }
  | { type: 'getProviderKeyState'; provider: ProviderKind; profileId?: string }
  | { type: 'activateProfile'; id: string }
  | { type: 'deleteProfile'; id: string }
  | { type: 'collapseSidebar'; width: number }
  | { type: 'dialogResult'; id: string; action?: string; value?: string }
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
  | { type: 'diagnostics'; draft?: boolean; endpoint?: string; apiKey?: string; provider?: ProviderKind; profileId?: string }
  | { type: 'stopTurn' }
  | { type: 'startRouter' }
  | { type: 'retryConnection' }
  | { type: 'checkRouterConnection' }
  | { type: 'openDashboard' }
  | { type: 'openExternal'; url: string }
  | { type: 'openFile'; path: string }
  | { type: 'openPlanArtifact'; turnIndex: number }
  | { type: 'pickFiles'; kind: 'files' | 'images' | 'resources' }
  | { type: 'pasteImage'; name: string; mimeType: string; dataUrl: string }
  | { type: 'removeAttachment'; index: number }
  | { type: 'loadSession'; id: string }
  | { type: 'deleteSession'; id: string }
  | { type: 'deleteAllSessions' }
  | { type: 'editMessage'; index: number; prompt: string; mode: ChatMode; model: string }
  | { type: 'disconnectProvider' }
  | { type: 'send'; prompt: string; mode: ChatMode; model: string; includeSelection: boolean; reasoningEffort?: ReasoningEffort; serviceTier?: 'default' | 'fast' }
  | { type: 'newThread' }
  | { type: 'refreshSkills' }
  | { type: 'openSettings' };

export function registerChatViewMessageHandler(
  webview: vscode.Webview,
  handler: (message: WebviewMessage) => Promise<void>
): vscode.Disposable {
  return webview.onDidReceiveMessage((candidate: unknown) => {
    if (!isWebviewMessage(candidate)) return;
    void handler(candidate);
  });
}

export function isWebviewMessage(candidate: unknown): candidate is WebviewMessage {
  if (!isRecord(candidate) || typeof candidate.type !== 'string') return false;
  const value = candidate;
  const noPayload = new Set([
    'ready', 'discardAgentRun', 'pauseGoal', 'clearGoal', 'acceptAllChanges',
    'undoAllChanges', 'exportDiagnostics', 'showLogs', 'checkModels',
    'cancelModelCheck', 'getTelemetry', 'openTelemetryDashboard',
    'clearTelemetry', 'getMcpServers', 'setupLocalProvider',
    'stopTurn', 'startRouter', 'retryConnection', 'checkRouterConnection',
    'openDashboard', 'deleteAllSessions', 'disconnectProvider', 'newThread',
    'refreshSkills', 'openSettings'
  ]);
  if (noPayload.has(value.type as string)) return true;

  switch (value.type) {
    case 'webviewDiagnostic':
      return isOneOf(value.level, ['error', 'rejection']) && isString(value.message, 4_000);
    case 'setLanguage':
      return isOneOf(value.language, ['vi', 'en']);
    case 'toggleFavoriteModel':
      return isString(value.model, 300);
    case 'getProviderKeyState':
      return isProviderKind(value.provider) && optionalString(value.profileId, 300);
    case 'approval':
      return isString(value.id, 200) && isOneOf(value.decision, ['deny', 'once', 'similar']);
    case 'resolveToolFailure':
      return isString(value.id, 200)
        && isOneOf(value.action, ['retry', 'skip', 'change-model'])
        && optionalString(value.model, 300);
    case 'resumeAgent':
    case 'resumeGoal':
      return optionalString(value.model, 300);
    case 'acceptChange':
    case 'undoChange':
    case 'reviewChange':
    case 'restoreCheckpoint':
    case 'activateProfile':
    case 'deleteProfile':
    case 'removeMcpServer':
    case 'loginMcp':
    case 'reconnectMcp':
    case 'logoutMcp':
    case 'configureMcpApiKey':
    case 'loadSession':
    case 'deleteSession':
      return isString(value.id, 300);
    case 'applyChangeHunk':
      return isString(value.id, 300)
        && Number.isSafeInteger(value.hunkId)
        && Number(value.hunkId) >= 0
        && isOneOf(value.action, ['accept', 'undo']);
    case 'acceptTaskChanges':
    case 'undoTaskChanges':
      return isString(value.taskId, 300);
    case 'setPermissionMode':
      return isOneOf(value.mode, ['ask', 'edit', 'full']);
    case 'connect':
      return isString(value.endpoint, 4_000)
        && optionalString(value.apiKey, 20_000)
        && optionalString(value.model, 300)
        && (value.provider === undefined || isProviderKind(value.provider))
        && optionalString(value.profileId, 300)
        && optionalString(value.profileName, 300)
        && optionalFiniteNumber(value.inputPricePerMillion)
        && optionalFiniteNumber(value.outputPricePerMillion);
    case 'diagnostics':
      return (value.draft === undefined || typeof value.draft === 'boolean')
        && optionalString(value.endpoint, 4_000)
        && optionalString(value.apiKey, 20_000)
        && (value.provider === undefined || isProviderKind(value.provider))
        && optionalString(value.profileId, 300);
    case 'collapseSidebar':
      return typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0 && value.width < 10_000;
    case 'dialogResult':
      return isString(value.id, 200) && optionalString(value.action, 100) && optionalString(value.value, 100_000);
    case 'saveMcpServer':
      return isMcpServerConfig(value.server)
        && optionalString(value.token, 100_000)
        && (value.env === undefined || isStringRecord(value.env));
    case 'installMcpPreset':
      return isString(value.presetId, 300);
    case 'openExternal':
      return isString(value.url, 8_000);
    case 'openFile':
      return isString(value.path, 32_000);
    case 'openPlanArtifact':
      return Number.isSafeInteger(value.turnIndex) && Number(value.turnIndex) >= 0;
    case 'pickFiles':
      return isOneOf(value.kind, ['files', 'images', 'resources']);
    case 'pasteImage':
      return isString(value.name, 500)
        && isString(value.mimeType, 200)
        && isString(value.dataUrl, 25_000_000);
    case 'removeAttachment':
      return Number.isSafeInteger(value.index) && Number(value.index) >= 0;
    case 'editMessage':
      return Number.isSafeInteger(value.index)
        && Number(value.index) >= 0
        && isString(value.prompt, 2_000_000)
        && isOneOf(value.mode, ['chat', 'agent', 'plan'])
        && isString(value.model, 300);
    case 'send':
      return isString(value.prompt, 2_000_000)
        && isOneOf(value.mode, ['chat', 'agent', 'plan'])
        && isString(value.model, 300)
        && typeof value.includeSelection === 'boolean'
        && (value.reasoningEffort === undefined || isOneOf(value.reasoningEffort, ['minimal', 'low', 'medium', 'high', 'xhigh']))
        && (value.serviceTier === undefined || isOneOf(value.serviceTier, ['default', 'fast']));
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function optionalString(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || isString(value, maxLength);
}

function optionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isOneOf<const T extends readonly string[]>(value: unknown, choices: T): value is T[number] {
  return typeof value === 'string' && choices.includes(value);
}

function isProviderKind(value: unknown): value is ProviderKind {
  return isOneOf(value, ['9router', 'cockpit', 'openai', 'anthropic', 'openai-compatible', 'ollama', 'lm-studio']);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value)
    && Object.keys(value).length <= 200
    && Object.entries(value).every(([key, item]) => key.length <= 500 && isString(item, 100_000));
}

function isMcpServerConfig(value: unknown): value is McpServerConfig {
  if (!isRecord(value)) return false;
  return isString(value.id, 300)
    && isString(value.name, 500)
    && isOneOf(value.transport, ['stdio', 'http'])
    && typeof value.enabled === 'boolean'
    && (value.authMode === undefined || isOneOf(value.authMode, ['oauth', 'token', 'api-key', 'none']))
    && optionalString(value.catalogId, 300)
    && optionalString(value.tokenHeader, 300)
    && optionalString(value.command, 32_000)
    && (value.args === undefined || (
      Array.isArray(value.args)
      && value.args.length <= 1_000
      && value.args.every((item) => isString(item, 32_000))
    ))
    && optionalString(value.url, 8_000);
}
