import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAT_VIEW_CONTROLLER } from '../src/webview/chatViewController';
import { renderChatViewHtml } from '../src/webview/chatViewHtml';
import { CHAT_VIEW_STYLES } from '../src/webview/chatViewStyles';

const providerSource = readFileSync(resolve('src/chatViewProvider.ts'), 'utf8');
const agentRuntimeSource = readFileSync(resolve('src/agentRuntime.ts'), 'utf8');
const webSearchSource = readFileSync(resolve('src/webSearch.ts'), 'utf8');
const projectInstructionsSource = readFileSync(resolve('src/projectInstructions.ts'), 'utf8');
const uiIconsSource = readFileSync(resolve('src/uiIcons.ts'), 'utf8');
const materialIconsSource = readFileSync(resolve('src/materialFileIcons.ts'), 'utf8');
const telemetryDashboardSource = readFileSync(resolve('src/webview/telemetryDashboard.ts'), 'utf8');
const mcpOAuthSource = readFileSync(resolve('src/webview/mcpOAuthResult.ts'), 'utf8');
const extensionManifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

const html = renderChatViewHtml({
  language: 'vi',
  nonce: 'test-nonce',
  cspSource: 'vscode-webview://test',
  styles: CHAT_VIEW_STYLES,
  controller: CHAT_VIEW_CONTROLLER
});

describe('Chat webview assets', () => {
  it('uses the selected provider name throughout the connection center', () => {
    expect(html).toContain('id="setupProviderBadge">Provider</strong>');
    expect(CHAT_VIEW_CONTROLLER).toContain('function comparableEndpoint(value)');
    expect(CHAT_VIEW_CONTROLLER).toContain("hostname.toLowerCase() === 'localhost' ? '127.0.0.1'");
    expect(CHAT_VIEW_CONTROLLER).toContain('isKnownProviderEndpoint(current)');
    expect(CHAT_VIEW_CONTROLLER).toContain('function setProvider(next, changeEndpoint = true, updateBadge = true)');
    expect(CHAT_VIEW_CONTROLLER).toContain('setProvider(option.dataset.provider, true, false)');
    expect(CHAT_VIEW_CONTROLLER).toContain('!currentProfileId || previous !== next || isKnownProviderEndpoint(current)');
    expect(CHAT_VIEW_CONTROLLER).toContain("const draftProvider = $('configProvider').value || '9router'");
    expect(CHAT_VIEW_CONTROLLER).toContain('function restoreSavedProfileDraft()');
    expect(CHAT_VIEW_CONTROLLER).toContain('function closeConfigPanel(restoreDraft = true)');
    expect(html).toContain('id="startRouter" class="primary">Mở 9Router</button>');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('setupProviderBadge').textContent = meta.label");
    expect(CHAT_VIEW_CONTROLLER).toContain("'Kết nối ' + providerName");
    expect(CHAT_VIEW_CONTROLLER).toContain("'Mở 9Router'");
  });

  it('starts a fresh thread in the configured default mode', () => {
    expect(providerSource).toContain("get<'chat' | 'agent'>('defaultMode', 'chat')");
    expect(providerSource).toContain('mode: defaultMode');
    expect(extensionManifest.contributes.configuration.properties['nineRouter.defaultMode'].default).toBe('chat');
    expect(CHAT_VIEW_CONTROLLER).toContain("let mode = 'chat';");
    expect(CHAT_VIEW_CONTROLLER).toContain('setMode(defaultMode);');
    expect(CHAT_VIEW_CONTROLLER).toContain('setMode(data.mode || defaultMode);');
    expect(CHAT_VIEW_CONTROLLER).toContain('Chat directly with the selected model.');
  });

  it('restores composer preferences while keeping untouched defaults', () => {
    expect(providerSource).toContain("const COMPOSER_PREFERENCES_STATE = 'nineRouter.composerPreferences'");
    expect(providerSource).toContain('composerPreferences: this.composerPreferences()');
    expect(providerSource).toContain("message.type === 'saveComposerPreferences'");
    expect(CHAT_VIEW_CONTROLLER).toContain('data.composerPreferences || { models: {}, reasoningEffort: \'medium\', serviceTier: \'default\' }');
    expect(CHAT_VIEW_CONTROLLER).toContain('if (composerPreferences.lastMode) setMode(composerPreferences.lastMode);');
    expect(CHAT_VIEW_CONTROLLER).toContain("setMode(button.dataset.mode, true);");
    expect(CHAT_VIEW_CONTROLLER).toContain("saveComposerPreferences({ mode, model: $('model').value || undefined, reasoningEffort });");
    expect(CHAT_VIEW_CONTROLLER).toContain("saveComposerPreferences({ mode, model: $('model').value || undefined, serviceTier });");
    expect(CHAT_VIEW_CONTROLLER).toContain('composerPreferences.models?.[mode]');
  });

  it('routes explicit Chat web-search requests and exposes the Agent web_search tool', () => {
    expect(providerSource).toContain('buildWebSearchQuery(prompt, previousUserPrompt');
    expect(providerSource).toContain('const webResponse = await searchWebSources(webQuery, turnController.signal)');
    expect(webSearchSource).toContain("name: 'web_search'");
    expect(agentRuntimeSource).toContain('WEB_SEARCH_TOOL');
    expect(agentRuntimeSource).toContain("return searchWeb(String(args.query ?? ''), signal");
    expect(agentRuntimeSource).toContain('Không được nói đã tìm kiếm nếu chưa nhận được kết quả từ web_search');
  });

  it('keeps RelayCode user instructions separate from Codex identity instructions', () => {
    expect(projectInstructionsSource).toContain("'.relaycode', 'AGENTS.md'");
    expect(projectInstructionsSource).not.toContain("'.codex', 'AGENTS.md'");
  });

  it('contains valid standalone controller JavaScript', () => {
    expect(() => new Function(CHAT_VIEW_CONTROLLER)).not.toThrow();
    expect(CHAT_VIEW_CONTROLLER).not.toContain('currentLanguage');
  });

  it('renders GitHub-style Markdown tables in assistant messages', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('function splitMarkdownTableRow(source)');
    expect(CHAT_VIEW_CONTROLLER).toContain('function markdownTableAlignment(cell)');
    expect(CHAT_VIEW_CONTROLLER).toContain('renderMarkdownTable(tableHeaders, tableAlignments, rows)');
    expect(CHAT_VIEW_CONTROLLER).toContain('tableAlignments.every(Boolean)');
    expect(CHAT_VIEW_STYLES).toContain('.message.assistant .markdown-table-wrap');
    expect(CHAT_VIEW_STYLES).toContain('.message.assistant .markdown-table .align-center{text-align:center}');
    expect(CHAT_VIEW_STYLES).toContain('.message.assistant .body strong{font-weight:650}');
    expect(CHAT_VIEW_STYLES).toContain('background:transparent!important');
  });

  it('renders a safe terminal approval card and a scroll-back activity indicator', () => {
    expect(html).toContain('id="runningScrollIndicator"');
    expect(html.indexOf('<footer class="composer-shell">')).toBeLessThan(html.indexOf('id="runningScrollIndicator"'));
    expect(CHAT_VIEW_CONTROLLER).toContain("finishApproval('once')");
    expect(CHAT_VIEW_CONTROLLER).toContain("finishApproval('similar')");
    expect(CHAT_VIEW_CONTROLLER).toContain("finishApproval('always')");
    expect(CHAT_VIEW_CONTROLLER).toContain("finishApproval('deny')");
    expect(CHAT_VIEW_CONTROLLER).toContain("command.textContent = data.command");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("'<strong>Agent cần quyền</strong><span>' + data.message");
    expect(CHAT_VIEW_STYLES).toContain('.permission-card-v2');
    expect(CHAT_VIEW_CONTROLLER).toContain("permissionText.className = 'permission-text'");
    expect(CHAT_VIEW_STYLES).toContain('.permission-card-v2 .permission-text{display:grid;align-content:center');
    expect(CHAT_VIEW_STYLES).toContain('body .message.assistant .body .file-link{display:inline!important;align-items:initial!important;vertical-align:baseline!important');
    expect(CHAT_VIEW_STYLES).toContain('font-family:var(--vscode-font-family)!important;font-size:inherit!important;font-weight:650!important;line-height:inherit!important');
    expect(CHAT_VIEW_STYLES).toContain('body .message.assistant .body .file-link>span:not(.file-type-icon):not(.file-line){vertical-align:baseline!important;line-height:inherit!important}');
    expect(CHAT_VIEW_STYLES).toContain('body .message.assistant .body .file-link .file-type-icon{display:inline-block!important;align-self:auto!important;flex:none!important;width:16px!important;min-width:16px!important;height:16px!important;min-height:16px!important;margin:0 4px 0 0!important;padding:0!important;line-height:0!important;vertical-align:-.34em!important;position:static!important;top:auto!important;transform:none!important;overflow:visible!important}');
    expect(CHAT_VIEW_STYLES).toContain('overflow:visible!important;fill:none!important;shape-rendering:geometricPrecision!important');
    expect(CHAT_VIEW_STYLES).toContain('body .message.assistant .body .file-link .file-type-icon .ui-symbol,body .message.assistant .body .file-link .file-type-icon .ui-symbol svg{display:block!important;width:16px!important;height:16px!important');
    expect(CHAT_VIEW_STYLES).toContain('body .agent-commentary .file-link{display:inline!important;align-items:initial!important;vertical-align:baseline!important');
    expect(CHAT_VIEW_STYLES).toContain('body .agent-commentary .file-link .file-type-icon{display:inline-block!important;align-self:auto!important;flex:none!important;width:16px!important;min-width:16px!important;height:16px!important;min-height:16px!important');
    expect(CHAT_VIEW_STYLES).toContain('body .agent-commentary .file-link .file-type-icon .ui-symbol,body .agent-commentary .file-link .file-type-icon .ui-symbol svg{display:block!important;width:16px!important;height:16px!important');
    expect(CHAT_VIEW_STYLES).toContain('body .message.assistant .body .file-link .file-type-icon,body .agent-commentary .file-link .file-type-icon{transform:translateY(1px)!important}');
    expect(CHAT_VIEW_STYLES).toContain('.running-scroll-indicator');
    expect(CHAT_VIEW_STYLES).toContain('.composer-shell>.running-scroll-indicator');
    expect(CHAT_VIEW_STYLES).toContain('bottom:calc(100% + 12px)');
    expect(html).toContain('class="running-scroll-arrow"');
    expect(html).toContain('class="running-scroll-dots"');
    expect(CHAT_VIEW_STYLES).toContain('.running-scroll-indicator.is-running .running-scroll-dots');
    expect(CHAT_VIEW_STYLES).toContain('.running-scroll-indicator.is-running .running-scroll-arrow');
    expect(CHAT_VIEW_STYLES).toContain('@media(prefers-reduced-motion:reduce){.running-scroll-dots');
    expect(CHAT_VIEW_CONTROLLER).toContain("indicator.classList.toggle('hidden', atBottom)");
    expect(CHAT_VIEW_CONTROLLER).toContain("indicator.classList.toggle('is-running', running)");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('messages').addEventListener('scroll'");
  });

  it('does not report temporary provider rate limits as broken models', () => {
    expect(providerSource).toContain("status: limited ? 'limited' : 'error'");
    expect(providerSource).toContain('Math.min(3, this.models.length)');
    expect(CHAT_VIEW_CONTROLLER).toContain("healthStatus === 'limited'");
    expect(CHAT_VIEW_CONTROLLER).toContain('Tạm giới hạn · thử lại sau');
    expect(CHAT_VIEW_STYLES).toContain('.model-health.limited:before');
  });

  it('keeps provider status and models synchronized after connecting', () => {
    expect(html).toContain('id="connectionBadge"');
    expect(html).toContain('id="connectionBrand"');
    expect(CHAT_VIEW_CONTROLLER).toContain('function updateConnectionBadge(');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('connectionBrand').innerHTML = brandIcon(meta.brand, meta.label)");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('setupProviderMark').innerHTML = brandIcon(meta.brand, meta.label)");
    expect(CHAT_VIEW_CONTROLLER).toContain('function scheduleModelListRecovery()');
    expect(CHAT_VIEW_CONTROLLER).toContain("vscode.postMessage({ type: 'retryConnection' })");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.connected ? 'ready' : routerReady ? 'running'");
    expect(providerSource.indexOf("type: 'configSaved'")).toBeLessThan(providerSource.indexOf('await this.refreshConnection(true);'));
    expect(CHAT_VIEW_STYLES).toContain('#connectionBadge.route-meta');
    expect(CHAT_VIEW_CONTROLLER).toContain("let language = $('uiLanguage').value");
    expect(CHAT_VIEW_CONTROLLER).toContain("language = $('uiLanguage').value");
  });

  it('switches language without remounting the webview and keeps settings open for MCP', () => {
    expect(providerSource).toContain("type: 'languageChanged', language: message.language");
    expect(providerSource).toContain('Keep the current webview mounted');
    expect(providerSource).toContain('localized.replace(controllerMarker, () => CHAT_VIEW_CONTROLLER)');
    expect(CHAT_VIEW_CONTROLLER).toContain('function applyLanguageUi()');
    expect(CHAT_VIEW_CONTROLLER).toContain("openFloatingSurface('mcpPanel', { preserve: ['configPanel'] })");
    expect(CHAT_VIEW_CONTROLLER).toContain('const liveLanguagePairs');
  });

  it('translates dynamically rendered add and slash-command menus', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("appendMenuSection(menu, uiCopy('Thêm', 'Add'))");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('Đính kèm ngữ cảnh từ workspace', 'Attach context from workspace')");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('Chạy tác vụ dài có thể tạm dừng và tiếp tục', 'Run a long task that can be paused and resumed')");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('Đoạn code đang chọn', 'Selected code')");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('Mở 9Router', 'Open 9Router')");
    expect(providerSource).toContain("'Đang khởi động 9Router': 'Starting 9Router'");
    expect(CHAT_VIEW_CONTROLLER).toContain("['+ Hồ sơ mới', '+ New profile']");
  });

  it('localizes the model check confirmation from the selected language', () => {
    expect(providerSource).toContain("title: english ? `Check ${this.models.length} models?`");
    expect(providerSource).toContain("label: english ? 'Check all' : 'Kiểm tra tất cả'");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('checkModels').textContent = checkingModels");
  });

  it('normalizes a tampered language value before rendering HTML attributes', () => {
    const unsafe = renderChatViewHtml({
      language: '<script>bad()</script>' as 'vi',
      nonce: 'safe',
      cspSource: 'vscode-webview://safe',
      styles: '',
      controller: ''
    });
    expect(unsafe).toContain('<html lang="vi">');
    expect(unsafe).not.toContain('<script>bad()</script>');
  });

  it('opens file review in an IDE diff tab without an extension popup', () => {
    expect(html).toContain("script-src 'nonce-test-nonce'");
    expect(html).toContain(CHAT_VIEW_STYLES);
    expect(html).toContain(CHAT_VIEW_CONTROLLER);
    expect(html).not.toContain('id="changeReviewPanel"');
    expect(html).not.toContain('id="reviewHunkList"');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('function renderChangeReview(data)');
    expect(providerSource).toContain("executeCommand(\n      'vscode.diff'");
    expect(providerSource).toContain('beforeUri,\n      afterUri');
    expect(providerSource).not.toContain("executeCommand('vscode.open', previewUri, { preview: true })");
    expect(providerSource).toContain('registerTextDocumentContentProvider(CHANGE_REVIEW_SCHEME');
    expect(providerSource).toContain("executeCommand('editor.action.toggleWordWrap')");
    expect(CHAT_VIEW_CONTROLLER).toContain('DSML');
    expect(CHAT_VIEW_CONTROLLER).toContain('looksLikeProse');
  });

  it('defines every element ID accessed through the controller helper exactly once', () => {
    const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]!);
    const controllerIds = [...CHAT_VIEW_CONTROLLER.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]!);
    const missing = [...new Set(controllerIds)].filter((id) => !htmlIds.includes(id));
    const duplicates = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
    expect(missing).toEqual([]);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('keeps the connection center reachable and coalesces progressive path analysis', () => {
    expect(html).toContain('id="topConnect"');
    expect(html).toContain('id="connectionBadge" class="route-meta" role="button" tabindex="0"');
    expect(html).toContain('id="backToChat"');
    expect(html).toContain('id="setupCheckResult"');
    expect(CHAT_VIEW_CONTROLLER).toContain('function openConnectionCenter()');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('topConnect').addEventListener('click', openConnectionCenter)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("if (activeProvider === '9router') {");
    expect(html).not.toContain('id="topDisconnect"');
    expect(CHAT_VIEW_CONTROLLER).toContain('activitySteps.get(info.key)');
    expect(CHAT_VIEW_CONTROLLER).toContain("key: 'edit:' + detail");
    expect(CHAT_VIEW_CONTROLLER).toContain("key: 'analyze-files'");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("key: 'analyze:' + detail");
    expect(CHAT_VIEW_CONTROLLER).toContain("key: 'command-current'");
    expect(CHAT_VIEW_CONTROLLER).toContain("key: 'test-current'");
    expect(CHAT_VIEW_STYLES).toContain('.agent-activity:not(.expanded) .activity-trace{display:none');
    expect(CHAT_VIEW_CONTROLLER).toContain('function cueActivitySweep(element)');
    expect(CHAT_VIEW_CONTROLLER).toContain('function activityIconName');
    expect(CHAT_VIEW_CONTROLLER).toContain('activity-icon');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('activity-count');
    expect(CHAT_VIEW_STYLES).not.toContain('.activity-count');
    expect(providerSource).toContain('`${lastAgentStatus} · ${waitingSeconds}s`');
    expect(providerSource).not.toContain('`Model đang suy nghĩ · ${waitingSeconds}s`');
    expect(CHAT_VIEW_CONTROLLER).toContain("assistantActivity.className = 'agent-activity'");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("assistantActivity.className = 'agent-activity expanded'");
  });

  it('opens completed Plan responses in a reviewable document before Agent execution', () => {
    expect(providerSource).toContain("message.mode === 'plan' && answer.trim()");
    expect(providerSource).toContain('this.openPlanDocument(');
    expect(providerSource).toContain("message.type === 'proceed'");
    expect(providerSource).toContain("mode: 'agent'");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'planRevision'");
    expect(providerSource).toContain("if (message.mode !== 'plan') void this.post({ type: 'delta', delta: localizedDelta });");
    expect(providerSource).toContain('planChatSummary');
    expect(providerSource).toContain("artifact: planArtifact");
    expect(providerSource).toContain("message.type === 'openPlanArtifact'");
    expect(CHAT_VIEW_CONTROLLER).toContain('function appendPlanArtifact');
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'openPlanArtifact', turnIndex");
    expect(CHAT_VIEW_STYLES).toContain('.plan-artifact{display:grid');
  });

  it('exposes Cockpit Tools as a native provider with its local API Service defaults', () => {
    expect(html).toContain('data-provider="cockpit"');
    expect(html).toContain('<option value="cockpit">Cockpit Tools</option>');
    expect(html).toContain('id="openCockpitCenter"');
    expect(CHAT_VIEW_CONTROLLER).toContain("endpoint: 'http://127.0.0.1:1455/v1'");
    expect(CHAT_VIEW_CONTROLLER).toContain("keyLabel: 'Cockpit Client Key'");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('openCockpitCenter').addEventListener");
    expect(CHAT_VIEW_CONTROLLER).toContain("vscode.postMessage({ type: 'openCockpit' })");
    expect(providerSource).toContain("vscode.Uri.parse('cockpit-tools://')");
  });

  it('keeps connection controls available for every saved provider', () => {
    expect(html).toContain('id="disconnectConnection"');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('disconnectConnection').classList.toggle('hidden', !data.connected)");
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'disconnectProvider'");
  });

  it('exposes OpenCode Console as a native OpenAI-compatible provider', () => {
    expect(html).toContain('data-provider="opencode"');
    expect(html).toContain('<option value="opencode">OpenCode</option>');
    expect(CHAT_VIEW_CONTROLLER).toContain("endpoint: 'https://opencode.ai/zen/v1'");
    expect(CHAT_VIEW_CONTROLLER).toContain("keyLabel: 'OpenCode API key'");
  });

  it('allows saved provider profiles and their secret keys to be deleted safely', () => {
    expect(html).toContain('id="deleteProfile"');
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'deleteProfile', id: profile.id");
    expect(CHAT_VIEW_CONTROLLER).toContain('profiles.length <= 1');
    expect(CHAT_VIEW_CONTROLLER).toContain('API key');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('window.confirm(');
  });

  it('closes floating panels when another surface or the outside area is clicked', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("const floatingSurfaces = ['historyPanel', 'telemetryPanel', 'mcpPanel', 'configPanel', 'accessConfirm', 'connectionDiagnostics', 'uiDialog']");
    expect(CHAT_VIEW_CONTROLLER).toContain("function openFloatingSurface(id, options = {})");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (event.target === $('accessConfirm'))");
    expect(CHAT_VIEW_CONTROLLER).toContain("closeFloatingSurfaces();");
  });

  it('keeps confirmations, prompts and transient notices inside the extension', () => {
    expect(html).toContain('id="uiDialog"');
    expect(html).toContain('id="uiDialogInput"');
    expect(html).toContain('id="toastStack"');
    expect(CHAT_VIEW_CONTROLLER).toContain('function renderUiDialog(data)');
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'dialogResult'");
    expect(CHAT_VIEW_STYLES).toContain('.ui-dialog-backdrop');
    expect(CHAT_VIEW_STYLES).toContain('.toast-stack');
    expect(CHAT_VIEW_STYLES).toContain('width:min(430px,100%);padding:12px 10px 12px 12px');
    expect(CHAT_VIEW_STYLES).toContain('.ui-toast p{margin:0;font-size:11.5px;line-height:1.5}');
    expect(CHAT_VIEW_CONTROLLER).toContain('let queuedUiDialogs = []');
    expect(CHAT_VIEW_CONTROLLER).toContain('queuedUiDialogs.shift()');
    expect(CHAT_VIEW_CONTROLLER).toContain("backdrop.classList.remove('hidden')");
    expect(CHAT_VIEW_CONTROLLER).toContain("toast.addEventListener('click', (event) => event.stopPropagation())");
  });

  it('makes chat deletion explicit and derives concise history titles', () => {
    expect(providerSource).toContain("title: 'Agent vẫn đang chạy'");
    expect(providerSource).toContain("await this.deleteSession(message.id)");
    expect(providerSource).not.toContain("Hãy dừng tác vụ đang chạy trước khi xóa cuộc trò chuyện.");
    expect(providerSource).toContain('title: smartSessionTitle(firstPrompt)');
    expect(providerSource).toContain("turns.find((turn) => turn.role === 'user')");
    expect(providerSource).toContain('.sort((left, right) => right.updatedAt - left.updatedAt)');
  });

  it('keeps normal Chat conversational and scopes RelayCode product context', () => {
    expect(providerSource).toContain('withEditorContext(prompt, message.includeSelection, message.mode)');
    expect(providerSource).toContain("const autoIdeContext = mode !== 'chat' && this.context.workspaceState.get<boolean>(IDE_CONTEXT_STATE, false);");
    expect(providerSource).toContain('9Router là provider/gateway local để định tuyến nhiều model');
    expect(providerSource).toContain('Cockpit Tools là provider/gateway local hỗ trợ nhiều tài khoản');
    expect(providerSource).toContain('const ideContext = this.context.workspaceState.get<boolean>(IDE_CONTEXT_STATE, false);');
  });

  it('adds citations, smart model routing and persistent session summaries', () => {
    expect(providerSource).toContain('formatWebCitations(webSearchResults)');
    expect(providerSource).toContain('rankedModelsForMode(message.mode, message.model');
    expect(providerSource).toContain('sessionSummaryForPrompt(this.sessionSummary)');
    expect(providerSource).toContain('summary: this.sessionSummary');
    expect(CHAT_VIEW_CONTROLLER).toContain('function smartModelForMode(currentMode)');
    expect(CHAT_VIEW_CONTROLLER).toContain('applySmartModelForMode();');
    expect(CHAT_VIEW_CONTROLLER).toContain("['/summary'");
  });

  it('keeps MCP visible through authentication and reports the connection outcome', () => {
    expect(html).toContain('id="mcpConnectionNotice"');
    expect(CHAT_VIEW_CONTROLLER).toContain('A dialog overlays the active surface');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('uiDialog').addEventListener('click', (event) => {\n  event.stopPropagation();");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("activeUiDialog = data;\n  closeFloatingSurfaces('uiDialog');");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'mcpOutcome'");
    expect(CHAT_VIEW_CONTROLLER).toContain('syncPendingMcpOutcome(data.servers || [])');
    expect(providerSource).toContain('runMcpConnectionAction(');
    expect(providerSource).toContain("type: 'openMcpPanel'");
    expect(CHAT_VIEW_CONTROLLER).toContain("openFloatingSurface('mcpPanel', { preserve: ['configPanel'] })");
    expect(providerSource).toContain('đã kết nối thành công');
    expect(CHAT_VIEW_STYLES).toContain('.mcp-connection-notice.success');
  });

  it('always removes the streaming caret when a turn ends', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("turnMessage?.classList.remove('streaming')");
    expect(CHAT_VIEW_CONTROLLER).toContain("document.querySelectorAll('.message.streaming.complete')");
    expect(CHAT_VIEW_STYLES).toContain('.message.assistant .body::after{display:none!important;content:none!important}');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('if (assistantBody && turnStartedAt) {');
  });

  it('shows the stop state immediately and preserves space beside the send button', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("if (!standaloneCommand) setRunning(true)");
    expect(CHAT_VIEW_CONTROLLER).toContain("item.querySelector('.recovery-resume')?.addEventListener('click', () => {\n      setRunning(true);");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('goalResume').addEventListener('click', () => {\n  setRunning(true);");
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .model-picker{margin-right:7px!important}');
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .send.running::before{display:block!important');
    expect(CHAT_VIEW_STYLES).toContain('@media(max-width:350px){');
  });

  it('shows real startup and provider status while the first stream delta is pending', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("let workingStatus = ''");
    expect(CHAT_VIEW_CONTROLLER).toContain('function setWorkingStatus(status)');
    expect(CHAT_VIEW_CONTROLLER).toContain("setWorkingStatus(data.message)");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('Đang kết nối model', 'Connecting to model')");
    expect(CHAT_VIEW_CONTROLLER).toContain("workingLabel.textContent = workingStatus + ' · ' + elapsed");
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .send{width:28px!important;height:28px!important');
  });

  it('bounds large change sets and keeps bulk review actions visible', () => {
    expect(CHAT_VIEW_STYLES).toContain('grid-template-rows:minmax(0,auto) auto');
    expect(CHAT_VIEW_STYLES).toContain('--change-tray-max:clamp(240px,46vh,500px)');
    expect(CHAT_VIEW_STYLES).toContain('flex:0 0 auto!important;height:auto!important;min-height:45px!important');
    expect(CHAT_VIEW_STYLES).toContain('.change-tray #changeList{min-height:0;max-height:calc(var(--change-tray-max) - 45px);overflow-y:auto');
    expect(CHAT_VIEW_STYLES).toContain('.change-tray-footer{position:relative;z-index:2');
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'changeOperation'");
    expect(CHAT_VIEW_CONTROLLER).toContain('updateChangeActionState()');
    expect(CHAT_VIEW_CONTROLLER).toContain('renderedChanges + 60');
    expect(CHAT_VIEW_CONTROLLER).toContain("more.className = 'change-list-more'");
    expect(CHAT_VIEW_CONTROLLER).toContain('if (shouldFollowChanges && !running)');
    expect(CHAT_VIEW_CONTROLLER).toContain("tray.classList.toggle('hidden', !nextChangeCount || changesHidden)");
    expect(CHAT_VIEW_CONTROLLER).toContain("collapsed.classList.toggle('hidden', !nextChangeCount || !changesHidden)");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('collapsedChanges').classList.toggle('hidden', !lastChangeCount)");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (lastChangeCount) $('changeTray').classList.remove('hidden')");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("$('collapsedChanges').classList.toggle('hidden', !running || !lastChangeCount)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("if (running && lastChangeCount) $('changeTray').classList.remove('hidden')");
    expect(CHAT_VIEW_CONTROLLER).toContain('let pendingCompletedChangesState = null');
    expect(CHAT_VIEW_CONTROLLER).toContain("if (data.changes?.length && !running && !hasInlineChangeSummary)");
    expect(CHAT_VIEW_CONTROLLER).toContain("window.dispatchEvent(new MessageEvent('message', { data: completedChangesState }))");
    expect(CHAT_VIEW_CONTROLLER).toContain('if (running) messageList.scrollTop = previousScrollTop');
    expect(CHAT_VIEW_STYLES).toContain('.change-list-more{');
    expect(CHAT_VIEW_STYLES).toContain('.change-tray.hidden{display:none!important}');
    expect(CHAT_VIEW_STYLES.lastIndexOf('.change-tray.hidden{display:none!important}')).toBeGreaterThan(CHAT_VIEW_STYLES.lastIndexOf('.change-tray{display:grid!important'));
  });

  it('uses compact trackless scrollbars across every scroll surface', () => {
    expect(CHAT_VIEW_STYLES).toContain('*::-webkit-scrollbar-track,*::-webkit-scrollbar-track-piece,*::-webkit-scrollbar-corner{border:0!important;background:transparent!important');
    expect(CHAT_VIEW_STYLES).toContain('*::-webkit-scrollbar-thumb{min-height:28px;border:2px solid transparent!important;border-radius:999px!important');
    expect(CHAT_VIEW_STYLES).toContain('*::-webkit-scrollbar-button:single-button:vertical:decrement');
    expect(CHAT_VIEW_STYLES).toContain('*::-webkit-scrollbar-button:single-button:vertical:increment');
    expect(CHAT_VIEW_STYLES).not.toContain('scrollbar-gutter:stable');
    expect(CHAT_VIEW_STYLES).not.toContain('scrollbar-width:none');
  });

  it('provides hover copy and inline edit controls for branching a conversation', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'editMessage'");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'truncateTurns'");
    expect(CHAT_VIEW_CONTROLLER).toContain("item.dataset.rawContent");
    expect(CHAT_VIEW_CONTROLLER).toContain("Gửi lại sẽ thay thế các phản hồi phía sau.");
    expect(CHAT_VIEW_STYLES).toContain('.message:hover .message-actions');
    expect(CHAT_VIEW_STYLES).toContain('.message-editor');
  });

  it('keeps transcript metadata compact and renders Markdown task lists', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('const task = bullet && listText.match(/^\\[(x| )\\]\\s+(.+)$/i)');
    expect(CHAT_VIEW_CONTROLLER).toContain('type="checkbox" class="task-checkbox"');
    expect(CHAT_VIEW_CONTROLLER).toContain("aria-label=\"' + escapeHtml(task[2]) + '\"");
    expect(CHAT_VIEW_CONTROLLER).toContain('function submitTaskChoices(container)');
    expect(CHAT_VIEW_CONTROLLER).toContain("Continue with selections");
    expect(CHAT_VIEW_CONTROLLER).toContain('const previousTaskState = new Map');
    expect(CHAT_VIEW_STYLES).toContain('.task-checkbox:checked{border-color:#65c8aa;background:#65c8aa}');
    expect(CHAT_VIEW_STYLES).toContain('.task-continue{display:inline-flex;align-items:center');
    expect(CHAT_VIEW_STYLES).toContain('.message.user:hover .message-meta');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions{display:flex;align-items:center;justify-content:flex-start');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions .label{display:block!important');
  expect(CHAT_VIEW_STYLES).toContain('.worked-label{font-size:12px!important');
  });

  it('places the assistant copy control after the response review card', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("responseActions.className = 'assistant-response-actions'");
    expect(CHAT_VIEW_CONTROLLER).toContain('responseActions.append(copy, label)');
    expect(CHAT_VIEW_CONTROLLER).toContain("item.insertBefore(card, item.querySelector('.assistant-response-actions,.message-meta'))");
    expect(CHAT_VIEW_CONTROLLER).toContain('function placeAssistantResponseActionsAfterChangeSummary()');
    expect(CHAT_VIEW_CONTROLLER).toContain('placeAssistantResponseActionsAfterChangeSummary();');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions{display:flex;align-items:center;justify-content:flex-start');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions:hover');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions .message-action{opacity:0;transform:translateY(2px);pointer-events:none}');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions .message-action{visibility:hidden;transition:opacity .14s ease,visibility .14s ease,transform .14s ease}');
    expect(CHAT_VIEW_STYLES).toContain('.message.assistant:hover .assistant-response-actions .message-action');
    expect(CHAT_VIEW_STYLES).toContain('.message.assistant.streaming .assistant-response-actions{display:none!important}');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions{display:flex;align-items:center;justify-content:flex-start;gap:7px;min-height:26px;margin-top:1px!important;opacity:1');
    expect(CHAT_VIEW_STYLES).toContain('.assistant-response-actions .label{display:block!important;visibility:hidden;opacity:0');
  expect(CHAT_VIEW_STYLES).toContain('.activity-current,.activity-history-copy{font-weight:400!important}');
    expect(CHAT_VIEW_STYLES).toContain('.chat-change-summary{margin-bottom:3px!important}');
  });

  it('keeps errors single-layered and uses a clear, slow activity sweep', () => {
    expect(CHAT_VIEW_STYLES).toContain('.message.error{margin:10px 0 18px;padding:0!important;border:0!important;border-left:0!important');
    expect(CHAT_VIEW_STYLES).toContain('#setupError{margin:10px 1px 0');
    expect(CHAT_VIEW_STYLES).not.toContain(')}.error{margin:10px 1px 0');
    expect(CHAT_VIEW_STYLES).toContain('padding:0!important;border:0!important;align-self:center;justify-self:center');
    expect(CHAT_VIEW_CONTROLLER).toContain("if (element.classList.contains('sweeping')) return");
    expect(CHAT_VIEW_STYLES).toContain('.activity-row.active .activity-copy{color:#969ba1!important');
    expect(CHAT_VIEW_CONTROLLER).toContain('currentActivity.dataset.sweep = status');
    expect(CHAT_VIEW_CONTROLLER).toContain("current.classList.remove('sweeping')");
    expect(CHAT_VIEW_CONTROLLER).toContain('delete current.dataset.sweep');
    expect(CHAT_VIEW_STYLES).toContain('.activity-current.sweeping::after{content:attr(data-sweep)');
    expect(CHAT_VIEW_STYLES).toContain('animation:activityTextSweep 3s cubic-bezier(.22,.62,.32,1) infinite');
    expect(CHAT_VIEW_STYLES).toContain('@keyframes activityTextSweep{0%,8%{background-position:170% 0}86%,100%{background-position:-70% 0}}');
    expect(CHAT_VIEW_STYLES).toContain('background:linear-gradient(90deg,transparent 28%,rgba(255,255,255,0) 38%');
    expect(CHAT_VIEW_STYLES).toContain('filter:drop-shadow(0 0 2px rgba(255,255,255,.22))');
    expect((CHAT_VIEW_STYLES.match(/animation:activityTextSweep 3s/g) || [])).toHaveLength(1);
    expect(CHAT_VIEW_STYLES).not.toContain('will-change:background-position');
    expect(CHAT_VIEW_STYLES).toContain('.agent-activity.archived .activity-current.sweeping::after{display:none;animation:none}');
    expect(CHAT_VIEW_CONTROLLER).toContain('function classifyChatError(raw)');
    expect(CHAT_VIEW_CONTROLLER).toContain('Model không hỗ trợ xem ảnh');
    expect(CHAT_VIEW_CONTROLLER).toContain("body.classList.add('structured-error')");
    expect(CHAT_VIEW_STYLES).toContain('.chat-error-card');
    expect(CHAT_VIEW_STYLES).toContain('grid-template-columns:28px minmax(0,1fr);align-items:center');
    expect(CHAT_VIEW_STYLES).toContain('.chat-error-icon::before,.chat-error-icon::after{content:"";position:absolute;left:50%;width:2px');
    expect(CHAT_VIEW_STYLES).toContain('.chat-error-icon::before{top:4px;height:8px}');
    expect(CHAT_VIEW_STYLES).toContain('.chat-error-icon::after{top:14px;height:2px}');
  });

  it('keeps only one dropdown open at a time', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('function closeDropdowns(except = null)');
    expect(CHAT_VIEW_CONTROLLER).toContain("if (open) closeDropdowns($('modelMenu'))");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (open) closeDropdowns($('providerMenu'))");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (!isOpen) closeDropdowns($('permMenu'))");
    expect(CHAT_VIEW_CONTROLLER).toContain('if (opening) closeDropdowns(allowMenu)');
  });

  it('shows live activity but removes progress and technical output after a turn finishes', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('function finalizeLiveActivity()');
    expect(CHAT_VIEW_CONTROLLER).toContain('function compactTechnicalHistory(');
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'activityComplete') {\n    finalizeLiveActivity()");
    expect(CHAT_VIEW_CONTROLLER).toContain("turnMessage.querySelectorAll('.agent-commentary,.activity-history-summary,.agent-activity,.terminal-card').forEach((node) => node.remove());");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (data.cancelled) discardTechnicalHistory(turnMessage);");
    expect(CHAT_VIEW_CONTROLLER).toContain("turnMessage.querySelectorAll('.activity-history-summary,.agent-activity,.terminal-card')");
    expect(CHAT_VIEW_CONTROLLER).toContain("document.querySelectorAll('.message.complete .agent-activity').forEach((node) => node.remove());");
    expect(CHAT_VIEW_CONTROLLER).toContain('function scrollMessagesToBottom()');
    expect(CHAT_VIEW_CONTROLLER).toContain("setRunning(true);\n    scrollMessagesToBottom();");
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'resumeAgent', model: $('model').value");
  });

  it('deduplicates recovery cards and prevents the same run from resuming twice', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'recoveredTurn') {\n    if (running) return;\n    document.querySelectorAll('.recovery-card').forEach((card) => card.remove())");
    expect(CHAT_VIEW_CONTROLLER).toContain("item.dataset.runId = data.runId || ''");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'agentRecoveryDismissed') {\n    document.querySelectorAll('.recovery-card').forEach((card) => card.remove())");
    expect(providerSource).toContain('this.resumingRunId !== recovered.runId');
    expect(providerSource).toContain('activeRunAlreadyFinalized(recoveredRun, sessions)');
    expect(providerSource).toContain('this.persistActiveRun({ ...activeRun, answer }, runGeneration)');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('messages').querySelector('.empty')?.remove()");
  });

  it('keeps Agent content, activity and commentary in chronological order', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('function appendAssistantTimelineNode(node)');
    expect(CHAT_VIEW_CONTROLLER).toContain('function isAssistantTimelineNode(child)');
    expect(CHAT_VIEW_CONTROLLER).toContain('function moveAssistantBodyAfterTimeline()');
    expect(CHAT_VIEW_CONTROLLER).toContain('appendAssistantTimelineNode(assistantActivity);');
    expect(CHAT_VIEW_CONTROLLER).toContain("activeCommandGroup.className = 'activity-history-summary command-history';");
    expect(CHAT_VIEW_CONTROLLER).toContain('const commandGroup = activeCommandGroup;');
    expect(CHAT_VIEW_CONTROLLER).toContain('commandDetails.append(activeTerminal);');
    expect(CHAT_VIEW_CONTROLLER).toContain('appendAssistantTimelineNode(block);');
    expect(CHAT_VIEW_CONTROLLER).toContain('function insertAssistantTimelineNode(node)');
    expect(CHAT_VIEW_CONTROLLER).toContain('function archiveAssistantStreamBeforeTimeline()');
    expect(CHAT_VIEW_CONTROLLER).toContain('function materializePendingActivity()');
    expect(CHAT_VIEW_CONTROLLER).toContain('let activityReadyAfterCommentary = false;');
    expect(CHAT_VIEW_CONTROLLER).toContain('if (!assistantActivity && !activityReadyAfterCommentary) {');
    expect(CHAT_VIEW_CONTROLLER).toContain('activityReadyAfterCommentary = true;');
    expect(CHAT_VIEW_CONTROLLER).toContain('pendingActivityStatus = String(status || \'\');');
    expect(CHAT_VIEW_CONTROLLER).toContain('materializePendingActivity();');
    expect(CHAT_VIEW_CONTROLLER).toContain('const duplicateOpening = liveText.length > 0');
    expect(CHAT_VIEW_CONTROLLER).toContain('if (duplicateOpening) {');
    expect(CHAT_VIEW_CONTROLLER).toContain('assistantBody.replaceChildren();');
    expect(CHAT_VIEW_CONTROLLER).toContain('archiveAssistantStreamBeforeTimeline();');
    expect(CHAT_VIEW_CONTROLLER).toContain('const last = timelineNodes.at(-1);');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('assistantBody.after(node);');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('assistantBody.after(block);');
    expect(CHAT_VIEW_CONTROLLER).toContain('if (currentActivity) finalizeLiveActivity();');
    expect(CHAT_VIEW_CONTROLLER).toContain('moveAssistantBodyAfterTimeline();');
  });

  it('offers per-file change actions without adding a separate review button', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("const undo = document.createElement('button');");
    expect(CHAT_VIEW_CONTROLLER).toContain("undo.className = 'tray-undo';");
    expect(CHAT_VIEW_CONTROLLER).toContain("accept.className = 'tray-accept';");
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'undoChange', id: change.id");
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'acceptChange', id: change.id");
    expect(CHAT_VIEW_CONTROLLER).toContain("file.addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }))");
    expect(CHAT_VIEW_CONTROLLER).toContain("activityCopy('Đã phân tích: ', 'Analyzed: ')");
    expect(CHAT_VIEW_CONTROLLER).toContain("activityCopy('Xem file', 'Show files')");
    expect(CHAT_VIEW_CONTROLLER).toContain('const disabled = running || changeOperationBusy;');
    expect(providerSource).toContain("!change || !this.visibleChangeEntries().some(([id]) => id === message.id) || this.abortController || this.changeOperationBusy");
    expect(CHAT_VIEW_STYLES).toContain('.change-row-actions');
    expect(CHAT_VIEW_STYLES).toContain('.change-row-review{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important');
  });

  it('keeps Chat and Agent capabilities separate while exposing permissions', () => {
    expect(html).toContain('id="permissionMode"');
    expect(html).toContain('data-perm="full"');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('function looksLikeWorkspaceMutationPrompt(value)');
    expect(agentRuntimeSource).toContain("tool('write_file'");
    expect(agentRuntimeSource).toContain("tool('apply_patch'");
    expect(agentRuntimeSource).toContain("tool('create_directory'");
  });

  it('reveals streamed provider deltas smoothly without blocking the provider stream', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('if (!assistantBody || !delta) return;');
    expect(CHAT_VIEW_CONTROLLER).toContain('pendingAssistantText += delta;');
    expect(CHAT_VIEW_CONTROLLER).toContain('const charsThisFrame = Math.max(3, Math.min(12, Math.ceil(pendingAssistantText.length / 14)));');
    expect(CHAT_VIEW_CONTROLLER).toContain('pendingAssistantText = pendingAssistantText.slice(charsThisFrame);');
    expect(CHAT_VIEW_CONTROLLER).toContain('if (pendingAssistantText) {\n    scheduleAssistantTextRender();\n    return;\n  }');
    expect(CHAT_VIEW_CONTROLLER).toContain('assistantRenderFrame = requestAnimationFrame(renderPendingAssistantText);');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('prompt').blur();");
    expect(CHAT_VIEW_STYLES).toContain('.composer-shell #prompt:focus,.composer-shell #prompt:focus-visible,.composer-shell.is-running #prompt:focus,.composer-shell.is-running #prompt:focus-visible{caret-color:#f2f3f4!important}');
    expect(CHAT_VIEW_STYLES).not.toContain('caret-color:transparent!important');
    expect(CHAT_VIEW_CONTROLLER).toContain('renderMarkdownInto(assistantBody, assistantRawText);');
    expect(CHAT_VIEW_CONTROLLER).toContain('function markAssistantOutput()');
    expect(CHAT_VIEW_CONTROLLER).toContain('if (state === \'working\' && workingStatus && !assistantHasOutput)');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('typingTimer');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('setTimeout(tick, 16)');
    const renderStart = CHAT_VIEW_CONTROLLER.indexOf('function renderPendingAssistantText()');
    const renderEnd = CHAT_VIEW_CONTROLLER.indexOf('function scheduleAssistantTextRender()', renderStart);
    expect(renderStart).toBeGreaterThan(-1);
    expect(renderEnd).toBeGreaterThan(renderStart);
    expect(CHAT_VIEW_CONTROLLER.slice(renderStart, renderEnd)).toContain('pendingAssistantText = pendingAssistantText.slice(charsThisFrame);');
  });

  it('keeps Agent content deltas on the same live stream', () => {
    expect(agentRuntimeSource).toContain('callbacks.onDelta(progress.content)');
    expect(agentRuntimeSource).toContain("if (progress.type === 'content' && progress.content)");
    expect(agentRuntimeSource).toContain('if (!this.currentStepStreamed)');
  });

  it('deduplicates approval prompts and supports a persistent edit permission', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('item.dataset.approvalKey');
    expect(providerSource).toContain('private pendingApprovalByKey = new Map<string, Promise<boolean>>()');
    expect(providerSource).toContain("message.decision === 'always'");
    expect(providerSource).toContain("globalState.update(PERMISSION_MODE_STATE, 'edit')");
  });

  it('keeps resolved history while removing resolved files from the live tray', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'changeResolved'");
    expect(CHAT_VIEW_CONTROLLER).toContain('resolvedChangeSnapshots.set');
    expect(CHAT_VIEW_CONTROLLER).toContain('const allChanges = pendingChanges');
    expect(CHAT_VIEW_CONTROLLER).toContain("#changeList button:not(.is-resolved),#undoAllChanges,#acceptAllChanges");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("document.querySelectorAll('#changeTray button,");
    expect(CHAT_VIEW_CONTROLLER).not.toContain('changeSummary.remove()');
    expect(CHAT_VIEW_CONTROLLER).toContain("reviewButton.onclick = () => setSummaryExpanded(!changeSummaryExpanded)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("more.className = 'change-summary-more'");
  });

  it('attaches the completed task file list to its assistant message', () => {
    expect(providerSource).toContain('const completedChanges = [...this.changes.entries()]');
    expect(providerSource).toContain('changes: completedChanges');
    expect(CHAT_VIEW_CONTROLLER).toContain('function appendTurnChangeSummary(');
    expect(CHAT_VIEW_CONTROLLER).toContain("item.querySelector('.turn-change-summary')?.remove()");
    expect(CHAT_VIEW_CONTROLLER).toContain("item.insertBefore(card, item.querySelector('.assistant-response-actions,.message-meta'))");
    expect(CHAT_VIEW_CONTROLLER).toContain("card.className = 'chat-change-summary turn-change-summary'");
    expect(CHAT_VIEW_CONTROLLER).toContain('appendTurnChangeSummary(turnMessage, data)');
    expect(CHAT_VIEW_CONTROLLER).toContain("item.insertBefore(card, item.querySelector('.assistant-response-actions,.message-meta'))");
    expect(CHAT_VIEW_CONTROLLER).toContain('setExpanded(false)');
    expect(CHAT_VIEW_CONTROLLER).toContain("document.querySelectorAll('.turn-change-file')");
    expect(CHAT_VIEW_CONTROLLER).toContain('!hasInlineChangeSummary');
  });

  it('uses the shared brand registry for models, providers and MCP services', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('const brandIcons = Object.freeze(');
    expect(CHAT_VIEW_CONTROLLER).toContain("brandKey(option.value, activeProvider)");
    expect(CHAT_VIEW_CONTROLLER).toContain("return brandIcons[kind === 'stitch' ? 'google' : kind] || brandIcons.mcp");
    expect(CHAT_VIEW_STYLES).toContain('.model-brand .brand-symbol');
    expect(CHAT_VIEW_STYLES).toContain('.provider-brand-slot');
    expect(CHAT_VIEW_STYLES).toContain('.model-option>.model-brand>.brand-symbol{display:grid!important;place-items:center!important;transform:none!important}');
    expect(CHAT_VIEW_STYLES).not.toContain('.model-option>.model-brand>.brand-symbol{transform:translateX(-1px)}');
  });

  it('provides Codex-style goal controls and a follow-up queue', () => {
    expect(html).toContain('id="goalRail"');
    expect(html).toContain('id="goalPause"');
    expect(html).toContain('id="goalResume"');
    expect(html).toContain('id="followUpQueue"');
    expect(CHAT_VIEW_CONTROLLER).toContain("['/goal',");
    expect(CHAT_VIEW_CONTROLLER).toContain("['/compact',");
    expect(CHAT_VIEW_CONTROLLER).toContain('function queueFollowUp(');
    expect(CHAT_VIEW_CONTROLLER).toContain("queuedFollowUpReady = false;");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'turnReady'");
    expect(providerSource).toContain("void this.post({ type: 'turnReady' });");
    expect(CHAT_VIEW_STYLES).toContain('.goal-rail[data-state="running"]');
    expect(CHAT_VIEW_STYLES).toContain('.send.running.queue-ready');
    expect(CHAT_VIEW_CONTROLLER).toContain('function closeFollowUpMenus()');
    expect(CHAT_VIEW_CONTROLLER).toContain('followUpQueueEnabled = !followUpQueueEnabled;');
    expect(CHAT_VIEW_CONTROLLER).toContain("if (!followUpQueueEnabled || running || !queuedFollowUps.length || !queuedFollowUpReady) return;");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('Điều hướng', 'Steer')");
    expect(CHAT_VIEW_CONTROLLER).toContain("vscode.postMessage({ type: 'steerTurn', prompt: selected.prompt });");
    expect(CHAT_VIEW_CONTROLLER).toContain("setRelayTooltip(steer, steerHint, 'above');");
    expect(CHAT_VIEW_CONTROLLER).toContain('function updateRelayTooltips()');
    expect(CHAT_VIEW_CONTROLLER).toContain("typeof data.message === 'object'");
    expect(providerSource).toContain("this.activeRunMode !== 'agent'");
    expect(providerSource).toContain('this.pendingSteering.push(message.prompt.trim());');
    expect(providerSource).toContain("en: 'Steering instruction received; Agent will apply it at the next safe step.'");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('Bỏ tin nhắn khỏi hàng đợi', 'Remove message from queue')");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiCopy('1 tin nhắn đang chờ', '1 message queued')");
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .send.running.queue-ready::before{top:10px!important}');
  });

  it('keeps custom tooltips limited to the intentional controls', () => {
    expect(CHAT_VIEW_CONTROLLER).not.toContain('function normalizeTooltip(element)');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('relay-tooltip-popover');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('.title =');
    expect(CHAT_VIEW_CONTROLLER).toContain('data-relay-tooltip');
    expect(CHAT_VIEW_CONTROLLER).not.toContain("setAttribute('title', label)");
    expect(CHAT_VIEW_STYLES).not.toContain('.relay-tooltip-popover');
    expect(CHAT_VIEW_STYLES).toContain('.relay-tooltip-target');
    expect(CHAT_VIEW_STYLES).toContain('content:attr(data-relay-tooltip)');
    expect(CHAT_VIEW_CONTROLLER).not.toContain("element.closest('.history-list')");
    expect(CHAT_VIEW_STYLES).toContain('.history-list{max-height:450px;min-width:0;overflow-y:auto;overflow-x:hidden');
    expect(telemetryDashboardSource).not.toContain('[data-tooltip]::after');
    expect(telemetryDashboardSource).not.toContain(' title=');
    expect(mcpOAuthSource).not.toContain('[data-tooltip]{position:relative}');
    expect(mcpOAuthSource).not.toContain(' title=');
  });

  it('does not add redundant tooltips to labeled connection controls', () => {
    expect(html).not.toContain('id="connectionBadge" class="route-meta" data-tooltip=');
    expect(CHAT_VIEW_CONTROLLER).not.toContain("button.classList.toggle('active', profile.id === currentProfileId); button.setAttribute('data-tooltip', profile.endpoint)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("card.setAttribute('data-tooltip', server?.error");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("$('modelTrigger').setAttribute('data-tooltip', selectedLabel)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("remove.className = 'history-delete'; remove.setAttribute('data-tooltip'");
    expect(CHAT_VIEW_CONTROLLER).toContain("remove.setAttribute('aria-label', uiCopy('Xóa cuộc trò chuyện', 'Delete conversation'))");
  });

  it('turns commands, skills and context into combinable composer tokens', () => {
    expect(html).toContain('id="composerTokens"');
    expect(CHAT_VIEW_CONTROLLER).toContain('function activeComposerTrigger(');
    expect(CHAT_VIEW_CONTROLLER).toContain('function renderComposerTokens(');
    expect(CHAT_VIEW_CONTROLLER).toContain("...composerSkills.map((skill) => '$' + skill.name)");
    expect(CHAT_VIEW_CONTROLLER).toContain("...composerContexts");
    expect(CHAT_VIEW_STYLES).toContain('.composer-token.skill');
    expect(CHAT_VIEW_CONTROLLER).toContain('let composerCommand = null');
    expect(CHAT_VIEW_STYLES).toContain('.composer-tokens{display:flex;order:-1');
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .model-trigger');
    expect(CHAT_VIEW_CONTROLLER).toContain('function renderUserPrompt(body, content)');
    expect(CHAT_VIEW_CONTROLLER).toContain("chip.className = 'sent-prompt-token ' + token.kind");
    expect(CHAT_VIEW_STYLES).toContain('.sent-prompt-token.skill');
  });

  it('keeps permission and model controls compact on narrow sidebars', () => {
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .mode-trigger:after,.composer-actions .perm-arrow{display:none!important}');
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .perm-wrap{display:block!important;flex:none!important}');
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .model-picker{flex:0 1 auto!important;width:auto!important;max-width:118px!important;');
    expect(CHAT_VIEW_STYLES).toContain('transform:translateX(var(--perm-menu-shift,0px))!important');
    expect(CHAT_VIEW_CONTROLLER).toContain('function positionPermissionMenu()');
  });

  it('turns pasted links into compact branded composer tokens', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('let composerLinks = []');
    expect(CHAT_VIEW_CONTROLLER).toContain('function compactExternalLink(');
    expect(CHAT_VIEW_CONTROLLER).toContain("if (host === 'github.com')");
    expect(CHAT_VIEW_CONTROLLER).toContain('function extractComposerLinks(');
    expect(CHAT_VIEW_CONTROLLER).toContain("...composerLinks.map((link) => '[' + link.label + '](' + link.url + ')')");
    expect(CHAT_VIEW_CONTROLLER).toContain("isGithub ? brandIcon('github', 'GitHub')");
    expect(CHAT_VIEW_STYLES).toContain('.composer-token.link');
    expect(CHAT_VIEW_STYLES).toContain('.rich-link-icon');
  });

  it('uses one polished menu system for Add, commands, skills and context', () => {
    expect(html).toContain('id="addMenu"');
    expect(html).toContain('id="sendIcon"');
    expect(CHAT_VIEW_CONTROLLER).toContain('function renderAddMenu(');
    expect(CHAT_VIEW_CONTROLLER).toContain("kind: 'resources'");
    expect(CHAT_VIEW_CONTROLLER).toContain('function createMenuRow(');
    expect(CHAT_VIEW_CONTROLLER).toContain("uiIcon('arrowUp')");
    expect(CHAT_VIEW_STYLES).toContain('.add-menu,.composer-menu');
    expect(CHAT_VIEW_STYLES).toContain('.send-icon');
  });

  it('does not reopen a model picker that the user closed during a health check', () => {
    expect(CHAT_VIEW_CONTROLLER).not.toContain('keepModelMenuOpen');
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'modelCheckEnd'");
  });

  it('defers favorite reordering until the model picker is opened again and uses a larger bookmark control', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('let favoriteModelsAtMenuOpen = []');
    expect(CHAT_VIEW_CONTROLLER).toContain('if (open) favoriteModelsAtMenuOpen = [...favoriteModels]');
    expect(CHAT_VIEW_CONTROLLER).toContain("const rankingFavorites = $('modelMenu').classList.contains('hidden') ? favoriteModels : favoriteModelsAtMenuOpen");
    expect(CHAT_VIEW_CONTROLLER).toContain('favorite.innerHTML = \'<svg viewBox="0 0 24 24"');
    expect(CHAT_VIEW_STYLES).toContain('grid-template-columns:24px minmax(0,1fr) 14px 28px!important');
    expect(CHAT_VIEW_STYLES).toContain('.model-favorite svg{display:block;width:16px;height:16px');
  });

  it('clears a pending model-switch target when the failure is retried or skipped', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("if (pendingToolFailureId === data.id) pendingToolFailureId = ''");
  });

  it('uses library icons for skills, files and live Agent activity', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('const uiIcons = Object.freeze(');
    expect(CHAT_VIEW_CONTROLLER).toContain("glyph: 'cube'");
    expect(CHAT_VIEW_CONTROLLER).toContain('function fileUiIcon(');
    expect(CHAT_VIEW_CONTROLLER).toContain('function activityIconName(');
    expect(CHAT_VIEW_STYLES).toContain('.activity-icon .ui-symbol');
    expect(CHAT_VIEW_STYLES).toContain('@keyframes activityTextSweep');
    expect(uiIconsSource).toContain("from './materialFileIcons'");
    expect(uiIconsSource).toContain('fileHtml: materialHtml');
    expect(uiIconsSource).toContain('fileCss: materialCss');
    expect(uiIconsSource).toContain('fileJs: materialJavascript');
    expect(materialIconsSource).toContain('export const materialCss = svg(');
    expect(materialIconsSource).toContain('<path fill="#7e57c2"');
    expect(materialIconsSource).not.toContain('<path fill="#ffffff"');
    expect(CHAT_VIEW_CONTROLLER).toContain('function appendCommentaryBeforePendingActivity(block)');
  });

  it('keeps the header compact and uses aligned file-type library icons', () => {
    expect(extensionManifest.contributes.views.nineRouter[0].name).toBe('Chat');
    const titleCommands = extensionManifest.contributes.menus['view/title'];
    expect(titleCommands.find((item: { command: string }) => item.command === 'nineRouter.configure')?.group).toBe('navigation@1');
    expect(html).toContain('id="historyToggle" class="header-action" aria-label="Lịch sử chat"');
    expect(html).toContain('id="settings" class="header-action icon-only" aria-label="Cài đặt"');
    expect(CHAT_VIEW_STYLES).toContain('.route-header{height:49px!important');
    expect(CHAT_VIEW_STYLES).toContain('.header-action.icon-only{display:inline-flex!important;visibility:visible!important;opacity:1!important');
    expect(CHAT_VIEW_STYLES).toContain('.file-type-icon,.file-type-icon[class]{display:inline-grid!important;place-items:center!important');
    expect(CHAT_VIEW_CONTROLLER).toContain("+ uiIcon(icon)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain('fileGlyphLabels');
    expect(CHAT_VIEW_STYLES).toContain('filter:drop-shadow(0 1px 4px color-mix(in srgb,currentColor 24%,transparent))');
    expect(CHAT_VIEW_STYLES).toContain('color:#58aee8!important');
    expect(CHAT_VIEW_STYLES).toContain('grid-template-columns:minmax(150px,320px) max-content!important');
    expect(CHAT_VIEW_STYLES).toContain('.header-action-label{display:none!important}');
    expect(CHAT_VIEW_STYLES).not.toContain('content:attr(data-tooltip)');
    expect(CHAT_VIEW_STYLES).toContain('color:var(--relay-file-accent)!important');
    expect(CHAT_VIEW_STYLES).toContain('grid-template-columns:minmax(150px,240px) minmax(0,1fr)!important');
    expect(CHAT_VIEW_STYLES).toContain('.header-action.icon-only,#settings{display:inline-flex!important');
    expect(CHAT_VIEW_STYLES).toContain('@media(max-width:620px)');
    expect(CHAT_VIEW_STYLES).toContain('body .change-file{display:grid!important;grid-template-columns:24px minmax(0,1fr)!important');
    expect(CHAT_VIEW_CONTROLLER).toContain("data-file-kind=\"' + icon + '\"");
    expect(CHAT_VIEW_CONTROLLER).toContain("uiIcon(icon)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain('fileGlyphLabels');
    expect(CHAT_VIEW_STYLES).toContain('body .file-type-icon.fileJs,body .file-type-icon.fileJsx{color:#e8c84f!important}');
    expect(CHAT_VIEW_STYLES).toContain('body .file-type-icon.fileCss{color:#5aa7e8!important}');
    expect(CHAT_VIEW_CONTROLLER).not.toContain("row.setAttribute('data-tooltip', change.path)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain('class="file-link" data-tooltip="');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('.title =');
    expect(html).not.toContain(' title="');
    expect(html).not.toContain('data-tooltip');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('data-tooltip');
    expect(CHAT_VIEW_STYLES).toContain('body .message.assistant .body .file-link:hover{border:0!important;background:transparent!important');
    expect(CHAT_VIEW_STYLES).toContain('body .message.assistant .body .file-link>span:not(.file-type-icon):not(.file-line)');
    expect(CHAT_VIEW_STYLES).toContain('display:inline!important;align-items:initial!important;vertical-align:baseline!important');
    expect(CHAT_VIEW_STYLES).toContain('body .activity-current-icon[data-icon="fileHtml"]');
    expect(CHAT_VIEW_STYLES).toContain('body .activity-current-icon[data-icon="fileCss"]');
    expect(CHAT_VIEW_CONTROLLER).toContain("if (/\\.(?:vue)$/.test(clean)) return 'fileVue'");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (/\\.(?:sql)$/.test(clean)) return 'fileSql'");
  });

  it('opens Chat first and reconnects the saved provider without gating the UI', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("} else if (data.type === 'bootstrap') {");
    expect(CHAT_VIEW_CONTROLLER).toContain('// Chat is the primary surface.');
    expect(CHAT_VIEW_CONTROLLER).toContain("if (data.connected && !setupOpenRequested) showSetup(false)");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("if (!data.connected && !setupDismissed) showSetup(true)");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('topConnect').classList.remove('hidden')");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('topConnect').classList.toggle('online', Boolean(data.connected))");
    expect(providerSource).toContain("if (provider === '9router' && vscode.workspace.isTrusted && routerRuntime?.state !== 'ready')");
    expect(providerSource).toContain('this.requireTrustedWorkspaceForRouter();');
    expect(providerSource).toContain("await this.routerProcess.ensureRunning(this.endpoint, routerCommand");
    expect(providerSource).toContain('private async ensureRouterInstalled(routerCommand: string): Promise<boolean>');
    expect(providerSource).toContain("label: 'Cài và mở 9Router'");
  });

  it('does not block provider and model startup on skill discovery', () => {
    const readyStart = providerSource.indexOf("} else if (message.type === 'ready') {");
    const readyEnd = providerSource.indexOf("} else if (message.type === 'getProviderKeyState')", readyStart);
    const readySource = providerSource.slice(readyStart, readyEnd);
    expect(readySource).toContain("type: 'bootstrap'");
    expect(readySource).toContain('await this.refreshConnection(false)');
    expect(readySource).toContain('void this.refreshSkillsInBackground()');
    expect(readySource.indexOf("type: 'bootstrap'")).toBeLessThan(readySource.indexOf('await this.refreshConnection(false)'));
    expect(readySource.indexOf('await this.refreshConnection(false)')).toBeLessThan(readySource.indexOf('void this.refreshSkillsInBackground()'));
    expect(readySource).not.toContain('await discoverSkills(');
  });

  it('registers the webview message bridge before HTML can emit ready', () => {
    const resolveStart = providerSource.indexOf('public resolveWebviewView(view: vscode.WebviewView): void {');
    const resolveEnd = providerSource.indexOf('\n  public reveal()', resolveStart);
    const resolveSource = providerSource.slice(resolveStart, resolveEnd);
    expect(resolveSource.indexOf('registerChatViewMessageHandler(')).toBeGreaterThan(-1);
    expect(resolveSource.indexOf('view.webview.html =')).toBeGreaterThan(-1);
    expect(resolveSource.indexOf('registerChatViewMessageHandler(')).toBeLessThan(resolveSource.indexOf('view.webview.html ='));
  });

  it('retries the startup handshake until bootstrap is acknowledged', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('function requestBootstrap()');
    expect(CHAT_VIEW_CONTROLLER).toContain("vscode.postMessage({ type: 'ready' })");
    expect(CHAT_VIEW_CONTROLLER).toContain('startupReadyTimer = setTimeout(requestBootstrap, 1500)');
    expect(CHAT_VIEW_CONTROLLER).toContain("} else if (data.type === 'bootstrap') {\n    if (startupReadyTimer) clearTimeout(startupReadyTimer);");
    expect(CHAT_VIEW_CONTROLLER).toContain('requestBootstrap();');
  });

  it('initializes provider state from the host when Antigravity drops the ready bridge event', () => {
    expect(providerSource).toContain("this.output.appendLine('[webview] host startup fallback')");
    expect(providerSource).toContain("void this.onMessage({ type: 'ready' })");
    expect(providerSource).toContain('if (this.webviewInitialized) return');
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'webviewDiagnostic'");
  });

  it('renders Codex-style live trace and keeps only the conclusion after completion', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('function setActivityExpanded(');
    expect(CHAT_VIEW_CONTROLLER).toContain('function appendAgentCommentary(');
    expect(CHAT_VIEW_CONTROLLER).toContain('function archiveStreamedProgress(');
    expect(CHAT_VIEW_CONTROLLER).toContain('function finalizeLiveActivity(');
    expect(CHAT_VIEW_CONTROLLER).toContain('finalizeLiveActivity();');
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'commentary'");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'activityComplete'");
    expect(CHAT_VIEW_CONTROLLER).toContain("turnMessage.querySelectorAll('.agent-commentary,.activity-history-summary,.agent-activity,.terminal-card').forEach((node) => node.remove())");
    expect(CHAT_VIEW_CONTROLLER).toContain("toggle.className = 'activity-toggle'");
    expect(CHAT_VIEW_CONTROLLER).toContain("trace.className = 'activity-trace'");
    expect(CHAT_VIEW_CONTROLLER).toContain('class="terminal-command"');
    expect(CHAT_VIEW_CONTROLLER).toContain('class="change-summary-icon"');
    expect(CHAT_VIEW_CONTROLLER).toContain("classList.add('complete')");
    expect(CHAT_VIEW_STYLES).toContain('.agent-commentary{');
    expect(CHAT_VIEW_STYLES).toContain('.activity-toggle');
    expect(CHAT_VIEW_STYLES).toContain('.terminal-command');
    expect(CHAT_VIEW_STYLES).toContain('.activity-history-summary');
    expect(CHAT_VIEW_STYLES).toContain('.change-summary-copy');
    expect(CHAT_VIEW_STYLES).toContain('.chat-change-summary{display:block;margin:12px 0 50px');
    expect(providerSource).toContain("type: 'commentary'");
    expect(providerSource).toContain("type: 'intermediateStep'");
    expect(providerSource).toContain('onIntermediateStep: (content) =>');
    expect(providerSource).toContain("type: 'activityComplete'");
    expect(providerSource).toContain('let latestCheckpoint = resumeCheckpoint;');
    expect(providerSource).toContain('latestCheckpoint = checkpoint;');
    expect(providerSource).toContain("await this.post({ type: 'intermediateStep', content: '' });");
    expect(providerSource).toContain('findHealthyFallbackModel(candidates, candidate, providerClient');
    expect(providerSource).toContain("type: 'modelSwitched', model: nextModel, from: candidate");
    expect(providerSource).toContain('providerClient.checkModel(candidate');
    expect(providerSource).toContain('tuningForModel(candidate)');
    expect(providerSource).toContain('đang chuyển sang model dự phòng ${nextModel}');
    expect(providerSource).not.toContain("type: 'notice', message: `Agent đã tự chuyển sang model dự phòng");
  });

  it('keeps the visible send control as a reliable stop button during a run', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("$('send').classList.toggle('queue-ready', running && hasPrompt && followUpQueueEnabled)");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('send').setAttribute('aria-label', running ? (hasPrompt && followUpQueueEnabled ? 'Gửi vào hàng chờ' : 'Dừng phản hồi') : 'Gửi')");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (effectiveComposerPrompt() && followUpQueueEnabled) {\n      send();\n      return;\n    }");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('send').classList.add('stopping');\n  vscode.postMessage({ type: 'stopTurn' });");
    expect(CHAT_VIEW_CONTROLLER).toContain("vscode.postMessage({ type: 'stopTurn' });\n  // Release the composer immediately.");
    expect(CHAT_VIEW_CONTROLLER).toContain("settleTurn({ cancelled: true, timestamp: Date.now() });\n}");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("if ($('prompt').value.trim()) {\n      send();");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'cancelPendingInteractions'");
    expect(providerSource).toContain('private stopActiveTurn(): void');
    expect(providerSource).toContain("this.post({ type: 'cancelPendingInteractions' })");
    expect(providerSource).toContain('const turnController = new AbortController()');
    expect(providerSource).toContain('if (this.abortController === turnController) this.abortController = undefined');
    expect(providerSource).toContain('if (stopGeneration !== this.stopGeneration) return');
    expect(providerSource).toContain("this.post({ type: 'stopAcknowledged', active })");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'stopAcknowledged'");
    expect(CHAT_VIEW_CONTROLLER).toContain("if (running) settleTurn({ cancelled: true, timestamp: Date.now() });");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'turnEnd') {\n    // Provider deltas are batched per animation frame");
    expect(CHAT_VIEW_CONTROLLER).toContain("reconcileFinalAssistantText(data.content)");
    expect(providerSource).toContain("content: finalAnswer");
    expect(CHAT_VIEW_CONTROLLER).toContain('assistantRawText += pendingAssistantText;');
    expect(CHAT_VIEW_CONTROLLER).toContain('pendingTurnEnd = data;');
    expect(CHAT_VIEW_CONTROLLER).toContain("settleTurn(data);");
    expect(CHAT_VIEW_CONTROLLER).toContain("function settleTurn(data) {");
    expect(CHAT_VIEW_CONTROLLER).toContain("document.querySelectorAll('.message.streaming').forEach");
    expect(CHAT_VIEW_CONTROLLER).toContain("finally {\n    if (workingTimer) clearInterval(workingTimer);");
    expect(providerSource.indexOf("type: 'turnEnd',\n        timestamp: completedAt")).toBeLessThan(providerSource.indexOf('await this.saveSession(message.mode, effectiveModel);', providerSource.indexOf("type: 'turnEnd',\n        timestamp: completedAt")));
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'activeTurnState'");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'recoveredTurn') {\n    if (running) return;");
    expect(providerSource.match(/type: 'recoveredTurn'/g)).toHaveLength(1);
  });

  it('keeps draft provider diagnostics isolated and presents configuration errors as toasts', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("draft: true,\n    endpoint: $('configEndpoint').value");
    expect(CHAT_VIEW_CONTROLLER).toContain("profileId: currentProfileId || undefined");
    expect(CHAT_VIEW_CONTROLLER).toContain("showUiToast({ message: 'Hãy chọn một model trước khi gửi.', tone: 'danger' })");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("appendMessage('assistant', data.message, true)");
    expect(providerSource).toContain("const draft = options.draft === true");
    expect(providerSource).toContain("if (!draft) {\n        this.models = models.map");
    expect(providerSource).toContain("{ type: 'diagnosticsResult', ok: true, draft");
  });

  it('keeps saved provider keys and only renders models returned by the active provider', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("apiKey: $('configApiKey').value || undefined");
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'getProviderKeyState', provider: next");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'providerKeyState'");
    expect(CHAT_VIEW_CONTROLLER).toContain('data.requestId === keyStateRequestId');
    expect(providerSource).toContain('this.profileStore.apiKeyFor(savedProfile.id, provider)');
    expect(providerSource).not.toContain('CUSTOM_MODELS_STATE');
    expect(providerSource).not.toContain("message.type === 'addCustomModel'");
    expect(CHAT_VIEW_CONTROLLER).not.toContain("'__custom__'");
    expect(CHAT_VIEW_CONTROLLER).not.toContain('· tùy chỉnh');
    expect(html).not.toContain('id="customModelRow"');
  });

  it('keeps parenthesized rich links together and rejects whitespace-only model responses', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('class="rich-link-group"');
    expect(CHAT_VIEW_STYLES).toContain('.rich-link-group{display:inline-flex');
    expect(CHAT_VIEW_STYLES).toContain('white-space:nowrap');
    expect(providerSource).toContain('if (!answer.trim()) throw new Error(`Model ${candidate} đã kết thúc nhưng không trả về nội dung.`)');
    expect(providerSource).toContain('if (answer.trim() || candidate === candidates[candidates.length - 1]) throw lastError;');
    expect(providerSource).toContain('const completedAnswer = answer.trim();');
    expect(providerSource).toContain("content: planChatSummary || completedAnswer || 'Agent kết thúc nhưng model không trả về nội dung.'");
  });

  it('can clear all saved chat history without orphaning pending reviews', () => {
    expect(html).toContain('id="clearAllHistory"');
    expect(CHAT_VIEW_CONTROLLER).toContain("vscode.postMessage({ type: 'deleteAllSessions' })");
    expect(providerSource).toContain("message.type === 'deleteAllSessions'");
    expect(providerSource).toContain('private async deleteAllSessions(): Promise<void>');
    expect(providerSource).toContain("title: 'Lịch sử còn file chưa xử lý'");
    expect(providerSource).toContain("{ id: 'review', label: 'Xem file'");
    expect(providerSource).toContain("{ id: 'keep', label: 'Giữ tất cả & xóa'");
    expect(providerSource).toContain("{ id: 'undo', label: 'Hoàn tác tất cả & xóa'");
    expect(providerSource).toContain('resolvePendingChanges(pendingEntries, choice)');
    expect(providerSource).toContain('find((session) => pendingSessionIds.has(session.id))');
    expect(providerSource).toContain("globalState.update(CHAT_SESSIONS_STATE, [])");
  });

  it('lets pending chat deletion review, keep, or undo its files safely', () => {
    expect(providerSource).toContain("{ id: 'review', label: 'Xem file'");
    expect(providerSource).toContain("{ id: 'keep', label: 'Giữ thay đổi & xóa'");
    expect(providerSource).toContain("{ id: 'undo', label: 'Hoàn tác & xóa'");
    expect(providerSource).toContain("private async resolveSessionChanges(id: string, action: 'keep' | 'undo')");
    expect(providerSource).toContain('await this.loadSession(id)');
    expect(CHAT_VIEW_CONTROLLER).toContain("$('historyPanel').classList.add('hidden')");
    expect(CHAT_VIEW_STYLES).toContain('.ui-dialog>footer.many');
  });

  it('orders chat history by latest activity as soon as a new user turn starts', () => {
    expect(providerSource).toContain('.sort((left, right) => right.updatedAt - left.updatedAt)');
    expect(providerSource).toContain("this.transcript.push({ role: 'user'");
    expect(providerSource).toContain('await this.saveSession(message.mode, message.model);');
  });

  it('collapses the host sidebar after a deliberate drag below its supported width', () => {
    expect(html).not.toContain('class="narrow-view-warning"');
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'collapseSidebar'");
    expect(CHAT_VIEW_CONTROLLER).toContain('const minimumViewWidth = 344');
    expect(CHAT_VIEW_CONTROLLER).toContain('const minimumNarrowDrag = 18');
    expect(CHAT_VIEW_CONTROLLER).toContain('function collapseIfStillNarrow()');
    expect(CHAT_VIEW_CONTROLLER).toContain('narrowCollapseTimer = setTimeout(collapseIfStillNarrow, 140)');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('window.devicePixelRatio');
    expect(CHAT_VIEW_CONTROLLER).not.toContain('restoreMinimumViewWidth');
    expect(CHAT_VIEW_STYLES).toContain('.profile-bar{display:grid!important');
    expect(CHAT_VIEW_STYLES).toContain('overflow-x:hidden!important');
    expect(CHAT_VIEW_STYLES).toContain('input[type="number"]::-webkit-inner-spin-button');
  });
});
