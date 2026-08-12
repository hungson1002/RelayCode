export const CHAT_CONTROLLER_ACTIVITY = String.raw`const activityCopy = (vi, en) => language === 'en' ? en : vi;

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
    markAssistantOutput();
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
  markAssistantOutput();
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

function workingStatusLabel(status) {
  const raw = String(status || '').trim();
  if (!raw || language !== 'en') return raw;
  if (/đang kiểm tra provider/i.test(raw)) return 'Checking provider';
  if (/mất kết nối 9router/i.test(raw)) return 'Reconnecting 9Router';
  if (/đang kiểm tra 9router/i.test(raw)) return 'Checking 9Router';
  if (/đang khởi động lại 9router/i.test(raw)) return 'Restarting 9Router';
  if (/đang chờ 9router sẵn sàng/i.test(raw)) return 'Waiting for 9Router';
  if (/đã kết nối lại 9router/i.test(raw)) return '9Router reconnected';
  if (/đang tìm trên web/i.test(raw)) return 'Searching the web';
  if (/đã nhận kết quả web/i.test(raw)) return 'Web results received';
  if (/đang chờ model/i.test(raw)) return 'Waiting for the model';
  if (/đang đọc file/i.test(raw)) return 'Reading files';
  if (/đang xem thư mục/i.test(raw)) return 'Reading the workspace';
  if (/đang phân tích file/i.test(raw)) return 'Analyzing files';
  if (/đang tìm trong dự án/i.test(raw)) return 'Searching the project';
  if (/đang kiểm tra đường dẫn/i.test(raw)) return 'Checking paths';
  if (/đang chạy lệnh/i.test(raw)) return 'Running a command';
  if (/đang chạy kiểm tra/i.test(raw)) return 'Validating changes';
  if (/đang sửa file/i.test(raw)) return 'Editing files';
  if (/đang tạo thư mục/i.test(raw)) return 'Creating a directory';
  if (/đang xóa file/i.test(raw)) return 'Deleting a file';
  if (/đang dùng/i.test(raw)) return 'Using a connected tool';
  return raw;
}

function setWorkingStatus(status) {
  if (assistantHasOutput) {
    workingStatus = '';
    updateWorkingLabel();
    return;
  }
  if (pendingAssistantText.trim()) return;
  workingStatus = workingStatusLabel(status);
  updateWorkingLabel();
}

function updateWorkingLabel(state = 'working') {
  if (!workingLabel || !turnStartedAt) return;
  const seconds = Math.max(1, Math.round((Date.now() - turnStartedAt) / 1000));
  const elapsed = formatWorkingElapsed(seconds);
  if (state === 'working' && workingStatus && !assistantHasOutput) {
    workingLabel.textContent = workingStatus + ' · ' + elapsed;
    return;
  }
  workingLabel.textContent = language === 'en'
    ? (state === 'cancelled' ? 'Stopped after ' : state === 'error' ? 'Stopped after ' : state === 'complete' ? 'Worked for ' : 'Working for ') + elapsed
    : (state === 'cancelled' ? 'Đã dừng sau ' : state === 'error' ? 'Dừng sau ' : state === 'complete' ? 'Đã làm trong ' : 'Đang làm trong ') + elapsed;
}

function startWorkingLabel() {
  if (!assistantBody) return;
  if (workingTimer) clearInterval(workingTimer);
  const turnMessage = assistantBody.closest('.message');
  const existing = turnMessage
    ? [...turnMessage.children].find((node) => node.classList.contains('worked-label') && node.classList.contains('working-live'))
    : null;
  document.querySelectorAll('.worked-label.working-live').forEach((node) => {
    if (node !== existing) node.remove();
  });
  workingLabel = existing || document.createElement('div');
  workingLabel.className = 'worked-label working-live';
  if (!workingLabel.isConnected) assistantBody.before(workingLabel);
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
  if (!turnMessage) return;
  const labels = [...turnMessage.children].filter((node) => node.classList.contains('worked-label'));
  const label = labels.at(-1);
  labels.slice(0, -1).forEach((node) => node.remove());
  const timeline = [...turnMessage.children].filter((node) => isAssistantTimelineNode(node));
  if (!label || !timeline.length) return;
  const history = document.createElement('details');
  history.className = 'worked-history';
  const summary = document.createElement('summary');
  summary.className = 'worked-label';
  summary.innerHTML = '<span class="worked-history-copy"></span><span class="worked-history-caret" aria-hidden="true">' + uiIcon('caretRight') + '</span>';
  summary.querySelector('.worked-history-copy').textContent = label.textContent || '';
  const details = document.createElement('div');
  details.className = 'worked-history-details';
  timeline.forEach((node) => {
    if (node.classList.contains('agent-activity')) {
      node.classList.add('expanded', 'archived');
      node.querySelector('.activity-toggle')?.remove();
    }
    details.append(node);
  });
  history.append(summary, details);
  label.replaceWith(history);
}

function discardTechnicalHistory(turnMessage) {
  if (!turnMessage) return;
  turnMessage.querySelectorAll('.activity-history-summary,.agent-activity,.terminal-card').forEach((node) => node.remove());
}

`;
