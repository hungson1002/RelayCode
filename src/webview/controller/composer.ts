export const CHAT_CONTROLLER_COMPOSER = String.raw`function renderGoal(goal) {
  activeGoal = goal || null;
  const rail = $('goalRail');
  rail.classList.toggle('hidden', !activeGoal);
  if (!activeGoal) return;
  const state = activeGoal.status || 'ready';
  rail.dataset.state = state;
  $('goalTitle').textContent = activeGoal.objective;
  $('goalStatus').textContent = activeGoal.lastStatus || (state === 'running' ? uiCopy('Đang làm việc', 'Working') : state === 'paused' ? uiCopy('Đã tạm dừng', 'Paused') : state === 'failed' ? uiCopy('Cần xử lý', 'Needs attention') : uiCopy('Sẵn sàng để review', 'Ready for review'));
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
  updateTaskChoiceButtons();
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
    renderMarkdownInto(assistantBody, uiCopy('Đã dừng.', 'Stopped.'));
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
  workingStatus = '';
  assistantHasOutput = false;
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
    document.querySelectorAll('.message.complete > .agent-activity').forEach((node) => node.remove());
    pendingAssistantText = '';
    pendingTurnEnd = null;
    turnStartedAt = 0;
    assistantBody = null;
    assistantActivity = null;
    pendingActivityStatus = '';
    assistantHasOutput = false;
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
  const hasPrompt = Boolean($('prompt').value.trim() || pendingAttachmentCount || composerSkills.length || composerContexts.length || composerGoalMode || composerCommand);
  $('send').disabled = running ? false : !hasPrompt;
  $('send').classList.toggle('queue-ready', running && hasPrompt && followUpQueueEnabled);
  $('send').setAttribute('aria-label', running
    ? (hasPrompt && followUpQueueEnabled ? uiCopy('Gửi vào hàng chờ', 'Queue message') : uiCopy('Dừng phản hồi', 'Stop response'))
    : uiCopy('Gửi', 'Send'));
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
  document.querySelector('.composer-shell')?.classList.toggle('has-input', Boolean(prompt.value.trim() || pendingAttachmentCount || composerSkills.length || composerContexts.length || composerGoalMode || composerCommand));
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
  token.setAttribute('aria-label', uiCopy('Bỏ ' + label, 'Remove ' + label));
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
  const hasTokens = Boolean(composerCommand) || composerGoalMode || composerSkills.length > 0 || composerContexts.length > 0;
  $('composerInput').classList.toggle('has-tokens', hasTokens);
  updateComposerPlaceholder();
  updateSendState();
}

function resetComposerTokens() {
  composerGoalMode = false;
  composerCommand = null;
  composerSkills = [];
  composerContexts = [];
  renderComposerTokens();
}

function effectiveComposerPrompt() {
  if (composerCommand) {
    const argument = $('prompt').value.trim();
    return composerCommand.key === '/browser' && argument
      ? composerCommand.key + ' ' + argument
      : composerCommand.key;
  }
  const parts = [
    ...composerSkills.map((skill) => '$' + skill.name),
    ...composerContexts,
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
    ['/terminal', uiCopy('Mở terminal tương tác của workspace', 'Open the interactive workspace terminal'), 'Terminal', 'terminal'],
    ['/browser', uiCopy('Điều khiển browser thật bằng Playwright', 'Control a real browser with Playwright'), 'Browser Agent', 'globe'],
    ['/chatgpt', uiCopy('Kết nối project với ChatGPT Web', 'Connect this project to ChatGPT Web'), 'ChatGPT Web', 'link'],
    ['/pr', uiCopy('Review GitHub pull request', 'Review a GitHub pull request'), 'GitHub PR', 'gitDiff'],
    ['/schedule', uiCopy('Quản lý tác vụ Agent định kỳ', 'Manage scheduled Agent tasks'), 'Scheduled tasks', 'clockCounterClockwise'],
    ['/plugins', uiCopy('Mở plugin và skill đã cài', 'Open installed plugins and skills'), 'Plugins', 'cube'],
    ['/hooks', uiCopy('Cấu hình hook trước/sau Agent', 'Configure before/after Agent hooks'), 'Hooks', 'arrowsClockwise'],
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
      } else if (item.kind === 'mention') {
        replaceComposerTrigger(trigger, item.key);
        $('prompt').focus();
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
      } else if (item.kind === 'command') {
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
  const composerPrompt = effectiveComposerPrompt();
  const prompt = composerPrompt;
  if (!prompt && !pendingAttachmentCount) return;
  const model = $('model').value;
  const browserTask = composerCommand?.key === '/browser' && Boolean(rawPrompt);
  const standaloneCommand = (Boolean(composerCommand) && !browserTask) || (!composerGoalMode && !composerSkills.length && !composerContexts.length && rawPrompt.startsWith('/') && !/^\/browser\s+\S/i.test(rawPrompt));
  if (!model && !standaloneCommand) { showUiToast({ message: uiCopy('Hãy chọn một model trước khi gửi.', 'Select a model before sending.'), tone: 'danger' }); return; }
  const selected = $('model').selectedOptions[0];
  if ((mode === 'agent' || browserTask) && selected?.dataset.tools === 'false') { showUiToast({ message: uiCopy('Model này không hỗ trợ tools nên không thể chạy Agent mode. Hãy chuyển sang Chat hoặc chọn model khác.', 'This model does not support tools and cannot run Agent mode. Switch to Chat or choose another model.'), tone: 'danger' }); return; }
  if ((mode === 'agent' || browserTask) && ['error', 'limited'].includes(modelHealth[model]?.status)) {
    showUiToast({ message: uiCopy('Model này đã thất bại khi kiểm tra tool-call của Agent. Hãy chọn model có dấu ✓ hoặc kiểm tra lại sau.', 'This model failed the Agent tool-call check. Choose a model with ✓ or check again later.'), tone: 'danger' });
    return;
  }
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
  pendingAttachmentCount = 0;
  $('attachmentList').replaceChildren();
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
`;
