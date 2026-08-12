export const CHAT_CONTROLLER_TRANSCRIPT = String.raw`function showSetup(show) {
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
  $('startRouter').textContent = launchingRouter ? message : activeProvider === '9router' ? uiCopy('Mở 9Router', 'Open 9Router') : activeProvider === 'omniroute' ? uiCopy('Mở OmniRoute', 'Open OmniRoute') : uiCopy('Kết nối ' + providerName, 'Connect ' + providerName);
  $('signalMap').classList.toggle('launching', launchingRouter);
  $('signalMap').classList.toggle('ready', state === 'ready');
  document.querySelector('.launch-panel').classList.toggle('launching', launchingRouter);
  document.querySelector('.launch-panel').classList.toggle('ready', state === 'ready');
  if (message) $('launchTitle').textContent = message;
}

function formatTime(value = Date.now()) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

let lightboxZoom = 1;
let lightboxPanX = 0;
let lightboxPanY = 0;
let lightboxDragging = false;
let lightboxPointerId = null;
let lightboxDragOffsetX = 0;
let lightboxDragOffsetY = 0;

function clampLightboxZoom(value) {
  return Math.min(4, Math.max(0.5, Math.round(value * 4) / 4));
}

function updateLightboxTransform() {
  const image = $('lightboxImage');
  image.style.transform = 'translate(' + lightboxPanX + 'px, ' + lightboxPanY + 'px) scale(' + lightboxZoom + ')';
  $('zoomLabel').textContent = Math.round(lightboxZoom * 100) + '%';
  $('zoomOut').disabled = lightboxZoom <= 0.5;
  $('zoomIn').disabled = lightboxZoom >= 4;
  $('resetZoom').disabled = lightboxZoom === 1 && lightboxPanX === 0 && lightboxPanY === 0;
  $('lightboxViewport').classList.toggle('can-pan', lightboxZoom > 1);
}

function resetLightboxView() {
  lightboxZoom = 1;
  lightboxPanX = 0;
  lightboxPanY = 0;
  updateLightboxTransform();
}

function setLightboxZoom(value) {
  const nextZoom = clampLightboxZoom(value);
  if (nextZoom === lightboxZoom) return;
  lightboxZoom = nextZoom;
  if (lightboxZoom <= 1) {
    lightboxPanX = 0;
    lightboxPanY = 0;
  }
  updateLightboxTransform();
}

function openImage(source) {
  $('lightboxImage').src = source;
  resetLightboxView();
  $('imageLightbox').classList.remove('hidden');
  requestAnimationFrame(() => $('zoomIn').focus());
}

function stopLightboxDrag() {
  lightboxDragging = false;
  $('lightboxViewport').classList.remove('dragging');
  if (lightboxPointerId !== null) {
    try { $('lightboxViewport').releasePointerCapture(lightboxPointerId); } catch { /* pointer may already be released */ }
    lightboxPointerId = null;
  }
}

function closeImageLightbox() {
  stopLightboxDrag();
  $('imageLightbox').classList.add('hidden');
  resetLightboxView();
}

function createUserAttachmentLabel(name) {
  const file = document.createElement('span');
  file.className = 'user-file';
  file.innerHTML = fileTypeIcon(name) + '<span>' + escapeHtml(name) + '</span>';
  return file;
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
        const fallback = createUserAttachmentLabel(attachment.name);
        img.replaceWith(fallback);
      };
      img.addEventListener('error', handleImageError);
      gallery.append(img);
    } else {
      gallery.append(createUserAttachmentLabel(attachment.name));
    }
  }
  item.append(gallery);
}

function renderHistory(sessions = []) {
  allSessions = sessions;
  $('historyPanel').classList.toggle('expanded', historyExpanded);
  $('historyTitle').textContent = historyExpanded ? uiCopy('Tất cả lịch sử', 'All history') : uiCopy('Lịch sử chat', 'Chat history');
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
    const button = document.createElement('button'); button.type = 'button'; button.className = 'history-item' + (session.kind === 'chatgpt-web' ? ' chatgpt-web-history-item' : '');
    const title = document.createElement('span');
    if (session.kind === 'chatgpt-web') title.innerHTML = '<i aria-hidden="true">' + uiIcon('globe') + '</i><b>ChatGPT Web</b>';
    else title.textContent = session.title;
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
  return uiIcon(kind === 'edit' ? 'pencilSimple' : kind);
}

function chatGptActivityPresentation(tool, ok) {
  const name = String(tool || '');
  if (!ok) return { icon: 'warning', title: uiCopy('Không thực hiện được', 'Action failed'), tone: 'failed' };
  if (/^read_/.test(name)) return { icon: 'file', title: uiCopy('Đã đọc file', 'Read file'), tone: 'read' };
  if (/^search_/.test(name)) return { icon: 'magnifyingGlass', title: uiCopy('Đã tìm trong project', 'Searched project'), tone: 'read' };
  if (/^(?:write_|apply_)/.test(name)) return { icon: 'pencilSimple', title: uiCopy('Đã sửa file', 'Edited file'), tone: 'changed' };
  if (/^delete_/.test(name)) return { icon: 'trash', title: uiCopy('Đã xóa file', 'Deleted file'), tone: 'changed' };
  if (/^run_/.test(name)) return { icon: 'terminalWindow', title: uiCopy('Đã chạy lệnh', 'Ran command'), tone: 'command' };
  if (/^list_/.test(name)) return { icon: 'listSearch', title: uiCopy('Đã xem workspace', 'Inspected workspace'), tone: 'read' };
  return { icon: 'globe', title: uiCopy('Đã dùng RelayCode', 'Used RelayCode'), tone: 'read' };
}

let pendingChatGptWebActivities = [];
let chatGptWebActivityTimer = 0;

function createChatGptWebActivity(activity) {
  document.querySelector('.empty')?.remove();
  const info = chatGptActivityPresentation(activity?.tool, activity?.ok !== false);
  const item = document.createElement('article');
  item.className = 'chatgpt-web-activity ' + info.tone;
  item.innerHTML = '<span class="chatgpt-web-rail" aria-hidden="true"></span><span class="chatgpt-web-activity-icon" aria-hidden="true">' + uiIcon(info.icon) + '</span><div class="chatgpt-web-activity-copy"><div><strong></strong><time></time></div><p></p><small></small></div>';
  item.querySelector('strong').textContent = info.title;
  item.querySelector('time').textContent = formatTime(activity?.timestamp || Date.now());
  item.querySelector('p').textContent = activity?.summary || activity?.tool || '';
  item.querySelector('small').textContent = (activity?.tool || '') + (Number.isFinite(activity?.durationMs) ? ' · ' + activity.durationMs + ' ms' : '');
  return item;
}

function flushChatGptWebActivities() {
  chatGptWebActivityTimer = 0;
  if (!pendingChatGptWebActivities.length) return;
  const messageList = $('messages');
  const shouldFollow = messagesPinnedToBottom || messagesAreNearBottom();
  const fragment = document.createDocumentFragment();
  for (const activity of pendingChatGptWebActivities.splice(0)) {
    fragment.append(createChatGptWebActivity(activity));
  }
  messageList.append(fragment);
  if (shouldFollow) {
    messagesPinnedToBottom = true;
    messageList.scrollTop = messageList.scrollHeight;
  }
  updateRunningScrollIndicator();
}

function resetChatGptWebActivityQueue() {
  if (chatGptWebActivityTimer) clearTimeout(chatGptWebActivityTimer);
  chatGptWebActivityTimer = 0;
  pendingChatGptWebActivities = [];
}

function appendChatGptWebActivity(activity, immediate = false) {
  if (immediate) {
    const item = createChatGptWebActivity(activity);
    $('messages').append(item);
    return item;
  }
  pendingChatGptWebActivities.push(activity);
  if (!chatGptWebActivityTimer) {
    chatGptWebActivityTimer = setTimeout(() => requestAnimationFrame(flushChatGptWebActivities), 72);
  }
  return null;
}

function appendChatGptWebIntro() {
  const intro = document.createElement('header');
  intro.className = 'chatgpt-web-intro';
  intro.innerHTML = '<span aria-hidden="true">' + uiIcon('globe') + '</span><div><strong>ChatGPT Web</strong><p></p></div>';
  intro.querySelector('p').textContent = uiCopy('Hoạt động công cụ trong project. Nội dung trò chuyện trên ChatGPT không được MCP chia sẻ.', 'Tool activity in this project. MCP does not share the ChatGPT conversation text.');
  $('messages').append(intro);
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
  button.setAttribute('aria-label', uiCopy('Đã sao chép', 'Copied'));
  setTimeout(() => {
    button.classList.remove('copied');
    button.setAttribute('aria-label', uiCopy('Sao chép', 'Copy'));
  }, 1200);
}

function beginMessageEdit(item, body, content, turnIndex) {
  if (running || item.classList.contains('editing')) return;
  item.classList.add('editing');
  const editor = document.createElement('div');
  editor.className = 'message-editor';
  const input = document.createElement('textarea');
  input.value = content;
  input.setAttribute('aria-label', uiCopy('Chỉnh sửa tin nhắn', 'Edit message'));
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
    const text = document.createElement('div');
    text.className = 'sent-prompt-copy';
    renderMarkdownInto(text, copy);
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
  copy.setAttribute('aria-label', uiCopy('Sao chép', 'Copy'));
  copy.innerHTML = messageActionIcon('copy');
  copy.addEventListener('click', () => void copyMessageText(copy, item.dataset.rawContent || content));
  actions.append(copy);
  if (role === 'user' && Number.isInteger(turnIndex)) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'message-action edit-message';
    edit.setAttribute('aria-label', uiCopy('Chỉnh sửa', 'Edit'));
    edit.innerHTML = messageActionIcon('edit');
    edit.addEventListener('click', () => beginMessageEdit(item, body, content, turnIndex));
    actions.append(edit);
  }
  if (role === 'assistant') {
    detachedAssistantResponseActions = null;
    const responseActions = document.createElement('div');
    responseActions.className = 'assistant-response-actions';
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'message-action expand-response';
    expand.setAttribute('aria-label', uiCopy('Mở rộng câu trả lời', 'Expand response'));
    expand.innerHTML = messageActionIcon('arrowsOut');
    expand.addEventListener('click', () => vscode.postMessage({ type: 'openAssistantResponse', content: item.dataset.rawContent || content }));
    responseActions.append(copy, expand, label);
    item.append(body, responseActions);
  } else {
    actions.append(copy);
    meta.append(label, actions);
    item.append(body, meta);
  }
  appendMessageAttachments(item, attachments);
  appendPlanArtifact(item, artifact, turnIndex);
  $('messages').append(item);
  scrollMessagesToBottom();
  return body;
}

function placeAssistantResponseActionsAfterChangeSummary() {
  if (!changeSummary?.isConnected) return;
  const messageList = $('messages');
  messageList.append(changeSummary);
  const latestAssistant = [...messageList.querySelectorAll('.message.assistant')].at(-1);
  const responseActions = latestAssistant?.querySelector('.assistant-response-actions') || detachedAssistantResponseActions;
  if (!responseActions) return;
  detachedAssistantResponseActions = responseActions;
  changeSummary.after(responseActions);
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
  const card = document.createElement('details');
  card.className = 'activity-history-summary edit-history turn-change-summary';
  const header = document.createElement('summary');
  header.innerHTML = '<span class="activity-history-icon" aria-hidden="true">' + uiIcon('pencilSimple') + '</span><span class="activity-history-copy"></span><span class="edit-history-stats"></span><span class="activity-history-caret" aria-hidden="true">' + uiIcon('caretRight') + '</span>';
  header.querySelector('.activity-history-copy').textContent = changes.length === 1
    ? activityCopy('Đã sửa file', 'Edited file')
    : activityCopy('Đã sửa file', 'Edited files') + ' · ' + changes.length;
  const added = changes.reduce((sum, change) => sum + Number(change.added || 0), 0);
  const removed = changes.reduce((sum, change) => sum + Number(change.removed || 0), 0);
  header.querySelector('.edit-history-stats').innerHTML = '<b class="diff-add">+' + added + '</b><b class="diff-remove">-' + removed + '</b>';
  const preview = document.createElement('div');
  preview.className = 'activity-history-details edit-history-details';
  for (const change of changes) {
    const entry = document.createElement('details');
    entry.className = 'edited-file-entry turn-change-file';
    entry.dataset.changeId = change.id;
    const entrySummary = document.createElement('summary');
    entrySummary.innerHTML = fileTypeIcon(change.path) + '<span>' + escapeHtml(change.path) + '</span><small><b class="diff-add">+' + Number(change.added || 0) + '</b><b class="diff-remove">-' + Number(change.removed || 0) + '</b></small><i aria-hidden="true">' + uiIcon('caretRight') + '</i>';
    const inline = document.createElement('div');
    inline.className = 'edited-file-preview loading';
    inline.textContent = activityCopy('Mở để tải bản xem trước…', 'Open to load preview…');
    const openDiff = document.createElement('button');
    openDiff.type = 'button';
    openDiff.className = 'edited-file-open';
    openDiff.textContent = activityCopy('Mở diff đầy đủ', 'Open full diff');
    openDiff.addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }));
    entry.addEventListener('toggle', () => {
      entrySummary.querySelector('i').innerHTML = uiIcon(entry.open ? 'caretDown' : 'caretRight');
      if (entry.open && !entry.dataset.previewRequested) {
        entry.dataset.previewRequested = 'true';
        inline.textContent = activityCopy('Đang tải diff…', 'Loading diff…');
        vscode.postMessage({ type: 'previewChange', id: change.id });
      }
    });
    entry.append(entrySummary, inline, openDiff);
    preview.append(entry);
  }
  card.addEventListener('toggle', () => {
    header.querySelector('.activity-history-caret').innerHTML = uiIcon(card.open ? 'caretDown' : 'caretRight');
  });
  card.append(header, preview);
  const workedDetails = item.querySelector('.worked-history-details');
  if (workedDetails) workedDetails.append(card);
  else item.insertBefore(card, item.querySelector('.body,.assistant-response-actions,.message-meta'));
}

function renderChangePreview(data) {
  document.querySelectorAll('.edited-file-entry').forEach((entry) => {
    if (entry.dataset.changeId !== data.id) return;
    const preview = entry.querySelector('.edited-file-preview');
    if (!preview) return;
    preview.classList.remove('loading');
    preview.replaceChildren();
    if (data.binary) {
      preview.textContent = activityCopy('File nhị phân · mở diff đầy đủ để xem.', 'Binary file · open the full diff to inspect it.');
      return;
    }
    const hunks = data.hunks || [];
    if (!hunks.length) {
      preview.textContent = activityCopy('Không có dòng nội dung nào thay đổi.', 'No content lines changed.');
      return;
    }
    const code = document.createElement('div');
    code.className = 'edited-file-code';
    for (const hunk of hunks) {
      const marker = document.createElement('div');
      marker.className = 'edited-file-line hunk';
      marker.textContent = '@@ -' + hunk.originalStart + ' +' + hunk.updatedStart + ' @@';
      code.append(marker);
      hunk.before.forEach((line, index) => {
        const row = document.createElement('div');
        row.className = 'edited-file-line removed';
        row.innerHTML = '<span>' + (hunk.originalStart + index) + '</span><code></code>';
        row.querySelector('code').textContent = line || ' ';
        code.append(row);
      });
      hunk.after.forEach((line, index) => {
        const row = document.createElement('div');
        row.className = 'edited-file-line added';
        row.innerHTML = '<span>' + (hunk.updatedStart + index) + '</span><code></code>';
        row.querySelector('code').textContent = line || ' ';
        code.append(row);
      });
    }
    preview.append(code);
    if (data.truncated) {
      const note = document.createElement('div');
      note.className = 'edited-file-truncated';
      note.textContent = activityCopy('Bản xem trước đã rút gọn · mở diff đầy đủ để xem tất cả.', 'Preview truncated · open the full diff to see everything.');
      preview.append(note);
    }
  });
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

`;
