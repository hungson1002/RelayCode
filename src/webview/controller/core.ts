import { BRAND_ICONS, MODEL_BRAND_RULES } from '../../brandIcons';
import { UI_ICONS } from '../../uiIcons';

export const CHAT_CONTROLLER_CORE = String.raw`
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
  const glyph = uiIcons[name] || (String(name || '').startsWith('file') ? uiIcons.file : uiIcons.cube);
  return '<span class="ui-symbol"' + (label ? ' aria-label="' + escapeHtml(label) + '"' : '') + '>' + glyph + '</span>';
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
$('goalDockIcon').innerHTML = uiIcon('target');
const goalDockQuickClear = document.createElement('button');
goalDockQuickClear.type = 'button';
goalDockQuickClear.className = 'goal-dock-quick-clear';
goalDockQuickClear.setAttribute('aria-label', 'Turn off Goal');
goalDockQuickClear.innerHTML = uiIcon('x');
$('goalDockTrigger').insertAdjacentElement('afterend', goalDockQuickClear);
$('permDropdown').insertAdjacentElement('afterend', $('goalDock'));
$('sendIcon').innerHTML = uiIcon('arrowUp');
$('topConnectIcon').innerHTML = uiIcon('plugsConnected');
$('historyToggleIcon').innerHTML = uiIcon('clockCounterClockwise');
$('historyHeadingIcon').innerHTML = uiIcon('clockCounterClockwise');
$('closeHistory').innerHTML = uiIcon('x');
$('connectionDialogIcon').innerHTML = uiIcon('pulse');
$('closeConnectionDiagnostics').innerHTML = uiIcon('x');
$('metricsToggleIcon').innerHTML = uiIcon('chartLineUp');
$('settingsIcon').innerHTML = uiIcon('gear');
$('closeConfig').innerHTML = uiIcon('x');
$('closeConfig').setAttribute('aria-label', 'Close settings');
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
let defaultMode = 'agent';
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
let detachedAssistantResponseActions = null;
let pendingCompletedChangesState = null;
let activeProvider = '9router';
let pendingAssistantText = '';
let assistantRenderFrame = 0;
let assistantLastRenderAt = 0;
let assistantCharacterBudget = 0;
let assistantRawText = '';
let assistantStreamTextNode = null;
let assistantMarkdownRenderedLength = 0;
let assistantMarkdownTimer = 0;
let assistantActivity = null;
let pendingActivityStatus = '';
let activityReadyAfterCommentary = false;
let activitySteps = new Map();
let pendingTurnEnd = null;
let currentProfileId = '';
let savedProfileId = '';
let profiles = [];
let modelHealth = {};
let modelHealthMode = '', modelHealthFilter = 'all', modelHealthCheckComplete = false;
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
let pendingAttachmentCount = 0;

function promptTextFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/\u200B/g, '');
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node;
    if (element.classList.contains('composer-rich-link')) return element.dataset.url || element.textContent || '';
    if (element.tagName === 'BR') return '\n';
  }
  const children = [...node.childNodes];
  return children.map((child, index) => {
    const value = promptTextFromNode(child);
    const block = child.nodeType === Node.ELEMENT_NODE && /^(?:DIV|P)$/.test(child.tagName);
    return value + (block && index < children.length - 1 && !value.endsWith('\n') ? '\n' : '');
  }).join('');
}

function createPromptLink(url, label = url) {
  const link = document.createElement('span');
  link.className = 'composer-rich-link';
  link.contentEditable = 'false';
  link.dataset.url = url;
  let isGithub = false;
  try { isGithub = new URL(url).hostname.replace(/^www\./, '') === 'github.com'; } catch {}
  const icon = document.createElement('i');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = isGithub ? brandIcon('github', 'GitHub') : uiIcon('globe');
  const copy = document.createElement('span');
  copy.className = 'composer-rich-link-copy';
  copy.textContent = label;
  link.append(icon, copy);
  link.addEventListener('click', () => vscode.postMessage({ type: 'openExternal', url }));
  return link;
}

function renderPromptValue(value) {
  const editor = $('prompt');
  const source = String(value || '');
  const fragment = document.createDocumentFragment();
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>()]+)/gi;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > cursor) fragment.append(document.createTextNode(source.slice(cursor, match.index)));
    const url = match[2] || match[3];
    const label = match[1] || url;
    fragment.append(createPromptLink(url, label), document.createTextNode('\u200B'));
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) fragment.append(document.createTextNode(source.slice(cursor)));
  editor.replaceChildren(fragment);
}

function setPromptSelection(offset) {
  const editor = $('prompt');
  const selection = window.getSelection();
  if (!selection) return;
  let remaining = Math.max(0, offset);
  const range = document.createRange();
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const rawText = node.textContent || '';
      const length = rawText.replace(/\u200B/g, '').length;
      if (remaining <= length) {
        // A zero-width boundary after each atomic link gives Chromium a real
        // caret position, preventing newly typed text from painting over it.
        const rawOffset = rawText.startsWith('\u200B') ? Math.min(rawText.length, remaining + 1) : remaining;
        range.setStart(node, rawOffset);
        range.collapse(true);
        return true;
      }
      remaining -= length;
      return false;
    }
    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('composer-rich-link')) {
      const length = (node.dataset.url || '').length;
      if (remaining <= length) {
        const boundary = node.nextSibling;
        if (boundary?.nodeType === Node.TEXT_NODE && boundary.textContent?.startsWith('\u200B')) range.setStart(boundary, 1);
        else range.setStartAfter(node);
        range.collapse(true);
        return true;
      }
      remaining -= length;
      return false;
    }
    for (const child of node.childNodes) if (visit(child)) return true;
    return false;
  };
  if (!visit(editor)) {
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function promptSelectionOffset() {
  const editor = $('prompt');
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return editor.value.length;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return promptTextFromNode(range.cloneContents()).length;
}

function initializePromptEditor() {
  const editor = $('prompt');
  Object.defineProperties(editor, {
    value: {
      configurable: true,
      get: () => promptTextFromNode(editor),
      set: (value) => renderPromptValue(value)
    },
    placeholder: {
      configurable: true,
      get: () => editor.dataset.placeholder || '',
      set: (value) => { editor.dataset.placeholder = String(value || ''); }
    },
    selectionStart: { configurable: true, get: promptSelectionOffset },
    selectionEnd: { configurable: true, get: promptSelectionOffset }
  });
  editor.setRangeText = (replacement, start, end) => {
    const source = editor.value;
    editor.value = source.slice(0, start) + replacement + source.slice(end);
    setPromptSelection(start + replacement.length);
  };
  editor.setSelectionRange = (start) => setPromptSelection(start);
}

initializePromptEditor();
let turnStartedAt = 0;
let workingLabel = null;
let workingTimer = null;
let workingStatus = '';
let assistantHasOutput = false;
let setupDismissed = false;
let setupOpenRequested = false;
let queuedFollowUps = [];
let queuedFollowUpReady = true;
let followUpQueueEnabled = true;
let activeGoal = null;
let reasoningEffort = 'medium';
let serviceTier = 'default';
let latestTelemetryRecords = [];
let modelsProvider = '';
const providerMeta = {
  omniroute: { brand: 'omniroute', label: 'OmniRoute', hint: 'Gateway local · tự động định tuyến', endpoint: 'http://127.0.0.1:20128/v1', keyLabel: 'OmniRoute API key (optional)', local: false },
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
  ['Gateway local · tự động định tuyến', 'Local gateway · automatic routing'],
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
  ['Goal đang bật', 'Goal is on'], ['Yêu cầu tiếp theo sẽ trở thành mục tiêu', 'Your next request will become the goal'],
  ['Chọn model cho yêu cầu tiếp theo', 'Choose a model for the next request'], ['Tắt Goal', 'Turn off Goal'],
  ['Bắt đầu một cuộc chat mới', 'Start a new chat'], ['Rút gọn ngữ cảnh cuộc chat', 'Compact this chat context'],
  ['Tìm và chèn skill', 'Find and insert a skill'], ['Mở danh sách model', 'Open the model list'],
  ['Mở danh sách chế độ làm việc', 'Open the work mode list'], ['Mở quyền thao tác của Agent', 'Open Agent permissions'],
  ['Kiểm tra model cho chế độ hiện tại', 'Check models for the current mode'], ['Chuyển sang chế độ Agent', 'Switch to Agent mode'],
  ['Chuyển sang chế độ Chat', 'Switch to Chat mode'], ['Mở lịch sử cuộc trò chuyện', 'Open conversation history'],
  ['Mở số liệu sử dụng', 'Open usage metrics'],
  ['Chuyển sang chế độ Plan', 'Switch to Plan mode'], ['Xem các file đã thay đổi', 'View changed files'],
  ['Mở các thay đổi đang chờ review', 'Open changes awaiting review'], ['Bật hoặc tắt file đang mở trong ngữ cảnh', 'Toggle the open file in context'],
  ['Tạo khung AGENTS.md cho dự án', 'Create an AGENTS.md scaffold for the project'], ['Xem provider, MCP và skills', 'View provider, MCP and skills status'],
  ['Mở công cụ MCP', 'Open MCP tools'], ['Mở cấu hình', 'Open settings'], ['Mở Output Channel', 'Open Output Channel'],
  ['Mở 9Router', 'Open 9Router'],
  ['Giao diện', 'Interface'], ['Ngôn ngữ dùng trong RelayCode', 'Language used across RelayCode'], ['Hồ sơ', 'Profiles'], ['Lưu nhiều cấu hình provider riêng biệt', 'Save separate provider configurations'],
  ['Provider và địa chỉ API đang dùng', 'Provider and API endpoint currently in use'], ['Chi phí ước tính', 'Estimated cost'], ['Không bắt buộc, tính theo một triệu token', 'Optional, estimated per one million tokens'],
  ['Tên hồ sơ', 'Profile name'], ['Ví dụ: OpenAI cá nhân', 'For example: Personal OpenAI'], ['Endpoint và API key', 'Endpoint and API key'],
  ['Nhập API key của provider', 'Enter the provider API key'], ['Tùy chọn', 'Optional'], ['Lưu và kết nối lại', 'Save and reconnect'],
  ['API key được lưu riêng và an toàn cho provider này', 'The API key is stored securely and separately for this provider'], ['Đã lưu API key an toàn', 'API key stored securely'], ['Chưa lưu API key', 'No API key saved'], ['Không cần API key · server local vẫn phải đang chạy', 'No API key required · the local server must still be running'],
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
  document.querySelectorAll('#languageMenu [data-language]').forEach((option) => {
    const selected = option.dataset.language === language;
    option.classList.toggle('active', selected);
    option.setAttribute('aria-selected', String(selected));
  });
  translateLiveDom(language);
  syncStructuralLanguageCopy();
  updateComposerPlaceholder();
  setPermissionMode($('permissionMode').dataset.mode || 'ask');
  $('modelSearch').placeholder = uiCopy('Tìm model…', 'Search models…');
  $('checkModels').textContent = checkingModels
    ? uiCopy('Đang kiểm tra · Bấm để hủy', 'Checking · Click to cancel')
    : uiCopy('Kiểm tra model', 'Check models');
  syncGoalDock();
  $('imageLightbox').setAttribute('aria-label', uiCopy('Xem ảnh', 'Image viewer'));
  $('imageLightbox').querySelector('[role="toolbar"]')?.setAttribute('aria-label', uiCopy('Điều khiển ảnh', 'Image controls'));
  $('zoomOut').setAttribute('aria-label', uiCopy('Thu nhỏ', 'Zoom out'));
  $('zoomIn').setAttribute('aria-label', uiCopy('Phóng to', 'Zoom in'));
  $('resetZoom').textContent = uiCopy('Đặt lại', 'Reset');
  $('closeImage').setAttribute('aria-label', uiCopy('Đóng ảnh', 'Close image'));
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
const floatingSurfaces = ['historyPanel', 'telemetryPanel', 'mcpPanel', 'configPanel', 'connectionDiagnostics', 'uiDialog'];
let activeUiDialog = null;
let dialogReturnFocus = null;
let queuedUiDialogs = [];
if (!document.querySelector('#providerMenu [data-provider="omniroute"]')) {
  const omniProviderOption = document.createElement('button');
  omniProviderOption.type = 'button';
  omniProviderOption.className = 'provider-option';
  omniProviderOption.dataset.provider = 'omniroute';
  omniProviderOption.innerHTML = '<span><strong>OmniRoute</strong><small>' + uiCopy('Gateway local · tự động định tuyến', 'Local gateway · automatic routing') + '</small></span>';
  $('providerMenu').prepend(omniProviderOption);
}
if (!document.querySelector('#configProvider option[value="omniroute"]')) {
  const omniProviderSelectOption = document.createElement('option');
  omniProviderSelectOption.value = 'omniroute';
  omniProviderSelectOption.textContent = 'OmniRoute';
  $('configProvider').prepend(omniProviderSelectOption);
}
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
    ['profileMenu', 'profilePicker', 'profileTrigger'],
    ['languageMenu', 'languagePicker', 'languageTrigger'],
    ['reasoningMenu', 'reasoningPicker', 'reasoningTrigger'],
    ['permMenu', 'permDropdown', 'permissionMode'],
    ['goalRail', 'goalDock', 'goalDockTrigger']
  ];
  for (const [menuId, pickerId, triggerId] of entries) {
    const menu = $(menuId);
    if (!menu || menu === except) continue;
    if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover();
    menu.classList.add('hidden');
    $(pickerId)?.classList.remove('open');
    $(triggerId)?.setAttribute('aria-expanded', 'false');
  }
  document.querySelectorAll('.permission-menu').forEach((menu) => {
    if (menu === except) return;
    menu.classList.add('hidden');
    menu.closest('.permission-allow-wrap')?.querySelector('.permission-menu-trigger')?.setAttribute('aria-expanded', 'false');
  });
  if ($('composerMenu') !== except) {
    $('composerMenu').classList.add('hidden');
    composerMenuIndex = -1;
  }
  if ($('addMenu') !== except) closeAddMenu();
}

function closeUiDialog(action) {
  if (!activeUiDialog) return;
  const current = activeUiDialog;
  const value = current.input ? $('uiDialogInput').value : undefined;
  activeUiDialog = null;
  $('uiDialog').classList.add('hidden');
  $('uiDialogInput').value = '';
  $('uiDialogInput').setAttribute('aria-invalid', 'false');
  $('uiDialogError').classList.add('hidden');
  if (typeof current.onAction === 'function') current.onAction(action, value);
  else {
    vscode.postMessage({
      type: 'dialogResult',
      id: current.id,
      action,
      value
    });
  }
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
  const tone = data.tone || 'neutral';
  dialog.dataset.tone = tone;
  dialog.setAttribute('role', tone === 'danger' ? 'alertdialog' : 'dialog');
  $('uiDialogIcon').innerHTML = uiIcon(data.icon || (tone === 'danger' ? 'warning' : tone === 'warning' ? 'shieldWarning' : tone === 'success' ? 'checkCircle' : 'info'));
  $('uiDialogTitle').textContent = data.title || 'RelayCode';
  $('uiDialogMessage').textContent = data.message || '';
  $('uiDialogDetail').textContent = data.detail || '';
  $('uiDialogDetailIcon').innerHTML = uiIcon(tone === 'danger' ? 'warning' : tone === 'success' ? 'checkCircle' : 'info');
  $('uiDialogDetailWrap').classList.toggle('hidden', !data.detail);
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
    input.setAttribute('aria-invalid', 'false');
  }

  const actions = $('uiDialogActions');
  actions.replaceChildren();
  const suppliedActions = data.actions || [];
  const manyActions = suppliedActions.length > 2;
  const orderedActions = manyActions
    ? [...suppliedActions.filter((action) => !/^(?:cancel|close)$/i.test(action.id)), ...suppliedActions.filter((action) => /^(?:cancel|close)$/i.test(action.id))]
    : suppliedActions;
  actions.classList.toggle('many', manyActions);
  actions.dataset.count = String(suppliedActions.length);
  for (const action of orderedActions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ui-dialog-action ' + (action.kind || 'secondary');
    button.dataset.action = action.id;
    const actionLabel = document.createElement('span');
    actionLabel.className = 'ui-dialog-action-label';
    actionLabel.textContent = action.label;
    button.append(actionLabel);
    button.addEventListener('click', () => {
      if (data.input?.required && !input.value.trim() && action.kind !== 'secondary') {
        $('uiDialogError').textContent = uiCopy('Trường này không được để trống.', 'This field is required.');
        $('uiDialogError').classList.remove('hidden');
        input.setAttribute('aria-invalid', 'true');
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
      const asksForCaution = tone === 'danger' || tone === 'warning' || Boolean(actions.querySelector('.danger'));
      const preferred = asksForCaution
        ? actions.querySelector('.secondary') || $('uiDialogClose')
        : actions.querySelector('.primary') || actions.querySelector('.secondary') || $('uiDialogClose');
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
$('uiDialogInput').addEventListener('input', () => {
  $('uiDialogError').classList.add('hidden');
  $('uiDialogInput').setAttribute('aria-invalid', 'false');
});
$('uiDialogInput').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  $('uiDialogActions').querySelector('.primary')?.click();
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
  } else if (event.key === 'Escape' && closeSettingsDropdownsForEscape(event)) {
  } else if (event.key === 'Escape' && !$('connectionDiagnostics').classList.contains('hidden')) {
    event.preventDefault();
    closeConnectionDiagnosticsDialog();
  } else if (event.key === 'Tab' && !$('connectionDiagnostics').classList.contains('hidden')) {
    const focusable = [...$('connectionDiagnostics').querySelectorAll('button')]
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

`;
