export const CHAT_CONTROLLER_PANELS = String.raw`let currentLightboxMediaPath = '';
let turnToolCount = 0;
let lastChatVideoItem = null;
let historySearchQuery = '';
let workspacePathRequestId = 0;
let workspacePathTimer = 0;
let workspacePathLastKey = '';
let workspacePathResults = { kind: '', query: '', items: [] };
let hintBubbleNode = null;
let hintTargetNode = null;
let hintShowTimer = 0;
let hintWarmUntil = 0;
const HINT_TARGET_SELECTOR = [
  '.history-pin', '.history-rename', '.history-export', '.history-delete', '#closeHistory',
  '.message-action', '.markdown-code-copy', '.markdown-code-insert', '.markdown-code-run',
  '.user-video-expand', '.attachment-video-remove', '.attachment-chip button', '.attachment-preview button',
  '#attach', '#send', '#runningScrollIndicator', '#closeConfig', '#closeConnectionDiagnostics',
  '#uiDialogClose', '#closeImage', '#zoomIn', '#zoomOut', '.goal-dock-quick-clear',
  '.queue-icon-button', '.mcp-remove', '.model-favorite', '.change-review-dialog>header>button'
].join(',');

function ensureHintBubble() {
  if (!hintBubbleNode) {
    hintBubbleNode = document.createElement('div');
    hintBubbleNode.className = 'rc-hint-bubble';
    hintBubbleNode.setAttribute('role', 'tooltip');
    document.body.append(hintBubbleNode);
  }
  return hintBubbleNode;
}

function positionHintBubble(target, text) {
  const bubble = ensureHintBubble();
  bubble.textContent = text;
  bubble.classList.add('visible');
  const rect = target.getBoundingClientRect();
  const width = bubble.offsetWidth || 80;
  const height = bubble.offsetHeight || 24;
  const margin = 8;
  const left = Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left + (rect.width - width) / 2));
  const preferAbove = rect.top - height - 7 >= margin;
  const top = preferAbove ? rect.top - height - 7 : Math.min(window.innerHeight - height - margin, rect.bottom + 7);
  bubble.style.left = Math.round(left) + 'px';
  bubble.style.top = Math.round(top) + 'px';
}

function hideFloatingHint() {
  if (hintShowTimer) { clearTimeout(hintShowTimer); hintShowTimer = 0; }
  hintTargetNode = null;
  if (hintBubbleNode) hintBubbleNode.classList.remove('visible');
}

function showFloatingHint(target, immediate = false) {
  if (!target?.isConnected) return;
  const label = String(target.getAttribute('aria-label') || '').trim();
  if (!label) { hideFloatingHint(); return; }
  if (hintShowTimer) { clearTimeout(hintShowTimer); hintShowTimer = 0; }
  hintTargetNode = target;
  const delay = immediate || Date.now() < hintWarmUntil ? 0 : 150;
  const reveal = () => {
    hintShowTimer = 0;
    if (hintTargetNode !== target || !target.isConnected) return;
    const fresh = String(target.getAttribute('aria-label') || '').trim();
    if (!fresh) { hideFloatingHint(); return; }
    hintWarmUntil = Date.now() + 420;
    positionHintBubble(target, fresh);
  };
  if (delay === 0) reveal();
  else hintShowTimer = setTimeout(reveal, delay);
}

function refreshFloatingHint(target) {
  if (!target?.isConnected) return;
  const hovering = target === hintTargetNode || Boolean(target.matches?.(':hover'));
  if (!hovering) return;
  const fresh = String(target.getAttribute('aria-label') || '').trim();
  if (!fresh) { hideFloatingHint(); return; }
  hintTargetNode = target;
  positionHintBubble(target, fresh);
}

function resolveHintTarget(node) {
  if (!node || typeof node.closest !== 'function') return null;
  const match = node.closest(HINT_TARGET_SELECTOR);
  if (!match || match.disabled) return null;
  return match;
}

document.addEventListener('pointerover', (event) => {
  const target = resolveHintTarget(event.target);
  if (!target) {
    if (hintTargetNode) hideFloatingHint();
    return;
  }
  if (target !== hintTargetNode) showFloatingHint(target);
});
document.addEventListener('pointerout', (event) => {
  if (!hintTargetNode) return;
  const next = resolveHintTarget(event.relatedTarget);
  if (!next || next !== hintTargetNode) hideFloatingHint();
});
document.addEventListener('focusin', (event) => {
  const target = resolveHintTarget(event.target);
  if (target) showFloatingHint(target, true);
});
document.addEventListener('focusout', () => hideFloatingHint());
document.addEventListener('pointerdown', () => hideFloatingHint(), true);
document.addEventListener('scroll', () => hideFloatingHint(), true);
window.addEventListener('blur', () => hideFloatingHint());

function updateContextBar(used = 0, limit = 120000, compacted = false) {
  const bar = $('contextBar');
  if (!bar) return;
  const safeLimit = Math.max(1, Number(limit || 120000));
  const safeUsed = Math.max(0, Number(used || 0));
  const percent = Math.min(100, Math.round((safeUsed / safeLimit) * 100));
  bar.classList.toggle('hidden', percent < 20 && !compacted);
  bar.classList.toggle('warn', percent >= 70 && percent < 88);
  bar.classList.toggle('critical', percent >= 88 || Boolean(compacted));
  const fill = $('contextBarFill');
  if (fill) fill.style.width = percent + '%';
  const label = $('contextBarLabel');
  if (label) {
    label.textContent = percent + '% · ' + formatCompact(Math.ceil(safeUsed / 4)) + ' / ' + formatCompact(Math.ceil(safeLimit / 4)) + ' tok';
  }
  const btn = $('contextCompactBtn');
  if (btn) btn.textContent = uiCopy('Rút gọn', 'Compact');
}

function requestWorkspacePathSuggestions(kind, query) {
  const key = kind + ':' + query;
  if (key === workspacePathLastKey) return;
  workspacePathLastKey = key;
  if (workspacePathTimer) clearTimeout(workspacePathTimer);
  const requestId = ++workspacePathRequestId;
  workspacePathTimer = setTimeout(() => {
    workspacePathTimer = 0;
    vscode.postMessage({ type: 'searchWorkspacePaths', kind, query, requestId });
  }, 80);
}

function applyWorkspacePathSuggestions(data) {
  if (!data || (data.requestId && data.requestId < workspacePathRequestId)) return;
  workspacePathResults = {
    kind: data.kind || 'file',
    query: data.query || '',
    items: Array.isArray(data.items) ? data.items : []
  };
  if (!$('composerMenu').classList.contains('hidden') || activeComposerTrigger($('prompt').value)?.kind === 'mention') {
    renderComposerMenu();
  }
}

function filteredHistorySessions(sessions = []) {
  const needle = String(historySearchQuery || '').trim().toLowerCase();
  if (!needle) return sessions;
  return sessions.filter((session) =>
    String(session.title || '').toLowerCase().includes(needle)
    || String(session.preview || '').toLowerCase().includes(needle)
  );
}

function createHistoryActionButtons(session) {
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'history-pin' + (session.pinned ? ' active' : '');
  pin.setAttribute('aria-label', session.pinned ? uiCopy('Bỏ ghim', 'Unpin') : uiCopy('Ghim cuộc trò chuyện', 'Pin conversation'));
  pin.innerHTML = '<svg viewBox="0 0 24 24" fill="' + (session.pinned ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.9"><path d="M12 17v5M8 4h8l-1 5 3 3v2H6v-2l3-3-1-5Z"/></svg>';
  pin.addEventListener('click', (event) => {
    event.stopPropagation();
    vscode.postMessage({ type: 'togglePinSession', id: session.id });
  });
  const rename = document.createElement('button');
  rename.type = 'button';
  rename.className = 'history-rename';
  rename.setAttribute('aria-label', uiCopy('Đổi tên cuộc trò chuyện', 'Rename conversation'));
  rename.innerHTML = uiIcon('pencilSimple');
  rename.addEventListener('click', (event) => {
    event.stopPropagation();
    promptRenameSession(session);
  });
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'history-export';
  exportBtn.setAttribute('aria-label', uiCopy('Xuất Markdown', 'Export Markdown'));
  exportBtn.innerHTML = uiIcon('export');
  exportBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    vscode.postMessage({ type: 'exportSessionMarkdown', id: session.id });
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'history-delete';
  remove.setAttribute('aria-label', uiCopy('Xóa cuộc trò chuyện', 'Delete conversation'));
  remove.innerHTML = uiIcon('trash');
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    vscode.postMessage({ type: 'deleteSession', id: session.id });
  });
  return [pin, rename, exportBtn, remove];
}

function createRollbackMessageButton(turnIndex) {
  const rollback = document.createElement('button');
  rollback.type = 'button';
  rollback.className = 'message-action rollback-message';
  rollback.setAttribute('aria-label', uiCopy('Quay lại trước tin nhắn này', 'Revert to before this message'));
  rollback.innerHTML = uiIcon('arrowCounterClockwise');
  rollback.addEventListener('click', () => {
    if (running) return;
    vscode.postMessage({ type: 'rollbackToTurn', turnIndex });
  });
  return rollback;
}

function seekVideoElement(video, seconds) {
  const target = Math.max(0, Number(seconds || 0));
  const apply = () => {
    try { video.currentTime = target; } catch { /* ignore unseekable range */ }
    void video.play?.().catch(() => undefined);
  };
  if (video.readyState >= 1) apply();
  else video.addEventListener('loadedmetadata', apply, { once: true });
}

function seekChatVideoTo(seconds) {
  const cards = [...$('messages').querySelectorAll('.user-video-card')];
  const card = cards.at(-1);
  if (card && typeof card._playInline === 'function') {
    const video = card._playInline();
    if (video) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      seekVideoElement(video, seconds);
      return;
    }
  }
  if (lastChatVideoItem) {
    openVideoLightbox(lastChatVideoItem);
    const video = $('lightboxVideo');
    if (video) seekVideoElement(video, seconds);
  }
}

function syncPromptEmptyState() {
  const editor = $('prompt');
  if (!editor) return;
  const text = editor.value || '';
  const isEmpty = text.length === 0;
  if (isEmpty && editor.childNodes.length === 1 && editor.firstChild?.nodeName === 'BR') {
    editor.replaceChildren();
  }
  editor.dataset.empty = isEmpty ? 'true' : 'false';
}

function updateNarrowGuardBanner(width = currentViewWidth()) {
  const banner = $('narrowGuardBanner');
  if (!banner) return;
  const tooNarrow = Number.isFinite(width) && width > 0 && width < 286;
  banner.classList.toggle('hidden', !tooNarrow);
  const label = $('narrowGuardText');
  if (label) label.textContent = uiCopy('Khung chat đang khá hẹp · kéo rộng hơn để xem rõ', 'Sidebar is narrow · drag wider for best view');
}

function renderStarterPrompts() {
  const host = $('starterPrompts');
  if (!host) return;
  host.replaceChildren();
  const items = mode === 'plan'
    ? [
        { icon: 'lightbulb', label: uiCopy('Lập kế hoạch tính năng mới', 'Plan a new feature'), prompt: uiCopy('Đọc cấu trúc dự án và lập kế hoạch triển khai tính năng: ', 'Inspect the codebase and draft an implementation plan for: ') },
        { icon: 'magnifyingGlass', label: uiCopy('Rà soát kiến trúc dự án', 'Audit project architecture'), prompt: uiCopy('Phân tích kiến trúc hiện tại và đề xuất các điểm cần cải thiện.', 'Analyze the current architecture and propose key improvements.') }
      ]
    : mode === 'chat'
      ? [
          { icon: 'fileVideo', label: uiCopy('Phân tích ảnh hoặc video', 'Analyze an image or video'), action: () => vscode.postMessage({ type: 'pickFiles', kind: 'media' }) },
          { icon: 'chatCircle', label: uiCopy('Giải thích nhanh một đoạn code', 'Explain a code snippet'), prompt: uiCopy('Giải thích ngắn gọn cách hoạt động của ', 'Briefly explain how this works: ') }
        ]
      : [
          { icon: 'magnifyingGlass', label: uiCopy('Kiểm tra và sửa lỗi dự án', 'Find and fix bugs'), prompt: uiCopy('Kiểm tra toàn bộ dự án, tìm các lỗi tiềm ẩn và đề xuất sửa.', 'Inspect the workspace for bugs and fix the highest-impact issues.') },
          { icon: 'fileVideo', label: uiCopy('Gửi ảnh / video để phân tích', 'Attach image or video'), action: () => vscode.postMessage({ type: 'pickFiles', kind: 'media' }) },
          { icon: 'gitDiff', label: uiCopy('Review thay đổi Git hiện tại', 'Review current Git diff'), prompt: '@git-diff ' + uiCopy('Rà soát kỹ các thay đổi hiện tại và kiểm tra rủi ro.', 'Review the current diff for bugs and regressions.') }
        ];
  for (const item of items) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'starter-chip';
    chip.innerHTML = '<span class="starter-chip-icon" aria-hidden="true">' + uiIcon(item.icon) + '</span><span>' + escapeHtml(item.label) + '</span>';
    chip.addEventListener('click', () => {
      if (item.action) { item.action(); return; }
      const editor = $('prompt');
      editor.value = item.prompt || '';
      resizePrompt();
      updateSendState();
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    });
    host.append(chip);
  }
}

function openVideoLightbox(item) {
  if (!item?.videoUrl) {
    if (item?.path) vscode.postMessage({ type: 'openMediaExternal', path: item.path });
    return;
  }
  lightboxReturnFocus = document.activeElement;
  currentLightboxMediaPath = item.path || '';
  const lightbox = $('imageLightbox');
  const video = $('lightboxVideo');
  const image = $('lightboxImage');
  const bar = $('lightboxMediaBar');
  const meta = $('lightboxMediaMeta');
  lightbox.classList.add('is-video');
  lightbox.setAttribute('aria-label', uiCopy('Xem video', 'Video player'));
  image.classList.add('hidden');
  image.removeAttribute('src');
  video.classList.remove('hidden');
  video.poster = item.poster || '';
  video.src = item.videoUrl;
  const parts = [item.name, item.durationLabel, item.resolution, item.sizeLabel].filter(Boolean);
  meta.textContent = parts.join(' · ');
  $('openMediaExternal').textContent = uiCopy('Mở ngoài', 'Open externally');
  $('openMediaExternal').classList.toggle('hidden', !currentLightboxMediaPath);
  bar.classList.remove('hidden');
  lightbox.classList.remove('hidden');
  requestAnimationFrame(() => video.focus());
}

function createVideoAttachmentNode(item, options = {}) {
  const compact = Boolean(options.compact);
  const card = document.createElement('div');
  card.className = compact ? 'attachment-video-preview' : 'user-video-card';
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = compact ? 'attachment-video-thumb' : 'user-video-thumb';
  thumb.setAttribute('aria-label', uiCopy('Xem video ', 'Play video ') + (item.name || 'video'));
  if (item.poster) {
    const posterImg = document.createElement('img');
    posterImg.src = item.poster;
    posterImg.alt = item.name || 'video';
    thumb.append(posterImg);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'video-thumb-fallback';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.innerHTML = uiIcon('fileVideo');
    thumb.append(placeholder);
  }
  const playBadge = document.createElement('span');
  playBadge.className = 'video-play-pill';
  playBadge.setAttribute('aria-hidden', 'true');
  playBadge.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';
  thumb.append(playBadge);
  if (item.durationLabel) {
    const duration = document.createElement('span');
    duration.className = 'video-duration-badge';
    duration.textContent = item.durationLabel;
    thumb.append(duration);
  }
  thumb.addEventListener('click', (event) => {
    event.stopPropagation();
    if (compact || !item.videoUrl) {
      openVideoLightbox(item);
      return;
    }
    card._playInline?.();
  });
  if (!compact) {
    lastChatVideoItem = item;
    card._playInline = () => {
      const existing = card.querySelector('.user-video-inline-player');
      if (existing) return existing;
      if (!item.videoUrl) return null;
      const player = document.createElement('video');
      player.className = 'user-video-inline-player';
      player.controls = true;
      player.playsInline = true;
      player.autoplay = true;
      if (item.poster) player.poster = item.poster;
      player.src = item.videoUrl;
      thumb.replaceWith(player);
      card.classList.add('playing-inline');
      return player;
    };
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'user-video-expand';
    expand.setAttribute('aria-label', uiCopy('Mở video toàn màn hình', 'Open video in lightbox'));
    expand.innerHTML = uiIcon('arrowsOut');
    expand.addEventListener('click', (event) => {
      event.stopPropagation();
      card.querySelector('video')?.pause();
      openVideoLightbox(item);
    });
    card.append(expand);
  }
  card.append(thumb);
  if (compact && typeof options.onRemove === 'function') {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'attachment-video-remove';
    remove.innerHTML = uiIcon('x');
    remove.setAttribute('aria-label', uiCopy('Bỏ video đính kèm', 'Remove attached video'));
    remove.addEventListener('click', (event) => { event.stopPropagation(); options.onRemove(); });
    card.append(remove);
  }
  const meta = document.createElement('div');
  meta.className = compact ? 'attachment-video-meta' : 'user-video-meta';
  const name = document.createElement('strong');
  name.textContent = item.name || 'video';
  const details = document.createElement('small');
  details.textContent = [item.resolution, item.sizeLabel].filter(Boolean).join(' · ') || 'Video';
  meta.append(name, details);
  card.append(meta);
  return card;
}

function promptRenameSession(session) {
  if (!session?.id) return;
  renderUiDialog({
    id: 'rename-session-' + Date.now(),
    title: uiCopy('Đổi tên cuộc trò chuyện', 'Rename conversation'),
    message: uiCopy('Đặt tên ngắn gọn để dễ tìm lại trong lịch sử.', 'Choose a concise title to find this chat later.'),
    icon: 'pencilSimple',
    dismissible: true,
    input: {
      label: uiCopy('Tên cuộc trò chuyện', 'Conversation title'),
      value: session.title || '',
      placeholder: uiCopy('Ví dụ: Sửa upload video & tối ưu UI', 'e.g. Video upload & UI polish'),
      required: true
    },
    actions: [
      { id: 'cancel', label: uiCopy('Hủy', 'Cancel'), kind: 'secondary' },
      { id: 'confirm', label: uiCopy('Lưu tên', 'Save title'), kind: 'primary' }
    ],
    onAction: (action, value) => {
      if (action === 'confirm' && String(value || '').trim()) {
        vscode.postMessage({ type: 'renameSession', id: session.id, title: String(value).trim() });
      }
    }
  });
}

function syncStructuralLanguageCopy() {
  const copy = {
    configHeadingTitle: uiCopy('Cấu hình provider', 'Provider settings'),
    configHeadingCopy: uiCopy('Chọn nguồn model cho mọi yêu cầu', 'Choose the model source for every request'),
    configInterfaceTitle: uiCopy('Giao diện', 'Interface'),
    configInterfaceCopy: uiCopy('Ngôn ngữ dùng trong RelayCode', 'Language used across RelayCode'),
    interfaceLanguageLabel: uiCopy('Ngôn ngữ giao diện', 'Interface language'),
    configProfilesTitle: uiCopy('Hồ sơ', 'Profiles'),
    configProfilesCopy: uiCopy('Lưu nhiều cấu hình provider riêng biệt', 'Save separate provider configurations'),
    activeProfileText: uiCopy('Hồ sơ đang dùng', 'Active profile'),
    profileNameText: uiCopy('Tên hồ sơ', 'Profile name'),
    configConnectionTitle: uiCopy('Kết nối', 'Connection'),
    configConnectionCopy: uiCopy('Provider và địa chỉ API đang dùng', 'Provider and API endpoint currently in use'),
    providerFieldText: 'Provider',
    configEndpointLabel: 'Endpoint',
    configCostTitle: uiCopy('Chi phí ước tính', 'Estimated cost'),
    configCostCopy: uiCopy('Không bắt buộc, tính theo một triệu token', 'Optional, estimated per one million tokens'),
    modelMenuTitle: 'Models',
    modelMenuCopy: uiCopy('Chọn model cho yêu cầu tiếp theo', 'Choose a model for the next request'),
    undoAllChanges: uiCopy('Hoàn tác tất cả', 'Undo all'),
    acceptAllChanges: uiCopy('Chấp nhận tất cả', 'Accept all'),
    hideChanges: uiCopy('Ẩn', 'Hide'),
    expandChanges: uiCopy('Xem', 'View')
  };
  Object.entries(copy).forEach(([id, value]) => {
    const element = $(id);
    if (element) element.textContent = value;
  });
}

function formatChangedFilesLabel(count) {
  return language === 'en'
    ? count + ' ' + (count === 1 ? 'file' : 'files') + ' changed'
    : count + ' file đã thay đổi';
}

function syncDynamicLanguageCopy() {
  const emptyTitle = $('messages')?.querySelector('.empty h2');
  const emptyCopy = $('messages')?.querySelector('.empty p');
  if (emptyTitle) emptyTitle.textContent = uiCopy('Nói điều bạn muốn xây.', 'Describe what you want to build.');
  if (emptyCopy) {
    emptyCopy.textContent = mode === 'agent'
      ? uiCopy('Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.', 'Agent can read the project, edit files and run commands in the workspace.')
      : mode === 'plan'
        ? uiCopy('Agent sẽ đọc workspace và lập kế hoạch trước khi hành động.', 'Agent will inspect the workspace and plan before acting.')
        : uiCopy('Trò chuyện trực tiếp với model đang chọn.', 'Chat directly with the selected model.');
  }
  document.querySelectorAll('#providerMenu .provider-option').forEach((option) => {
    const kind = option.dataset.provider || '9router';
    const meta = providerMeta[kind];
    const hint = option.querySelector('small');
    if (meta && hint) hint.textContent = providerHintCopy(kind, meta.hint);
  });
  const selectedProvider = $('configProvider')?.value || activeProvider || '9router';
  const selectedMeta = providerMeta[selectedProvider] || providerMeta['9router'];
  if ($('providerHint')) $('providerHint').textContent = providerHintCopy(selectedProvider, selectedMeta.hint);
  if ($('configApiKey')) {
    $('configApiKey').placeholder = selectedMeta.local
      ? uiCopy('Provider local không dùng API key', 'Local providers do not use an API key')
      : uiCopy('Nhập key mới hoặc để trống để giữ key đã lưu', 'Enter a new key or leave blank to keep the saved key');
  }
  if ($('startRouter') && !launchingRouter) {
    $('startRouter').textContent = selectedProvider === '9router'
      ? uiCopy('Mở 9Router', 'Open 9Router')
      : selectedProvider === 'omniroute'
        ? uiCopy('Mở OmniRoute', 'Open OmniRoute')
        : uiCopy('Kết nối ' + selectedMeta.label, 'Connect ' + selectedMeta.label);
  }
  if ($('openOmniRoute')) $('openOmniRoute').textContent = uiCopy('Mở OmniRoute', 'Open OmniRoute');
  if ($('openOmniRouteCenter')) $('openOmniRouteCenter').textContent = uiCopy('Mở OmniRoute', 'Open OmniRoute');
  if ($('openCockpitCenter')) $('openCockpitCenter').textContent = uiCopy('Mở Cockpit', 'Open Cockpit');
  if ($('disconnectConnection')) $('disconnectConnection').textContent = uiCopy('Ngắt kết nối', 'Disconnect');
  if ($('openMediaExternal')) $('openMediaExternal').textContent = uiCopy('Mở ngoài', 'Open externally');
  if ($('composerDropzoneText')) $('composerDropzoneText').textContent = uiCopy('Thả ảnh, video hoặc tệp vào đây', 'Drop images, videos or files here');
  if ($('historySearch')) $('historySearch').placeholder = uiCopy('Tìm cuộc trò chuyện…', 'Search conversations…');
  if ($('contextCompactBtn')) $('contextCompactBtn').textContent = uiCopy('Rút gọn', 'Compact');
  if ($('closeHistory')) $('closeHistory').setAttribute('aria-label', uiCopy('Đóng', 'Close'));
  if ($('attach')) $('attach').setAttribute('aria-label', uiCopy('Thêm tệp, ảnh, video hoặc ngữ cảnh', 'Add files, media or context'));
  if ($('runningScrollIndicator')) $('runningScrollIndicator').setAttribute('aria-label', uiCopy('Cuộn xuống cuối cuộc trò chuyện', 'Scroll to bottom'));
  if ($('closeConnectionDiagnostics')) $('closeConnectionDiagnostics').setAttribute('aria-label', uiCopy('Đóng', 'Close'));
  if ($('uiDialogClose')) $('uiDialogClose').setAttribute('aria-label', uiCopy('Đóng', 'Close'));
  document.querySelectorAll('.message-action.copy-message:not(.copied)').forEach((btn) => btn.setAttribute('aria-label', uiCopy('Sao chép', 'Copy')));
  document.querySelectorAll('.message-action.edit-message').forEach((btn) => btn.setAttribute('aria-label', uiCopy('Chỉnh sửa', 'Edit')));
  document.querySelectorAll('.message-action.rollback-message').forEach((btn) => btn.setAttribute('aria-label', uiCopy('Quay lại trước tin nhắn này', 'Revert to before this message')));
  document.querySelectorAll('.message-action.expand-response').forEach((btn) => btn.setAttribute('aria-label', uiCopy('Mở rộng câu trả lời', 'Expand response')));
  updateNarrowGuardBanner();
  renderStarterPrompts();
  syncPromptEmptyState();
  if (!$('model')?.value && $('modelLabel')) $('modelLabel').textContent = uiCopy('Chọn model', 'Select model');
  renderProfiles();
  renderHistory(allSessions);
  renderTelemetry(latestTelemetryRecords);
  updateCodexTuning();
  updateSendState();
  updateRunningScrollIndicator();
  if (!$('addMenu').classList.contains('hidden')) renderAddMenu();
  if (!$('composerMenu').classList.contains('hidden')) renderComposerMenu();
  if (latestChangesState && lastChangeCount > 0) {
    const summaryText = formatChangedFilesLabel(lastChangeCount);
    const added = (latestChangesState.changes || []).reduce((sum, change) => sum + Number(change.added || 0), 0);
    const removed = (latestChangesState.changes || []).reduce((sum, change) => sum + Number(change.removed || 0), 0);
    $('changeCount').innerHTML = escapeHtml(summaryText) + ' <b class="diff-add">+' + added + '</b> <b class="diff-remove">-' + removed + '</b>';
    $('collapsedChangeCount').innerHTML = escapeHtml(summaryText + '  ') + '<b class="diff-add">+' + added + '</b> <b class="diff-remove">-' + removed + '</b>';
    document.querySelectorAll('#changeList .tray-undo').forEach((button) => { button.textContent = activityCopy('Hoàn tác', 'Undo'); });
    document.querySelectorAll('#changeList .tray-accept').forEach((button) => { button.textContent = activityCopy('Chấp nhận', 'Accept'); });
    if (changeSummary?.isConnected) {
      const filesNode = changeSummary.querySelector('.change-summary-files');
      const undoNode = changeSummary.querySelector('.summary-undo');
      const reviewNode = changeSummary.querySelector('.summary-review');
      if (filesNode) filesNode.textContent = summaryText;
      if (undoNode) undoNode.textContent = activityCopy('Hoàn tác', 'Undo');
      if (reviewNode) reviewNode.textContent = changeSummaryExpanded ? activityCopy('Ẩn file', 'Hide files') : activityCopy('Xem file', 'Show files');
    }
  }
}

function renderTelemetry(records = []) {
  const totalInput = records.reduce((sum, item) => sum + (item.inputTokens || 0), 0);
  const totalOutput = records.reduce((sum, item) => sum + (item.outputTokens || 0), 0);
  const costs = records.filter(item => typeof item.cost === 'number').reduce((sum, item) => sum + item.cost, 0);
  const avgLatency = records.length ? Math.round(records.reduce((sum, item) => sum + (item.latencyMs || 0), 0) / records.length) : 0;
  $('telemetrySummary').innerHTML = '<div class="metric-card"><strong>' + formatCompact(totalInput + totalOutput) + '</strong><span>' + uiCopy('Tổng token', 'Total tokens') + '</span></div><div class="metric-card"><strong>' + (costs ? '$' + costs.toFixed(4) : uiCopy('Chưa có', 'Not available')) + '</strong><span>' + uiCopy('Chi phí ước tính', 'Estimated cost') + '</span></div><div class="metric-card"><strong>' + avgLatency + ' ms</strong><span>' + uiCopy('Latency trung bình', 'Average latency') + '</span></div>';
  const latest = records[0]?.rateLimit;
  $('telemetryRate').textContent = latest ? 'Rate limit · requests ' + (latest.requestsRemaining || '?') + ' / ' + (latest.requestsLimit || '?') + ' · tokens ' + (latest.tokensRemaining || '?') + ' / ' + (latest.tokensLimit || '?') + ' · reset ' + (latest.reset || '?') : uiCopy('Chưa nhận được header rate limit từ provider.', 'The provider has not returned rate-limit headers.');
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
    notice.textContent = server.name + uiCopy(' đã kết nối thành công · ', ' connected successfully · ') + (server.toolCount || 0) + uiCopy(' công cụ sẵn sàng.', ' tools ready.');
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

`;
