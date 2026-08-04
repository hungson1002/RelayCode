import { BRAND_ICONS, MODEL_BRAND_RULES } from '../brandIcons';
import { UI_ICONS } from '../uiIcons';

export const CHAT_VIEW_CONTROLLER = String.raw`
const vscode = acquireVsCodeApi();
window.addEventListener('error', (event) => {
  vscode.postMessage({
    type: 'webviewDiagnostic',
    level: 'error',
    message: String(event.message || 'Unknown webview error') + ' @ ' + String(event.lineno || 0) + ':' + String(event.colno || 0)
  });
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason || 'Unknown rejected promise');
  vscode.postMessage({ type: 'webviewDiagnostic', level: 'rejection', message: reason.slice(0, 4000) });
});
const $ = (id) => document.getElementById(id);
let narrowCollapseTimer = 0;
let narrowCollapseArmed = false;
let resizeTrackingReady = false;
let lastViewWidth = 0;
let narrowShrinkDistance = 0;
const minimumViewWidth = 344;
const minimumNarrowDrag = 18;
function currentViewWidth() {
  return Math.min(
    document.documentElement.clientWidth,
    document.body.clientWidth || Number.POSITIVE_INFINITY,
    window.visualViewport?.width || Number.POSITIVE_INFINITY
  );
}
function cancelNarrowCollapse() {
  if (narrowCollapseTimer) clearTimeout(narrowCollapseTimer);
  narrowCollapseTimer = 0;
}
function collapseIfStillNarrow() {
  const width = currentViewWidth();
  if (
    document.visibilityState !== 'visible'
    || !Number.isFinite(width)
    || width <= 0
    || width >= minimumViewWidth
  ) {
    cancelNarrowCollapse();
    return;
  }
  narrowCollapseArmed = false;
  narrowShrinkDistance = 0;
  cancelNarrowCollapse();
  vscode.postMessage({ type: 'collapseSidebar', width: Math.round(width) });
}
function trackViewWidth() {
  const width = currentViewWidth();
  if (!Number.isFinite(width) || width <= 0) return;
  if (!resizeTrackingReady) {
    lastViewWidth = width;
    return;
  }
  if (width >= minimumViewWidth) {
    narrowCollapseArmed = true;
    narrowShrinkDistance = 0;
    cancelNarrowCollapse();
  } else {
    if (lastViewWidth > 0 && width < lastViewWidth) {
      narrowShrinkDistance += lastViewWidth - width;
    }
    const crossedMinimum = lastViewWidth >= minimumViewWidth;
    if (
      document.visibilityState === 'visible'
      && ((narrowCollapseArmed && crossedMinimum) || narrowShrinkDistance >= minimumNarrowDrag)
    ) {
      cancelNarrowCollapse();
      narrowCollapseTimer = setTimeout(collapseIfStillNarrow, 140);
    }
  }
  lastViewWidth = width;
}
const viewSizeObserver = new ResizeObserver(() => {
  trackViewWidth();
});
viewSizeObserver.observe(document.documentElement);
window.visualViewport?.addEventListener('resize', trackViewWidth);
setTimeout(() => {
  lastViewWidth = currentViewWidth();
  narrowCollapseArmed = lastViewWidth >= minimumViewWidth;
  resizeTrackingReady = true;
}, 450);
const brandIcons = Object.freeze(${JSON.stringify(BRAND_ICONS)});
const modelBrandRules = Object.freeze(${JSON.stringify(MODEL_BRAND_RULES)});
const uiIcons = Object.freeze(${JSON.stringify(UI_ICONS)});
function uiIcon(name, label = '') {
  return '<span class="ui-symbol"' + (label ? ' aria-label="' + escapeHtml(label) + '"' : '') + '>' + (uiIcons[name] || uiIcons.cube) + '</span>';
}
function brandIcon(key, label) {
  return '<span class="brand-symbol" aria-label="' + escapeHtml(label || key) + '">' + (brandIcons[key] || brandIcons.mcp) + '</span>';
}
function brandKey(value, provider = '') {
  const id = value.toLowerCase();
  for (const [pattern, key] of modelBrandRules) {
    if (new RegExp(pattern, 'i').test(id)) return key;
  }
  return brandIcons[provider] ? provider : 'mcp';
}
$('attachIcon').innerHTML = uiIcon('plus');
$('sendIcon').innerHTML = uiIcon('arrowUp');
$('topConnectIcon').innerHTML = uiIcon('plugsConnected');
$('historyToggleIcon').innerHTML = uiIcon('chatCircle');
$('metricsToggleIcon').innerHTML = uiIcon('pulse');
$('settingsIcon').innerHTML = uiIcon('gear');
$('uiLanguage').value = document.body.dataset.language === 'en' ? 'en' : 'vi';
let language = $('uiLanguage').value;
const uiCopy = (vi, en) => language === 'en' ? en : vi;
function setRelayTooltip(element, label, placement = 'below') {
  if (!element) return;
  element.classList.add('relay-tooltip-target');
  element.setAttribute('data-relay-tooltip', label);
  element.classList.toggle('relay-tooltip-above', placement === 'above');
}
function updateRelayTooltips() {
  const labels = {
    topConnect: uiCopy('Kết nối provider', 'Connect provider'),
    historyToggle: uiCopy('Lịch sử chat', 'Chat history'),
    metricsToggle: uiCopy('Số liệu sử dụng', 'Usage metrics'),
    settings: uiCopy('Cài đặt', 'Settings')
  };
  Object.entries(labels).forEach(([id, label]) => {
    const element = $(id);
    setRelayTooltip(element, label, 'below');
    element?.setAttribute('aria-label', label);
  });
}
updateRelayTooltips();
$('uiLanguageLabel').textContent = $('uiLanguage').value === 'en' ? 'English' : 'Tiếng Việt';
$('uiLanguage').addEventListener('change', () => {
  language = $('uiLanguage').value;
  applyLanguageUi();
  vscode.postMessage({ type: 'setLanguage', language: $('uiLanguage').value });
});
let mode = 'chat';
let defaultMode = 'chat';
let composerPreferences = { models: {}, reasoningEffort: 'medium', serviceTier: 'default' };
let modelSelectionSource = 'auto';
let lastAutoModel = '';
let running = false;
let messagesPinnedToBottom = true;
let startupReadyTimer = 0;
let modelListRecoveryTimer = 0;
let modelListRecoveryRequested = false;
let assistantBody = null;
let launchingRouter = false;
let changeSummary = null;
let changeSummaryExpanded = false;
let pendingCompletedChangesState = null;
let activeProvider = '9router';
let pendingAssistantText = '';
let assistantRenderFrame = 0;
let assistantRawText = '';
let assistantActivity = null;
let pendingActivityStatus = '';
let activityReadyAfterCommentary = false;
let activitySteps = new Map();
let pendingTurnEnd = null;
let currentProfileId = '';
let savedProfileId = '';
let profiles = [];
let modelHealth = {};
let allSessions = [];
let historyExpanded = false;
let changesHidden = false;
let lastChangeCount = 0;
let lastPendingChangeCount = 0;
let knownChangeSnapshots = new Map();
let resolvedChangeSnapshots = new Map();
let changeOperationBusy = false;
let checkingModels = false;
let favoriteModels = [];
let favoriteModelsAtMenuOpen = [];
let recentModels = [];
let mcpServerState = [];
let mcpPresetState = [];
let keyStateRequestId = 0;
let pendingToolFailureId = '';
let activeTerminal = null;
let activeCommandGroup = null;
let skills = [];
let composerMenuIndex = -1;
let composerGoalMode = false;
let composerCommand = null;
let composerSkills = [];
let composerContexts = [];
let composerLinks = [];
let turnStartedAt = 0;
let workingLabel = null;
let workingTimer = null;
let setupDismissed = false;
let setupOpenRequested = false;
let queuedFollowUps = [];
let queuedFollowUpReady = true;
let followUpQueueEnabled = true;
let activeGoal = null;
let reasoningEffort = 'medium';
let serviceTier = 'default';
let latestTelemetryRecords = [];
const providerMeta = {
  '9router': { brand: '9router', label: '9Router', hint: 'Gateway local, nhiều model', endpoint: 'http://127.0.0.1:20128/v1', keyLabel: '9Router API key', local: false },
  cockpit: { brand: 'cockpit', label: 'Cockpit Tools', hint: 'Gateway local · nhiều tài khoản', endpoint: 'http://127.0.0.1:1455/v1', keyLabel: 'Cockpit Client Key', local: false },
  opencode: { brand: 'opencode', label: 'OpenCode', hint: 'OpenCode Zen · OpenAI-compatible', endpoint: 'https://opencode.ai/zen/v1', keyLabel: 'OpenCode API key', local: false },
  openai: { brand: 'openai', label: 'OpenAI', hint: 'API chính thức · cần API key', endpoint: 'https://api.openai.com/v1', keyLabel: 'OpenAI API key', local: false },
  anthropic: { brand: 'claude', label: 'Anthropic Claude', hint: 'Messages API · cần API key', endpoint: 'https://api.anthropic.com/v1', keyLabel: 'Anthropic API key', local: false },
  'openai-compatible': { brand: 'openrouter', label: 'OpenAI-compatible', hint: 'Endpoint tùy chỉnh', endpoint: '', keyLabel: 'API key', local: false },
  ollama: { brand: 'ollama', label: 'Ollama', hint: 'Local · không cần API key', endpoint: 'http://localhost:11434/v1', keyLabel: 'API key', local: true },
  'lm-studio': { brand: 'lm-studio', label: 'LM Studio', hint: 'Local · không cần API key', endpoint: 'http://localhost:1234/v1', keyLabel: 'API key', local: true }
};

// Static shell labels are translated in place so changing language never
// requires replacing the webview document.
const liveLanguagePairs = [
  ['Kết nối provider', 'Connect provider'], ['Kết nối', 'Connect'], ['Lịch sử chat', 'Chat history'],
  ['Lịch sử', 'History'], ['Số liệu sử dụng', 'Usage metrics'], ['Số liệu', 'Usage'], ['Cài đặt', 'Settings'],
  ['Đóng', 'Close'], ['Xóa tất cả', 'Clear all'], ['Hoạt động provider', 'Provider activity'],
  ['Token, chi phí ước tính, tốc độ và rate limit', 'Tokens, estimated cost, latency and rate limits'],
  ['Kết nối công cụ', 'Tool connections'], ['Chọn dịch vụ và đăng nhập trong trình duyệt', 'Choose a service and sign in through your browser'],
  ['MCP có thể kết nối', 'Available MCP connections'], ['Đã thêm', 'Added'], ['Thêm MCP khác', 'Add another MCP'],
  ['Chọn một dịch vụ ở trên hoặc thêm MCP riêng.', 'Choose a service above or add a custom MCP.'],
  ['Tên server', 'Server name'], ['Kết nối server', 'Connect server'], ['Cấu hình provider', 'Provider settings'],
  ['Chọn nguồn model cho mọi yêu cầu', 'Choose the model source for every request'], ['Ngôn ngữ giao diện', 'Interface language'],
  ['Giao diện tiếng Việt', 'Vietnamese interface'], ['Hồ sơ đang dùng', 'Active profile'], ['Xóa hồ sơ', 'Delete profile'],
  ['+ Hồ sơ mới', '+ New profile'], ['Thêm', 'Add'], ['Tệp và thư mục', 'Files and folders'],
  ['Đính kèm ngữ cảnh từ workspace', 'Attach context from workspace'], ['Đặt mục tiêu để agent tiếp tục theo đuổi', 'Set a goal for Agent to keep pursuing'],
  ['Lập kế hoạch trước khi thực hiện', 'Plan before implementation'], ['Thêm skill vào yêu cầu', 'Add a skill to the request'],
  ['Chạy tác vụ dài có thể tạm dừng và tiếp tục', 'Run a long task that can be paused and resumed'],
  ['Bắt đầu một cuộc chat mới', 'Start a new chat'], ['Rút gọn ngữ cảnh cuộc chat', 'Compact this chat context'],
  ['Tìm và chèn skill', 'Find and insert a skill'], ['Mở danh sách model', 'Open the model list'],
  ['Chuyển sang chế độ Plan', 'Switch to Plan mode'], ['Xem các file đã thay đổi', 'View changed files'],
  ['Mở các thay đổi đang chờ review', 'Open changes awaiting review'], ['Bật hoặc tắt file đang mở trong ngữ cảnh', 'Toggle the open file in context'],
  ['Tạo khung AGENTS.md cho dự án', 'Create an AGENTS.md scaffold for the project'], ['Xem provider, MCP và skills', 'View provider, MCP and skills status'],
  ['Mở công cụ MCP', 'Open MCP tools'], ['Mở cấu hình', 'Open settings'], ['Mở Output Channel', 'Open Output Channel'],
  ['Mở 9Router', 'Open 9Router'],
  ['Tên hồ sơ', 'Profile name'], ['Ví dụ: OpenAI cá nhân', 'For example: Personal OpenAI'], ['Endpoint và API key', 'Endpoint and API key'],
  ['Nhập API key của provider', 'Enter the provider API key'], ['Tùy chọn', 'Optional'], ['Lưu và kết nối lại', 'Save and reconnect'],
  ['Chẩn đoán', 'Diagnostics'], ['Xuất chẩn đoán', 'Export diagnostics'], ['Mở Cockpit', 'Open Cockpit'],
  ['Thiết lập local', 'Set up local provider'], ['Connection center', 'Connection center'], ['Kết nối mô hình.', 'Connect a model.'],
  ['Quản lý provider, kiểm tra API và mở bảng điều khiển tại một nơi.', 'Manage providers, check APIs and open dashboards in one place.'],
  ['Mở trang quản lý', 'Open dashboard'], ['Kiểm tra kết nối', 'Check connection'], ['Ngắt kết nối', 'Disconnect'],
  ['Kết nối thủ công', 'Connect manually'], ['Nói điều bạn muốn xây.', 'Describe what you want to build.'],
  ['Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.', 'Agent can read the project, edit files and run commands in the workspace.'],
  ['Nhập yêu cầu, dùng /, $ hoặc @…', 'Ask anything, use /, $ or @…'], ['Đọc, sửa file và chạy lệnh', 'Read, edit files and run commands'],
  ['Trò chuyện trực tiếp với model', 'Chat directly with the model'], ['Lập kế hoạch trước khi hành động', 'Plan before taking action'],
  ['Hỏi mọi thao tác', 'Ask for every action'], ['Luôn hỏi trước khi thực hiện', 'Always ask before acting'],
  ['Cho phép sửa file', 'Allow file edits'], ['Chỉ hỏi khi chạy lệnh', 'Ask only before running commands'],
  ['Không hỏi lại khi Agent hoạt động', 'Do not ask again while Agent is working'], ['Chọn model', 'Select model'],
  ['Tìm model…', 'Search models…'], ['Kiểm tra model', 'Check models'], ['Gửi', 'Send'], ['Bật Full access?', 'Enable Full access?'],
  ['Bật Full access', 'Enable Full access'], ['Hủy', 'Cancel'], ['Quay lại chat', 'Back to chat'],
  ['Đang kiểm tra', 'Checking'], ['Đang gửi yêu cầu kiểm tra provider…', 'Sending a provider check request…'],
  ['Đang kiểm tra provider hiện tại', 'Checking the current provider'], ['Độ trễ', 'Latency'], ['Chưa có endpoint', 'No endpoint'],
  ['Đang làm việc', 'Working'], ['Tạm dừng', 'Pause'], ['Tiếp tục', 'Resume'], ['Xem', 'View'], ['Ẩn', 'Hide']
];

function translateLiveDom(languageValue) {
  const pairs = languageValue === 'en' ? liveLanguagePairs : liveLanguagePairs.map(([vi, en]) => [en, vi]);
  const translations = new Map(pairs);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('script,style')) continue;
    const raw = node.nodeValue || '';
    const trimmed = raw.trim();
    const replacement = translations.get(trimmed);
    if (replacement) node.nodeValue = raw.replace(trimmed, replacement);
  }
  document.querySelectorAll('[placeholder],[aria-label]').forEach((element) => {
    for (const attribute of ['placeholder', 'aria-label']) {
      const value = element.getAttribute(attribute);
      const replacement = value ? translations.get(value.trim()) : undefined;
      if (replacement) element.setAttribute(attribute, value.replace(value.trim(), replacement));
    }
  });
}

function applyLanguageUi() {
  document.documentElement.lang = language;
  document.body.dataset.language = language;
  updateRelayTooltips();
  $('uiLanguageLabel').textContent = language === 'en' ? 'English' : 'Tiếng Việt';
  translateLiveDom(language);
  updateComposerPlaceholder();
  setPermissionMode($('permissionMode').dataset.mode || 'ask');
  $('modelSearch').placeholder = uiCopy('Tìm model…', 'Search models…');
  $('checkModels').textContent = checkingModels
    ? uiCopy('Đang kiểm tra · Bấm để hủy', 'Checking · Click to cancel')
    : uiCopy('Kiểm tra model', 'Check models');
  renderModelMenu($('modelSearch').value);
  if (mcpPresetState.length || mcpServerState.length) renderMcpServers(mcpServerState, mcpPresetState);
  renderFollowUpQueue();
}

function comparableEndpoint(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase() === 'localhost' ? '127.0.0.1' : url.hostname.toLowerCase();
    const port = url.port ? ':' + url.port : '';
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.protocol + '//' + hostname + port + pathname;
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
}

const knownProviderEndpoints = new Set(Object.values(providerMeta).map(item => comparableEndpoint(item.endpoint)).filter(Boolean));
const isKnownProviderEndpoint = (value) => knownProviderEndpoints.has(comparableEndpoint(value));
const floatingSurfaces = ['historyPanel', 'telemetryPanel', 'mcpPanel', 'configPanel', 'accessConfirm', 'connectionDiagnostics', 'uiDialog'];
let activeUiDialog = null;
let dialogReturnFocus = null;
let queuedUiDialogs = [];
document.querySelectorAll('#providerMenu .provider-option').forEach((option) => {
  const meta = providerMeta[option.dataset.provider] || providerMeta['9router'];
  const slot = document.createElement('span');
  slot.className = 'provider-brand-slot';
  slot.innerHTML = brandIcon(meta.brand, meta.label);
  option.prepend(slot);
});

function closeFloatingSurfaces(except = '', preserve = []) {
  if (except !== 'configPanel' && !preserve.includes('configPanel') && !$('configPanel')?.classList.contains('hidden')) restoreSavedProfileDraft();
  floatingSurfaces.forEach((id) => {
    if (id === 'uiDialog' && activeUiDialog && except !== 'uiDialog') return;
    if (id !== except && !preserve.includes(id)) $(id)?.classList.add('hidden');
  });
  if (except !== 'historyPanel') historyExpanded = false;
}

function openFloatingSurface(id, options = {}) {
  closeDropdowns();
  const preserve = options.preserve || [];
  if (id !== 'configPanel' && !preserve.includes('configPanel')) closeConfigPanel();
  closeFloatingSurfaces(id, preserve);
  $(id)?.classList.remove('hidden');
}

function closeDropdowns(except = null) {
  const entries = [
    ['modeMenu', 'modePicker', 'modeTrigger'],
    ['modelMenu', 'modelPicker', 'modelTrigger'],
    ['providerMenu', 'providerPicker', 'providerTrigger'],
    ['languageMenu', 'languagePicker', 'languageTrigger'],
    ['reasoningMenu', 'reasoningPicker', 'reasoningTrigger'],
    ['permMenu', 'permDropdown', 'permissionMode']
  ];
  for (const [menuId, pickerId, triggerId] of entries) {
    const menu = $(menuId);
    if (!menu || menu === except) continue;
    menu.classList.add('hidden');
    $(pickerId)?.classList.remove('open');
    $(triggerId)?.setAttribute('aria-expanded', 'false');
  }
  document.querySelectorAll('.permission-menu').forEach((menu) => {
    if (menu === except) return;
    menu.classList.add('hidden');
    menu.closest('.permission-allow-wrap')?.querySelector('.permission-menu-trigger')?.setAttribute('aria-expanded', 'false');
  });
  if ($('addMenu') !== except) closeAddMenu();
}

function closeUiDialog(action) {
  if (!activeUiDialog) return;
  const current = activeUiDialog;
  const value = current.input ? $('uiDialogInput').value : undefined;
  activeUiDialog = null;
  $('uiDialog').classList.add('hidden');
  $('uiDialogInput').value = '';
  $('uiDialogError').classList.add('hidden');
  vscode.postMessage({
    type: 'dialogResult',
    id: current.id,
    action,
    value
  });
  const next = queuedUiDialogs.shift();
  if (next) {
    requestAnimationFrame(() => renderUiDialog(next));
    return;
  }
  if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus();
  dialogReturnFocus = null;
}

function renderUiDialog(data) {
  if (!data?.id) return;
  if (activeUiDialog) {
    if (activeUiDialog.id !== data.id && !queuedUiDialogs.some((item) => item.id === data.id)) queuedUiDialogs.push(data);
    return;
  }
  if (!dialogReturnFocus?.isConnected) dialogReturnFocus = document.activeElement;
  activeUiDialog = data;
  // A dialog overlays the active surface. Keep that surface mounted so closing
  // an API-key/OAuth prompt returns to MCP instead of the Chat home.
  const backdrop = $('uiDialog');
  const dialog = backdrop.querySelector('.ui-dialog');
  dialog.dataset.tone = data.tone || 'neutral';
  $('uiDialogIcon').innerHTML = uiIcon(data.icon || (data.tone === 'danger' ? 'warning' : data.tone === 'success' ? 'checkCircle' : 'info'));
  $('uiDialogTitle').textContent = data.title || 'RelayCode';
  $('uiDialogMessage').textContent = data.message || '';
  $('uiDialogDetail').textContent = data.detail || '';
  $('uiDialogDetail').classList.toggle('hidden', !data.detail);
  $('uiDialogClose').innerHTML = uiIcon('x');
  $('uiDialogClose').classList.toggle('hidden', data.dismissible === false);

  const field = $('uiDialogField');
  const input = $('uiDialogInput');
  field.classList.toggle('hidden', !data.input);
  if (data.input) {
    $('uiDialogFieldLabel').textContent = data.input.label || '';
    input.type = data.input.password ? 'password' : 'text';
    input.placeholder = data.input.placeholder || '';
    input.value = data.input.value || '';
    input.dataset.required = String(Boolean(data.input.required));
  }

  const actions = $('uiDialogActions');
  actions.replaceChildren();
  actions.classList.toggle('many', (data.actions || []).length > 2);
  for (const action of data.actions || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-dialog-action ' + (action.kind || 'secondary');
    button.textContent = action.label;
    button.dataset.action = action.id;
    button.addEventListener('click', () => {
      if (data.input?.required && !input.value.trim() && action.kind !== 'secondary') {
        $('uiDialogError').textContent = uiCopy('Trường này không được để trống.', 'This field is required.');
        $('uiDialogError').classList.remove('hidden');
        input.focus();
        return;
      }
      closeUiDialog(action.id);
    });
    actions.append(button);
  }
  // A modal must not unmount the Settings or MCP surface underneath it.
  backdrop.classList.remove('hidden');
  requestAnimationFrame(() => {
    if (data.input) {
      input.focus();
      input.select();
    } else {
      const preferred = actions.querySelector('.primary,.danger') || $('uiDialogClose');
      preferred?.focus();
    }
  });
}

function showUiToast(data) {
  const message = data?.message && typeof data.message === 'object'
    ? uiCopy(data.message.vi || '', data.message.en || '')
    : String(data?.message || '');
  const duplicate = [...$('toastStack').querySelectorAll('.ui-toast p')]
    .find((item) => item.textContent === message);
  if (duplicate) return;
  const toast = document.createElement('article');
  toast.className = 'ui-toast ' + (data.tone || 'neutral');
  toast.innerHTML = '<span aria-hidden="true">' + uiIcon(data.tone === 'danger' ? 'warning' : data.tone === 'success' ? 'checkCircle' : 'info') + '</span><p></p><button type="button" aria-label="' + uiCopy('Đóng', 'Close') + '">' + uiIcon('x') + '</button>';
  toast.querySelector('p').textContent = message;
  const remove = () => toast.remove();
  toast.addEventListener('click', (event) => event.stopPropagation());
  toast.querySelector('button').addEventListener('click', (event) => {
    event.stopPropagation();
    remove();
  });
  $('toastStack').append(toast);
  setTimeout(remove, Math.max(2600, Math.min(7000, message.length * 55)));
}

$('uiDialogClose').addEventListener('click', () => closeUiDialog(undefined));
$('uiDialog').addEventListener('click', (event) => {
  event.stopPropagation();
  if (event.target === $('uiDialog') && activeUiDialog?.dismissible !== false) closeUiDialog(undefined);
});
$('uiDialogInput').addEventListener('input', () => $('uiDialogError').classList.add('hidden'));
$('uiDialogInput').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  $('uiDialogActions').querySelector('.primary,.danger')?.click();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeUiDialog?.dismissible !== false) {
    event.preventDefault();
    closeUiDialog(undefined);
  } else if (event.key === 'Tab' && activeUiDialog) {
    const focusable = [...$('uiDialog').querySelectorAll('button:not(.hidden),input:not(.hidden)')]
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

function flushAssistantText() {
  if (assistantRenderFrame) { cancelAnimationFrame(assistantRenderFrame); assistantRenderFrame = 0; }
  if (assistantBody && pendingAssistantText) {
    assistantRawText += pendingAssistantText;
    renderMarkdownInto(assistantBody, assistantRawText);
    const item = assistantBody.closest('.message');
    if (item) item.dataset.rawContent = assistantRawText;
  }
  pendingAssistantText = '';
}

function renderPendingAssistantText() {
  assistantRenderFrame = 0;
  if (!assistantBody || !pendingAssistantText) return;
  const charsThisFrame = Math.max(3, Math.min(12, Math.ceil(pendingAssistantText.length / 14)));
  assistantRawText += pendingAssistantText.slice(0, charsThisFrame);
  pendingAssistantText = pendingAssistantText.slice(charsThisFrame);
  renderMarkdownInto(assistantBody, assistantRawText);
  const item = assistantBody.closest('.message');
  if (item) item.dataset.rawContent = assistantRawText;
  if (messagesPinnedToBottom) scrollMessagesToBottom();
  else updateRunningScrollIndicator();
  if (pendingAssistantText) {
    scheduleAssistantTextRender();
    return;
  }
  if (pendingTurnEnd) {
    const data = pendingTurnEnd;
    pendingTurnEnd = null;
    settleTurn(data);
  }
}

function scheduleAssistantTextRender() {
  if (assistantRenderFrame) return;
  assistantRenderFrame = requestAnimationFrame(renderPendingAssistantText);
}

function scrollMessagesToBottom() {
  const messageList = $('messages');
  messagesPinnedToBottom = true;
  messageList.scrollTop = messageList.scrollHeight;
  updateRunningScrollIndicator();
  // Webview layout can grow after Markdown, activity, and file icons settle.
  requestAnimationFrame(() => {
    messageList.scrollTop = messageList.scrollHeight;
    updateRunningScrollIndicator();
  });
}

function messagesAreNearBottom() {
  const messageList = $('messages');
  return messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 56;
}

function updateRunningScrollIndicator() {
  const indicator = $('runningScrollIndicator');
  if (!indicator) return;
  const atBottom = messagesPinnedToBottom || messagesAreNearBottom();
  indicator.classList.toggle('hidden', atBottom);
  indicator.classList.toggle('is-running', running);
  const indicatorHint = running
    ? uiCopy('Xuống tác vụ đang chạy', 'Jump to the running task')
    : uiCopy('Xuống cuối', 'Jump to the latest message');
  indicator.setAttribute('aria-label', indicatorHint);
}

$('messages').addEventListener('scroll', () => {
  messagesPinnedToBottom = messagesAreNearBottom();
  updateRunningScrollIndicator();
}, { passive: true });
$('runningScrollIndicator').addEventListener('click', scrollMessagesToBottom);

function queueAssistantText(delta) {
  if (!assistantBody || !delta) return;
  pendingAssistantText += delta;
  scheduleAssistantTextRender();
}

function reconcileFinalAssistantText(content) {
  const finalText = typeof content === 'string' ? content : '';
  if (!assistantBody || !finalText) return;
  const bufferedText = assistantRawText + pendingAssistantText;
  if (bufferedText === finalText) return;
  if (finalText.startsWith(assistantRawText)) {
    pendingAssistantText = finalText.slice(assistantRawText.length);
    if (pendingAssistantText) scheduleAssistantTextRender();
    return;
  }
  if (assistantRenderFrame) { cancelAnimationFrame(assistantRenderFrame); assistantRenderFrame = 0; }
  pendingAssistantText = '';
  assistantRawText = finalText;
  renderMarkdownInto(assistantBody, assistantRawText);
  const item = assistantBody.closest('.message');
  if (item) item.dataset.rawContent = assistantRawText;
}

function updateComposerPlaceholder() {
  $('prompt').placeholder = composerCommand
    ? uiCopy('Nhấn gửi để chạy ' + composerCommand.key, 'Press send to run ' + composerCommand.key)
    : composerGoalMode
    ? uiCopy('Mô tả mục tiêu dài hạn…', 'Describe a long-term goal…')
    : running && queuedFollowUps.length
      ? uiCopy('Nhập yêu cầu tiếp theo…', 'Ask for follow-up changes')
    : mode === 'agent'
      ? uiCopy('Nhập yêu cầu, dùng /, $ hoặc @…', 'Ask anything, use /, $ or @…')
      : mode === 'plan' ? uiCopy('Mô tả mục tiêu để Agent lập kế hoạch…', 'Describe the goal for Agent to plan…') : uiCopy('Hỏi nhanh qua model đang chọn…', 'Ask the selected model…');
}

function saveComposerPreferences(preferences) {
  vscode.postMessage({ type: 'saveComposerPreferences', ...preferences });
}

function setMode(next, remember = false) {
  mode = next;
  $('modeLabel').textContent = mode === 'agent' ? 'Agent' : mode === 'plan' ? 'Plan' : 'Chat';
  document.querySelectorAll('#modeMenu [data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
    button.setAttribute('aria-selected', String(button.dataset.mode === mode));
  });
  updateComposerPlaceholder();
  const rememberedModel = composerPreferences.models?.[mode];
  if (rememberedModel && [...$('model').options].some((option) => option.value === rememberedModel)) {
    modelSelectionSource = 'manual';
    lastAutoModel = '';
    if ($('model').value !== rememberedModel) {
      $('model').value = rememberedModel;
      $('model').dispatchEvent(new Event('change'));
    }
  } else {
    modelSelectionSource = 'auto';
    applySmartModelForMode();
  }
  if (remember) {
    composerPreferences.lastMode = mode;
    saveComposerPreferences({ mode, rememberMode: true });
  }
}

function smartModelScore(currentMode, option) {
  const text = (option.value + ' ' + option.text).toLowerCase();
  let score = 0;
  if (currentMode !== 'chat' && option.dataset.tools !== 'false') score += 30;
  if ((currentMode === 'agent' || currentMode === 'plan') && option.dataset.reasoning === 'true') score += 28;
  if (currentMode === 'chat') {
    if (/(mini|small|fast|flash|haiku|nano|instant|turbo)/.test(text)) score += 24;
    if (/(reasoning|thinking|opus|large|pro|max)/.test(text)) score -= 8;
  } else if (/(agent|coder|coding|reasoning|thinking|opus|sonnet|pro|max|gpt-5|o[134]|r1)/.test(text)) score += 18;
  if (option.dataset.vision === 'true') score += currentMode === 'chat' ? 2 : 4;
  return score;
}

function smartModelForMode(currentMode) {
  return [...$('model').options]
    .filter(option => option.value && (currentMode === 'chat' || option.dataset.tools !== 'false'))
    .sort((left, right) => smartModelScore(currentMode, right) - smartModelScore(currentMode, left) || left.text.localeCompare(right.text))[0]?.value || '';
}

function applySmartModelForMode() {
  if (modelSelectionSource !== 'auto') return;
  const next = smartModelForMode(mode);
  if (!next || next === $('model').value) return;
  lastAutoModel = next;
  $('model').value = next;
  $('model').dispatchEvent(new Event('change'));
}

function updateConnectionBadge(providerName, state = 'checking') {
  const labels = language === 'en'
    ? { ready: 'Ready', running: 'Running', setup: 'Needs setup', recovering: 'Needs recovery', offline: 'Offline', checking: 'Checking' }
    : { ready: 'Sẵn sàng', running: 'Đang chạy', setup: 'Chưa cấu hình', recovering: 'Cần khôi phục', offline: 'Ngoại tuyến', checking: 'Đang kiểm tra' };
  const status = labels[state] || labels.checking;
  const badge = $('connectionBadge');
  badge.dataset.state = state;
  badge.setAttribute('aria-label', uiCopy('Mở trung tâm kết nối', 'Open connection center'));
  const meta = providerMeta[activeProvider] || providerMeta['9router'];
  $('connectionBrand').innerHTML = brandIcon(meta.brand, meta.label);
  $('connectionLabel').textContent = providerName;
  $('connectionDot').classList.toggle('online', state === 'ready' || state === 'running');
}

function scheduleModelListRecovery() {
  if (modelListRecoveryTimer) clearTimeout(modelListRecoveryTimer);
  modelListRecoveryTimer = setTimeout(() => {
    modelListRecoveryTimer = 0;
    if (modelListRecoveryRequested || $('model').options.length > 2) return;
    modelListRecoveryRequested = true;
    vscode.postMessage({ type: 'retryConnection' });
  }, 900);
}

function requestBootstrap() {
  vscode.postMessage({ type: 'ready' });
  if (startupReadyTimer) clearTimeout(startupReadyTimer);
  startupReadyTimer = setTimeout(requestBootstrap, 1500);
}

function providerHintCopy(kind, fallback) {
  const english = {
    '9router': 'Local gateway, many models',
    cockpit: 'Local gateway · multiple accounts',
    opencode: 'OpenCode Zen · OpenAI-compatible',
    openai: 'Official API · API key required',
    anthropic: 'Messages API · API key required',
    'openai-compatible': 'Custom endpoint',
    ollama: 'Local · no API key required',
    'lm-studio': 'Local · no API key required'
  };
  return uiCopy(fallback, english[kind] || fallback);
}

function setProvider(next, changeEndpoint = true, updateBadge = true) {
  const meta = providerMeta[next] || providerMeta['9router'];
  const previous = $('configProvider').value;
  $('configProvider').value = next;
  // The provider picker is a draft form: always show the selected provider
  // there, while the header/connection badge changes only after Save.
  $('providerBrand').innerHTML = brandIcon(meta.brand, meta.label);
  $('setupProviderMark').innerHTML = brandIcon(meta.brand, meta.label);
  if (updateBadge) {
    $('connectionBrand').innerHTML = brandIcon(meta.brand, meta.label);
  }
  $('providerLabel').textContent = meta.label;
  $('providerHint').textContent = providerHintCopy(next, meta.hint);
  $('setupProviderBadge').textContent = meta.label;
  $('setupTitle').textContent = next === '9router' ? uiCopy('Mở 9Router.', 'Open 9Router.') : uiCopy('Kết nối ' + meta.label + '.', 'Connect ' + meta.label + '.');
  $('setupCopy').textContent = next === '9router'
    ? uiCopy('Kiểm tra hoặc cài 9Router rồi mở bảng điều khiển. Không cần API key để mở trang quản lý.', 'Check or install 9Router, then open its dashboard. An API key is not required to open the management page.')
    : next === 'ollama' || next === 'lm-studio'
      ? uiCopy('Provider local không cần API key, nhưng ứng dụng, model và API server phải đang chạy trên máy.', 'A local provider needs no API key, but its app, model and API server must be running.')
      : uiCopy('Mở Cài đặt để kiểm tra endpoint và API key của provider này.', 'Open Settings to check this provider endpoint and API key.');
  $('setupEndpointLabel').textContent = $('configEndpoint').value.trim() || meta.endpoint || 'Chưa có endpoint';
  $('apiKeyLabel').textContent = meta.keyLabel;
  document.querySelectorAll('#providerMenu .provider-option').forEach(option => option.classList.toggle('active', option.dataset.provider === next));
  const keyInput = $('configApiKey');
  keyInput.disabled = meta.local;
   keyInput.placeholder = meta.local ? uiCopy('Provider local không dùng API key', 'Local providers do not use an API key') : uiCopy('Nhập key mới hoặc để trống để giữ key đã lưu', 'Enter a new key or leave blank to keep the saved key');
  $('apiKeyField').classList.toggle('local', meta.local);
  $('openCockpit').classList.toggle('hidden', next !== 'cockpit');
  if (previous !== next) {
    keyInput.value = '';
    $('diagnosticsResult').textContent = '';
    $('diagnosticsResult').className = 'diagnostics-result hidden';
    if (!meta.local) {
       $('keyState').textContent = uiCopy('Đang kiểm tra API key đã lưu…', 'Checking saved API key…');
      $('keyState').classList.remove('saved');
      vscode.postMessage({ type: 'getProviderKeyState', provider: next, profileId: currentProfileId || undefined, requestId: ++keyStateRequestId });
    }
  }
  if (meta.local) {
     $('keyState').textContent = uiCopy('Không cần API key · server local vẫn phải đang chạy', 'No API key required · the local server must still be running');
    $('keyState').classList.add('local');
    $('keyState').classList.remove('saved');
  } else {
     $('keyState').textContent = uiCopy('API key được lưu riêng và an toàn cho provider này', 'The API key is stored securely and separately for this provider');
    $('keyState').classList.remove('local');
  }
  if (changeEndpoint) {
    const current = $('configEndpoint').value.trim();
    // A new profile must never inherit a custom endpoint from the profile
    // that was active before it. Existing profiles may intentionally keep a
    // custom endpoint when switching providers.
    if (!current || !currentProfileId || previous !== next || isKnownProviderEndpoint(current)) $('configEndpoint').value = meta.endpoint;
  }
  $('setupEndpointLabel').textContent = $('configEndpoint').value.trim() || meta.endpoint || 'Chưa có endpoint';
  $('startRouter').textContent = next === '9router' ? uiCopy('Mở 9Router', 'Open 9Router') : uiCopy('Kết nối ' + meta.label, 'Connect ' + meta.label);
}

function isCodexTunableModel(model) {
  return /(codex|gpt-5|(?:^|[/_-])o[134](?:$|[/_.-]))/i.test(model || '');
}

function resetTimestamp(value) {
  if (!value) return 0;
  const parsedDate = Date.parse(value);
  if (Number.isFinite(parsedDate)) return parsedDate;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Date.now() + Number(value) * 1000;
  const duration = String(value).match(/(\d+(?:\.\d+)?)\s*(ms|s|m|h)/i);
  if (!duration) return 0;
  const amount = Number(duration[1]);
  const unit = duration[2].toLowerCase();
  return Date.now() + amount * (unit === 'ms' ? 1 : unit === 's' ? 1000 : unit === 'm' ? 60000 : 3600000);
}

function formatReset(value) {
  const timestamp = resetTimestamp(value);
  if (!timestamp) return '';
  const minutes = Math.max(0, Math.ceil((timestamp - Date.now()) / 60000));
  if (minutes < 1) return 'sắp reset';
  if (minutes < 60) return minutes + ' phút';
  const hours = Math.ceil(minutes / 60);
  return hours < 24 ? hours + ' giờ' : Math.ceil(hours / 24) + ' ngày';
}

function updateCodexTuning() {
  const model = $('model').value;
  const visible = isCodexTunableModel(model);
  $('codexTuning').classList.toggle('hidden', !visible);
  $('reasoningLabel').textContent = reasoningEffort === 'xhigh' ? 'Extra high' : reasoningEffort[0].toUpperCase() + reasoningEffort.slice(1);
  $('fastModeLabel').textContent = serviceTier === 'fast' ? 'Fast' : 'Standard';
  $('fastMode').classList.toggle('active', serviceTier === 'fast');
  $('fastMode').setAttribute('aria-pressed', String(serviceTier === 'fast'));
  document.querySelectorAll('#reasoningMenu [data-effort]').forEach((button) => button.classList.toggle('active', button.dataset.effort === reasoningEffort));
  const latest = latestTelemetryRecords
    .filter((record) => record.model === model && record.rateLimit?.reset)
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))[0];
  const reset = visible ? formatReset(latest?.rateLimit?.reset) : '';
  $('quotaReset').classList.toggle('hidden', !reset);
  $('quotaResetLabel').textContent = reset;
}

function setPermissionMode(next) {
  const btn = $('permissionMode');
  btn.dataset.mode = next;
  $('permLabel').textContent = next === 'full' ? 'Full access' : next === 'edit' ? uiCopy('Sửa file', 'Edit files') : uiCopy('Hỏi', 'Ask');
  btn.classList.toggle('full', next === 'full');
  document.querySelectorAll('#permMenu .perm-opt').forEach(opt => {
    const active = opt.dataset.perm === next;
    opt.classList.toggle('active', active);
    opt.setAttribute('aria-selected', String(active));
  });
}

function renderModelMenu(query = '') {
  const list = $('modelOptions'); list.replaceChildren();
  const needle = query.trim().toLowerCase();
  const rankingFavorites = $('modelMenu').classList.contains('hidden') ? favoriteModels : favoriteModelsAtMenuOpen;
  const options = [...$('model').options]
    .filter(option => option.value && (!needle || option.text.toLowerCase().includes(needle)))
    .sort((left, right) => {
      const leftRank = rankingFavorites.includes(left.value) ? 0 : recentModels.includes(left.value) ? 1 : 2;
      const rightRank = rankingFavorites.includes(right.value) ? 0 : recentModels.includes(right.value) ? 1 : 2;
      return leftRank - rightRank || left.text.localeCompare(right.text);
    });
  for (const option of options) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'model-option';
    const healthStatus = modelHealth[option.value]?.status || '';
    const icon = document.createElement('span'); icon.className = 'model-brand'; icon.innerHTML = brandIcon(brandKey(option.value, activeProvider), option.text);
    const health = document.createElement('span'); health.className = 'model-health ' + healthStatus; health.setAttribute('aria-label', healthStatus === 'ok' ? uiCopy('Model hoạt động', 'Model available') : healthStatus === 'limited' ? uiCopy('Model đang bị giới hạn tạm thời', 'Model temporarily rate-limited') : healthStatus === 'error' ? uiCopy('Model không khả dụng', 'Model unavailable') : healthStatus === 'checking' ? uiCopy('Đang kiểm tra model', 'Checking model') : uiCopy('Chưa kiểm tra', 'Not checked'));
    const label = document.createElement('span'); label.className = 'model-option-label'; label.textContent = option.text;
    const meta = document.createElement('small'); meta.className = 'model-option-meta';
    const healthMessage = modelHealth[option.value]?.message || '';
    const latency = healthMessage.match(/(\d+)\s*ms/i)?.[1];
    meta.textContent = healthStatus === 'limited'
      ? uiCopy('Tạm giới hạn · thử lại sau', 'Temporarily limited · retry later')
      : healthStatus === 'error'
        ? uiCopy('Kiểm tra không thành công', 'Check failed')
        : option.dataset.tools === 'false'
          ? 'Chat only'
          : (option.dataset.reasoning === 'true' ? uiCopy('Agent · reasoning', 'Agent · reasoning') : 'Agent') + (latency ? ' · ' + latency + ' ms' : '');
    const copy = document.createElement('span'); copy.className = 'model-option-copy'; copy.append(label, meta);
    const favorite = document.createElement('span'); favorite.className = 'model-favorite' + (favoriteModels.includes(option.value) ? ' active' : ''); favorite.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7a1.75 1.75 0 0 1 1.75 1.75v16L12 17.5l-5.25 3.25v-16Z"/></svg>'; const favoriteHint = favoriteModels.includes(option.value) ? uiCopy('Bỏ dấu model', 'Remove model bookmark') : uiCopy('Đánh dấu model', 'Bookmark model'); favorite.setAttribute('aria-label', favoriteHint); favorite.setAttribute('role', 'button'); favorite.tabIndex = 0;
    favorite.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'toggleFavoriteModel', model: option.value }); });
    favorite.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); favorite.click(); } });
    button.append(icon, copy, health, favorite);
    button.classList.toggle('active', option.value === $('model').value);
    button.addEventListener('click', () => {
      $('model').value = option.value;
      $('model').dispatchEvent(new Event('change'));
      if (pendingToolFailureId) {
        vscode.postMessage({ type: 'resolveToolFailure', id: pendingToolFailureId, action: 'change-model', model: option.value });
        document.querySelector('[data-tool-failure-id="' + pendingToolFailureId + '"]')?.remove();
        pendingToolFailureId = '';
      }
      $('modelMenu').classList.add('hidden');
      $('modelPicker').classList.remove('open');
      $('modelTrigger').setAttribute('aria-expanded', 'false');
    });
    list.append(button);
  }
}

function renderProfiles() {
  const list = $('profileList'); list.replaceChildren();
  for (const profile of profiles) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'profile-chip'; button.textContent = profile.name;
    button.classList.toggle('active', profile.id === currentProfileId);
    button.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'activateProfile', id: profile.id }); });
    list.append(button);
  }
  const selected = profiles.find((profile) => profile.id === currentProfileId);
  $('deleteProfile').disabled = !selected || profiles.length <= 1;
}

function applyProfileUi(profile) {
  if (!profile) return;
  currentProfileId = profile.id;
  savedProfileId = profile.id;
  $('profileName').value = profile.name || '';
  $('configEndpoint').value = profile.endpoint || '';
  $('inputPrice').value = profile.inputPricePerMillion ?? '';
  $('outputPrice').value = profile.outputPricePerMillion ?? '';
  setProvider(profile.kind, false);
  renderProfiles();
}

function restoreSavedProfileDraft() {
  const saved = profiles.find((profile) => profile.id === savedProfileId)
    || profiles.find((profile) => profile.id === currentProfileId);
  if (!saved) return;
  applyProfileUi(saved);
  $('configApiKey').value = '';
  $('diagnosticsResult').textContent = '';
  $('diagnosticsResult').className = 'diagnostics-result hidden';
}

function closeConfigPanel(restoreDraft = true) {
  if (restoreDraft) restoreSavedProfileDraft();
  $('configPanel').classList.add('hidden');
}

function formatCompact(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, notation: 'compact' }).format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function fileTypeIcon(path) {
  const icon = fileUiIcon(String(path || '').replace(/:\d+(?::\d+)?$/, ''));
  return '<span class="file-type-icon ' + icon + '" data-file-kind="' + icon + '" aria-hidden="true">'
    + uiIcon(icon)
    + '</span>';
}

function inlineMarkdown(source) {
  const tokens = [];
  const reserve = (html) => {
    const token = '\u0000' + tokens.length + '\u0000';
    tokens.push(html);
    return token;
  };
  let text = escapeHtml(source);
  text = text.replace(/\(\[([^\]]+)\]\((https?:\/\/[^)]+)\)\)/gi, (_, label, rawTarget) => {
    const target = String(rawTarget).replace(/&amp;/g, '&');
    return reserve('<span class="rich-link-group">(' + richLinkMarkup(target, label) + ')</span>');
  });
  text = text.replace(/\((https?:\/\/[^\s<)]+)\)/gi, (_, rawTarget) => {
    const target = String(rawTarget).replace(/&amp;/g, '&');
    return reserve('<span class="rich-link-group">(' + richLinkMarkup(target) + ')</span>');
  });
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawTarget) => {
    const target = String(rawTarget).replace(/&amp;/g, '&');
    if (/^https?:\/\//i.test(target)) {
      return reserve(richLinkMarkup(target, label));
    }
    const location = target.match(/:(\d+)(?::\d+)?$/);
    const line = location && !/\bline\s+\d+/i.test(label) ? '<span class="file-line">(line ' + location[1] + ')</span>' : '';
    return reserve('<button type="button" class="file-link" data-file="' + encodeURIComponent(target) + '">' + fileTypeIcon(target) + '<span>' + label + '</span>' + line + '</button>');
  });
  text = text.replace(/\x60([^\x60\r\n]+)\x60/g, (_, code) => {
    const plain = String(code).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const looksLikeFile = /^(?:[a-z]:[\\/]|\.{0,2}[\\/])?.+\.[a-z0-9]{1,10}(?::\d+(?::\d+)?)?$/i.test(plain);
    const looksLikeProse = plain.length > 90 && plain.trim().split(/\s+/).length > 14 && !/[{};=]/.test(plain);
    if (looksLikeProse) return code;
    return reserve(looksLikeFile
      ? '<button type="button" class="file-link" data-file="' + encodeURIComponent(plain) + '">' + fileTypeIcon(plain) + '<span>' + code + '</span></button>'
      : '<code class="inline-code">' + code + '</code>');
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\((\+[\d.,]+)\s+(-[\d.,]+)\)/g, (_, added, removed) => reserve('<span class="diff-inline">(<b class="diff-add">' + added + '</b><b class="diff-remove">' + removed + '</b>)</span>'));
  text = text.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (_, prefix, url) => prefix + reserve(richLinkMarkup(url)));
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
}

function compactExternalLink(target, explicitLabel = '') {
  if (explicitLabel) return explicitLabel;
  try {
    const url = new URL(target);
    const host = url.hostname.replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    if (host === 'github.com') {
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2) return parts.slice(0, 2).join('/');
    }
    const compact = host + (path === '/' ? '' : path);
    return compact.length > 46 ? compact.slice(0, 43) + '…' : compact;
  } catch {
    return target.length > 46 ? target.slice(0, 43) + '…' : target;
  }
}

function richLinkMarkup(target, explicitLabel = '') {
  const label = compactExternalLink(target, explicitLabel);
  let isGithub = false;
  try { isGithub = new URL(target).hostname.replace(/^www\./, '') === 'github.com'; } catch {}
  const icon = isGithub ? brandIcon('github', 'GitHub') : uiIcon('plugsConnected');
  return '<button type="button" class="rich-link" data-url="' + encodeURIComponent(target) + '"><span class="rich-link-icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span></button>';
}

function bindRichContent(container) {
  container.querySelectorAll('[data-url]').forEach((item) => item.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternal', url: decodeURIComponent(item.dataset.url) });
  }));
  container.querySelectorAll('[data-file]').forEach((item) => item.addEventListener('click', () => {
    vscode.postMessage({ type: 'openFile', path: decodeURIComponent(item.dataset.file) });
  }));
}

function splitMarkdownTableRow(source) {
  const text = String(source || '').trim();
  if (!text.includes('|')) return null;
  const cells = [];
  let cell = '';
  let escaped = false;
  let inCode = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (escaped) {
      cell += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && (text[index + 1] === '|' || text[index + 1] === '\\')) {
      escaped = true;
      continue;
    }
    if (char === '\x60') {
      inCode = !inCode;
      cell += char;
      continue;
    }
    if (char === '|' && !inCode) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  if (text.startsWith('|')) cells.shift();
  if (text.endsWith('|')) cells.pop();
  return cells.length >= 2 ? cells : null;
}

function markdownTableAlignment(cell) {
  const marker = String(cell || '').replace(/\s+/g, '');
  if (!/^:?-{3,}:?$/.test(marker)) return null;
  if (marker.startsWith(':') && marker.endsWith(':')) return 'center';
  if (marker.endsWith(':')) return 'right';
  return 'left';
}

function renderMarkdownTable(headers, alignments, rows) {
  const renderCell = (tag, value, index) => '<' + tag + ' class="align-' + (alignments[index] || 'left') + '">' + inlineMarkdown(value || '') + '</' + tag + '>';
  const head = '<thead><tr>' + headers.map((cell, index) => renderCell('th', cell, index)).join('') + '</tr></thead>';
  const body = rows.length
    ? '<tbody>' + rows.map(row => '<tr>' + headers.map((_, index) => renderCell('td', row[index] || '', index)).join('') + '</tr>').join('') + '</tbody>'
    : '';
  return '<div class="markdown-table-wrap"><table class="markdown-table">' + head + body + '</table></div>';
}

function renderMarkdownInto(container, source) {
  const cleanSource = String(source || '')
    .replace(/(?:\x60{1,3}[ \t]*)?(?:<|＜)?[|｜][ \t]*DSML[ \t]*[|｜][ \t]*(?:function_calls?|tool_calls?)(?:>|＞)?(?:[ \t]*\x60{1,3})?/giu, '')
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, '')
    .replace(/[ \t]{2,}/g, ' ');
  const lines = cleanSource.replace(/\r\n/g, '\n').split('\n');
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
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
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
    const tableHeaders = splitMarkdownTableRow(line);
    const tableSeparators = tableHeaders && lineIndex + 1 < lines.length
      ? splitMarkdownTableRow(lines[lineIndex + 1])
      : null;
    const tableAlignments = tableSeparators?.map(markdownTableAlignment) || [];
    if (tableHeaders && tableSeparators && tableHeaders.length === tableSeparators.length && tableAlignments.every(Boolean)) {
      flushParagraph(); closeList();
      const rows = [];
      lineIndex += 2;
      while (lineIndex < lines.length) {
        const row = splitMarkdownTableRow(lines[lineIndex]);
        if (!row) break;
        rows.push(row);
        lineIndex++;
      }
      lineIndex--;
      html += renderMarkdownTable(tableHeaders, tableAlignments, rows);
      continue;
    }
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

const activityCopy = (vi, en) => language === 'en' ? en : vi;

function compactActivityText(value, limit = 108) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length <= limit) return text;
  return text.slice(0, Math.max(1, limit - 1)).trimEnd() + '…';
}

function activityInfo(status) {
  const detail = status.includes(':') ? status.slice(status.indexOf(':') + 1).trim() : '';
  if (/kiểm tra provider|checking provider/i.test(status)) return { kind: 'provider', key: 'provider', done: activityCopy('Đã kiểm tra provider', 'Provider checked') };
  if (/kết nối model gián đoạn|model connection interrupted/i.test(status)) return { kind: 'provider', key: 'model-retry', done: activityCopy('Đã kết nối lại model', 'Model reconnected') };
  if (/chờ model|model đang xử lý|model đang suy nghĩ|waiting for model|model is (?:working|thinking)/i.test(status)) return { kind: 'waiting', key: 'waiting', done: activityCopy('Model đã phản hồi', 'Model responded') };
  if (/chạy lệnh|running command/i.test(status)) return { kind: 'command', key: 'command-current', done: detail ? activityCopy('Đã chạy: ', 'Ran: ') + detail : activityCopy('Đã chạy lệnh', 'Command completed') };
  if (/chạy kiểm tra|running tests|validating changes/i.test(status)) return { kind: 'test', key: 'test-current', done: detail ? activityCopy('Đã kiểm tra: ', 'Checked: ') + detail : activityCopy('Đã chạy kiểm tra', 'Tests completed') };
  if (/tạo ảnh thất bại|image generation failed/i.test(status)) return { kind: 'error', key: 'image:' + detail, done: detail ? activityCopy('Không thể tạo ảnh ', 'Could not generate ') + detail : activityCopy('Không thể tạo ảnh', 'Image generation failed') };
  if (/tạo ảnh|generating image/i.test(status)) return { kind: 'edit', key: 'image:' + detail, done: detail ? activityCopy('Đã tạo ảnh ', 'Generated ') + detail : activityCopy('Đã tạo ảnh', 'Image generated') };
  if (/tìm model tạo ảnh|finding an image model/i.test(status)) return { kind: 'inspect', key: 'image-models', done: activityCopy('Đã tìm model tạo ảnh', 'Image model found') };
  if (/tạo thư mục|creating directory/i.test(status)) return { kind: 'edit', key: 'directory:' + detail, done: detail ? activityCopy('Đã tạo thư mục ', 'Created directory ') + detail : activityCopy('Đã tạo thư mục', 'Directory created') };
  if (/xóa file|deleting file/i.test(status)) return { kind: 'edit', key: 'delete:' + detail, done: detail ? activityCopy('Đã xóa ', 'Deleted ') + detail : activityCopy('Đã xóa file', 'File deleted') };
  if (/di chuyển file|moving file/i.test(status)) return { kind: 'edit', key: 'move:' + detail, done: detail ? activityCopy('Đã di chuyển ', 'Moved ') + detail : activityCopy('Đã di chuyển file', 'File moved') };
  if (/sửa file|editing file/i.test(status)) return { kind: 'edit', key: 'edit:' + detail, done: detail ? activityCopy('Đã sửa ', 'Edited ') + detail : activityCopy('Đã sửa file', 'File edited') };
  if (/kiểm tra đường dẫn|checking path/i.test(status)) return { kind: 'inspect', key: 'stat:' + detail, done: detail ? activityCopy('Đã kiểm tra ', 'Checked ') + detail : activityCopy('Đã kiểm tra đường dẫn', 'Path checked') };
  if (/xem thư mục|reading directory/i.test(status)) return { kind: 'inspect', key: 'directory-list:' + detail, done: detail ? activityCopy('Đã xem thư mục ', 'Read directory ') + detail : activityCopy('Đã xem thư mục', 'Directory read') };
  if (/Git diff/i.test(status)) return { kind: 'inspect', key: 'git-diff', done: activityCopy('Đã đọc Git diff', 'Git diff read') };
  if (/đọc tài nguyên skill|reading skill resource/i.test(status)) return { kind: 'inspect', key: 'skill:' + detail, done: detail ? activityCopy('Đã đọc skill: ', 'Read skill: ') + detail : activityCopy('Đã đọc skill', 'Skill read') };
  if (/đọc trang web|reading webpage/i.test(status)) return { kind: 'inspect', key: 'web:' + detail, done: detail ? activityCopy('Đã đọc trang ', 'Read page ') + detail : activityCopy('Đã đọc trang web', 'Webpage read') };
  if (/phân tích file|analyzing file/i.test(status)) return { kind: 'inspect', key: 'analyze-files', done: detail ? activityCopy('Đã phân tích: ', 'Analyzed: ') + detail : activityCopy('Đã phân tích file', 'File analyzed') };
  if (/đọc file|reading file/i.test(status)) return { kind: 'inspect', key: 'read:' + detail, done: detail ? activityCopy('Đã đọc ', 'Read ') + detail : activityCopy('Đã đọc file', 'File read') };
  if (/cấu trúc dự án|project structure/i.test(status)) return { kind: 'inspect', key: 'list:' + detail, done: detail ? activityCopy('Đã xem file: ', 'Inspected files: ') + detail : activityCopy('Đã xem cấu trúc dự án', 'Project structure inspected') };
  if (/tìm trong dự án|searching project/i.test(status)) return { kind: 'inspect', key: 'search:' + detail, done: detail ? activityCopy('Đã tìm: ', 'Searched: ') + detail : activityCopy('Đã tìm trong dự án', 'Project searched') };
  if (/MCP/i.test(status)) return { kind: 'mcp', key: 'mcp:' + status, done: language === 'en' ? status.replace(/^Using/i, 'Used') : status.replace(/^Đang dùng/i, 'Đã dùng') };
  if (/phân tích hướng thực hiện|analyzing the approach/i.test(status)) return { kind: 'thinking', key: 'thinking-direction', done: activityCopy('Đã xác định hướng thực hiện', 'Approach determined') };
  if (/bước tiếp theo|next step/i.test(status)) return { kind: 'thinking', key: 'thinking-next', done: activityCopy('Đã xác định bước tiếp theo', 'Next step determined') };
  return { kind: 'thinking', key: 'thinking', done: activityCopy('Đã phân tích yêu cầu', 'Request analyzed') };
}

function fileUiIcon(path) {
  const clean = String(path || '').split(/[?#]/)[0].toLowerCase();
  const name = clean.split(/[\\/]/).pop() || clean;
  if (/\.(?:ts)$/.test(clean)) return 'fileTs';
  if (/\.(?:tsx)$/.test(clean)) return 'fileTsx';
  if (/\.(?:js|mjs|cjs)$/.test(clean)) return 'fileJs';
  if (/\.(?:jsx)$/.test(clean)) return 'fileJsx';
  if (/\.(?:css|scss|sass|less)$/.test(clean)) return 'fileCss';
  if (/\.(?:html|htm)$/.test(clean)) return 'fileHtml';
  if (/\.(?:md|mdx)$/.test(clean)) return 'fileMd';
  if (/\.(?:py)$/.test(clean)) return 'filePy';
  if (/\.(?:rs)$/.test(clean)) return 'fileRs';
  if (/\.(?:vue)$/.test(clean)) return 'fileVue';
  if (/\.(?:c|h)$/.test(clean)) return 'fileC';
  if (/\.(?:cpp|cc|cxx|hpp|hh|hxx)$/.test(clean)) return 'fileCpp';
  if (/\.(?:cs)$/.test(clean)) return 'fileCSharp';
  if (/\.(?:sql)$/.test(clean)) return 'fileSql';
  if (/\.(?:ini|cfg|conf|properties)$/.test(clean)) return 'fileIni';
  if (/\.(?:csv|tsv)$/.test(clean)) return 'fileCsv';
  if (/\.(?:txt|log)$/.test(clean)) return 'fileTxt';
  if (/\.(?:png)$/.test(clean)) return 'filePng';
  if (/\.(?:jpe?g)$/.test(clean)) return 'fileJpg';
  if (/\.(?:svg)$/.test(clean)) return 'fileSvg';
  if (/\.(?:gif|webp|ico|avif|bmp)$/.test(clean)) return 'fileImage';
  if (/\.(?:mp4|webm|mov|avi|mkv)$/.test(clean)) return 'fileVideo';
  if (/\.(?:mp3|wav|ogg|flac|m4a)$/.test(clean)) return 'fileAudio';
  if (/\.(?:pdf)$/.test(clean)) return 'filePdf';
  if (/\.(?:docx?)$/.test(clean)) return 'fileDoc';
  if (/\.(?:xlsx?)$/.test(clean)) return 'fileXls';
  if (/\.(?:pptx?)$/.test(clean)) return 'filePpt';
  if (/\.(?:zip|tar|gz|7z|rar)$/.test(clean)) return 'fileZip';
  if (/^(?:readme|license|notice|authors|contributors)(?:\..*)?$/.test(name)) return 'fileText';
  if (/^(?:dockerfile|makefile|procfile|gemfile|rakefile)$/.test(name)) return 'fileCode';
  if (/\.(?:json|jsonc|yaml|yml|toml|xml|go|java|kt|swift|php|rb|svelte|sh|bash|zsh|fish|ps1|bat|cmd|graphql|gql)$/.test(clean)) return 'fileCode';
  return 'file';
}

function activityIconName(info, status) {
  const detail = status.includes(':') ? status.slice(status.indexOf(':') + 1).trim() : '';
  if (info.kind === 'edit' || (info.kind === 'inspect' && /(?:file|skill)/i.test(info.key))) return fileUiIcon(detail);
  if (info.kind === 'command') return 'terminalWindow';
  if (info.kind === 'test') return 'checkCircle';
  if (info.kind === 'mcp') return 'plugsConnected';
  if (info.kind === 'provider') return 'pulse';
  if (info.kind === 'waiting' || info.kind === 'thinking') return 'brain';
  if (/list:/.test(info.key)) return 'files';
  if (/search:/.test(info.key)) return 'listSearch';
  if (/web:/.test(info.key)) return 'listSearch';
  return 'spinnerGap';
}

function setActivityExpanded(expanded, activity = assistantActivity) {
  if (!activity) return;
  activity.classList.toggle('expanded', expanded);
  const toggle = activity.querySelector('.activity-toggle');
  toggle?.setAttribute('aria-expanded', String(expanded));
  const caret = activity.querySelector('.activity-caret');
  if (caret) caret.innerHTML = uiIcon(expanded ? 'caretDown' : 'caretRight');
  const message = activity.closest('.message');
  message?.classList.toggle('show-trace', Boolean(message.querySelector('.agent-activity.expanded')));
}

function cueActivitySweep(element) {
  if (!element) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (element.classList.contains('sweeping')) return;
  element.classList.add('sweeping');
}

function isAssistantTimelineNode(child) {
  return child?.classList.contains('agent-commentary')
    || child?.classList.contains('agent-activity')
    || child?.classList.contains('activity-history-summary')
    || child?.classList.contains('terminal-card');
}

function assistantStreamHasText() {
  return Boolean((assistantRawText + pendingAssistantText).trim() || assistantBody?.textContent?.trim());
}

function moveAssistantBodyAfterTimeline() {
  const message = assistantBody?.closest('.message');
  if (!message || !assistantBody) return;
  const timelineNodes = [...message.children].filter(isAssistantTimelineNode);
  const last = timelineNodes.at(-1);
  if (last && last.nextElementSibling !== assistantBody) last.after(assistantBody);
}

function insertAssistantTimelineNode(node) {
  const message = assistantBody?.closest('.message');
  if (!message || !node) return;
  const timelineNodes = [...message.children].filter(isAssistantTimelineNode);
  const last = timelineNodes.at(-1);
  if (last) last.after(node);
  else message.insertBefore(node, assistantBody);
  moveAssistantBodyAfterTimeline();
}

function archiveAssistantStreamBeforeTimeline() {
  if (!assistantBody || !assistantStreamHasText()) return;
  flushAssistantText();
  const text = (assistantRawText || assistantBody.textContent || '').trim();
  if (!text) return;
  const block = document.createElement('div');
  block.className = 'agent-commentary';
  renderMarkdownInto(block, text);
  insertAssistantTimelineNode(block);
  assistantRawText = '';
  pendingAssistantText = '';
  assistantBody.replaceChildren();
  const item = assistantBody.closest('.message');
  if (item) item.dataset.rawContent = '';
}

function appendAssistantTimelineNode(node) {
  if (!node) return;
  if (node !== activeCommandGroup && !node.classList.contains('terminal-card')) {
    activeCommandGroup = null;
    activeTerminal = null;
  }
  // The body is the live stream slot. Archive its current phase before the
  // next activity so a later Thinking/Edited row can never land underneath it.
  archiveAssistantStreamBeforeTimeline();
  insertAssistantTimelineNode(node);
}

function materializePendingActivity() {
  const status = String(pendingActivityStatus || '').trim();
  if (!status || !assistantBody || pendingTurnEnd) return;
  if (!activityReadyAfterCommentary) return;
  pendingActivityStatus = '';
  updateActivity(status);
}

function appendCommentaryBeforePendingActivity(block) {
  if (!block) return;
  // Keep commentary in the same chronological stream as status and tool rows.
  // The old pending-activity special case moved a later activity below the
  // response body when a second model step started.
  appendAssistantTimelineNode(block);
}

function archiveStreamedProgress(content = '') {
  if (!assistantBody) return;
  flushAssistantText();
  const text = String(content || assistantRawText || '').trim();
  const currentActivity = assistantActivity?.isConnected ? assistantActivity : null;
  if (text) {
    const block = document.createElement('div');
    block.className = 'agent-commentary';
    renderMarkdownInto(block, text);
    insertAssistantTimelineNode(block);
    activityReadyAfterCommentary = true;
  }
  // A streamed step is complete. Close its activity group so the next model
  // step creates a new Ran/Edited/Analyzed phase instead of reusing this one.
  if (currentActivity) finalizeLiveActivity();
  assistantRawText = '';
  pendingAssistantText = '';
  assistantBody.replaceChildren();
  const item = assistantBody.closest('.message');
  if (item) item.dataset.rawContent = '';
  moveAssistantBodyAfterTimeline();
  materializePendingActivity();
}

function updateActivity(status) {
  const messageList = $('messages');
  const previousScrollTop = messageList.scrollTop;
  if (!assistantActivity && !activityReadyAfterCommentary) {
    // Never put an activity above the first assistant paragraph. Providers
    // commonly emit status before commentary, so hold it until the paragraph
    // is in the transcript and then place the activity below that paragraph.
    pendingActivityStatus = String(status || '');
    return;
  }
  if (!assistantBody || !status || status === 'Hoàn tất') return;
  const info = activityInfo(status);
  if (info.kind !== 'command' && info.kind !== 'test') {
    activeCommandGroup = null;
    activeTerminal = null;
  }
  if (!assistantActivity) {
    assistantActivity = document.createElement('div');
    assistantActivity.className = 'agent-activity';
    activityReadyAfterCommentary = false;
    pendingActivityStatus = '';
    const phase = assistantActivity;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'activity-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', activityCopy('Xem chi tiết hoạt động', 'View activity details'));
    toggle.innerHTML = '<span class="activity-current-icon" aria-hidden="true"></span><span class="activity-current"></span><span class="activity-caret" aria-hidden="true">' + uiIcon('caretRight') + '</span>';
    toggle.addEventListener('click', () => setActivityExpanded(!phase.classList.contains('expanded'), phase));
    const trace = document.createElement('div');
    trace.className = 'activity-trace';
    assistantActivity.append(toggle, trace);
    appendAssistantTimelineNode(assistantActivity);
  }
  const iconName = activityIconName(info, status);
  assistantActivity.querySelectorAll('.activity-row.active').forEach((activeRow) => {
    if (activeRow.dataset.key === info.key) return;
    activeRow.classList.remove('active');
    activeRow.classList.add('done');
    activeRow.querySelector('.activity-copy').textContent = activeRow.dataset.done;
  });
  let row = activitySteps.get(info.key);
  if (!row) {
    row = document.createElement('div');
    row.className = 'activity-row';
    row.dataset.kind = info.kind;
    row.dataset.key = info.key;
    row.dataset.done = info.done;
    row.innerHTML = '<span class="activity-icon" aria-hidden="true"></span><span class="activity-copy"></span>';
    activitySteps.set(info.key, row);
    assistantActivity.querySelector('.activity-trace')?.append(row);
  }
  row.dataset.kind = info.kind;
  row.dataset.key = info.key;
  row.dataset.done = info.done;
  row.dataset.icon = iconName;
  row.querySelector('.activity-icon').innerHTML = uiIcon(iconName);
  row.querySelector('.activity-copy').textContent = compactActivityText(status, 108);
  row.classList.remove('done', 'stopped');
  row.classList.add('active');
  assistantActivity.querySelector('.activity-trace')?.append(row);
  const currentIcon = assistantActivity.querySelector('.activity-current-icon');
  currentIcon.dataset.icon = iconName;
  currentIcon.innerHTML = uiIcon(iconName);
  const currentActivity = assistantActivity.querySelector('.activity-current');
  currentActivity.textContent = compactActivityText(status, 108);
  currentActivity.dataset.sweep = status;
  cueActivitySweep(currentActivity);
  messageList.scrollTop = previousScrollTop;
}

function finalizeLiveActivity() {
  if (!assistantActivity) return;
  assistantActivity.querySelectorAll('.activity-row.active').forEach((row) => {
    row.classList.remove('active');
    row.classList.add('done');
    const copy = row.querySelector('.activity-copy');
    if (copy) copy.textContent = row.dataset.done || copy.textContent;
  });
  assistantActivity.classList.remove('expanded');
  assistantActivity.classList.add('archived');
  const current = assistantActivity.querySelector('.activity-current');
  const lastRow = [...assistantActivity.querySelectorAll('.activity-row')].at(-1);
  if (current) {
    if (lastRow) current.textContent = lastRow.dataset.done || lastRow.querySelector('.activity-copy')?.textContent || current.textContent;
    current.classList.remove('sweeping');
    delete current.dataset.sweep;
  }
  setActivityExpanded(false, assistantActivity);
  assistantActivity = null;
  activitySteps = new Map();
}

function appendAgentCommentary(content) {
  const text = String(content || '').trim();
  if (!assistantBody || !text) return;
  flushAssistantText();
  const liveText = String(assistantRawText || assistantBody.textContent || '').trim();
  const duplicateOpening = liveText.length > 0
    && liveText.length <= 80
    && text.startsWith(liveText);
  if (duplicateOpening) {
    // Some providers emit the first delta (for example "M") and then send
    // the complete commentary paragraph beginning with that same character.
    // Do not preserve the prefix as a stray message above the activity row.
    assistantRawText = '';
    pendingAssistantText = '';
    assistantBody.replaceChildren();
    const item = assistantBody.closest('.message');
    if (item) item.dataset.rawContent = '';
  }
  finalizeLiveActivity();
  activeTerminal = null;
  activeCommandGroup = null;
  const block = document.createElement('div');
  block.className = 'agent-commentary';
  renderMarkdownInto(block, text);
  appendCommentaryBeforePendingActivity(block);
  activityReadyAfterCommentary = true;
  materializePendingActivity();
}

function formatWorkingElapsed(seconds) {
  if (language === 'en') {
    if (seconds < 60) return seconds + 's';
    return Math.floor(seconds / 60) + 'm' + (seconds % 60 ? ' ' + (seconds % 60) + 's' : '');
  }
  if (seconds < 60) return seconds + ' giây';
  return Math.floor(seconds / 60) + ' phút' + (seconds % 60 ? ' ' + (seconds % 60) + ' giây' : '');
}

function updateWorkingLabel(state = 'working') {
  if (!workingLabel || !turnStartedAt) return;
  const seconds = Math.max(1, Math.round((Date.now() - turnStartedAt) / 1000));
  const elapsed = formatWorkingElapsed(seconds);
  workingLabel.textContent = language === 'en'
    ? (state === 'cancelled' ? 'Stopped after ' : state === 'error' ? 'Stopped after ' : state === 'complete' ? 'Worked for ' : 'Working for ') + elapsed
    : (state === 'cancelled' ? 'Đã dừng sau ' : state === 'error' ? 'Dừng sau ' : state === 'complete' ? 'Đã làm trong ' : 'Đang làm trong ') + elapsed;
}

function startWorkingLabel() {
  if (!assistantBody) return;
  if (workingTimer) clearInterval(workingTimer);
  workingLabel = document.createElement('div');
  workingLabel.className = 'worked-label working-live';
  assistantBody.before(workingLabel);
  updateWorkingLabel();
  workingTimer = setInterval(() => updateWorkingLabel(), 1000);
}

function finishWorkingLabel(state) {
  if (workingTimer) clearInterval(workingTimer);
  workingTimer = null;
  updateWorkingLabel(state);
  workingLabel?.classList.remove('working-live');
}

function compactTechnicalHistory(turnMessage) {
  if (!turnMessage || !assistantBody) return;
  // Live activity belongs to the running state only. Final file changes have
  // their own review card, so retaining activity rows after completion is both
  // redundant and visually indistinguishable from a stuck Agent.
  // Progress and tool output are useful while the task is running. Once it is
  // complete, keep only the final answer and the dedicated file-change card.
  turnMessage.querySelectorAll('.agent-commentary,.activity-history-summary,.agent-activity,.terminal-card').forEach((node) => node.remove());
}

function discardTechnicalHistory(turnMessage) {
  if (!turnMessage) return;
  turnMessage.querySelectorAll('.activity-history-summary,.agent-activity,.terminal-card').forEach((node) => node.remove());
}

function renderTelemetry(records = []) {
  const totalInput = records.reduce((sum, item) => sum + (item.inputTokens || 0), 0);
  const totalOutput = records.reduce((sum, item) => sum + (item.outputTokens || 0), 0);
  const costs = records.filter(item => typeof item.cost === 'number').reduce((sum, item) => sum + item.cost, 0);
  const avgLatency = records.length ? Math.round(records.reduce((sum, item) => sum + (item.latencyMs || 0), 0) / records.length) : 0;
  $('telemetrySummary').innerHTML = '<div class="metric-card"><strong>' + formatCompact(totalInput + totalOutput) + '</strong><span>' + uiCopy('Tổng token', 'Total tokens') + '</span></div><div class="metric-card"><strong>' + (costs ? '$' + costs.toFixed(4) : uiCopy('Chưa có', 'Not available')) + '</strong><span>' + uiCopy('Chi phí ước tính', 'Estimated cost') + '</span></div><div class="metric-card"><strong>' + avgLatency + ' ms</strong><span>' + uiCopy('Latency trung bình', 'Average latency') + '</span></div>';
  const latest = records[0]?.rateLimit;
  $('telemetryRate').textContent = latest ? 'Rate limit · requests ' + (latest.requestsRemaining || '?') + ' / ' + (latest.requestsLimit || '?') + ' · tokens ' + (latest.tokensRemaining || '?') + ' / ' + (latest.tokensLimit || '?') + ' · reset ' + (latest.reset || '?') : 'Chưa nhận được header rate limit từ provider.';
  const list = $('telemetryList'); list.replaceChildren();
  for (const item of records.slice(0, 40)) {
    const row = document.createElement('div'); row.className = 'telemetry-row';
    row.innerHTML = '<span class="telemetry-model"><span class="telemetry-brand">' + brandIcon(brandKey(item.model, item.provider), item.model) + '</span><span><strong>' + escapeHtml(item.model) + '</strong><small>' + escapeHtml(item.profileName) + ' · ' + formatTime(item.timestamp) + '</small></span></span><b>' + formatCompact((item.inputTokens || 0) + (item.outputTokens || 0)) + ' tok</b><small>' + (item.latencyMs || 0) + ' ms</small>';
    list.append(row);
  }
}

function mcpIcon(kind) {
  return brandIcons[kind === 'stitch' ? 'google' : kind] || brandIcons.mcp;
}

function renderMcpCatalog(presets = [], servers = []) {
  const catalog = $('mcpCatalog'); catalog.replaceChildren();
  for (const preset of presets) {
    const server = servers.find(item => item.catalogId === preset.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mcp-card' + (server?.connected ? ' connected' : server?.authPending ? ' pending' : server?.error ? ' failed' : '');
    const cardStatus = server?.connected
      ? (server.toolCount || 0) + uiCopy(' công cụ sẵn sàng', ' tools ready')
      : server?.authPending
        ? uiCopy('Đang chờ đăng nhập', 'Waiting for sign-in')
          : server?.error
            ? server.error
          : server?.hasToken
          ? uiCopy('Có API key · cần kết nối lại', 'API key saved · reconnect required')
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

function renderMcpOutcome(data) {
  const notice = $('mcpConnectionNotice');
  notice.dataset.serverId = data.serverId || '';
  notice.textContent = data.message || '';
  notice.className = 'mcp-connection-notice ' + (data.tone || 'neutral');
  notice.classList.toggle('hidden', !data.message);
  if (data.message) showUiToast({ message: data.message, tone: data.tone || 'neutral' });
}

function syncPendingMcpOutcome(servers) {
  const notice = $('mcpConnectionNotice');
  if (!notice.classList.contains('warning') || !notice.dataset.serverId) return;
  const server = servers.find((item) => item.id === notice.dataset.serverId);
  if (!server || server.authPending) return;
  if (server.connected) {
    notice.textContent = server.name + ' đã kết nối thành công · ' + (server.toolCount || 0) + ' công cụ sẵn sàng.';
    notice.className = 'mcp-connection-notice success';
  } else if (server.error) {
    notice.textContent = uiCopy('Không thể kết nối ', 'Unable to connect to ') + server.name + ': ' + server.error;
    notice.className = 'mcp-connection-notice danger';
  }
}

function renderMcpServers(servers = [], presets = []) {
  mcpServerState = servers;
  mcpPresetState = presets;
  renderMcpCatalog(presets, servers);
  const list = $('mcpList'); list.replaceChildren();
  if (!servers.length) { list.innerHTML = '<div class="mcp-empty">' + escapeHtml(uiCopy('Chọn một dịch vụ ở trên hoặc thêm MCP riêng.', 'Choose a service above or add a custom MCP.')) + '</div>'; return; }
  for (const server of servers) {
    const row = document.createElement('div'); row.className = 'mcp-row' + (server.error ? ' has-error' : '');
    const main = document.createElement('div'); main.className = 'mcp-row-main';
    const iconKind = presets.find(item => item.id === server.catalogId)?.icon || 'mcp';
    const icon = document.createElement('span'); icon.className = 'mcp-brand-icon'; icon.innerHTML = mcpIcon(iconKind);
    const info = document.createElement('span');
    const stateText = server.connected
      ? (server.toolCount || 0) + uiCopy(' công cụ · Đã kết nối', ' tools · Connected')
      : server.error
        ? server.error
      : server.authPending
        ? uiCopy('Đang chờ đăng nhập trên trình duyệt', 'Waiting for browser sign-in')
        : server.hasOAuthTokens
          ? uiCopy('Cần kết nối lại', 'Reconnect required')
          : server.authMode === 'oauth' ? uiCopy('Chưa đăng nhập', 'Not signed in') : uiCopy('Ngoại tuyến', 'Offline');
    info.innerHTML = '<strong>' + escapeHtml(server.name) + '</strong><small>' + escapeHtml(stateText) + '</small>';
    main.append(icon, info);

    const actions = document.createElement('div'); actions.className = 'mcp-row-actions';
    if (server.authMode === 'oauth') {
      const auth = document.createElement('button'); auth.type = 'button';
      auth.className = 'mcp-action ' + (server.hasOAuthTokens ? 'logout' : 'login');
      auth.textContent = server.hasOAuthTokens ? uiCopy('Đăng xuất', 'Sign out') : (server.authPending ? uiCopy('Đang mở…', 'Opening…') : uiCopy('Đăng nhập', 'Sign in'));
      auth.disabled = Boolean(server.authPending);
      auth.addEventListener('click', () => vscode.postMessage({ type: server.hasOAuthTokens ? 'logoutMcp' : 'loginMcp', id: server.id }));
      actions.append(auth);
    } else if (server.authMode === 'api-key') {
      const key = document.createElement('button'); key.type = 'button'; key.className = 'mcp-action ' + (server.hasToken ? 'logout' : 'login');
      key.textContent = server.hasToken ? uiCopy('Đổi key', 'Change key') : uiCopy('Nhập key', 'Enter key');
      key.addEventListener('click', () => vscode.postMessage({ type: 'configureMcpApiKey', id: server.id }));
      actions.append(key);
    } else if (!server.connected) {
      const reconnect = document.createElement('button'); reconnect.type = 'button'; reconnect.className = 'mcp-action login';
      reconnect.textContent = uiCopy('Kết nối lại', 'Reconnect');
      reconnect.addEventListener('click', () => vscode.postMessage({ type: 'reconnectMcp', id: server.id }));
      actions.append(reconnect);
    }
    const remove = document.createElement('button'); remove.className = 'mcp-remove'; remove.type = 'button'; remove.setAttribute('aria-label', uiCopy('Xóa MCP', 'Remove MCP')); remove.textContent = '×'; remove.addEventListener('click', () => vscode.postMessage({ type: 'removeMcpServer', id: server.id }));
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
  const providerName = providerMeta[activeProvider]?.label || activeProvider || 'provider';
  $('startRouter').textContent = launchingRouter ? message : activeProvider === '9router' ? uiCopy('Mở 9Router', 'Open 9Router') : uiCopy('Kết nối ' + providerName, 'Connect ' + providerName);
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
    const initialPreview = attachment.preview || attachment.modelPreview;
    if (initialPreview) {
      const img = document.createElement('img'); img.src = initialPreview; img.alt = attachment.name;
      img.addEventListener('click', () => openImage(img.currentSrc || initialPreview));
      let triedModelPreview = false;
      const handleImageError = () => {
        if (!triedModelPreview && attachment.modelPreview && attachment.modelPreview !== img.src) {
          triedModelPreview = true;
          img.src = attachment.modelPreview;
          return;
        }
        img.removeEventListener('error', handleImageError);
        const fallback = document.createElement('span'); fallback.className = 'user-file'; fallback.textContent = attachment.name;
        img.replaceWith(fallback);
      };
      img.addEventListener('error', handleImageError);
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
  $('clearAllHistory').classList.toggle('hidden', !sessions.length);
  $('clearAllHistory').textContent = activityCopy('Xóa tất cả', 'Clear all');
  const list = $('historyList'); list.replaceChildren();
  if (!sessions.length) {
    const empty = document.createElement('div'); empty.className = 'history-empty'; empty.textContent = uiCopy('Chưa có cuộc trò chuyện nào.', 'No conversations yet.'); list.append(empty);
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
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'history-delete'; remove.setAttribute('aria-label', uiCopy('Xóa cuộc trò chuyện', 'Delete conversation'));
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12M10 10v6m4-6v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    remove.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'deleteSession', id: session.id }); });
    row.append(button, remove);
    list.append(row);
  }
  $('viewAllHistory').classList.toggle('hidden', historyExpanded || sessions.length <= 5);
}

function messageActionIcon(kind) {
  return uiIcon(kind === 'edit' ? 'pencilSimple' : 'copy');
}

async function copyMessageText(button, content) {
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = content;
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.append(fallback);
    fallback.select();
    document.execCommand('copy');
    fallback.remove();
  }
  button.classList.add('copied');
  button.setAttribute('aria-label', 'Đã sao chép');
  setTimeout(() => {
    button.classList.remove('copied');
    button.setAttribute('aria-label', 'Sao chép');
  }, 1200);
}

function beginMessageEdit(item, body, content, turnIndex) {
  if (running || item.classList.contains('editing')) return;
  item.classList.add('editing');
  const editor = document.createElement('div');
  editor.className = 'message-editor';
  const input = document.createElement('textarea');
  input.value = content;
  input.setAttribute('aria-label', 'Chỉnh sửa tin nhắn');
  input.rows = 1;
  const hint = document.createElement('span');
  hint.className = 'message-edit-hint';
  hint.textContent = uiCopy('Gửi lại sẽ thay thế các phản hồi phía sau.', 'Resending will replace the responses that follow.');
  const controls = document.createElement('div');
  controls.className = 'message-edit-controls';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'message-edit-cancel';
  cancel.textContent = uiCopy('Hủy', 'Cancel');
  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'message-edit-submit';
  submit.textContent = uiCopy('Gửi lại', 'Resend');
  const resize = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    input.style.overflowY = input.scrollHeight > 180 ? 'auto' : 'hidden';
  };
  const close = () => {
    editor.replaceWith(body);
    item.classList.remove('editing');
  };
  const resend = () => {
    const prompt = input.value.trim();
    if (!prompt || submit.disabled) return;
    submit.disabled = true;
    input.disabled = true;
    vscode.postMessage({ type: 'editMessage', index: turnIndex, prompt, mode, model: $('model').value });
  };
  cancel.addEventListener('click', close);
  submit.addEventListener('click', resend);
  input.addEventListener('input', () => {
    submit.disabled = !input.value.trim();
    resize();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      resend();
    }
  });
  controls.append(hint, cancel, submit);
  editor.append(input, controls);
  body.replaceWith(editor);
  resize();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function renderUserPrompt(body, content) {
  const source = String(content || '');
  const tokens = [];
  let remaining = source;
  const tokenPattern = /^\s*(\$[\w.-]+|\/(?:goal|new|compact|skills|model|plan|review|diff|ide-context|init|status|diagnostics|mcp|settings|logs|export)|@(?:selection|terminal|git-diff|problems))(?=\s|$)/i;
  while (true) {
    const match = remaining.match(tokenPattern);
    if (!match) break;
    const raw = match[1];
    const kind = raw.startsWith('$') ? 'skill' : raw.startsWith('/') ? 'command' : 'context';
    const label = kind === 'skill' ? composerSkillLabel(raw.slice(1)) : raw;
    tokens.push({ kind, label });
    remaining = remaining.slice(match[0].length);
  }
  if (tokens.length) {
    const rail = document.createElement('div');
    rail.className = 'sent-prompt-tokens';
    for (const token of tokens) {
      const chip = document.createElement('span');
      chip.className = 'sent-prompt-token ' + token.kind;
      chip.innerHTML = '<i aria-hidden="true">' + uiIcon(token.kind === 'skill' ? 'cube' : token.kind === 'command' ? 'terminalWindow' : 'selection') + '</i><b></b>';
      chip.querySelector('b').textContent = token.label;
      rail.append(chip);
    }
    body.append(rail);
  }
  const copy = remaining.trim();
  if (copy) {
    const text = document.createElement('span');
    text.className = 'sent-prompt-copy';
    text.textContent = copy;
    body.append(text);
  }
}

function classifyChatError(raw) {
  const compact = String(raw || '').replace(/\s+/g, ' ').replace(/<[^>]*>/g, '').trim();
  if (/image_url|unknown variant.*image|vision|image input|xem ảnh|nhìn ảnh/i.test(compact)) {
    return {
      title: uiCopy('Model không hỗ trợ xem ảnh', 'Model does not support image input'),
      message: uiCopy('Model hiện tại chỉ nhận văn bản. Hãy chọn model có Vision hoặc gửi lại yêu cầu không kèm ảnh.', 'This model accepts text only. Choose a Vision model or resend without the image.')
    };
  }
  if (/HTTP 401|invalid api key|unauthori[sz]ed|API key.*hết hạn|API key.*không hợp lệ/i.test(compact)) {
    return {
      title: uiCopy('API key không hợp lệ', 'Invalid API key'),
      message: uiCopy('Kiểm tra lại API key trong Cài đặt rồi kết nối lại provider.', 'Check the API key in Settings, then reconnect the provider.')
    };
  }
  if (/HTTP 403|forbidden|permission denied|từ chối quyền/i.test(compact)) {
    return {
      title: uiCopy('Provider từ chối quyền truy cập', 'Provider access denied'),
      message: uiCopy('Tài khoản hoặc model hiện tại không có quyền sử dụng request này.', 'The current account or model is not allowed to use this request.')
    };
  }
  if (/HTTP 404|endpoint not found|endpoint không tồn tại|<!doctype html|<html/i.test(String(raw || ''))) {
    return {
      title: uiCopy('Endpoint không tồn tại', 'Endpoint not found'),
      message: uiCopy('Kiểm tra Base URL và đường dẫn API của provider.', 'Check the provider Base URL and API path.')
    };
  }
  if (/INVALID_MODEL_ID|invalid model|model .*not found|model .*không hợp lệ/i.test(compact)) {
    return {
      title: uiCopy('Model không hợp lệ', 'Invalid model'),
      message: uiCopy('Model này không có trong provider. Hãy chọn model khác từ danh sách.', 'This model is not available from the provider. Choose another model from the list.')
    };
  }
  if (/HTTP 429|rate.?limit|too many requests|quota|hạn mức/i.test(compact)) {
    return {
      title: uiCopy('Provider đang giới hạn request', 'Provider rate limit'),
      message: uiCopy('Hãy đợi một lúc rồi thử lại hoặc chọn model/provider khác.', 'Wait a moment and retry, or choose another model/provider.')
    };
  }
  if (/timeout|timed out|không phản hồi trong thời gian/i.test(compact)) {
    return {
      title: uiCopy('Model phản hồi quá chậm', 'Model timed out'),
      message: uiCopy('Model chưa trả lời trong thời gian cho phép. Hãy thử lại hoặc chọn model nhanh hơn.', 'The model did not respond in time. Retry or choose a faster model.')
    };
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network error|không thể kết nối/i.test(compact)) {
    return {
      title: uiCopy('Không thể kết nối provider', 'Provider unreachable'),
      message: uiCopy('Kiểm tra endpoint, mạng và trạng thái provider rồi thử lại.', 'Check the endpoint, network, and provider status, then retry.')
    };
  }
  return {
    title: uiCopy('Không thể hoàn tất yêu cầu', 'Request failed'),
    message: compact.slice(0, 600) || uiCopy('Provider không trả về thông tin lỗi.', 'The provider returned no error details.')
  };
}

function renderChatError(body, raw) {
  const info = classifyChatError(raw);
  body.classList.add('structured-error');
  body.replaceChildren();
  const card = document.createElement('div');
  card.className = 'chat-error-card';
  const icon = document.createElement('span');
  icon.className = 'chat-error-icon';
  icon.textContent = '!';
  const copy = document.createElement('div');
  copy.className = 'chat-error-copy';
  const title = document.createElement('strong');
  title.textContent = info.title;
  const message = document.createElement('span');
  message.textContent = info.message;
  copy.append(title, message);
  card.append(icon, copy);
  body.append(card);
}

function appendMessage(role, content, error = false, timestamp = Date.now(), attachments = [], turnIndex = null, artifact = null) {
  document.querySelector('.empty')?.remove();
  const item = document.createElement('article');
  item.className = 'message ' + role + (error ? ' error' : '');
  item.dataset.rawContent = content;
  if (Number.isInteger(turnIndex)) item.dataset.turnIndex = String(turnIndex);
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = formatTime(timestamp);
  const body = document.createElement('div');
  body.className = 'body';
  if (role === 'assistant' && error) renderChatError(body, content);
  else if (role === 'assistant') renderMarkdownInto(body, content);
  else renderUserPrompt(body, content);
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'message-action copy-message';
  copy.setAttribute('aria-label', 'Sao chép');
  copy.innerHTML = messageActionIcon('copy');
  copy.addEventListener('click', () => void copyMessageText(copy, item.dataset.rawContent || content));
  actions.append(copy);
  if (role === 'user' && Number.isInteger(turnIndex)) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'message-action edit-message';
    edit.setAttribute('aria-label', 'Chỉnh sửa');
    edit.innerHTML = messageActionIcon('edit');
    edit.addEventListener('click', () => beginMessageEdit(item, body, content, turnIndex));
    actions.append(edit);
  }
  meta.append(label, actions);
  item.append(body, meta);
  appendMessageAttachments(item, attachments);
  appendPlanArtifact(item, artifact, turnIndex);
  $('messages').append(item);
  scrollMessagesToBottom();
  return body;
}

function appendPlanArtifact(item, artifact, turnIndex) {
  if (!item || !artifact || artifact.type !== 'plan' || !Number.isInteger(turnIndex)) return;
  item.querySelector('.plan-artifact')?.remove();
  const card = document.createElement('section');
  card.className = 'plan-artifact';
  const icon = document.createElement('span');
  icon.className = 'plan-artifact-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = uiIcon('fileDoc');
  const copy = document.createElement('span');
  copy.className = 'plan-artifact-copy';
  const title = document.createElement('strong');
  title.textContent = artifact.title || activityCopy('Kế hoạch thực hiện', 'Implementation Plan');
  const meta = document.createElement('small');
  meta.textContent = activityCopy('Sẵn sàng để xem và phê duyệt', 'Ready to review and approve');
  copy.append(title, meta);
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'plan-artifact-open';
  open.innerHTML = '<span>' + activityCopy('Mở kế hoạch', 'Open plan') + '</span><i aria-hidden="true">' + uiIcon('caretRight') + '</i>';
  open.addEventListener('click', () => vscode.postMessage({ type: 'openPlanArtifact', turnIndex }));
  card.append(icon, copy, open);
  const body = item.querySelector('.body');
  item.insertBefore(card, body || item.querySelector('.message-meta'));
}

function appendTurnChangeSummary(item, data) {
  const changes = data.changes || [];
  if (!item || !changes.length) return;
  item.querySelector('.turn-change-summary')?.remove();
  const card = document.createElement('section');
  card.className = 'chat-change-summary turn-change-summary';
  const header = document.createElement('header');
  const icon = document.createElement('span');
  icon.className = 'change-summary-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = uiIcon('files');
  const copy = document.createElement('span');
  copy.className = 'change-summary-copy';
  const title = document.createElement('strong');
  title.textContent = changes.length + ' ' + (changes.length === 1 ? 'file' : 'files') + ' changed';
  const stats = document.createElement('small');
  stats.className = 'change-summary-stats';
  const added = changes.reduce((sum, change) => sum + Number(change.added || 0), 0);
  const removed = changes.reduce((sum, change) => sum + Number(change.removed || 0), 0);
  stats.innerHTML = '<b class="diff-add">+' + added + '</b><b class="diff-remove">-' + removed + '</b>';
  copy.append(title, stats);
  const actions = document.createElement('span');
  actions.className = 'change-summary-actions';
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'summary-undo';
  undo.textContent = activityCopy('Hoàn tác', 'Undo');
  undo.addEventListener('click', (event) => {
    event.stopPropagation();
    vscode.postMessage({ type: 'undoAllChanges' });
  });
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'summary-review';
  actions.append(undo, toggle);
  header.append(icon, copy, actions);
  const preview = document.createElement('div');
  preview.className = 'change-summary-preview';
  for (const change of changes) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'change-summary-file turn-change-file';
    row.dataset.changeId = change.id;
    row.innerHTML = fileTypeIcon(change.path) + '<span>' + escapeHtml(change.path) + '</span><small><b class="diff-add">+' + Number(change.added || 0) + '</b> <b class="diff-remove">-' + Number(change.removed || 0) + '</b></small>';
    row.addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }));
    preview.append(row);
  }
  let expanded = false;
  const setExpanded = (value) => {
    expanded = value;
    card.classList.toggle('collapsed', !expanded);
    toggle.textContent = expanded ? activityCopy('Ẩn', 'Hide') : activityCopy('Xem', 'Review');
  };
  toggle.addEventListener('click', () => setExpanded(!expanded));
  copy.addEventListener('click', () => setExpanded(!expanded));
  card.append(header, preview);
  setExpanded(false);
  item.insertBefore(card, item.querySelector('.message-meta'));
}

function appendTerminalOutput(data) {
  if (!assistantBody) return;
  const messageList = $('messages');
  const previousScrollTop = messageList.scrollTop;
  const command = String(data.command || 'PowerShell').replace(/\s+/g, ' ').trim() || 'PowerShell';
  if (!activeCommandGroup || !activeCommandGroup.isConnected) {
    activeCommandGroup = document.createElement('details');
    activeCommandGroup.className = 'activity-history-summary command-history';
    activeCommandGroup.open = false;
    const groupSummary = document.createElement('summary');
    groupSummary.innerHTML = '<span class="activity-history-icon" aria-hidden="true">' + uiIcon('terminalWindow') + '</span><span class="activity-history-copy"></span><span class="activity-history-caret" aria-hidden="true">' + uiIcon('caretRight') + '</span>';
    groupSummary.querySelector('.activity-history-copy').textContent = activityCopy('Đã chạy lệnh', 'Ran commands');
    const commandDetails = document.createElement('div');
    commandDetails.className = 'activity-history-details';
    activeCommandGroup.append(groupSummary, commandDetails);
    const commandGroup = activeCommandGroup;
    commandGroup.addEventListener('toggle', () => {
      const caret = commandGroup.querySelector('.activity-history-caret');
      if (caret) caret.innerHTML = uiIcon(commandGroup.open ? 'caretDown' : 'caretRight');
    });
    appendAssistantTimelineNode(activeCommandGroup);
  }
  const commandDetails = activeCommandGroup.querySelector('.activity-history-details');
  if (!activeTerminal || activeTerminal.dataset.command !== command) {
    activeTerminal = document.createElement('details');
    activeTerminal.className = 'terminal-card';
    activeTerminal.open = false;
    activeTerminal.dataset.command = command;
    const summary = document.createElement('summary');
    summary.innerHTML = '<span class="terminal-icon" aria-hidden="true">' + uiIcon('terminalWindow') + '</span><span class="terminal-command"></span><span class="terminal-elapsed"></span><span class="terminal-caret" aria-hidden="true">' + uiIcon('caretRight') + '</span>';
    summary.querySelector('.terminal-command').textContent = compactActivityText(command, 92);
    summary.querySelector('.terminal-elapsed').textContent = uiCopy('đang chạy', 'running');
    const output = document.createElement('pre');
    activeTerminal.append(summary, output);
    const terminal = activeTerminal;
    terminal.addEventListener('toggle', () => {
      const caret = terminal.querySelector('.terminal-caret');
      if (caret) caret.innerHTML = uiIcon(terminal.open ? 'caretDown' : 'caretRight');
    });
    commandDetails.append(activeTerminal);
  }
  const output = activeTerminal.querySelector('pre');
  output.textContent = (output.textContent + data.chunk).slice(-20000);
  activeTerminal.querySelector('.terminal-command').textContent = compactActivityText(command, 92);
  activeTerminal.querySelector('.terminal-elapsed').textContent = Math.max(1, Math.round((data.elapsedMs || 0) / 1000)) + 's';
  output.scrollTop = output.scrollHeight;
  messageList.scrollTop = previousScrollTop;
  requestAnimationFrame(() => {
    if (running) messageList.scrollTop = previousScrollTop;
  });
}

function renderGoal(goal) {
  activeGoal = goal || null;
  const rail = $('goalRail');
  rail.classList.toggle('hidden', !activeGoal);
  if (!activeGoal) return;
  const state = activeGoal.status || 'ready';
  rail.dataset.state = state;
  $('goalTitle').textContent = activeGoal.objective;
  $('goalStatus').textContent = activeGoal.lastStatus || (state === 'running' ? 'Đang làm việc' : state === 'paused' ? 'Đã tạm dừng' : state === 'failed' ? 'Cần xử lý' : 'Sẵn sàng để review');
  $('goalPause').classList.toggle('hidden', state !== 'running');
  $('goalResume').classList.toggle('hidden', state !== 'paused' && state !== 'failed');
}

function renderFollowUpQueue() {
  const queue = $('followUpQueue');
  const list = $('queueList');
  const composer = document.querySelector('.composer-shell');
  const attachmentList = $('attachmentList');
  if (composer && queue.parentElement !== composer) composer.insertBefore(queue, attachmentList || composer.firstChild);
  const shouldFollowQueue = messagesPinnedToBottom;
  queue.classList.toggle('hidden', !queuedFollowUps.length && followUpQueueEnabled);
  queue.classList.toggle('queue-disabled', !followUpQueueEnabled);
  $('queueCount').textContent = queuedFollowUps.length === 1
    ? uiCopy('1 tin nhắn đang chờ', '1 message queued')
    : uiCopy(queuedFollowUps.length + ' tin nhắn đang chờ', queuedFollowUps.length + ' messages queued');
  $('clearQueue').textContent = followUpQueueEnabled ? uiCopy('Xóa hàng đợi', 'Clear queue') : uiCopy('Bật xếp hàng', 'Turn on queueing');
  $('clearQueue').setAttribute('aria-label', followUpQueueEnabled ? uiCopy('Xóa hàng đợi', 'Clear queue') : uiCopy('Bật lại chế độ xếp hàng', 'Turn on queueing'));
  list.replaceChildren();
  queuedFollowUps.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'queue-row';
    const icon = document.createElement('span');
    icon.className = 'queue-row-icon';
    icon.innerHTML = uiIcon('arrowsClockwise');
    const copy = document.createElement('span');
    copy.className = 'queue-row-copy';
    copy.textContent = item.prompt;
    const steer = document.createElement('button');
    steer.type = 'button';
    steer.className = 'queue-steer';
    steer.innerHTML = '<span aria-hidden="true">↳</span><span>' + uiCopy('Điều hướng', 'Steer') + '</span>';
    const canSteer = running && item.mode === 'agent';
    steer.disabled = !canSteer;
  const steerHint = canSteer
    ? uiCopy('Dùng tin nhắn này để điều hướng Agent đang chạy', 'Use this message to steer the active Agent')
    : uiCopy('Chỉ có thể điều hướng Agent đang chạy', 'Steer is available only while Agent is running');
  steer.setAttribute('aria-label', steerHint);
  setRelayTooltip(steer, steerHint, 'above');
    steer.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!canSteer) return;
      const [selected] = queuedFollowUps.splice(index, 1);
      if (selected) {
        vscode.postMessage({ type: 'steerTurn', prompt: selected.prompt });
        renderFollowUpQueue();
      }
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'queue-icon-button';
    remove.setAttribute('aria-label', uiCopy('Bỏ tin nhắn khỏi hàng đợi', 'Remove message from queue'));
    remove.innerHTML = uiIcon('trash');
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      queuedFollowUps.splice(index, 1);
      renderFollowUpQueue();
    });
    const menuTrigger = document.createElement('button');
    menuTrigger.type = 'button';
    menuTrigger.className = 'queue-icon-button queue-menu-trigger';
    menuTrigger.setAttribute('aria-label', uiCopy('Tùy chọn hàng đợi', 'Queue options'));
    menuTrigger.innerHTML = '<span aria-hidden="true">•••</span>';
    const menu = document.createElement('div');
    menu.className = 'queue-row-menu hidden';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.innerHTML = uiIcon('pencilSimple') + '<span>' + uiCopy('Sửa tin nhắn', 'Edit message') + '</span>';
    edit.addEventListener('click', (event) => {
      event.stopPropagation();
      queuedFollowUps.splice(index, 1);
      $('prompt').value = item.prompt;
      setMode(item.mode);
      if ([...$('model').options].some((option) => option.value === item.model)) $('model').value = item.model;
      menu.classList.add('hidden');
      renderFollowUpQueue();
      resizePrompt();
      updateSendState();
      $('prompt').focus();
    });
    const toggleQueue = document.createElement('button');
    toggleQueue.type = 'button';
    toggleQueue.innerHTML = uiIcon(followUpQueueEnabled ? 'arrowCounterClockwise' : 'arrowsClockwise') + '<span>' + uiCopy(followUpQueueEnabled ? 'Tắt xếp hàng' : 'Bật xếp hàng', followUpQueueEnabled ? 'Turn off queueing' : 'Turn on queueing') + '</span>';
    toggleQueue.addEventListener('click', (event) => {
      event.stopPropagation();
      followUpQueueEnabled = !followUpQueueEnabled;
      menu.classList.add('hidden');
      renderFollowUpQueue();
      updateSendState();
      if (followUpQueueEnabled && !running && queuedFollowUps.length) runNextQueuedFollowUp();
    });
    menu.append(edit, toggleQueue);
    menuTrigger.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('.queue-row-menu').forEach((item) => { if (item !== menu) item.classList.add('hidden'); });
      menu.classList.toggle('hidden');
    });
    row.append(icon, copy, steer, remove, menuTrigger, menu);
    list.append(row);
  });
  if (queuedFollowUps.length && shouldFollowQueue) requestAnimationFrame(scrollMessagesToBottom);
}

function queueFollowUp(prompt, selectedMode, model) {
  if (!followUpQueueEnabled) return;
  queuedFollowUps.push({ prompt, mode: selectedMode, model });
  queuedFollowUpReady = false;
  renderFollowUpQueue();
  $('prompt').value = '';
  resetComposerTokens();
  resizePrompt();
  updateSendState();
}

function runNextQueuedFollowUp() {
  if (!followUpQueueEnabled || running || !queuedFollowUps.length || !queuedFollowUpReady) return;
  const next = queuedFollowUps.shift();
  queuedFollowUpReady = false;
  renderFollowUpQueue();
  setMode(next.mode);
  if ([...$('model').options].some((option) => option.value === next.model)) {
    $('model').value = next.model;
    $('model').dispatchEvent(new Event('change'));
  }
  setRunning(true);
  vscode.postMessage({ type: 'send', prompt: next.prompt, mode: next.mode, model: next.model, includeSelection: false, ...(isCodexTunableModel(next.model) ? { reasoningEffort, serviceTier } : {}) });
}

function setRunning(value, text = '') {
  running = value;
  const button = $('send');
  button.classList.toggle('running', value);
  button.classList.remove('stopping');
  const buttonHint = value ? uiCopy('Dừng', 'Stop') : uiCopy('Gửi', 'Send');
  button.setAttribute('aria-label', value ? uiCopy('Dừng phản hồi', 'Stop response') : uiCopy('Gửi', 'Send'));
  document.querySelector('.composer-shell')?.classList.toggle('is-running', value);
  updateRunningScrollIndicator();
  updateChangeActionState();
  updateSendState();
}

function updateChangeActionState() {
  const disabled = running || changeOperationBusy;
  $('changeTray')?.classList.toggle('is-busy', changeOperationBusy);
  document.querySelectorAll('#changeList button:not(.is-resolved),#undoAllChanges,#acceptAllChanges,.hunk-undo,.hunk-accept,.review-undo-file,.review-accept-file,.summary-undo').forEach((button) => { button.disabled = disabled; });
  if ($('undoAllChanges')) $('undoAllChanges').disabled = disabled || !lastPendingChangeCount;
  if ($('acceptAllChanges')) $('acceptAllChanges').disabled = disabled || !lastPendingChangeCount;
}

function finishTurn(data) {
  const turnMessage = assistantBody?.closest('.message')
    || document.querySelector('.message.assistant.streaming')
    || [...document.querySelectorAll('.message.assistant')].at(-1);
  finalizeLiveActivity();
  assistantBody?.closest('.message')?.classList.remove('show-trace');
  if (workingLabel?.classList.contains('working-live')) {
    finishWorkingLabel(data.cancelled ? 'cancelled' : data.error ? 'error' : 'complete');
  }
  turnMessage?.classList.remove('streaming');
  turnMessage?.classList.add('complete');
  document.querySelectorAll('.message.streaming.complete').forEach((item) => item.classList.remove('streaming'));
  if (data.cancelled) discardTechnicalHistory(turnMessage);
  else compactTechnicalHistory(turnMessage);
  activeTerminal = null;
  activeCommandGroup = null;
  if (data.error) {
    if (assistantBody && !assistantRawText && !turnMessage?.querySelector('.agent-commentary,.activity-history-summary')) assistantBody.closest('.message')?.remove();
    const errorBody = appendMessage('assistant', data.error, true, data.timestamp);
    if (activeProvider === '9router'
      && /không phản hồi|không có hoạt động|không phản hồi API|chưa trả kết quả Agent/i.test(data.error)
      && !/HTTP 403|bearer token|invalid token|xác thực|đăng nhập lại/i.test(data.error)) {
      const actions = document.createElement('div'); actions.className = 'error-actions';
      const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'error-action'; restart.textContent = uiCopy('Kiểm tra kết nối', 'Check connection');
      restart.addEventListener('click', () => {
        vscode.postMessage({ type: 'checkRouterConnection' });
      });
      actions.append(restart);
      errorBody.append(actions);
    }
  } else if (data.cancelled && assistantBody && !assistantRawText && !turnMessage?.querySelector('.agent-commentary,.activity-history-summary')) {
    renderMarkdownInto(assistantBody, 'Đã dừng.');
  } else if (assistantBody) {
    const label = assistantBody.closest('.message')?.querySelector('.label');
    if (label) label.textContent = formatTime(data.timestamp);
  }
  if (assistantBody && data.artifact) {
    appendPlanArtifact(assistantBody.closest('.message'), data.artifact, data.turnIndex);
  }
  if (turnMessage && data.changes?.length) {
    appendTurnChangeSummary(turnMessage, data);
  }
  assistantBody = null;
  assistantRawText = '';
  assistantActivity = null;
  pendingActivityStatus = '';
  activityReadyAfterCommentary = false;
  activeTerminal = null;
  activeCommandGroup = null;
  activitySteps = new Map();
  pendingTurnEnd = null;
  turnStartedAt = 0;
  workingLabel = null;
  setRunning(false);
  if (pendingCompletedChangesState) {
    const completedChangesState = pendingCompletedChangesState;
    pendingCompletedChangesState = null;
    window.dispatchEvent(new MessageEvent('message', { data: completedChangesState }));
  }
  $('prompt').focus();
  if (queuedFollowUpReady) runNextQueuedFollowUp();
}

function settleTurn(data) {
  try {
    flushAssistantText();
    finishTurn(data);
  } catch (error) {
    console.error('RelayCode failed to render the completed turn.', error);
  } finally {
    if (workingTimer) clearInterval(workingTimer);
    workingTimer = null;
    workingLabel?.classList.remove('working-live');
    document.querySelectorAll('.message.streaming').forEach((item) => {
      item.classList.remove('streaming');
      item.classList.add('complete');
    });
    // This is deliberately repeated outside finishTurn(): even if Markdown or
    // history compaction throws, a completed turn must never retain live trace.
    document.querySelectorAll('.message.complete .agent-activity').forEach((node) => node.remove());
    pendingAssistantText = '';
    pendingTurnEnd = null;
    turnStartedAt = 0;
    assistantBody = null;
    assistantActivity = null;
    pendingActivityStatus = '';
    activityReadyAfterCommentary = false;
    activeTerminal = null;
    activeCommandGroup = null;
    activitySteps = new Map();
    setRunning(false);
    if (messagesPinnedToBottom) scrollMessagesToBottom();
    else updateRunningScrollIndicator();
  }
}

function updateSendState() {
  const hasPrompt = Boolean($('prompt').value.trim() || composerLinks.length || composerSkills.length || composerContexts.length || composerGoalMode || composerCommand);
  $('send').disabled = running ? false : !hasPrompt;
  $('send').classList.toggle('queue-ready', running && hasPrompt && followUpQueueEnabled);
  $('send').setAttribute('aria-label', running ? (hasPrompt && followUpQueueEnabled ? 'Gửi vào hàng chờ' : 'Dừng phản hồi') : 'Gửi');
}

function closeFollowUpMenus() {
  document.querySelectorAll('.queue-row-menu').forEach((menu) => menu.classList.add('hidden'));
}

function stopCurrentTurn() {
  $('send').classList.add('stopping');
  vscode.postMessage({ type: 'stopTurn' });
  // Release the composer immediately. The host acknowledgement remains
  // idempotent and will reconcile any late provider event.
  settleTurn({ cancelled: true, timestamp: Date.now() });
}

function resizePrompt() {
  const prompt = $('prompt');
  const maximum = 132;
  prompt.style.height = '26px';
  const height = Math.min(prompt.scrollHeight, maximum);
  prompt.style.height = height + 'px';
  prompt.style.overflowY = prompt.scrollHeight > maximum ? 'auto' : 'hidden';
  document.querySelector('.composer-shell')?.classList.toggle('has-input', Boolean(prompt.value.trim() || composerLinks.length || composerSkills.length || composerContexts.length || composerGoalMode || composerCommand));
}

function composerSkillLabel(name) {
  return String(name || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createComposerToken(kind, label, onRemove) {
  const token = document.createElement('button');
  token.type = 'button';
  token.className = 'composer-token ' + kind;
  token.setAttribute('aria-label', 'Bỏ ' + label);
  const mark = document.createElement('i');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = uiIcon(kind === 'goal' ? 'target' : kind === 'command' ? 'terminalWindow' : kind === 'skill' ? 'cube' : 'selection');
  const copy = document.createElement('span');
  copy.textContent = label;
  const remove = document.createElement('b');
  remove.setAttribute('aria-hidden', 'true');
  remove.textContent = '×';
  token.append(mark, copy, remove);
  token.addEventListener('click', onRemove);
  return token;
}

function createComposerLinkToken(link) {
  const token = document.createElement('span');
  token.className = 'composer-token link';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'composer-link-open';
  open.setAttribute('aria-label', 'Mở ' + link.label);
  const mark = document.createElement('i');
  mark.setAttribute('aria-hidden', 'true');
  let isGithub = false;
  try { isGithub = new URL(link.url).hostname.replace(/^www\./, '') === 'github.com'; } catch {}
  mark.innerHTML = isGithub ? brandIcon('github', 'GitHub') : uiIcon('plugsConnected');
  const copy = document.createElement('span');
  copy.textContent = link.label;
  open.append(mark, copy);
  open.addEventListener('click', () => vscode.postMessage({ type: 'openExternal', url: link.url }));
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'composer-link-remove';
  remove.innerHTML = uiIcon('x');
  remove.setAttribute('aria-label', 'Bỏ liên kết ' + link.label);
  remove.addEventListener('click', () => {
    composerLinks = composerLinks.filter((item) => item.url !== link.url);
    renderComposerTokens();
    $('prompt').focus();
  });
  token.append(open, remove);
  return token;
}

function addComposerLink(url, label = '') {
  const normalized = String(url || '').trim();
  if (!/^https?:\/\//i.test(normalized)) return false;
  if (!composerLinks.some((item) => item.url === normalized)) {
    composerLinks.push({ url: normalized, label: compactExternalLink(normalized, label) });
  }
  renderComposerTokens();
  return true;
}

function extractComposerLinks(text, includeBareUrls) {
  let changed = false;
  let remaining = String(text || '').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_, label, url) => {
    changed = addComposerLink(url, label) || changed;
    return '';
  });
  if (includeBareUrls) {
    remaining = remaining.replace(/https?:\/\/[^\s<>()]+/gi, (url) => {
      changed = addComposerLink(url) || changed;
      return '';
    });
  }
  return { changed, text: remaining.replace(/[ \t]{2,}/g, ' ').trimStart() };
}

function renderComposerTokens() {
  const host = $('composerTokens');
  host.replaceChildren();
  if (composerCommand) {
    host.append(createComposerToken('command', composerCommand.label, () => {
      composerCommand = null;
      renderComposerTokens();
      $('prompt').focus();
    }));
  }
  if (composerGoalMode) {
    host.append(createComposerToken('goal', 'Goal', () => {
      composerGoalMode = false;
      renderComposerTokens();
      $('prompt').focus();
    }));
  }
  composerSkills.forEach((skill) => {
    host.append(createComposerToken('skill', composerSkillLabel(skill.name), () => {
      composerSkills = composerSkills.filter((item) => item.name !== skill.name);
      renderComposerTokens();
      $('prompt').focus();
    }));
  });
  composerContexts.forEach((context) => {
    host.append(createComposerToken('context', context, () => {
      composerContexts = composerContexts.filter((item) => item !== context);
      renderComposerTokens();
      $('prompt').focus();
    }));
  });
  composerLinks.forEach((link) => host.append(createComposerLinkToken(link)));
  const hasTokens = Boolean(composerCommand) || composerGoalMode || composerSkills.length > 0 || composerContexts.length > 0 || composerLinks.length > 0;
  $('composerInput').classList.toggle('has-tokens', hasTokens);
  updateComposerPlaceholder();
  updateSendState();
}

function resetComposerTokens() {
  composerGoalMode = false;
  composerCommand = null;
  composerSkills = [];
  composerContexts = [];
  composerLinks = [];
  renderComposerTokens();
}

function effectiveComposerPrompt() {
  if (composerCommand) return composerCommand.key;
  const parts = [
    ...composerSkills.map((skill) => '$' + skill.name),
    ...composerContexts,
    ...composerLinks.map((link) => '[' + link.label + '](' + link.url + ')'),
    $('prompt').value.trim()
  ].filter(Boolean);
  const body = parts.join(' ');
  return composerGoalMode && body ? '/goal ' + body : body;
}

function activeComposerTrigger(value) {
  const definitions = [
    ['command', /(?:^|\s)(\/[^\s]*)$/],
    ['skill', /(?:^|\s)(\$[^\s]*)$/],
    ['mention', /(?:^|\s)(@[^\s]*)$/]
  ];
  for (const [kind, pattern] of definitions) {
    const match = value.match(pattern);
    if (!match) continue;
    const token = match[1];
    return { kind, token, start: match.index + match[0].lastIndexOf(token), end: value.length };
  }
  return null;
}

function replaceComposerTrigger(trigger, replacement = '') {
  const prompt = $('prompt');
  const before = prompt.value.slice(0, trigger.start);
  const after = prompt.value.slice(trigger.end);
  prompt.value = (before + replacement + after).replace(/[ \t]+$/, replacement ? ' ' : '');
  resizePrompt();
}

function closeAddMenu() {
  $('addMenu').classList.add('hidden');
  $('attach').classList.remove('active');
  $('attach').setAttribute('aria-expanded', 'false');
}

function appendMenuSection(host, label) {
  const heading = document.createElement('div');
  heading.className = 'menu-section-label';
  heading.textContent = label;
  host.append(heading);
}

function createMenuRow({ glyph, label, description, meta = '', action, selected = false }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = selected ? 'selected' : '';
  button.setAttribute('role', 'menuitem');
  const icon = document.createElement('span');
  icon.className = 'menu-glyph';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = uiIcon(glyph || 'cube');
  const main = document.createElement('span');
  main.className = 'menu-main';
  const title = document.createElement('strong');
  title.textContent = label;
  const copy = document.createElement('small');
  copy.textContent = description;
  main.append(title, copy);
  const suffix = document.createElement('span');
  suffix.className = 'menu-meta';
  suffix.textContent = meta;
  button.append(icon, main, suffix);
  button.addEventListener('click', action);
  return button;
}

function renderAddMenu() {
  const menu = $('addMenu');
  menu.replaceChildren();
  appendMenuSection(menu, uiCopy('Thêm', 'Add'));
  menu.append(
    createMenuRow({
      glyph: 'paperclip',
      label: uiCopy('Tệp và thư mục', 'Files and folders'),
      description: uiCopy('Đính kèm ngữ cảnh từ workspace', 'Attach context from workspace'),
      action: () => {
        closeAddMenu();
        vscode.postMessage({ type: 'pickFiles', kind: 'resources' });
      }
    }),
    createMenuRow({
      glyph: 'target',
      label: 'Goal',
      description: uiCopy('Đặt mục tiêu để agent tiếp tục theo đuổi', 'Set a goal for Agent to keep pursuing'),
      action: () => {
        composerGoalMode = true;
        closeAddMenu();
        renderComposerTokens();
        $('prompt').focus();
      }
    }),
    createMenuRow({
      glyph: 'lightbulb',
      label: 'Plan mode',
      description: uiCopy('Lập kế hoạch trước khi thực hiện', 'Plan before implementation'),
      action: () => {
        closeAddMenu();
        setMode('plan');
        $('prompt').focus();
      }
    })
  );
  if (skills.length) {
    appendMenuSection(menu, 'Skills');
    for (const skill of skills) {
      menu.append(createMenuRow({
        glyph: 'cube',
        label: composerSkillLabel(skill.name),
        description: skill.description || uiCopy('Thêm skill vào yêu cầu', 'Add a skill to the request'),
        meta: skill.source === 'workspace' ? 'Workspace' : 'Personal',
        selected: composerSkills.some((item) => item.name === skill.name),
        action: () => {
          if (!composerSkills.some((item) => item.name === skill.name)) composerSkills.push(skill);
          closeAddMenu();
          renderComposerTokens();
          $('prompt').focus();
        }
      }));
    }
  }
}

function renderComposerMenu() {
  const value = $('prompt').value;
  const menu = $('composerMenu');
  const slash = [
    ['/goal', uiCopy('Chạy tác vụ dài có thể tạm dừng và tiếp tục', 'Run a long task that can be paused and resumed'), 'Goal', 'target'],
    ['/new', uiCopy('Bắt đầu một cuộc chat mới', 'Start a new chat'), 'New chat', 'chatCircle'],
    ['/compact', uiCopy('Rút gọn ngữ cảnh cuộc chat', 'Compact this chat context'), 'Compact', 'broom'],
    ['/summary', uiCopy('Xem mục tiêu, file đổi và việc còn lại', 'View goals, changed files and open issues'), 'Summary', 'info'],
    ['/skills', uiCopy('Tìm và chèn skill', 'Find and insert a skill'), 'Skills', 'cube'],
    ['/model', uiCopy('Mở danh sách model', 'Open the model list'), 'Model', 'circlesThree'],
    ['/plan', uiCopy('Chuyển sang chế độ Plan', 'Switch to Plan mode'), 'Plan mode', 'lightbulb'],
    ['/review', uiCopy('Xem các file đã thay đổi', 'View changed files'), 'Code review', 'magnifyingGlass'],
    ['/diff', uiCopy('Mở các thay đổi đang chờ review', 'Open changes awaiting review'), 'Diff', 'gitDiff'],
    ['/ide-context', uiCopy('Bật hoặc tắt file đang mở trong ngữ cảnh', 'Toggle the open file in context'), 'IDE context', 'selection'],
    ['/init', uiCopy('Tạo khung AGENTS.md cho dự án', 'Create an AGENTS.md scaffold for the project'), 'Init', 'fileMd'],
    ['/status', uiCopy('Xem provider, MCP và skills', 'View provider, MCP and skills status'), 'Status', 'info'],
    ['/diagnostics', uiCopy('Kiểm tra kết nối', 'Check connection'), 'Diagnostics', 'pulse'],
    ['/mcp', uiCopy('Mở công cụ MCP', 'Open MCP tools'), 'MCP', 'plugsConnected'],
    ['/settings', uiCopy('Mở cấu hình', 'Open settings'), 'Settings', 'gear'],
    ['/logs', uiCopy('Mở Output Channel', 'Open Output Channel'), 'Logs', 'terminalWindow'],
    ['/export', uiCopy('Xuất gói chẩn đoán', 'Export diagnostics package'), 'Export', 'export']
  ];
  const mentions = [
    ['@selection', uiCopy('Đoạn code đang chọn', 'Selected code'), 'Selection', 'selection'],
    ['@file:', uiCopy('Một file trong workspace', 'A workspace file'), 'File', 'file'],
    ['@folder:', uiCopy('Cây file của thư mục', 'Folder file tree'), 'Folder', 'folderOpen'],
    ['@terminal', uiCopy('Output terminal gần nhất', 'Latest terminal output'), 'Terminal', 'terminalWindow'],
    ['@git-diff', uiCopy('Thay đổi Git hiện tại', 'Current Git changes'), 'Git diff', 'gitDiff'],
    ['@problems', uiCopy('Problems của workspace', 'Workspace problems'), 'Problems', 'pulse']
  ];
  const trigger = activeComposerTrigger(value);
  const source = trigger?.kind === 'command'
    ? slash.map(([key, description, label, glyph]) => ({ key, description, label, glyph, kind: 'command' }))
    : trigger?.kind === 'mention'
      ? mentions.map(([key, description, label, glyph]) => ({ key, description, label, glyph, kind: 'mention' }))
      : trigger?.kind === 'skill'
        ? skills.map((skill) => ({ key: '$' + skill.name, label: composerSkillLabel(skill.name), glyph: 'cube', description: skill.description, kind: 'skill', source: skill.source, skill }))
        : [];
  const needle = (trigger?.token || '').toLowerCase();
  const filtered = source.filter((item) => item.key.toLowerCase().includes(needle)).slice(0, 50);
  menu.replaceChildren();
  if (composerMenuIndex >= filtered.length) composerMenuIndex = filtered.length - 1;
  if (composerMenuIndex < 0 && filtered.length) composerMenuIndex = 0;
  for (const [index, item] of filtered.entries()) {
    const button = createMenuRow({
      glyph: item.glyph || (item.kind === 'skill' ? 'cube' : 'info'),
      label: item.label || item.key,
      description: item.description,
      meta: item.kind === 'skill' ? (item.source === 'workspace' ? 'Workspace' : 'Personal') : item.key,
      selected: index === composerMenuIndex,
      action: () => {
      if (!trigger) return;
      if (item.kind === 'skill') {
        if (!composerSkills.some((skill) => skill.name === item.skill.name)) composerSkills.push(item.skill);
        replaceComposerTrigger(trigger);
        renderComposerTokens();
      } else if (item.kind === 'mention' && !item.key.endsWith(':')) {
        if (!composerContexts.includes(item.key)) composerContexts.push(item.key);
        replaceComposerTrigger(trigger);
        renderComposerTokens();
      } else if (item.kind === 'command' && item.key === '/goal') {
        composerGoalMode = true;
        replaceComposerTrigger(trigger);
        renderComposerTokens();
      } else if (item.kind === 'command' && item.key === '/skills') {
        replaceComposerTrigger(trigger, '$');
        composerMenuIndex = 0;
        renderComposerMenu();
        $('prompt').focus();
        return;
      } else if (item.kind === 'command' && item.key === '/model') {
        replaceComposerTrigger(trigger);
        $('modelTrigger').click();
      } else if (item.kind === 'command' && item.key === '/plan') {
        replaceComposerTrigger(trigger);
        setMode('plan');
      } else {
        composerCommand = { key: item.key, label: item.label || item.key };
        $('prompt').value = '';
        renderComposerTokens();
      }
      menu.classList.add('hidden');
      composerMenuIndex = -1;
      $('prompt').focus();
      resizePrompt();
      updateSendState();
      }
    });
    menu.append(button);
  }
  menu.classList.toggle('hidden', !filtered.length);
}

function send() {
  const rawPrompt = $('prompt').value.trim();
  const prompt = effectiveComposerPrompt();
  if (!prompt) return;
  const model = $('model').value;
  const standaloneCommand = Boolean(composerCommand) || (!composerGoalMode && !composerSkills.length && !composerContexts.length && !composerLinks.length && rawPrompt.startsWith('/'));
  if (!model && !standaloneCommand) { showUiToast({ message: 'Hãy chọn một model trước khi gửi.', tone: 'danger' }); return; }
  const selected = $('model').selectedOptions[0];
  if (mode === 'agent' && selected?.dataset.tools === 'false') { showUiToast({ message: 'Model này không hỗ trợ tools nên không thể chạy Agent mode. Hãy chuyển sang Chat hoặc chọn model khác.', tone: 'danger' }); return; }
  if (running) {
    if (!followUpQueueEnabled) {
      stopCurrentTurn();
      return;
    }
    queueFollowUp(prompt, mode, model);
    return;
  }
  if (pendingTurnEnd) {
    const completedTurn = pendingTurnEnd;
    pendingTurnEnd = null;
    flushAssistantText();
    finishTurn(completedTurn);
  }
  vscode.postMessage({ type: 'send', prompt, mode, model, includeSelection: false, ...(isCodexTunableModel(model) ? { reasoningEffort, serviceTier } : {}) });
  $('prompt').blur();
  if (!standaloneCommand) setRunning(true);
  $('prompt').value = '';
  resetComposerTokens();
  resizePrompt();
  updateSendState();
}

document.querySelectorAll('#modeMenu [data-mode]').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation();
  setMode(button.dataset.mode, true);
  $('modeMenu').classList.add('hidden');
  $('modePicker').classList.remove('open');
  $('modeTrigger').setAttribute('aria-expanded', 'false');
}));
$('modeTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('modeMenu').classList.contains('hidden');
  if (open) closeDropdowns($('modeMenu'));
  $('modeMenu').classList.toggle('hidden', !open);
  $('modePicker').classList.toggle('open', open);
  $('modeTrigger').setAttribute('aria-expanded', String(open));
});
$('modeMenu').addEventListener('click', (event) => event.stopPropagation());
$('connect').addEventListener('click', () => {
  showError('');
  vscode.postMessage({ type: 'connect', endpoint: $('endpoint').value, apiKey: $('apiKey').value || undefined, provider: $('configProvider').value });
});
$('startRouter').addEventListener('click', () => {
  showError('');
  setRouterLaunchState('starting', 'Đang mở 9Router');
  vscode.postMessage({ type: 'startRouter' });
});
$('openDashboard').addEventListener('click', () => vscode.postMessage({ type: 'openDashboard' }));
$('openCockpitCenter').addEventListener('click', () => vscode.postMessage({ type: 'openCockpit' }));
$('disconnectConnection').addEventListener('click', () => vscode.postMessage({ type: 'disconnectProvider' }));
$('backToChat').addEventListener('click', () => {
  setupDismissed = true;
  setupOpenRequested = false;
  showSetup(false);
});
$('historyToggle').addEventListener('click', (event) => {
  event.stopPropagation();
  const opening = $('historyPanel').classList.contains('hidden');
  if (opening) {
    vscode.postMessage({ type: 'showAgentRecovery' });
    historyExpanded = false;
    renderHistory(allSessions);
    openFloatingSurface('historyPanel');
  } else $('historyPanel').classList.add('hidden');
});
$('historyPanel').addEventListener('click', (event) => event.stopPropagation());
$('closeHistory').addEventListener('click', () => { historyExpanded = false; $('historyPanel').classList.add('hidden'); });
$('clearAllHistory').addEventListener('click', () => vscode.postMessage({ type: 'deleteAllSessions' }));
$('viewAllHistory').addEventListener('click', () => { historyExpanded = true; renderHistory(allSessions); });
$('metricsToggle').addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'openTelemetryDashboard' }); });
$('closeTelemetry').addEventListener('click', () => $('telemetryPanel').classList.add('hidden'));
$('telemetryPanel').addEventListener('click', (event) => event.stopPropagation());
$('clearTelemetry').addEventListener('click', () => vscode.postMessage({ type: 'clearTelemetry' }));
$('openMcp').addEventListener('click', (event) => { event.stopPropagation(); openFloatingSurface('mcpPanel', { preserve: ['configPanel'] }); vscode.postMessage({ type: 'getMcpServers' }); });
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
  try { env = $('mcpEnv').value.trim() ? JSON.parse($('mcpEnv').value) : {}; } catch { $('diagnosticsResult').textContent = uiCopy('Env MCP phải là JSON hợp lệ.', 'MCP environment values must be valid JSON.'); $('diagnosticsResult').className = 'diagnostics-result failure'; return; }
  vscode.postMessage({ type: 'saveMcpServer', token: $('mcpToken').value || undefined, server: { id: '', name: $('mcpName').value, transport, authMode: transport === 'http' ? $('mcpAuth').value : undefined, enabled: true, command: $('mcpCommand').value, args: $('mcpArgs').value.split(/\s+/).filter(Boolean), url: $('mcpUrl').value }, env });
});
updateMcpForm();
$('closeImage').addEventListener('click', () => $('imageLightbox').classList.add('hidden'));
$('imageLightbox').addEventListener('click', (event) => { if (event.target === $('imageLightbox')) $('imageLightbox').classList.add('hidden'); });
$('attach').addEventListener('click', (event) => {
  event.stopPropagation();
  const opening = $('addMenu').classList.contains('hidden');
  if (opening) {
    closeDropdowns($('addMenu'));
    $('composerMenu').classList.add('hidden');
    composerMenuIndex = -1;
    renderAddMenu();
    $('addMenu').classList.remove('hidden');
    $('attach').classList.add('active');
  } else {
    closeAddMenu();
  }
  $('attach').setAttribute('aria-expanded', String(opening));
});
$('addMenu').addEventListener('click', (event) => event.stopPropagation());
$('acceptAllChanges').addEventListener('click', () => vscode.postMessage({ type: 'acceptAllChanges' }));
$('undoAllChanges').addEventListener('click', () => vscode.postMessage({ type: 'undoAllChanges' }));
$('hideChanges').addEventListener('click', () => {
  changesHidden = true;
  $('changeTray').classList.add('hidden');
  $('collapsedChanges').classList.toggle('hidden', !lastChangeCount);
});
$('expandChanges').addEventListener('click', () => {
  changesHidden = false;
  $('collapsedChanges').classList.add('hidden');
  if (lastChangeCount) $('changeTray').classList.remove('hidden');
});
$('model').addEventListener('change', () => {
   if ($('model').value !== lastAutoModel) {
     modelSelectionSource = 'manual';
     if ($('model').value) saveComposerPreferences({ mode, model: $('model').value });
   }
   const selectedLabel = $('model').selectedOptions[0]?.textContent || uiCopy('Chọn model', 'Select model');
  $('modelLabel').textContent = selectedLabel;
  $('modelBrand').innerHTML = $('model').value ? brandIcon(brandKey($('model').value, activeProvider), selectedLabel) : '';
  updateCodexTuning();
});
$('modelTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('modelMenu').classList.contains('hidden');
  if (open) closeDropdowns($('modelMenu'));
  if (open) favoriteModelsAtMenuOpen = [...favoriteModels];
  $('modelMenu').classList.toggle('hidden', !open);
  $('modelPicker').classList.toggle('open', open);
  $('modelTrigger').setAttribute('aria-expanded', String(open));
  $('modelSearch').value = '';
  renderModelMenu();
  if (open) $('modelSearch').focus();
});
$('modelMenu').addEventListener('click', (event) => event.stopPropagation());
$('modelSearch').addEventListener('input', () => renderModelMenu($('modelSearch').value));
$('checkModels').addEventListener('click', (event) => {
  event.stopPropagation();
  vscode.postMessage({ type: checkingModels ? 'cancelModelCheck' : 'checkModels' });
});
$('providerTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('providerMenu').classList.contains('hidden');
  if (open) closeDropdowns($('providerMenu'));
  $('providerMenu').classList.toggle('hidden', !open);
  $('providerPicker').classList.toggle('open', open);
  $('providerTrigger').setAttribute('aria-expanded', String(open));
});
$('providerMenu').addEventListener('click', (event) => event.stopPropagation());
document.querySelectorAll('#providerMenu .provider-option').forEach(option => option.addEventListener('click', (event) => {
  event.stopPropagation();
  setProvider(option.dataset.provider, true, false);
  $('providerMenu').classList.add('hidden');
  $('providerPicker').classList.remove('open');
  $('providerTrigger').setAttribute('aria-expanded', 'false');
}));
$('reasoningTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('reasoningMenu').classList.contains('hidden');
  if (open) closeDropdowns($('reasoningMenu'));
  $('reasoningMenu').classList.toggle('hidden', !open);
  $('reasoningPicker').classList.toggle('open', open);
  $('reasoningTrigger').setAttribute('aria-expanded', String(open));
});
$('reasoningMenu').addEventListener('click', (event) => event.stopPropagation());
document.querySelectorAll('#reasoningMenu [data-effort]').forEach((option) => option.addEventListener('click', (event) => {
  event.stopPropagation();
  reasoningEffort = option.dataset.effort;
  $('reasoningMenu').classList.add('hidden');
  $('reasoningPicker').classList.remove('open');
  $('reasoningTrigger').setAttribute('aria-expanded', 'false');
  updateCodexTuning();
  saveComposerPreferences({ mode, model: $('model').value || undefined, reasoningEffort });
}));
$('fastMode').addEventListener('click', (event) => {
  event.stopPropagation();
  serviceTier = serviceTier === 'fast' ? 'default' : 'fast';
  updateCodexTuning();
  saveComposerPreferences({ mode, model: $('model').value || undefined, serviceTier });
});
$('quotaReset').addEventListener('click', () => vscode.postMessage({ type: 'openTelemetryDashboard' }));
$('languageTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('languageMenu').classList.contains('hidden');
  if (open) closeDropdowns($('languageMenu'));
  $('languageMenu').classList.toggle('hidden', !open);
  $('languagePicker').classList.toggle('open', open);
  $('languageTrigger').setAttribute('aria-expanded', String(open));
});
$('languageMenu').addEventListener('click', (event) => event.stopPropagation());
document.querySelectorAll('#languageMenu [data-language]').forEach((option) => option.addEventListener('click', (event) => {
  event.stopPropagation();
  $('uiLanguage').value = option.dataset.language;
  $('uiLanguage').dispatchEvent(new Event('change'));
  $('languageMenu').classList.add('hidden');
  $('languagePicker').classList.remove('open');
  $('languageTrigger').setAttribute('aria-expanded', 'false');
}));
$('retryConnection').addEventListener('click', () => {
  showError('');
  $('setupCheckResult').textContent = uiCopy('Đang kiểm tra provider…', 'Checking provider…');
  $('setupCheckResult').className = 'setup-check-result checking';
  $('retryConnection').disabled = true;
  vscode.postMessage({ type: 'diagnostics' });
});
$('connectionToggle').addEventListener('click', () => vscode.postMessage({ type: 'disconnectProvider' }));
function runConnectionDiagnostics() {
  const meta = providerMeta[activeProvider] || providerMeta['9router'];
  openFloatingSurface('connectionDiagnostics');
  $('connectionProviderName').textContent = meta.label;
  $('connectionProviderMark').innerHTML = brandIcon(meta.brand, meta.label);
  $('connectionEndpoint').textContent = $('configEndpoint').value.trim() || 'Chưa có endpoint';
  $('connectionDialogSubtitle').textContent = uiCopy('Đang kiểm tra ', 'Checking ') + meta.label;
  $('connectionHealthBadge').textContent = uiCopy('Đang kiểm tra', 'Checking');
  $('connectionHealthBadge').className = 'checking';
  $('connectionLatency').textContent = '—';
  $('connectionModels').textContent = '—';
  $('connectionMessage').textContent = uiCopy('Đang gửi yêu cầu kiểm tra provider…', 'Sending a provider check request…');
  $('retryDiagnostics').disabled = true;
  vscode.postMessage({ type: 'diagnostics' });
}
function openConnectionCenter() {
  setupDismissed = false;
  setupOpenRequested = true;
  closeFloatingSurfaces();
  showSetup(true);
  $('setup').scrollTop = 0;
}
$('topConnect').addEventListener('click', openConnectionCenter);
$('connectionBadge').addEventListener('click', openConnectionCenter);
$('connectionBadge').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openConnectionCenter();
});
$('retryDiagnostics').addEventListener('click', runConnectionDiagnostics);
$('closeConnectionDiagnostics').addEventListener('click', () => $('connectionDiagnostics').classList.add('hidden'));
$('connectionDiagnostics').addEventListener('click', (event) => { if (event.target === $('connectionDiagnostics')) $('connectionDiagnostics').classList.add('hidden'); });
$('openConnectionSettings').addEventListener('click', () => {
  openFloatingSurface('configPanel');
});
function positionPermissionMenu() {
  const menu = $('permMenu');
  menu.style.setProperty('--perm-menu-shift', '0px');
  const rect = menu.getBoundingClientRect();
  const edge = 8;
  const viewportWidth = document.documentElement.clientWidth;
  const shift = rect.left < edge
    ? edge - rect.left
    : rect.right > viewportWidth - edge
      ? viewportWidth - edge - rect.right
      : 0;
  menu.style.setProperty('--perm-menu-shift', Math.round(shift) + 'px');
}
$('permissionMode').addEventListener('click', (e) => {
  e.stopPropagation();
  const wrap = $('permDropdown');
  const isOpen = wrap.classList.contains('open');
  if (!isOpen) closeDropdowns($('permMenu'));
  wrap.classList.toggle('open', !isOpen);
  $('permMenu').classList.toggle('hidden', isOpen);
  $('permissionMode').setAttribute('aria-expanded', String(!isOpen));
  if (!isOpen) requestAnimationFrame(positionPermissionMenu);
});
window.addEventListener('resize', () => {
  if (!$('permMenu').classList.contains('hidden')) positionPermissionMenu();
});
document.querySelectorAll('#permMenu .perm-opt').forEach(opt => {
  opt.addEventListener('click', (e) => {
    e.stopPropagation();
    if (opt.dataset.perm === 'full') openFloatingSurface('accessConfirm');
    else vscode.postMessage({ type: 'setPermissionMode', mode: opt.dataset.perm });
    $('permDropdown').classList.remove('open');
    $('permMenu').classList.add('hidden');
    $('permissionMode').setAttribute('aria-expanded', 'false');
  });
});
$('cancelFull').addEventListener('click', () => $('accessConfirm').classList.add('hidden'));
$('confirmFull').addEventListener('click', () => { $('accessConfirm').classList.add('hidden'); vscode.postMessage({ type: 'setPermissionMode', mode: 'full' }); });
$('accessConfirm').addEventListener('click', (event) => { if (event.target === $('accessConfirm')) $('accessConfirm').classList.add('hidden'); });
$('configPanel').addEventListener('click', (event) => {
  event.stopPropagation();
  if (!$('providerPicker').contains(event.target)) {
    $('providerMenu').classList.add('hidden');
    $('providerPicker').classList.remove('open');
    $('providerTrigger').setAttribute('aria-expanded', 'false');
  }
  if (!$('languagePicker').contains(event.target)) {
    $('languageMenu').classList.add('hidden');
    $('languagePicker').classList.remove('open');
    $('languageTrigger').setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('click', () => {
  closeDropdowns();
  closeFloatingSurfaces();
  closeFollowUpMenus();
});
$('settings').addEventListener('click', (event) => {
  event.stopPropagation();
  const opening = $('configPanel').classList.contains('hidden');
  if (opening) openFloatingSurface('configPanel');
  else closeConfigPanel();
});
$('closeConfig').addEventListener('click', () => closeConfigPanel());
$('newProfile').addEventListener('click', () => {
  currentProfileId = '';
  $('profileName').value = '';
  $('configApiKey').value = '';
  $('inputPrice').value = '';
  $('outputPrice').value = '';
  const draftProvider = $('configProvider').value || '9router';
  setProvider(draftProvider, true, false);
  renderProfiles();
});
$('deleteProfile').addEventListener('click', () => {
  const profile = profiles.find((item) => item.id === currentProfileId);
  if (!profile || profiles.length <= 1) return;
  vscode.postMessage({ type: 'deleteProfile', id: profile.id });
});
$('saveConfig').addEventListener('click', () => {
  vscode.postMessage({
    type: 'connect',
    endpoint: $('configEndpoint').value,
    apiKey: $('configApiKey').value || undefined,
    provider: $('configProvider').value,
    profileId: currentProfileId || '__new__',
    profileName: $('profileName').value,
    inputPricePerMillion: $('inputPrice').value ? Number($('inputPrice').value) : undefined,
    outputPricePerMillion: $('outputPrice').value ? Number($('outputPrice').value) : undefined,
  });
  $('configPanel').classList.add('hidden');
});
$('runDiagnostics').addEventListener('click', () => {
    $('diagnosticsResult').textContent = uiCopy('Đang kiểm tra…', 'Checking…');
  $('diagnosticsResult').className = 'diagnostics-result checking';
  $('runDiagnostics').disabled = true;
  vscode.postMessage({
    type: 'diagnostics',
    draft: true,
    endpoint: $('configEndpoint').value,
    apiKey: $('configApiKey').value || undefined,
    provider: $('configProvider').value,
    profileId: currentProfileId || undefined
  });
});
$('localSetup').addEventListener('click', () => vscode.postMessage({ type: 'setupLocalProvider' }));
$('openCockpit').addEventListener('click', () => vscode.postMessage({ type: 'openCockpit' }));
$('exportDiagnostics').addEventListener('click', () => vscode.postMessage({ type: 'exportDiagnostics' }));
$('send').addEventListener('click', () => {
  if (running) {
    if (effectiveComposerPrompt() && followUpQueueEnabled) {
      send();
      return;
    }
    stopCurrentTurn();
    return;
  }
  send();
});
$('goalPause').addEventListener('click', () => vscode.postMessage({ type: 'pauseGoal' }));
$('goalResume').addEventListener('click', () => {
  setRunning(true);
  vscode.postMessage({ type: 'resumeGoal', model: $('model').value });
});
$('goalClear').addEventListener('click', () => vscode.postMessage({ type: 'clearGoal' }));
$('clearQueue').addEventListener('click', () => {
  if (!followUpQueueEnabled) {
    followUpQueueEnabled = true;
    renderFollowUpQueue();
    updateSendState();
    if (!running && queuedFollowUps.length) runNextQueuedFollowUp();
    return;
  }
  queuedFollowUps = [];
  renderFollowUpQueue();
});
$('prompt').addEventListener('keydown', (event) => {
  const menu = $('composerMenu');
  const items = [...menu.querySelectorAll('button')];
  if (!menu.classList.contains('hidden') && items.length) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      composerMenuIndex = (composerMenuIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((item, index) => item.classList.toggle('selected', index === composerMenuIndex));
      items[composerMenuIndex]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      event.preventDefault();
      items[Math.max(0, composerMenuIndex)]?.click();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      menu.classList.add('hidden');
      composerMenuIndex = -1;
      return;
    }
  }
  if (event.key === 'Backspace' && !$('prompt').value) {
    if (composerLinks.length) composerLinks.pop();
    else if (composerContexts.length) composerContexts.pop();
    else if (composerSkills.length) composerSkills.pop();
    else if (composerGoalMode) composerGoalMode = false;
    else if (composerCommand) composerCommand = null;
    else return;
    event.preventDefault();
    renderComposerTokens();
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
});
$('prompt').addEventListener('input', () => {
  closeAddMenu();
  const extracted = extractComposerLinks($('prompt').value, false);
  if (extracted.changed) $('prompt').value = extracted.text;
  resizePrompt();
  renderComposerMenu();
  updateSendState();
});
$('prompt').addEventListener('focus', () => document.querySelector('.composer-shell')?.classList.add('prompt-focused'));
$('prompt').addEventListener('blur', () => document.querySelector('.composer-shell')?.classList.remove('prompt-focused'));
$('prompt').addEventListener('paste', (event) => {
  const images = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
  if (images.length) {
    event.preventDefault();
    for (const file of images) {
      const reader = new FileReader();
      reader.addEventListener('load', () => vscode.postMessage({ type: 'pasteImage', name: file.name || 'clipboard-image', mimeType: file.type, dataUrl: String(reader.result || '') }));
      reader.readAsDataURL(file);
    }
    return;
  }
  const pasted = event.clipboardData?.getData('text/plain') || '';
  const extracted = extractComposerLinks(pasted, true);
  if (!extracted.changed) return;
  event.preventDefault();
  const prompt = $('prompt');
  const start = prompt.selectionStart ?? prompt.value.length;
  const end = prompt.selectionEnd ?? start;
  prompt.setRangeText(extracted.text, start, end, 'end');
  resizePrompt();
  renderComposerMenu();
  updateSendState();
});

window.addEventListener('message', ({ data }) => {
  if (data.type === 'languageChanged') {
    language = data.language === 'en' ? 'en' : 'vi';
    $('uiLanguage').value = language;
    applyLanguageUi();
  } else if (data.type === 'uiDialog') {
    renderUiDialog(data);
  } else if (data.type === 'cancelPendingInteractions') {
    queuedUiDialogs = [];
    if (activeUiDialog) closeUiDialog(undefined);
    document.querySelectorAll('.permission-card,.tool-failure-card').forEach((item) => item.remove());
    pendingToolFailureId = '';
    $('modelMenu').classList.add('hidden');
    $('modelPicker').classList.remove('open');
    $('modelTrigger').setAttribute('aria-expanded', 'false');
  } else if (data.type === 'stopAcknowledged') {
    // Stop is acknowledged by the extension host, so release the composer
    // immediately. A later backend turnEnd is idempotent and only persists the
    // final transcript state.
    if (running) settleTurn({ cancelled: true, timestamp: Date.now() });
    else {
      finishWorkingLabel('cancelled');
      finalizeLiveActivity();
      setRunning(false);
    }
  } else if (data.type === 'uiToast') {
    showUiToast(data);
  } else if (data.type === 'bootstrap') {
    if (startupReadyTimer) clearTimeout(startupReadyTimer);
    keyStateRequestId++;
    startupReadyTimer = 0;
    // Chat is the primary surface. Provider discovery runs in the background;
    // Connection Center is opened only when the user explicitly requests it.
    showSetup(false);
    $('endpoint').value = data.endpoint;
    $('configEndpoint').value = data.endpoint;
    renderGoal(data.goal);
    activeProvider = data.provider || '9router';
    setProvider(activeProvider, false);
    updateConnectionBadge(providerMeta[activeProvider]?.label || activeProvider, 'checking');
    modelListRecoveryRequested = false;
    scheduleModelListRecovery();
    if (!providerMeta[activeProvider]?.local) {
      $('keyState').textContent = data.hasApiKey ? uiCopy('Đã lưu API key an toàn', 'API key stored securely') : uiCopy('Chưa lưu API key', 'No API key saved');
      $('keyState').classList.toggle('saved', data.hasApiKey);
    }
    $('apiKey').placeholder = data.hasApiKey ? uiCopy('Đã lưu API key, nhập để thay đổi', 'API key saved, enter to change') : uiCopy('Nhập API key nếu endpoint yêu cầu', 'Enter an API key if the endpoint requires it');
    composerPreferences = data.composerPreferences || { models: {}, reasoningEffort: 'medium', serviceTier: 'default' };
    reasoningEffort = composerPreferences.reasoningEffort || 'medium';
    serviceTier = composerPreferences.serviceTier || 'default';
    defaultMode = data.mode === 'agent' ? 'agent' : 'chat';
    if (composerPreferences.lastMode) setMode(composerPreferences.lastMode);
    else setMode(defaultMode);
    setPermissionMode(data.permissionMode || 'ask');
    if (data.workspaceTrusted === false) appendMessage('assistant', uiCopy('Workspace chưa được tin cậy. Agent, terminal và MCP sẽ bị khóa cho đến khi bạn bật Workspace Trust.', 'This workspace is not trusted. Agent, terminal and MCP remain locked until Workspace Trust is enabled.'), true);
    profiles = data.profiles || [];
    favoriteModels = data.favoriteModels || [];
    recentModels = data.recentModels || [];
    skills = data.skills || [];
    currentProfileId = data.activeProfileId || '';
    renderProfiles();
    const initialProfile = profiles.find((item) => item.id === currentProfileId);
    if (initialProfile) applyProfileUi(initialProfile);
    renderHistory(data.sessions || []);
  } else if (data.type === 'composerPreferences') {
    composerPreferences = data.preferences || composerPreferences;
    reasoningEffort = composerPreferences.reasoningEffort || reasoningEffort;
    serviceTier = composerPreferences.serviceTier || serviceTier;
    updateCodexTuning();
  } else if (data.type === 'goalState') {
    renderGoal(data.goal);
  } else if (data.type === 'sessions') {
    renderHistory(data.sessions || []);
  } else if (data.type === 'restoreSession') {
    flushAssistantText();
    $('historyPanel').classList.add('hidden');
    setMode(data.mode || defaultMode);
    $('messages').replaceChildren();
    changeSummary = null;
    for (const [index, turn] of (data.turns || []).entries()) {
      appendMessage(turn.role, turn.content, Boolean(turn.error), turn.timestamp, turn.attachments || [], index, turn.artifact || null);
    }
    if ([...$('model').options].some((option) => option.value === data.model)) {
      $('model').value = data.model;
      $('model').dispatchEvent(new Event('change'));
    }
    setRunning(false);
  } else if (data.type === 'skills') {
    skills = data.skills || [];
    renderComposerMenu();
  } else if (data.type === 'focusSkillPicker') {
    const prompt = $('prompt');
    prompt.value = prompt.value.replace(/\s*$/, prompt.value ? ' $' : '$');
    composerMenuIndex = 0;
    renderComposerMenu();
    prompt.focus();
    resizePrompt();
    updateSendState();
  } else if (data.type === 'editGoalComposer') {
    composerGoalMode = true;
    $('prompt').value = data.objective || '';
    renderComposerTokens();
    resizePrompt();
    $('prompt').focus();
    $('prompt').setSelectionRange($('prompt').value.length, $('prompt').value.length);
  } else if (data.type === 'setComposerMode') {
    setMode(data.mode || defaultMode);
    $('prompt').focus();
  } else if (data.type === 'planRevision') {
    setMode('plan');
    $('prompt').value = language === 'en'
      ? 'Revise the implementation plan with this feedback: '
      : 'Điều chỉnh kế hoạch thực hiện theo phản hồi này: ';
    resizePrompt();
    updateSendState();
    $('prompt').focus();
    $('prompt').setSelectionRange($('prompt').value.length, $('prompt').value.length);
  } else if (data.type === 'openChanges') {
    changesHidden = false;
    $('changeTray').classList.toggle('hidden', !lastChangeCount);
    $('collapsedChanges').classList.add('hidden');
  } else if (data.type === 'connection') {
    activeProvider = data.provider || '9router';
    setProvider(activeProvider, false);
    if (data.endpoint) {
      $('endpoint').value = data.endpoint;
      $('configEndpoint').value = data.endpoint;
    }
    const isRouter = activeProvider === '9router';
    const routerReady = isRouter && data.routerRuntimeState === 'ready';
    const routerStale = isRouter && data.routerRuntimeState === 'stale';
    const routerExternal = routerReady && data.routerRuntimeOwner === 'external';
    const providerName = providerMeta[activeProvider]?.label || activeProvider;
    const needsConfiguration = !data.connected && /API key|cấu hình|endpoint/i.test(data.message || '');
    updateConnectionBadge(
      providerName,
      data.connected ? 'ready' : routerReady ? 'running' : needsConfiguration ? 'setup' : routerStale ? 'recovering' : 'offline'
    );
    if (data.connected) showError('');
    else if (!launchingRouter) showError(data.message || '');
    if (data.connected && !setupOpenRequested) showSetup(false);
    $('connectionToggle').classList.toggle('hidden', !data.connected);
     $('connectionToggle').textContent = uiCopy('Ngắt kết nối', 'Disconnect');
     $('disconnectConnection').classList.toggle('hidden', !data.connected);
     $('disconnectConnection').textContent = uiCopy('Ngắt kết nối', 'Disconnect');
     $('openCockpitCenter').classList.toggle('hidden', activeProvider !== 'cockpit');
     $('openCockpitCenter').textContent = uiCopy('Mở Cockpit', 'Open Cockpit');
    $('topConnectLabel').textContent = isRouter
       ? data.connected
         ? uiCopy('Cấu hình', 'Configure')
         : routerStale
           ? uiCopy('Khôi phục', 'Recover')
           : routerReady
             ? uiCopy('Cấu hình', 'Configure')
             : uiCopy('Mở', 'Open')
       : data.connected
         ? uiCopy('Kết nối', 'Connect')
         : uiCopy('Kết nối', 'Connect');
    $('topConnect').classList.remove('hidden');
    $('topConnect').classList.toggle('online', Boolean(data.connected));
    $('topConnect').classList.toggle('attention', !data.connected && !routerReady);
    $('localSetup').classList.toggle('hidden', !(activeProvider === 'ollama' || activeProvider === 'lm-studio'));
    $('setupProviderBadge').textContent = providerName;
    $('setupProviderMark').innerHTML = brandIcon(providerMeta[activeProvider]?.brand || brandKey(providerName, activeProvider), providerName);
    $('setupEndpointLabel').textContent = data.endpoint || $('configEndpoint').value.trim() || 'Chưa có endpoint';
     $('setupTitle').textContent = isRouter ? uiCopy('Mở 9Router.', 'Open 9Router.') : uiCopy('Kết nối ' + providerName + '.', 'Connect ' + providerName + '.');
     $('setupCopy').textContent = isRouter
       ? uiCopy('Kiểm tra hoặc cài 9Router rồi mở bảng điều khiển. Không cần API key để mở trang quản lý.', 'Check or install 9Router, then open its dashboard. An API key is not required to open the management page.')
       : activeProvider === 'ollama' || activeProvider === 'lm-studio'
         ? uiCopy('Provider local không cần API key, nhưng ứng dụng, model và API server phải đang chạy trên máy.', 'A local provider needs no API key, but its app, model and API server must be running.')
         : uiCopy('Mở Cài đặt để kiểm tra endpoint và API key của provider này.', 'Open Settings to check this provider endpoint and API key.');
    if (data.connected || routerReady) {
      setRouterLaunchState(
        'ready',
        isRouter
           ? (routerExternal ? uiCopy('9Router đang chạy sẵn', '9Router is already running') : uiCopy('9Router đang hoạt động', '9Router is running'))
           : uiCopy(providerName + ' đã kết nối', providerName + ' connected')
      );
      $('launchDescription').textContent = !isRouter
         ? uiCopy('Đang dùng provider ' + activeProvider + '.', 'Using provider ' + activeProvider + '.')
         : routerExternal
           ? uiCopy('RelayCode đã phát hiện 9Router từ terminal và sẽ dùng lại tiến trình này, không khởi động thêm.', 'RelayCode detected 9Router in the terminal and will reuse that process without starting another one.')
           : uiCopy('Gateway và API đang sẵn sàng nhận yêu cầu từ Chat hoặc Agent.', 'The gateway and API are ready for Chat or Agent requests.');
      $('startRouter').classList.add('hidden');
      $('openDashboard').classList.toggle('hidden', !isRouter);
      $('retryConnection').classList.remove('hidden');
      $('topConnect').classList.remove('attention');
    } else {
      $('startRouter').classList.toggle('hidden', !isRouter);
      $('openDashboard').classList.add('hidden');
      $('openCockpitCenter').classList.toggle('hidden', activeProvider !== 'cockpit');
      $('disconnectConnection').classList.add('hidden');
      $('retryConnection').classList.remove('hidden');
       if (!launchingRouter) setRouterLaunchState('idle', isRouter ? uiCopy('9Router chưa chạy · bấm Mở 9Router', '9Router is not running · click Open 9Router') : uiCopy(providerName + ' chưa kết nối', providerName + ' is not connected'));
    }
    const select = $('model');
    const previous = select.value;
    const previousWasAuto = modelSelectionSource === 'auto' && previous === lastAutoModel;
    modelHealth = {};
     select.replaceChildren(new Option(uiCopy('Chọn model', 'Select model'), ''));
    for (const model of data.models || []) {
      const option = new Option(model.name, model.id);
      option.dataset.tools = String(model.capabilities?.tools !== false);
      option.dataset.vision = String(model.capabilities?.vision === true);
      option.dataset.reasoning = String(model.capabilities?.reasoning === true);
      select.add(option);
    }
    const configuredDefault = data.defaultModel && [...select.options].some((option) => option.value === data.defaultModel) ? data.defaultModel : '';
    const rememberedModel = composerPreferences.models?.[mode] && [...select.options].some((option) => option.value === composerPreferences.models[mode])
      ? composerPreferences.models[mode]
      : '';
    const preferred = previous || rememberedModel || configuredDefault || smartModelForMode(mode);
    if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
    else if (select.options.length > 1) select.selectedIndex = 1;
    modelSelectionSource = previousWasAuto || (!previous && !rememberedModel && !configuredDefault) ? 'auto' : 'manual';
    lastAutoModel = modelSelectionSource === 'auto' ? select.value : '';
    const selectedLabel = select.selectedOptions[0]?.textContent || 'Chọn model';
    $('modelLabel').textContent = selectedLabel;
    $('modelBrand').innerHTML = select.value ? brandIcon(brandKey(select.value, activeProvider), selectedLabel) : '';
    renderModelMenu();
    updateCodexTuning();
    if (data.connected && select.options.length <= 2) scheduleModelListRecovery();
    else if (select.options.length > 2 && modelListRecoveryTimer) {
      clearTimeout(modelListRecoveryTimer);
      modelListRecoveryTimer = 0;
    }
  } else if (data.type === 'favoriteModels') {
    favoriteModels = data.models || [];
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'recentModels') {
    recentModels = data.models || [];
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'contextBudget') {
    const meter = $('contextMeter');
    const percent = Math.min(100, Math.round(((data.used || 0) / Math.max(1, data.limit || 1)) * 100));
    meter.querySelector('i').style.width = percent + '%';
    meter.classList.toggle('compacted', Boolean(data.compacted));
  } else if (data.type === 'notice') {
    appendMessage('assistant', data.message, false, Date.now());
  } else if (data.type === 'recoveredTurn') {
    if (running) return;
    document.querySelectorAll('.recovery-card').forEach((card) => card.remove());
    $('messages').querySelector('.empty')?.remove();
    setRunning(false);
    const item = document.createElement('article'); item.className = 'recovery-card';
    item.dataset.runId = data.runId || '';
    const lastStatus = data.checkpoint?.lastStatus || 'Tác vụ bị gián đoạn khi IDE reload.';
    item.innerHTML = '<small>' + uiCopy('Khôi phục phiên Agent', 'Recover Agent session') + '</small><strong>' + escapeHtml(data.prompt) + '</strong><span>' + escapeHtml(lastStatus) + '</span><div>' + (data.checkpoint ? '<button class="recovery-resume">' + uiCopy('Tiếp tục', 'Resume') + '</button>' : '') + '<button class="recovery-discard">' + uiCopy('Bỏ phiên', 'Discard session') + '</button></div>';
    item.querySelector('.recovery-resume')?.addEventListener('click', () => {
      setRunning(true);
      vscode.postMessage({ type: 'resumeAgent', model: $('model').value });
      item.querySelector('.recovery-resume').disabled = true;
      item.querySelector('.recovery-resume').textContent = uiCopy('Đang tiếp tục…', 'Resuming…');
    });
    item.querySelector('.recovery-discard').addEventListener('click', () => {
      vscode.postMessage({ type: 'discardAgentRun' });
      item.remove();
    });
    $('messages').append(item);
    $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'activeTurnState') {
    document.querySelectorAll('.recovery-card').forEach((card) => card.remove());
    turnStartedAt = data.startedAt || Date.now();
    if (!workingLabel) startWorkingLabel();
    setRunning(true);
    updateActivity(data.status || 'Đang tiếp tục tác vụ');
  } else if (data.type === 'agentRecoveryDismissed') {
    document.querySelectorAll('.recovery-card').forEach((card) => card.remove());
  } else if (data.type === 'openConfig') {
    openFloatingSurface('configPanel');
  } else if (data.type === 'openMcpPanel') {
    openFloatingSurface('mcpPanel', { preserve: ['configPanel'] });
  } else if (data.type === 'openModelPicker') {
    favoriteModelsAtMenuOpen = [...favoriteModels];
    $('modelMenu').classList.remove('hidden');
    $('modelPicker').classList.add('open');
    $('modelTrigger').setAttribute('aria-expanded', 'true');
    $('modelSearch').focus();
  } else if (data.type === 'configSaved') {
    $('configEndpoint').value = data.endpoint;
    activeProvider = data.provider || '9router';
    setProvider(activeProvider, false);
    $('configApiKey').value = '';
    if (data.profile) applyProfileUi(data.profile);
    if (!providerMeta[activeProvider]?.local) {
      $('keyState').textContent = data.hasApiKey ? uiCopy('Đã lưu API key an toàn', 'API key stored securely') : uiCopy('Chưa lưu API key', 'No API key saved');
      $('keyState').classList.toggle('saved', data.hasApiKey);
    }
  } else if (data.type === 'providerKeyState') {
    if ((!data.requestId || data.requestId === keyStateRequestId) && data.provider === $('configProvider').value && !providerMeta[data.provider]?.local) {
      $('keyState').textContent = data.hasApiKey ? uiCopy('Đã lưu API key an toàn', 'API key stored securely') : uiCopy('Chưa lưu API key', 'No API key saved');
      $('keyState').classList.toggle('saved', Boolean(data.hasApiKey));
      $('configApiKey').placeholder = data.hasApiKey
        ? uiCopy('Đã lưu key · để trống để giữ nguyên', 'Key saved · leave blank to keep it')
        : uiCopy('Nhập API key của provider', 'Enter the provider API key');
    }
  } else if (data.type === 'diagnosticsResult') {
    $('diagnosticsResult').textContent = data.message;
    $('diagnosticsResult').className = 'diagnostics-result ' + (data.ok ? 'success' : 'failure');
    $('runDiagnostics').disabled = false;
    $('retryConnection').disabled = false;
    $('setupCheckResult').textContent = data.message;
    $('setupCheckResult').className = 'setup-check-result ' + (data.ok ? 'success' : 'failure');
    $('retryDiagnostics').disabled = false;
    $('connectionProviderName').textContent = providerMeta[data.provider]?.label || data.provider || 'Provider';
    const diagnosticsMeta = providerMeta[data.provider] || providerMeta['9router'];
    $('connectionProviderMark').innerHTML = brandIcon(diagnosticsMeta.brand, diagnosticsMeta.label);
    $('connectionEndpoint').textContent = data.endpoint || 'Chưa có endpoint';
     $('connectionDialogSubtitle').textContent = data.ok ? uiCopy('Provider đã sẵn sàng', 'Provider is ready') : uiCopy('Provider chưa thể sử dụng', 'Provider is unavailable');
     $('connectionHealthBadge').textContent = data.ok ? uiCopy('Sẵn sàng', 'Ready') : uiCopy('Có lỗi', 'Error');
    $('connectionHealthBadge').className = data.ok ? 'ready' : 'failed';
    $('connectionLatency').textContent = typeof data.latency === 'number' ? data.latency + ' ms' : '—';
    $('connectionModels').textContent = typeof data.modelCount === 'number' ? String(data.modelCount) : '—';
     $('connectionMessage').textContent = data.message || (data.ok ? uiCopy('Kết nối hoạt động bình thường.', 'Connection is working normally.') : uiCopy('Không thể kết nối provider.', 'Unable to connect to the provider.'));
  } else if (data.type === 'profiles') {
    profiles = data.profiles || [];
    currentProfileId = data.activeProfileId || currentProfileId;
    renderProfiles();
  } else if (data.type === 'profileLoaded') {
    keyStateRequestId++;
    applyProfileUi(data.profile);
    activeProvider = data.profile?.kind || '9router';
    updateConnectionBadge(providerMeta[activeProvider]?.label || activeProvider, 'checking');
    $('configApiKey').value = '';
    $('keyState').textContent = data.hasApiKey ? uiCopy('Đã lưu API key an toàn', 'API key stored securely') : uiCopy('Chưa lưu API key', 'No API key saved');
    $('keyState').classList.toggle('saved', data.hasApiKey);
  } else if (data.type === 'modelCheckStart') {
    checkingModels = true;
    modelHealth = {};
     $('checkModels').textContent = uiCopy('Đang kiểm tra 0/' + data.total + ' · Bấm để hủy', 'Checking 0/' + data.total + ' · Click to cancel');
    $('checkModels').classList.add('checking');
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'modelCheck') {
    modelHealth[data.model] = { status: data.status, message: data.message || (data.latencyMs ? 'OK · ' + data.latencyMs + ' ms' : '') };
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'modelCheckProgress') {
     $('checkModels').textContent = uiCopy('Đang kiểm tra ' + data.completed + '/' + data.total + ' · Bấm để hủy', 'Checking ' + data.completed + '/' + data.total + ' · Click to cancel');
  } else if (data.type === 'modelCheckEnd') {
    checkingModels = false;
     $('checkModels').textContent = data.cancelled ? uiCopy('Đã hủy · Kiểm tra lại', 'Canceled · Check again') : uiCopy('Kiểm tra model', 'Check models');
    $('checkModels').classList.remove('checking');
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'telemetry') {
    latestTelemetryRecords = data.records || [];
    renderTelemetry(latestTelemetryRecords);
    updateCodexTuning();
  } else if (data.type === 'mcpServers') {
    renderMcpServers(data.servers || [], data.presets || []);
    syncPendingMcpOutcome(data.servers || []);
  } else if (data.type === 'mcpOutcome') {
    renderMcpOutcome(data);
  } else if (data.type === 'checkpoint') {
    const card = document.createElement('article'); card.className = 'checkpoint-card';
    card.innerHTML = '<span>' + uiCopy('Git checkpoint đã tạo · ', 'Git checkpoint created · ') + data.checkpoint.hash + '</span><button>' + uiCopy('Khôi phục', 'Restore') + '</button>';
    card.querySelector('button').addEventListener('click', () => vscode.postMessage({ type: 'restoreCheckpoint', id: data.checkpoint.id }));
    $('messages').append(card); $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'checkpointRestored') {
    appendMessage('assistant', 'Đã khôi phục workspace về Git checkpoint ' + data.hash + '.', false, Date.now());
  } else if (data.type === 'localRuntime') {
    if (data.message) { $('diagnosticsResult').textContent = data.message; $('diagnosticsResult').className = 'diagnostics-result ' + (data.serverRunning || data.models?.length ? 'success' : 'checking'); }
  } else if (data.type === 'permissionMode') {
    setPermissionMode(data.mode);
  } else if (data.type === 'routerLaunch') {
    setRouterLaunchState(data.progress, data.message);
     $('launchDescription').textContent = data.progress === 'checking'
       ? uiCopy('Đang kiểm tra dịch vụ cục bộ.', 'Checking the local service.')
       : data.progress === 'waiting'
         ? uiCopy('Quá trình chạy nền, bạn có thể tiếp tục dùng IDE.', 'This runs in the background; you can keep using the IDE.')
         : uiCopy('Không cần mở terminal. Một nút là đủ để bắt đầu.', 'No terminal required. One click is enough to start.');
    if (data.progress === 'stopped') {
      $('startRouter').classList.remove('hidden');
      $('openDashboard').classList.add('hidden');
      $('retryConnection').classList.add('hidden');
      $('connectionToggle').classList.add('hidden');
      $('disconnectConnection').classList.add('hidden');
      $('openCockpitCenter').classList.add('hidden');
      $('topConnect').classList.add('attention');
    }
  } else if (data.type === 'browserOpened') {
     setRouterLaunchState('ready', uiCopy('Đã mở trình quản lý', 'Management page opened'));
     $('launchDescription').textContent = uiCopy('9Router đang chạy nền. Trình duyệt đã mở trang quản lý.', '9Router is running in the background. The dashboard is open in your browser.');
    showError('');
  } else if (data.type === 'attachmentLoading') {
    $('attachmentProgress').classList.toggle('hidden', !data.active);
    $('attach').disabled = Boolean(data.active);
  } else if (data.type === 'attachments') {
    const list = $('attachmentList');
    list.replaceChildren();
    for (const [index, item] of (data.attachments || []).entries()) {
      const initialPreview = item.preview || item.modelPreview;
      if (initialPreview) {
        const preview = document.createElement('div'); preview.className = 'attachment-preview';
        const image = document.createElement('img'); image.src = initialPreview; image.alt = item.name;
        image.addEventListener('click', () => openImage(image.currentSrc || initialPreview));
        let triedModelPreview = false;
        const handleImageError = () => {
          if (!triedModelPreview && item.modelPreview && item.modelPreview !== image.src) {
            triedModelPreview = true;
            image.src = item.modelPreview;
            return;
          }
          image.removeEventListener('error', handleImageError);
          preview.replaceChildren();
          const chip = document.createElement('span'); chip.className = 'attachment-chip';
          chip.innerHTML = fileTypeIcon(item.name) + '<span>' + escapeHtml(item.name) + '</span>';
          preview.classList.add('attachment-preview-fallback');
          preview.append(chip);
          const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Bỏ ảnh đính kèm');
          remove.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'removeAttachment', index }); });
          preview.append(remove);
        };
        image.addEventListener('error', handleImageError);
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Bỏ ảnh đính kèm');
        remove.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'removeAttachment', index }); });
        preview.append(image, remove); list.append(preview); continue;
      }
      const chip = document.createElement('span');
      chip.className = 'attachment-chip';
      chip.innerHTML = fileTypeIcon(item.name) + '<span>' + escapeHtml(item.name) + '</span>';
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Bỏ tệp đính kèm');
      remove.addEventListener('click', () => vscode.postMessage({ type: 'removeAttachment', index }));
      chip.append(remove); list.append(chip);
    }
  } else if (data.type === 'turnReady') {
    queuedFollowUpReady = true;
    if (!running && queuedFollowUps.length) runNextQueuedFollowUp();
  } else if (data.type === 'approval') {
    const item = document.createElement('article');
    item.className = 'permission-card permission-card-v2';
    item.dataset.approvalKey = [data.kind, data.title, data.message, data.command || ''].join('|');
    const duplicate = [...document.querySelectorAll('.permission-card-v2')]
      .find((card) => card.dataset.approvalKey === item.dataset.approvalKey);
    if (duplicate) return;

    const heading = document.createElement('header');
    const icon = document.createElement('span');
    icon.className = 'permission-icon';
    icon.innerHTML = uiIcon(data.kind === 'command' ? 'terminalWindow' : 'shieldWarning');
    const title = document.createElement('span');
    title.className = 'permission-title';
    title.textContent = data.title || (data.kind === 'command'
      ? 'Terminal'
      : (language === 'en' ? 'Permission required' : 'Cần bạn cho phép'));
    const copy = document.createElement('p');
    copy.className = 'permission-copy';
    copy.textContent = data.message || 'RelayCode needs your permission.';
    const permissionText = document.createElement('div');
    permissionText.className = 'permission-text';
    permissionText.append(title, copy);
    heading.append(icon, permissionText);
    item.append(heading);

    if (data.command) {
      const command = document.createElement('pre');
      command.className = 'permission-command';
      command.textContent = data.command;
      item.append(command);
    }

    const actions = document.createElement('footer');
    actions.className = 'permission-actions';
    const deny = document.createElement('button');
    deny.type = 'button';
    deny.className = 'permission-deny';
    deny.textContent = language === 'en' ? 'Deny' : 'Từ chối';

    const allowWrap = document.createElement('div');
    allowWrap.className = 'permission-allow-wrap';
    const allowOnce = document.createElement('button');
    allowOnce.type = 'button';
    allowOnce.className = 'permission-allow-once';
    allowOnce.textContent = language === 'en' ? 'Allow once' : 'Cho phép';
    allowWrap.append(allowOnce);

    const finishApproval = (decision) => {
      vscode.postMessage({ type: 'approval', id: data.id, decision });
      item.remove();
      updateRunningScrollIndicator();
    };

    if (data.allowSimilar || data.allowAlways) {
      const menuTrigger = document.createElement('button');
      menuTrigger.type = 'button';
      menuTrigger.className = 'permission-menu-trigger';
      menuTrigger.setAttribute('aria-label', language === 'en' ? 'More permission options' : 'Tùy chọn cấp quyền');
      menuTrigger.setAttribute('aria-haspopup', 'menu');
      menuTrigger.setAttribute('aria-expanded', 'false');
      menuTrigger.innerHTML = uiIcon('caretDown');
      const allowMenu = document.createElement('div');
      allowMenu.className = 'permission-menu hidden';
      allowMenu.setAttribute('role', 'menu');
      if (data.allowSimilar) {
        const similar = document.createElement('button');
        similar.type = 'button';
        similar.className = 'permission-similar';
        similar.setAttribute('role', 'menuitem');
        const similarLabel = document.createElement('span');
        similarLabel.textContent = language === 'en' ? 'Allow similar commands' : 'Cho phép lệnh tương tự';
        const similarInfo = document.createElement('span');
        similarInfo.innerHTML = uiIcon('info');
        similar.append(similarLabel, similarInfo);
        allowMenu.append(similar);
        similar.addEventListener('click', () => finishApproval('similar'));
      }
      if (data.allowAlways) {
        const always = document.createElement('button');
        always.type = 'button';
        always.className = 'permission-always';
        always.setAttribute('role', 'menuitem');
        const alwaysLabel = document.createElement('span');
        alwaysLabel.textContent = language === 'en' ? 'Always allow file edits' : 'Luôn cho phép sửa file';
        const alwaysInfo = document.createElement('span');
        alwaysInfo.innerHTML = uiIcon('check');
        always.append(alwaysLabel, alwaysInfo);
        allowMenu.append(always);
        always.addEventListener('click', () => finishApproval('always'));
      }
      allowWrap.append(menuTrigger, allowMenu);
      menuTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const opening = allowMenu.classList.contains('hidden');
        if (opening) closeDropdowns(allowMenu);
        allowMenu.classList.toggle('hidden', !opening);
        menuTrigger.setAttribute('aria-expanded', String(opening));
      });
    }

    actions.append(deny, allowWrap);
    item.append(actions);
    allowOnce.addEventListener('click', () => finishApproval('once'));
    deny.addEventListener('click', () => finishApproval('deny'));
    item.addEventListener('click', (event) => event.stopPropagation());
    $('messages').append(item);
    if (messagesPinnedToBottom) scrollMessagesToBottom();
    else updateRunningScrollIndicator();
  } else if (data.type === 'toolFailure') {
    const item = document.createElement('article'); item.className = 'tool-failure-card';
    item.dataset.toolFailureId = data.id;
    item.innerHTML = '<small>' + escapeHtml(data.tool) + ' · ' + uiCopy('lần ', 'attempt ') + data.attempt + '</small><strong>' + uiCopy('Tool chưa hoàn thành', 'Tool did not complete') + '</strong><span>' + escapeHtml(data.message) + '</span><div><button class="tool-retry">' + uiCopy('Thử lại', 'Retry') + '</button><button class="tool-change-model">' + uiCopy('Đổi model', 'Change model') + '</button><button class="tool-skip">' + uiCopy('Bỏ qua', 'Skip') + '</button></div>';
    const finish = (action, model) => {
      if (pendingToolFailureId === data.id) pendingToolFailureId = '';
      vscode.postMessage({ type: 'resolveToolFailure', id: data.id, action, model });
      item.remove();
    };
    item.querySelector('.tool-retry').addEventListener('click', () => finish('retry'));
    item.querySelector('.tool-change-model').addEventListener('click', () => {
      pendingToolFailureId = data.id;
      favoriteModelsAtMenuOpen = [...favoriteModels];
      $('modelMenu').classList.remove('hidden');
      $('modelPicker').classList.add('open');
      $('modelTrigger').setAttribute('aria-expanded', 'true');
      $('modelSearch').focus();
    });
    item.querySelector('.tool-skip').addEventListener('click', () => finish('skip'));
    $('messages').append(item); $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'changeOperation') {
    changeOperationBusy = Boolean(data.busy);
    updateChangeActionState();
  } else if (data.type === 'changeResolved') {
    for (const id of data.ids || []) {
      const snapshot = knownChangeSnapshots.get(id);
      if (snapshot) resolvedChangeSnapshots.set(id, { ...snapshot, resolution: data.action });
    }
  } else if (data.type === 'changesState') {
    const tray = $('changeTray');
    const collapsed = $('collapsedChanges');
    const messageList = $('messages');
    const shouldFollowChanges = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 90;
    const pendingChanges = data.changes || [];
    for (const change of pendingChanges) {
      knownChangeSnapshots.set(change.id, change);
      resolvedChangeSnapshots.delete(change.id);
    }
    // Only unresolved files belong in the live tray above the composer.
    // Resolved snapshots are retained for transcript history, but must not
    // keep an empty/disabled tray visible after Accept or Undo.
    const allChanges = pendingChanges;
    const nextChangeCount = allChanges.length;
    lastPendingChangeCount = pendingChanges.length;
    if (running) pendingCompletedChangesState = data;
    if (!nextChangeCount || !lastChangeCount) changesHidden = false;
    lastChangeCount = nextChangeCount;
    // Keep the review tray stable across turn completion. It remains visible
    // until the user hides it or resolves every pending change.
    tray.classList.toggle('hidden', !nextChangeCount || changesHidden);
    collapsed.classList.toggle('hidden', !nextChangeCount || !changesHidden);
    const displayAdded = allChanges.reduce((sum, change) => sum + change.added, 0);
    const displayRemoved = allChanges.reduce((sum, change) => sum + change.removed, 0);
    const fileSummary = nextChangeCount + ' ' + (nextChangeCount === 1 ? 'file' : 'files') + ' changed';
    $('changeCount').innerHTML = escapeHtml(fileSummary) + ' <b class="diff-add">+' + displayAdded + '</b> <b class="diff-remove">-' + displayRemoved + '</b>';
    $('collapsedChangeCount').innerHTML = escapeHtml(fileSummary + '  ') + '<b class="diff-add">+' + displayAdded + '</b> <b class="diff-remove">-' + displayRemoved + '</b>';
    const list = $('changeList'); list.replaceChildren();
    let renderedTask = '';
    let renderedChanges = 0;
    const renderChangeBatch = () => {
      list.querySelector('.change-list-more')?.remove();
      const nextChanges = allChanges.slice(renderedChanges, renderedChanges + 60);
      for (const change of nextChanges) {
        if (change.taskId && change.taskId !== renderedTask) {
          renderedTask = change.taskId;
          const taskLabel = document.createElement('div'); taskLabel.className = 'task-group-label';
          const title = document.createElement('span'); title.textContent = uiCopy('Tác vụ ', 'Task ') + change.taskId.replace(/^task-/, '').split('-')[0];
          taskLabel.append(title);
          list.append(taskLabel);
        }
        const resolved = Boolean(change.resolution);
        const row = document.createElement('div');
        row.className = 'change-row change-row-review' + (resolved ? ' is-resolved' : '');
        row.dataset.changeId = change.id;
        const file = document.createElement('button');
        file.type = 'button';
        file.className = 'change-file';
        file.innerHTML = fileTypeIcon(change.path) + '<span>' + escapeHtml(change.path) + '</span>';
        const stats = document.createElement('span');
        stats.className = 'change-row-stats';
        stats.innerHTML = '<b class="diff-add">+' + change.added + '</b> <b class="diff-remove">-' + change.removed + '</b>' + (resolved ? '<em>' + escapeHtml(change.resolution === 'accepted' ? activityCopy('Đã chấp nhận', 'Accepted') : activityCopy('Đã hoàn tác', 'Undone')) + '</em>' : '');
        const actions = document.createElement('span');
        actions.className = 'change-row-actions';
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'tray-undo';
        undo.textContent = activityCopy('Hoàn tác', 'Undo');
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'tray-accept';
        accept.textContent = activityCopy('Chấp nhận', 'Accept');
        actions.append(undo, accept);
        file.addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }));
        undo.addEventListener('click', (event) => {
          event.stopPropagation();
          vscode.postMessage({ type: 'undoChange', id: change.id });
        });
        accept.addEventListener('click', (event) => {
          event.stopPropagation();
          vscode.postMessage({ type: 'acceptChange', id: change.id });
        });
        if (resolved) {
          file.disabled = true;
          undo.disabled = true;
          accept.disabled = true;
        }
        row.append(file, stats, actions);
        list.append(row);
      }
      renderedChanges += nextChanges.length;
      if (renderedChanges < allChanges.length) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'change-list-more';
         more.textContent = uiCopy('Hiện thêm ', 'Show ') + Math.min(60, allChanges.length - renderedChanges) + uiCopy(' file', ' files');
        more.addEventListener('click', renderChangeBatch);
        list.append(more);
      }
      updateChangeActionState();
    };
    renderChangeBatch();
    updateChangeActionState();
    const pendingChangeIds = new Set(pendingChanges.map((change) => change.id));
    const hasInlineChangeSummary = [...document.querySelectorAll('.turn-change-file')]
      .some((row) => pendingChangeIds.has(row.dataset.changeId));
    if (data.changes?.length && !running && !hasInlineChangeSummary) {
      if (!changeSummary) {
        changeSummary = document.createElement('article');
        changeSummary.className = 'chat-change-summary collapsed';
        changeSummary.innerHTML = '<header><span class="change-summary-icon" aria-hidden="true">' + uiIcon('files') + '</span><span class="change-summary-copy"><strong><span class="change-summary-files"></span></strong><small class="change-summary-stats"><b class="diff-add"></b><b class="diff-remove"></b></small></span><span class="change-summary-actions"><button class="summary-undo" type="button">Undo</button><button class="summary-review" type="button">Show files</button></span></header><div class="change-summary-preview"></div>';
        $('messages').append(changeSummary);
      }
      const setSummaryExpanded = (expanded) => {
        changeSummaryExpanded = expanded;
        changeSummary.classList.toggle('collapsed', !expanded);
        changeSummary.querySelector('.summary-review').textContent = expanded ? activityCopy('Ẩn file', 'Hide files') : activityCopy('Xem file', 'Show files');
      };
      const reviewButton = changeSummary.querySelector('.summary-review');
      reviewButton.onclick = () => setSummaryExpanded(!changeSummaryExpanded);
      changeSummary.querySelector('.summary-undo').onclick = () => vscode.postMessage({ type: 'undoAllChanges' });
      changeSummary.querySelector('.change-summary-files').textContent = fileSummary;
      changeSummary.querySelector('.change-summary-stats .diff-add').textContent = '+' + data.added;
      changeSummary.querySelector('.change-summary-stats .diff-remove').textContent = '-' + data.removed;
      changeSummary.querySelector('.change-summary-copy').onclick = () => setSummaryExpanded(!changeSummaryExpanded);
      const preview = changeSummary.querySelector('.change-summary-preview');
      preview.replaceChildren();
      for (const change of (data.changes || [])) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'change-summary-file';
        row.innerHTML = fileTypeIcon(change.path) + '<span>' + escapeHtml(change.path) + '</span><small><b class="diff-add">+' + change.added + '</b> <b class="diff-remove">-' + change.removed + '</b></small>';
        row.addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }));
        preview.append(row);
      }
      setSummaryExpanded(changeSummaryExpanded);
      updateChangeActionState();
    }
    if (shouldFollowChanges && !running) messageList.scrollTop = messageList.scrollHeight;
  } else if (data.type === 'turnStart') {
    document.querySelectorAll('.recovery-card').forEach((card) => card.remove());
    mode = data.mode;
    followUpQueueEnabled = true;
    turnStartedAt = data.timestamp || Date.now();
    flushAssistantText();
    assistantRawText = '';
    assistantActivity = null;
    pendingActivityStatus = '';
    activityReadyAfterCommentary = false;
    activeTerminal = null;
    activeCommandGroup = null;
    activitySteps = new Map();
    pendingTurnEnd = null;
    pendingCompletedChangesState = null;
    if (!data.resume) appendMessage('user', data.prompt, false, data.timestamp, data.attachments || [], data.turnIndex);
    assistantBody = appendMessage('assistant', '', false, data.timestamp, [], Number.isInteger(data.turnIndex) ? data.turnIndex + 1 : null);
    assistantBody.closest('.message')?.classList.add('streaming');
    startWorkingLabel();
    setRunning(true);
    scrollMessagesToBottom();
  } else if (data.type === 'truncateTurns') {
    flushAssistantText();
    document.querySelectorAll('.message[data-turn-index]').forEach((item) => {
      if (Number(item.dataset.turnIndex) >= data.fromIndex) item.remove();
    });
    assistantBody = null;
    assistantRawText = '';
    assistantActivity = null;
    pendingActivityStatus = '';
    activityReadyAfterCommentary = false;
    activeTerminal = null;
    activitySteps = new Map();
    if (workingTimer) clearInterval(workingTimer);
    workingTimer = null;
    workingLabel = null;
  } else if (data.type === 'commentary') {
    appendAgentCommentary(data.content);
  } else if (data.type === 'intermediateStep') {
    archiveStreamedProgress(data.content);
  } else if (data.type === 'activityComplete') {
    finalizeLiveActivity();
  } else if (data.type === 'delta') {
    queueAssistantText(data.delta);
  } else if (data.type === 'status') {
    if (running) {
      updateActivity(data.message);
      if (activeGoal?.status === 'running') $('goalStatus').textContent = data.message;
    }
  } else if (data.type === 'toolOutput') {
    appendTerminalOutput(data);
  } else if (data.type === 'turnEnd') {
    // Provider deltas are batched per animation frame; only wait if the final
    // reconciliation still has text queued for the current render frame.
    if (!data.cancelled && !data.error) reconcileFinalAssistantText(data.content);
    if (!data.cancelled && !data.error && assistantBody && pendingAssistantText && assistantRenderFrame) {
      pendingTurnEnd = data;
    } else settleTurn(data);
  } else if (data.type === 'reset') {
    flushAssistantText();
    queuedUiDialogs = [];
    if (activeUiDialog) closeUiDialog(undefined);
    queuedFollowUps = [];
    followUpQueueEnabled = true;
    activeTerminal = null;
    activeCommandGroup = null;
    renderFollowUpQueue();
    renderGoal(null);
    setMode(composerPreferences.lastMode || defaultMode);
    const emptyDescription = mode === 'agent'
      ? uiCopy('Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.', 'Agent can read the project, edit files and run commands in the workspace.')
      : mode === 'plan'
      ? uiCopy('Agent sẽ đọc workspace và lập kế hoạch trước khi hành động.', 'Agent will inspect the workspace and plan before acting.')
      : uiCopy('Trò chuyện trực tiếp với model đang chọn.', 'Chat directly with the selected model.');
     $('messages').innerHTML = '<div class="empty"><h2>' + uiCopy('Nói điều bạn muốn xây.', 'Describe what you want to build.') + '</h2><p>' + uiCopy('Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.', 'Agent can read the project, edit files and run commands in the workspace.') + '</p></div>';
    const emptyState = $('messages').querySelector('.empty p');
    if (emptyState) emptyState.textContent = emptyDescription;
    if (workingTimer) clearInterval(workingTimer);
    workingTimer = null;
    workingLabel = null;
    turnStartedAt = 0;
    assistantBody = null;
    pendingTurnEnd = null;
    pendingCompletedChangesState = null;
    if (modelListRecoveryTimer) clearTimeout(modelListRecoveryTimer);
    modelListRecoveryTimer = 0;
    modelListRecoveryRequested = false;
    lastChangeCount = 0;
    lastPendingChangeCount = 0;
    knownChangeSnapshots = new Map();
    resolvedChangeSnapshots = new Map();
    changesHidden = false;
    setRunning(false);
  } else if (data.type === 'error') {
    if (workingTimer) clearInterval(workingTimer);
    workingTimer = null;
    workingLabel = null;
     setRouterLaunchState('idle', uiCopy('9Router chưa chạy', '9Router is not running'));
     $('launchDescription').textContent = uiCopy('Không cần mở terminal hoặc chuyển sang trình duyệt.', 'No terminal or browser switching is required.');
    showError(data.message);
    showUiToast({ message: data.message, tone: 'danger' });
    setRunning(false);
  }
});

setMode('chat');
setPermissionMode('ask');
resizePrompt();
requestBootstrap();
`;
