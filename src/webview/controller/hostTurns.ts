export const CHAT_CONTROLLER_HOST_TURNS = String.raw`  } else if (data.type === 'turnStart') {
    document.querySelectorAll('.recovery-card').forEach((card) => card.remove());
    mode = data.mode;
    turnToolCount = 0;
    resetThinkingBlock();
    followUpQueueEnabled = true;
    turnStartedAt = data.timestamp || Date.now();
    assistantHasOutput = false;
    workingStatus = data.mode === 'chat'
      ? uiCopy('Đang kết nối model', 'Connecting to model')
      : data.mode === 'plan'
        ? uiCopy('Đang lập kế hoạch', 'Planning the next steps')
        : uiCopy('Đang phân tích yêu cầu', 'Analyzing the request');
    flushAssistantText();
    assistantRawText = '';
    assistantStreamTextNode = null;
    assistantMarkdownRenderedLength = 0;
    assistantActivity = null;
    pendingActivityStatus = '';
    activityReadyAfterCommentary = false;
    activeTerminal = null;
    activeCommandGroup = null;
    activitySteps = new Map();
    pendingTurnEnd = null;
    pendingCompletedChangesState = null;
    changeSummary = null;
    detachedAssistantResponseActions = null;
    if (!data.resume) {
      appendMessage('user', data.prompt, false, data.timestamp, data.attachments || [], data.turnIndex);
    }
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
    const lastKeptTurn = [...$('messages').querySelectorAll('.message[data-turn-index]')].at(-1);
    let trailing = lastKeptTurn ? lastKeptTurn.nextElementSibling : $('messages').firstElementChild;
    while (trailing) {
      const next = trailing.nextElementSibling;
      trailing.remove();
      trailing = next;
    }
    assistantBody = null;
    assistantRawText = '';
    assistantStreamTextNode = null;
    assistantMarkdownRenderedLength = 0;
    assistantActivity = null;
    pendingActivityStatus = '';
    activityReadyAfterCommentary = false;
    activeTerminal = null;
    activeCommandGroup = null;
    activitySteps = new Map();
    changeSummary = null;
    detachedAssistantResponseActions = null;
    if (workingTimer) clearInterval(workingTimer);
    workingTimer = null;
    workingLabel = null;
    workingStatus = '';
    assistantHasOutput = false;
  } else if (data.type === 'commentary') {
    appendAgentCommentary(data.content);
  } else if (data.type === 'intermediateStep') {
    archiveStreamedProgress(data.content);
  } else if (data.type === 'activityComplete') {
    finalizeLiveActivity();
  } else if (data.type === 'delta') {
    queueAssistantText(data.delta);
  } else if (data.type === 'thinkingDelta') {
    appendThinkingDelta(data.delta);
  } else if (data.type === 'status') {
    if (running) {
      setWorkingStatus(data.message);
      updateActivity(data.message);
      if (activeGoal?.status === 'running') $('goalStatus').textContent = data.message;
    }
  } else if (data.type === 'toolOutput') {
    appendTerminalOutput(data);
  } else if (data.type === 'toolEvent') {
    recordToolEvent(data.event);
  } else if (data.type === 'turnEnd') {
    // Provider deltas are batched per animation frame; only wait if the final
    // reconciliation still has text queued for the current render frame.
    finishThinkingBlock();
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
    composerGoalMode = false;
    resetComposerTokens();
    renderFollowUpQueue();
    renderGoal(null);
    setMode(composerPreferences.lastMode || defaultMode);
    const emptyDescription = mode === 'agent'
      ? uiCopy('Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.', 'Agent can read the project, edit files and run commands in the workspace.')
      : mode === 'plan'
      ? uiCopy('Agent sẽ đọc workspace và lập kế hoạch trước khi hành động.', 'Agent will inspect the workspace and plan before acting.')
      : uiCopy('Trò chuyện trực tiếp với model đang chọn.', 'Chat directly with the selected model.');
     $('messages').innerHTML = '<div class="empty"><div class="empty-emblem" aria-hidden="true"><span></span></div><h2>' + uiCopy('Nói điều bạn muốn xây.', 'Describe what you want to build.') + '</h2><p>' + uiCopy('Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.', 'Agent can read the project, edit files and run commands in the workspace.') + '</p></div>';
    const emptyCard = $('messages').querySelector('.empty');
    const emptyState = emptyCard?.querySelector('p');
    if (emptyState) emptyState.textContent = emptyDescription;
    if (emptyCard) {
      const starterHost = document.createElement('div');
      starterHost.id = 'starterPrompts';
      starterHost.className = 'starter-prompts';
      emptyCard.append(starterHost);
    }
    renderStarterPrompts();
    syncPromptEmptyState();
    resetThinkingBlock();
    updateContextBar(0, 120000, false);
    turnToolCount = 0;
    if (workingTimer) clearInterval(workingTimer);
    workingTimer = null;
    workingLabel = null;
    workingStatus = '';
    turnStartedAt = 0;
    assistantBody = null;
    assistantRawText = '';
    assistantStreamTextNode = null;
    assistantMarkdownRenderedLength = 0;
    assistantActivity = null;
    pendingTurnEnd = null;
    pendingCompletedChangesState = null;
    changeSummary = null;
    detachedAssistantResponseActions = null;
    if (modelListRecoveryTimer) clearTimeout(modelListRecoveryTimer);
    modelListRecoveryTimer = 0;
    modelListRecoveryRequested = false;
    lastChangeCount = 0;
    lastPendingChangeCount = 0;
    latestChangesState = null;
    knownChangeSnapshots = new Map();
    resolvedChangeSnapshots = new Map();
    changesHidden = false;
    $('changeTray').classList.add('hidden');
    $('collapsedChanges').classList.add('hidden');
    setRunning(false);
  } else if (data.type === 'error') {
    flushAssistantText();
    finalizeLiveActivity();
    if (workingTimer) clearInterval(workingTimer);
    workingTimer = null;
    workingLabel?.classList.remove('working-live');
    workingLabel = null;
    workingStatus = '';
    document.querySelectorAll('.message.streaming').forEach((item) => {
      item.classList.remove('streaming');
      item.classList.add('complete');
    });
    const isRouterProvider = activeProvider === '9router';
    const currentProviderName = providerMeta[activeProvider]?.label || activeProvider;
    setRouterLaunchState(
      'idle',
      isRouterProvider
        ? uiCopy('9Router chưa chạy', '9Router is not running')
        : uiCopy(currentProviderName + ' chưa kết nối', currentProviderName + ' is not connected')
    );
    $('launchDescription').textContent = isRouterProvider
      ? uiCopy('Không cần mở terminal hoặc chuyển sang trình duyệt.', 'No terminal or browser switching is required.')
      : uiCopy('Kiểm tra endpoint, API key hoặc trạng thái dịch vụ rồi thử lại.', 'Check the endpoint, API key or service status, then try again.');
    showError(data.message);
    showUiToast({ message: data.message, tone: 'danger' });
    setRunning(false);
  }
});

setMode('chat');
setPermissionMode('ask');
resizePrompt();
applyLanguageUi();
requestBootstrap();
`;
