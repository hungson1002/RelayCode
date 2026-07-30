import type * as vscode from 'vscode';
import type { ChatMode, ReasoningEffort } from './types';
import type { ProviderKind } from './provider';
import type { McpServerConfig } from './mcpManager';

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'setLanguage'; language: 'vi' | 'en' }
  | { type: 'addCustomModel'; model: string }
  | { type: 'approval'; id: string; allow: boolean }
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
  | { type: 'diagnostics' }
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

function isWebviewMessage(candidate: unknown): candidate is WebviewMessage {
  return Boolean(candidate && typeof candidate === 'object' && typeof (candidate as { type?: unknown }).type === 'string');
}
