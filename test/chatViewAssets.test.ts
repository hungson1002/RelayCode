import { describe, expect, it } from 'vitest';
import { CHAT_VIEW_CONTROLLER } from '../src/webview/chatViewController';
import { renderChatViewHtml } from '../src/webview/chatViewHtml';
import { CHAT_VIEW_STYLES } from '../src/webview/chatViewStyles';

const html = renderChatViewHtml({
  language: 'vi',
  nonce: 'test-nonce',
  cspSource: 'vscode-webview://test',
  styles: CHAT_VIEW_STYLES,
  controller: CHAT_VIEW_CONTROLLER
});

describe('Chat webview assets', () => {
  it('contains valid standalone controller JavaScript', () => {
    expect(() => new Function(CHAT_VIEW_CONTROLLER)).not.toThrow();
  });

  it('renders CSP, styles and controller without the retired review popup', () => {
    expect(html).toContain("script-src 'nonce-test-nonce'");
    expect(html).toContain(CHAT_VIEW_STYLES);
    expect(html).toContain(CHAT_VIEW_CONTROLLER);
    expect(html).not.toContain('changeReviewPanel');
  });

  it('defines every element ID accessed through the controller helper exactly once', () => {
    const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]!);
    const controllerIds = [...CHAT_VIEW_CONTROLLER.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]!);
    const missing = [...new Set(controllerIds)].filter((id) => !htmlIds.includes(id));
    const duplicates = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
    expect(missing).toEqual([]);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('keeps the connection center reachable and preserves per-resource activity rows', () => {
    expect(html).toContain('id="topConnect"');
    expect(html).toContain('id="backToChat"');
    expect(html).toContain('id="setupCheckResult"');
    expect(html).not.toContain('id="topDisconnect"');
    expect(CHAT_VIEW_CONTROLLER).toContain('activitySteps.get(info.key)');
    expect(CHAT_VIEW_CONTROLLER).toContain("key: 'edit:' + detail");
    expect(CHAT_VIEW_STYLES).toContain('.agent-activity:not(.expanded) .activity-trace{display:none');
    expect(CHAT_VIEW_STYLES).toContain('@keyframes activityShimmer');
    expect(CHAT_VIEW_CONTROLLER).toContain('function activityIconName');
    expect(CHAT_VIEW_CONTROLLER).toContain('activity-icon');
  });

  it('exposes Cockpit Tools as a native provider with its local API Service defaults', () => {
    expect(html).toContain('data-provider="cockpit"');
    expect(html).toContain('<option value="cockpit">Cockpit Tools</option>');
    expect(CHAT_VIEW_CONTROLLER).toContain("endpoint: 'http://127.0.0.1:1455/v1'");
    expect(CHAT_VIEW_CONTROLLER).toContain("keyLabel: 'Cockpit Client Key'");
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
    expect(CHAT_VIEW_CONTROLLER).toContain("function openFloatingSurface(id)");
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
  });

  it('provides hover copy and inline edit controls for branching a conversation', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'editMessage'");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'truncateTurns'");
    expect(CHAT_VIEW_CONTROLLER).toContain("item.dataset.rawContent");
    expect(CHAT_VIEW_CONTROLLER).toContain("Gửi lại sẽ thay thế các phản hồi phía sau.");
    expect(CHAT_VIEW_STYLES).toContain('.message:hover .message-actions');
    expect(CHAT_VIEW_STYLES).toContain('.message-editor');
  });

  it('keeps errors single-layered and gives the running shimmer a resting phase', () => {
    expect(CHAT_VIEW_STYLES).toContain('.message.error{margin:10px 0 18px;padding:0!important;border:0!important;border-left:0!important');
    expect(CHAT_VIEW_STYLES).toContain('#setupError{margin:10px 1px 0');
    expect(CHAT_VIEW_STYLES).not.toContain(')}.error{margin:10px 1px 0');
    expect(CHAT_VIEW_STYLES).toContain('padding:0!important;border:0!important;align-self:center;justify-self:center');
    expect(CHAT_VIEW_STYLES).toContain('animation-duration:3.8s');
    expect(CHAT_VIEW_STYLES).toContain('0%,12%{background-position:190% 0}50%,100%{background-position:-50% 0}');
  });

  it('removes transient Agent activity and terminal output after a turn finishes', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('assistantActivity.remove()');
    expect(CHAT_VIEW_CONTROLLER).toContain('activeTerminal?.remove()');
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'resumeAgent', model: $('model').value");
  });

  it('uses the shared brand registry for models, providers and MCP services', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('const brandIcons = Object.freeze(');
    expect(CHAT_VIEW_CONTROLLER).toContain("brandKey(option.value, activeProvider)");
    expect(CHAT_VIEW_CONTROLLER).toContain("return brandIcons[kind === 'stitch' ? 'google' : kind] || brandIcons.mcp");
    expect(CHAT_VIEW_STYLES).toContain('.model-brand .brand-symbol');
    expect(CHAT_VIEW_STYLES).toContain('.provider-brand-slot');
  });

  it('provides Codex-style goal controls and a follow-up queue', () => {
    expect(html).toContain('id="goalRail"');
    expect(html).toContain('id="goalPause"');
    expect(html).toContain('id="goalResume"');
    expect(html).toContain('id="followUpQueue"');
    expect(CHAT_VIEW_CONTROLLER).toContain("['/goal',");
    expect(CHAT_VIEW_CONTROLLER).toContain("['/compact',");
    expect(CHAT_VIEW_CONTROLLER).toContain('function queueFollowUp(');
    expect(CHAT_VIEW_CONTROLLER).toContain('setTimeout(runNextQueuedFollowUp, 0)');
    expect(CHAT_VIEW_STYLES).toContain('.goal-rail[data-state="running"]');
    expect(CHAT_VIEW_STYLES).toContain('.send.running.queue-ready');
  });

  it('turns commands, skills and context into combinable composer tokens', () => {
    expect(html).toContain('id="composerTokens"');
    expect(CHAT_VIEW_CONTROLLER).toContain('function activeComposerTrigger(');
    expect(CHAT_VIEW_CONTROLLER).toContain('function renderComposerTokens(');
    expect(CHAT_VIEW_CONTROLLER).toContain("...composerSkills.map((skill) => '$' + skill.name)");
    expect(CHAT_VIEW_CONTROLLER).toContain("...composerContexts");
    expect(CHAT_VIEW_STYLES).toContain('.composer-token.skill');
    expect(CHAT_VIEW_STYLES).toContain('.composer-actions .model-trigger');
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

  it('uses library icons for skills, files and live Agent activity', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('const uiIcons = Object.freeze(');
    expect(CHAT_VIEW_CONTROLLER).toContain("glyph: 'cube'");
    expect(CHAT_VIEW_CONTROLLER).toContain('function fileUiIcon(');
    expect(CHAT_VIEW_CONTROLLER).toContain('function activityIconName(');
    expect(CHAT_VIEW_STYLES).toContain('.activity-icon .ui-symbol');
    expect(CHAT_VIEW_STYLES).toContain('@keyframes activityLightSweep');
  });

  it('renders a compact Codex-style transcript with expandable trace and terminal details', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain('function setActivityExpanded(');
    expect(CHAT_VIEW_CONTROLLER).toContain("toggle.className = 'activity-toggle'");
    expect(CHAT_VIEW_CONTROLLER).toContain("trace.className = 'activity-trace'");
    expect(CHAT_VIEW_CONTROLLER).toContain('class="terminal-command"');
    expect(CHAT_VIEW_CONTROLLER).toContain('class="change-summary-icon"');
    expect(CHAT_VIEW_CONTROLLER).toContain("classList.add('complete')");
    expect(CHAT_VIEW_STYLES).toContain('.activity-toggle');
    expect(CHAT_VIEW_STYLES).toContain('.terminal-command');
    expect(CHAT_VIEW_STYLES).toContain('.change-summary-copy');
  });

  it('keeps the sidebar usable at its supported minimum width', () => {
    expect(html).not.toContain('class="narrow-view-warning"');
    expect(CHAT_VIEW_CONTROLLER).toContain("type: 'viewTooNarrow'");
    expect(CHAT_VIEW_CONTROLLER).toContain('const minimumViewWidth = 344');
    expect(CHAT_VIEW_CONTROLLER).toContain('window.devicePixelRatio');
    expect(CHAT_VIEW_CONTROLLER).toContain('function restoreMinimumViewWidth()');
    expect(CHAT_VIEW_STYLES).toContain('.profile-bar{display:grid!important');
    expect(CHAT_VIEW_STYLES).toContain('overflow-x:hidden!important');
    expect(CHAT_VIEW_STYLES).toContain('input[type="number"]::-webkit-inner-spin-button');
  });
});
