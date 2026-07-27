export const CHAT_VIEW_CONTROLLER = String.raw`
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
let providerConnected = false;
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
let skills = [];
let composerMenuIndex = -1;
let turnStartedAt = 0;
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
    const size = Math.max(3, Math.min(18, Math.ceil(pendingAssistantText.length / 45)));
    assistantRawText += pendingAssistantText.slice(0, size);
    pendingAssistantText = pendingAssistantText.slice(size);
    renderMarkdownInto(assistantBody, assistantRawText);
    $('messages').scrollTop = $('messages').scrollHeight;
    if (pendingAssistantText) typingTimer = setTimeout(tick, 8);
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
  $('modeLabel').textContent = mode === 'agent' ? 'Agent' : mode === 'plan' ? 'Plan' : 'Chat';
  document.querySelectorAll('#modeMenu [data-mode]').forEach((button) => {
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
  $('permLabel').textContent = next === 'full' ? 'Full access' : next === 'edit' ? 'Sửa file' : 'Hỏi';
  btn.classList.toggle('full', next === 'full');
  document.querySelectorAll('#permMenu .perm-opt').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.perm === next);
  });
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
    const meta = document.createElement('small'); meta.className = 'model-option-meta';
    const healthMessage = modelHealth[option.value]?.message || '';
    const latency = healthMessage.match(/(\d+)\s*ms/i)?.[1];
    meta.textContent = option.dataset.tools === 'false'
      ? 'Chat only'
      : (option.dataset.reasoning === 'true' ? 'Agent · reasoning' : 'Agent') + (latency ? ' · ' + latency + ' ms' : '');
    const copy = document.createElement('span'); copy.className = 'model-option-copy'; copy.append(label, meta);
    const favorite = document.createElement('span'); favorite.className = 'model-favorite' + (favoriteModels.includes(option.value) ? ' active' : ''); favorite.textContent = '★'; favorite.title = favoriteModels.includes(option.value) ? 'Bỏ yêu thích' : 'Yêu thích'; favorite.setAttribute('role', 'button'); favorite.tabIndex = 0;
    favorite.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'toggleFavoriteModel', model: option.value }); });
    button.append(health, copy, favorite); button.title = healthMessage;
    button.classList.toggle('active', option.value === $('model').value);
    button.addEventListener('click', () => {
      $('model').value = option.value;
      $('model').dispatchEvent(new Event('change'));
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

function fileTypeIcon(path) {
  const clean = String(path || '').replace(/:\d+(?::\d+)?$/, '').split(/[\\/]/).pop() || '';
  const extension = clean.includes('.') ? clean.split('.').pop().toLowerCase() : '';
  const labels = {
    html: ['html', 'HTML'], htm: ['html', 'HTML'],
    css: ['css', 'CSS'], scss: ['css', 'SC'], sass: ['css', 'SA'], less: ['css', 'LE'],
    js: ['js', 'JS'], jsx: ['js', 'JS'], mjs: ['js', 'JS'], cjs: ['js', 'JS'],
    ts: ['ts', 'TS'], tsx: ['ts', 'TS'],
    json: ['json', '{}'], jsonc: ['json', '{}'],
    md: ['md', 'MD'], mdx: ['md', 'MD'],
    png: ['image', ''], jpg: ['image', ''], jpeg: ['image', ''], gif: ['image', ''], webp: ['image', ''], svg: ['image', '']
  };
  const info = labels[extension];
  if (info?.[0] === 'image') {
    return '<span class="file-type-icon image" aria-hidden="true"><svg viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><circle cx="10.5" cy="6" r="1"/><path d="m4.5 11 2.4-2.6 1.8 1.8 1.2-1.1 1.7 1.9"/></svg></span>';
  }
  if (info?.[0] === 'html') {
    return '<span class="file-type-icon html logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M1.5 0h21l-1.91 21.56L11.98 24l-8.57-2.44L1.5 0Zm4.61 4.41.7 8.01h9.13l-.33 3.43-2.91.8-2.95-.81-.19-2.1H6.93l.33 4.17L12 19.42l5.4-1.5.75-8.17H8.53L8.3 7.03h10.06l.23-2.62H6.11Z"/></svg></span>';
  }
  if (info?.[0] === 'css') {
    return '<span class="file-type-icon css logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M1.5 0h21l-1.91 21.56L11.98 24l-8.57-2.44L1.5 0Zm4.36 4.41.26 2.62h8.94l-.26 2.72H6.36l.74 8.16L12 19.42l4.89-1.51.68-7.51h-2.72l-.37 5.4-2.48.67-2.45-.68-.16-2.05H6.7l.36 4.17L12 19.42l5.4-1.5 1.21-13.51H5.86Z"/></svg></span>';
  }
  if (info) return '<span class="file-type-icon ' + info[0] + '" aria-hidden="true">' + info[1] + '</span>';
  return '<span class="file-type-icon" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/></svg></span>';
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
    return reserve('<button type="button" class="file-link" data-file="' + encodeURIComponent(target) + '">' + fileTypeIcon(target) + '<span>' + label + '</span>' + line + '</button>');
  });
  text = text.replace(/\x60([^\x60]+)\x60/g, (_, code) => {
    const plain = String(code).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const looksLikeFile = /^(?:[a-z]:[\\/]|\.{0,2}[\\/])?.+\.[a-z0-9]{1,10}(?::\d+(?::\d+)?)?$/i.test(plain);
    return reserve(looksLikeFile
      ? '<button type="button" class="file-link" data-file="' + encodeURIComponent(plain) + '">' + fileTypeIcon(plain) + '<span>' + code + '</span></button>'
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
  const cleanSource = String(source || '')
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
  if (/kiểm tra provider/i.test(status)) return { kind: 'provider', done: 'Đã kiểm tra provider' };
  if (/chờ model|model đang xử lý/i.test(status)) return { kind: 'waiting', done: 'Model đã phản hồi' };
  if (/chạy lệnh/i.test(status)) return { kind: 'command', done: 'Đã chạy lệnh' };
  if (/chạy kiểm tra/i.test(status)) return { kind: 'test', done: 'Đã chạy kiểm tra' };
  if (/sửa file/i.test(status)) return { kind: 'edit', done: 'Đã sửa file' };
  if (/đọc file|cấu trúc dự án|tìm trong dự án/i.test(status)) return { kind: 'inspect', done: 'Đã đọc workspace' };
  if (/MCP/i.test(status)) return { kind: 'mcp', done: 'Đã dùng công cụ MCP' };
  return { kind: 'thinking', done: 'Đã phân tích yêu cầu' };
}

function activityIcon(kind, stopped = false) {
  if (stopped) return '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1"/></svg>';
  const icons = {
    provider: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 10.8a4 4 0 0 1 0-5.6"/><path d="M10.8 5.2a4 4 0 0 1 0 5.6"/><path d="m6.7 9.3 2.6-2.6"/></svg>',
    waiting: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.45-3.53"/><path d="M11.6 2.8v2.7H8.9"/></svg>',
    command: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="2"/><path d="m5 6 2 2-2 2M8.5 10h2.5"/></svg>',
    test: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m5.5 8 1.6 1.7 3.5-3.6"/></svg>',
    edit: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.2 11.8.5-2.6 6.9-6.9 2.6 2.6-6.9 6.9z"/><path d="m9.5 3.4 2.6 2.6M3.2 11.8l2.6-.5"/></svg>',
    inspect: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3"/></svg>',
    mcp: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="7.5" cy="12" r="1.5"/><path d="m5.3 4.6 5.2.1M4.8 5.3l2 5.3m4.2-4.2-2.5 4.3"/></svg>',
    thinking: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.3v2M8 11.7v2M2.3 8h2M11.7 8h2M4 4l1.4 1.4M10.6 10.6 12 12M12 4l-1.4 1.4M5.4 10.6 4 12"/></svg>'
  };
  return icons[kind] || icons.thinking;
}

function updateActivity(status) {
  if (!assistantBody || !status || status === 'Hoàn tất') return;
  const info = activityInfo(status);
  if (!assistantActivity) {
    assistantActivity = document.createElement('div');
    assistantActivity.className = 'agent-activity';
    assistantActivity.title = 'Bấm để xem hoạt động chi tiết';
    assistantActivity.addEventListener('click', () => {
      assistantActivity.classList.toggle('expanded');
      assistantBody?.closest('.message')?.classList.toggle('show-trace', assistantActivity.classList.contains('expanded'));
    });
    assistantBody.closest('.message')?.insertBefore(assistantActivity, assistantBody);
  }
  assistantActivity.querySelectorAll('.activity-row.active').forEach((row) => row.classList.remove('active'));
  let row = activitySteps.get(info.kind);
  if (!row) {
    row = document.createElement('div');
    row.className = 'activity-row';
    row.dataset.kind = info.kind;
    row.dataset.done = info.done;
    row.innerHTML = '<span class="activity-icon"></span><span class="activity-copy"></span>';
    activitySteps.set(info.kind, row);
    assistantActivity.append(row);
  }
  row.dataset.kind = info.kind;
  row.querySelector('.activity-icon').innerHTML = activityIcon(info.kind);
  row.querySelector('.activity-copy').textContent = status;
  row.classList.remove('done', 'stopped');
  row.classList.add('active');
  assistantActivity.append(row);
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
    if (cancelled) row.querySelector('.activity-icon').innerHTML = activityIcon(row.dataset.kind, true);
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
    activeTerminal.open = false;
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
  assistantActivity?.classList.remove('expanded');
  assistantBody?.closest('.message')?.classList.remove('show-trace');
  if (assistantBody && turnStartedAt) {
    assistantBody.closest('.message')?.classList.remove('streaming');
    const seconds = Math.max(1, Math.round((Date.now() - turnStartedAt) / 1000));
    const worked = document.createElement('div'); worked.className = 'worked-label';
    worked.textContent = data.cancelled ? 'Đã dừng sau ' + seconds + ' giây' : data.error ? 'Dừng sau ' + seconds + ' giây' : 'Làm việc trong ' + seconds + ' giây';
    assistantBody.closest('.message')?.insertBefore(worked, assistantBody);
  }
  if (activeTerminal) {
    const summary = activeTerminal.querySelector('summary');
    if (summary) summary.textContent = activeTerminal.dataset.command + (data.cancelled ? ' · đã dừng' : ' · hoàn tất');
    activeTerminal.open = false;
  }
  if (data.error) {
    if (assistantBody && !assistantRawText && !assistantActivity?.children.length) assistantBody.closest('.message')?.remove();
    const errorBody = appendMessage('assistant', data.error, true, data.timestamp);
    if (activeProvider === '9router'
      && /không phản hồi|không có hoạt động|không phản hồi API|chưa trả kết quả Agent/i.test(data.error)
      && !/HTTP 403|bearer token|invalid token|xác thực|đăng nhập lại/i.test(data.error)) {
      const actions = document.createElement('div'); actions.className = 'error-actions';
      const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'error-action'; restart.textContent = 'Kiểm tra kết nối';
      restart.addEventListener('click', () => {
        vscode.postMessage({ type: 'checkRouterConnection' });
      });
      actions.append(restart);
      errorBody.append(actions);
    }
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
  turnStartedAt = 0;
  setRunning(false);
  $('prompt').focus();
}

function updateSendState() {
  $('send').disabled = running ? false : !$('prompt').value.trim();
}

function resizePrompt() {
  const prompt = $('prompt');
  const maximum = 132;
  prompt.style.height = '26px';
  const height = Math.min(prompt.scrollHeight, maximum);
  prompt.style.height = height + 'px';
  prompt.style.overflowY = prompt.scrollHeight > maximum ? 'auto' : 'hidden';
  document.querySelector('.composer-shell')?.classList.toggle('has-input', Boolean(prompt.value.trim()));
}

function renderComposerMenu() {
  const value = $('prompt').value;
  const menu = $('composerMenu');
  const slash = [
    ['/new', 'Cuộc chat mới'],
    ['/skills', 'Tìm và chèn skill'],
    ['/models', 'Mở danh sách model'],
    ['/plan', 'Chuyển sang chế độ Plan'],
    ['/review', 'Xem các file đã thay đổi'],
    ['/status', 'Xem provider, MCP và skills'],
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
  const skillMatch = value.match(/(?:^|\s)\$([^\s]*)$/);
  const source = value.startsWith('/')
    ? slash.map(([key, description]) => ({ key, description, kind: 'command' }))
    : /(^|\s)@[^\s]*$/.test(value)
      ? mentions.map(([key, description]) => ({ key, description, kind: 'mention' }))
      : skillMatch
        ? skills.map((skill) => ({ key: '$' + skill.name, description: skill.description, kind: 'skill', source: skill.source }))
        : [];
  const needle = value.startsWith('/')
    ? value.toLowerCase()
    : skillMatch
      ? ('$' + (skillMatch[1] || '')).toLowerCase()
      : (value.match(/@[^\s]*$/)?.[0] || '').toLowerCase();
  const filtered = source.filter((item) => item.key.toLowerCase().includes(needle)).slice(0, 50);
  menu.replaceChildren();
  if (composerMenuIndex >= filtered.length) composerMenuIndex = filtered.length - 1;
  if (composerMenuIndex < 0 && filtered.length) composerMenuIndex = 0;
  for (const [index, item] of filtered.entries()) {
    const button = document.createElement('button'); button.type = 'button';
    button.classList.toggle('selected', index === composerMenuIndex);
    const command = document.createElement('span'); command.className = 'menu-key';
    if (item.kind === 'skill') {
      const mark = document.createElement('i'); mark.className = 'skill-mark'; mark.textContent = '$';
      command.append(mark);
    }
    command.append(document.createTextNode(item.key));
    if (item.kind === 'skill') {
      const source = document.createElement('small'); source.className = 'skill-source'; source.textContent = item.source === 'workspace' ? 'project' : 'user';
      command.append(source);
    }
    const copy = document.createElement('span'); copy.className = 'menu-copy'; copy.textContent = item.description;
    button.append(command, copy);
    button.addEventListener('click', () => {
      if (value.startsWith('/')) $('prompt').value = item.key;
      else if (item.kind === 'skill') $('prompt').value = value.replace(/\$[^\s]*$/, item.key + ' ');
      else $('prompt').value = value.replace(/@[^\s]*$/, item.key);
      menu.classList.add('hidden');
      composerMenuIndex = -1;
      $('prompt').focus();
      resizePrompt();
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
  resizePrompt();
  updateSendState();
}

document.querySelectorAll('#modeMenu [data-mode]').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation();
  setMode(button.dataset.mode);
  $('modeMenu').classList.add('hidden');
  $('modePicker').classList.remove('open');
  $('modeTrigger').setAttribute('aria-expanded', 'false');
}));
$('modeTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('modeMenu').classList.contains('hidden');
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
  const selectedLabel = custom ? 'Model tùy chỉnh' : ($('model').selectedOptions[0]?.textContent || 'Chọn model');
  $('modelLabel').textContent = selectedLabel;
  $('modelTrigger').title = selectedLabel;
});
$('modelTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('modelMenu').classList.contains('hidden');
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
$('stopRouter').addEventListener('click', () => vscode.postMessage({ type: 'checkRouterConnection' }));
$('connectionToggle').addEventListener('click', () => vscode.postMessage({ type: 'checkRouterConnection' }));
function runConnectionDiagnostics() {
  const meta = providerMeta[activeProvider] || providerMeta['9router'];
  $('connectionDiagnostics').classList.remove('hidden');
  $('connectionProviderName').textContent = meta.label;
  $('connectionProviderMark').textContent = meta.label.slice(0, 2).toUpperCase();
  $('connectionEndpoint').textContent = $('configEndpoint').value.trim() || 'Chưa có endpoint';
  $('connectionDialogSubtitle').textContent = 'Đang kiểm tra ' + meta.label;
  $('connectionHealthBadge').textContent = 'Đang kiểm tra';
  $('connectionHealthBadge').className = 'checking';
  $('connectionLatency').textContent = '—';
  $('connectionModels').textContent = '—';
  $('connectionMessage').textContent = 'Đang gửi yêu cầu kiểm tra provider…';
  $('retryDiagnostics').disabled = true;
  vscode.postMessage({ type: 'diagnostics' });
}
$('topDisconnect').addEventListener('click', () => {
  if (providerConnected) {
    runConnectionDiagnostics();
    return;
  }
  if (activeProvider === '9router') {
    showSetup(true);
    $('setup').scrollTop = 0;
    return;
  }
  $('configPanel').classList.remove('hidden');
});
$('retryDiagnostics').addEventListener('click', runConnectionDiagnostics);
$('closeConnectionDiagnostics').addEventListener('click', () => $('connectionDiagnostics').classList.add('hidden'));
$('connectionDiagnostics').addEventListener('click', (event) => { if (event.target === $('connectionDiagnostics')) $('connectionDiagnostics').classList.add('hidden'); });
$('openConnectionSettings').addEventListener('click', () => {
  $('connectionDiagnostics').classList.add('hidden');
  $('configPanel').classList.remove('hidden');
});
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
  $('modelPicker')?.classList.remove('open');
  $('modelTrigger')?.setAttribute('aria-expanded', 'false');
  $('historyPanel')?.classList.add('hidden');
  historyExpanded = false;
  $('telemetryPanel')?.classList.add('hidden');
  $('mcpPanel')?.classList.add('hidden');
  $('providerMenu')?.classList.add('hidden');
  $('providerPicker')?.classList.remove('open');
  $('providerTrigger')?.setAttribute('aria-expanded', 'false');
  $('modeMenu')?.classList.add('hidden');
  $('modePicker')?.classList.remove('open');
  $('modeTrigger')?.setAttribute('aria-expanded', 'false');
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
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
});
$('prompt').addEventListener('input', () => {
  resizePrompt();
  renderComposerMenu();
  updateSendState();
});
$('prompt').addEventListener('focus', () => document.querySelector('.composer-shell')?.classList.add('prompt-focused'));
$('prompt').addEventListener('blur', () => document.querySelector('.composer-shell')?.classList.remove('prompt-focused'));
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
    if (data.workspaceTrusted === false) appendMessage('assistant', 'Workspace chưa được tin cậy. Agent, terminal và MCP sẽ bị khóa cho đến khi bạn bật Workspace Trust.', true);
    profiles = data.profiles || [];
    favoriteModels = data.favoriteModels || [];
    recentModels = data.recentModels || [];
    skills = data.skills || [];
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
  } else if (data.type === 'skills') {
    skills = data.skills || [];
    renderComposerMenu();
  } else if (data.type === 'focusSkillPicker') {
    $('prompt').value = '$';
    composerMenuIndex = 0;
    renderComposerMenu();
    $('prompt').focus();
    updateSendState();
  } else if (data.type === 'setComposerMode') {
    setMode(data.mode || 'agent');
    $('prompt').focus();
  } else if (data.type === 'openChanges') {
    changesHidden = false;
    $('changeTray').classList.toggle('hidden', !lastChangeCount);
    $('collapsedChanges').classList.add('hidden');
  } else if (data.type === 'connection') {
    activeProvider = data.provider || '9router';
    providerConnected = Boolean(data.connected);
    const isRouter = activeProvider === '9router';
    const providerName = providerMeta[activeProvider]?.label || activeProvider;
    $('connectionDot').classList.toggle('online', data.connected);
    const needsConfiguration = !data.connected && /API key|cấu hình|endpoint/i.test(data.message || '');
    $('connectionLabel').textContent = data.connected ? providerName + ' sẵn sàng' : needsConfiguration ? 'Chưa cấu hình' : providerName + ' ngoại tuyến';
    if (data.connected) showError('');
    else if (!launchingRouter) showError(data.message || '');
    showSetup(!data.connected);
    $('connectionToggle').classList.toggle('hidden', !data.connected);
    $('connectionToggle').textContent = 'Kiểm tra';
    $('topDisconnect').classList.remove('hidden');
    $('topDisconnect').textContent = data.connected ? 'Kiểm tra' : 'Kết nối';
    $('topDisconnect').classList.toggle('connect-action', !data.connected);
    $('stopRouter').classList.toggle('hidden', !data.connected || !isRouter);
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
        : 'Dịch vụ đang chạy. Bấm Kiểm tra để xem tiến trình, cổng và API trong Terminal.';
      $('startRouter').classList.toggle('hidden', !isRouter);
      $('openDashboard').classList.toggle('hidden', !isRouter);
      $('retryConnection').classList.remove('hidden');
      $('topDisconnect').textContent = 'Kiểm tra';
      $('topDisconnect').classList.remove('connect-action');
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
    const selectedLabel = select.selectedOptions[0]?.textContent || 'Chọn model';
    $('modelLabel').textContent = selectedLabel;
    $('modelTrigger').title = selectedLabel;
    renderModelMenu();
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
    meter.title = data.compacted ? 'Context đã được rút gọn: ' + data.original + ' → ' + data.used + ' ký tự' : 'Context: ' + data.used + '/' + data.limit + ' ký tự';
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
    $('modelPicker').classList.add('open');
    $('modelTrigger').setAttribute('aria-expanded', 'true');
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
    $('retryDiagnostics').disabled = false;
    $('connectionProviderName').textContent = providerMeta[data.provider]?.label || data.provider || 'Provider';
    $('connectionProviderMark').textContent = (providerMeta[data.provider]?.label || data.provider || 'AI').slice(0, 2).toUpperCase();
    $('connectionEndpoint').textContent = data.endpoint || 'Chưa có endpoint';
    $('connectionDialogSubtitle').textContent = data.ok ? 'Provider đã sẵn sàng' : 'Provider chưa thể sử dụng';
    $('connectionHealthBadge').textContent = data.ok ? 'Sẵn sàng' : 'Có lỗi';
    $('connectionHealthBadge').className = data.ok ? 'ready' : 'failed';
    $('connectionLatency').textContent = typeof data.latency === 'number' ? data.latency + ' ms' : '—';
    $('connectionModels').textContent = typeof data.modelCount === 'number' ? String(data.modelCount) : '—';
    $('connectionMessage').textContent = data.message || (data.ok ? 'Kết nối hoạt động bình thường.' : 'Không thể kết nối provider.');
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
      providerConnected = false;
      $('startRouter').classList.remove('hidden');
      $('openDashboard').classList.add('hidden');
      $('retryConnection').classList.add('hidden');
      $('stopRouter').classList.add('hidden');
      $('connectionToggle').classList.add('hidden');
      $('topDisconnect').classList.remove('hidden');
      $('topDisconnect').classList.add('connect-action');
      $('topDisconnect').textContent = 'Kết nối';
    }
  } else if (data.type === 'browserOpened') {
    setRouterLaunchState('ready', 'Đã mở trình quản lý');
    $('launchDescription').textContent = '9Router đang chạy nền. Trình duyệt đã mở trang quản lý.';
    showError('');
  } else if (data.type === 'attachmentLoading') {
    $('attachmentProgress').classList.toggle('hidden', !data.active);
    $('attach').disabled = Boolean(data.active);
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
        taskLabel.append(title);
        list.append(taskLabel);
      }
      const row = document.createElement('div'); row.className = 'change-row';
      row.innerHTML = '<span>' + escapeHtml(change.path) + '</span><span><b class="diff-add">+' + change.added + '</b> <b class="diff-remove">-' + change.removed + '</b></span><button class="tray-review">Review</button><button class="tray-undo">Undo</button><button class="tray-accept">Accept</button>';
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
    turnStartedAt = data.timestamp || Date.now();
    flushAssistantText();
    assistantRawText = '';
    assistantActivity = null;
    activeTerminal = null;
    activitySteps = new Map();
    pendingTurnEnd = null;
    appendMessage('user', data.prompt, false, data.timestamp, data.attachments || []);
    assistantBody = appendMessage('assistant', '', false, data.timestamp);
    assistantBody.closest('.message')?.classList.add('streaming');
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

setPermissionMode('ask');
resizePrompt();
vscode.postMessage({ type: 'ready' });
`;
