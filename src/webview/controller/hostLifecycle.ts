export const CHAT_CONTROLLER_HOST_LIFECYCLE = String.raw`window.addEventListener('message', ({ data }) => {
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
    resetChatGptWebActivityQueue();
    $('historyPanel').classList.add('hidden');
    setMode(data.mode || defaultMode);
    $('messages').replaceChildren();
    changeSummary = null;
    if (data.sessionKind === 'chatgpt-web') appendChatGptWebIntro();
    for (const [index, turn] of (data.turns || []).entries()) {
      if (turn.chatGptActivity) appendChatGptWebActivity(turn.chatGptActivity, true);
      else appendMessage(turn.role, turn.content, Boolean(turn.error), turn.timestamp, turn.attachments || [], index, turn.artifact || null);
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
    const incomingProvider = data.provider || '9router';
    const providerChanged = modelsProvider !== incomingProvider;
    if (providerChanged && modelsProvider) clearModelSelectionForProviderSwitch();
    activeProvider = incomingProvider;
    setProvider(activeProvider, false);
    if (data.endpoint) {
      $('endpoint').value = data.endpoint;
      $('configEndpoint').value = data.endpoint;
    }
    const isRouter = activeProvider === '9router';
    const isOmniRoute = activeProvider === 'omniroute';
    const isGatewayProvider = isRouter || isOmniRoute;
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
     $('openOmniRouteCenter').classList.toggle('hidden', !isOmniRoute);
     $('openOmniRouteCenter').textContent = uiCopy('Mở OmniRoute', 'Open OmniRoute');
    $('topConnectLabel').textContent = isGatewayProvider
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
    $('setupEndpointLabel').textContent = data.endpoint || $('configEndpoint').value.trim() || uiCopy('Chưa có endpoint', 'No endpoint');
     $('setupTitle').textContent = isGatewayProvider ? uiCopy('Mở ' + providerName + '.', 'Open ' + providerName + '.') : uiCopy('Kết nối ' + providerName + '.', 'Connect ' + providerName + '.');
     $('setupCopy').textContent = isRouter
       ? uiCopy('Kiểm tra hoặc cài 9Router rồi mở bảng điều khiển. Không cần API key để mở trang quản lý.', 'Check or install 9Router, then open its dashboard. An API key is not required to open the management page.')
       : isOmniRoute
         ? uiCopy('Mở dashboard OmniRoute để quản lý provider và model. OmniRoute phải đang chạy ở cổng 20128.', 'Open the OmniRoute dashboard to manage providers and models. OmniRoute must be running on port 20128.')
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
      $('openOmniRouteCenter').classList.toggle('hidden', !isOmniRoute);
      $('retryConnection').classList.remove('hidden');
      $('topConnect').classList.remove('attention');
    } else {
      $('startRouter').classList.toggle('hidden', !isGatewayProvider);
      $('openDashboard').classList.add('hidden');
      $('openOmniRouteCenter').classList.add('hidden');
      $('openCockpitCenter').classList.toggle('hidden', activeProvider !== 'cockpit');
      $('disconnectConnection').classList.add('hidden');
      $('retryConnection').classList.remove('hidden');
       if (!launchingRouter) setRouterLaunchState('idle', isRouter ? uiCopy('9Router chưa chạy · bấm Mở 9Router', '9Router is not running · click Open 9Router') : uiCopy(providerName + ' chưa kết nối', providerName + ' is not connected'));
    }
    const select = $('model');
    const previous = providerChanged ? '' : select.value;
    const previousWasAuto = !providerChanged && modelSelectionSource === 'auto' && previous === lastAutoModel;
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
    const rememberedModel = !providerChanged && composerPreferences.models?.[mode] && [...select.options].some((option) => option.value === composerPreferences.models[mode])
      ? composerPreferences.models[mode]
      : '';
    const preferred = previous || rememberedModel || configuredDefault || smartModelForMode(mode);
    if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
    else if (select.options.length > 1) select.selectedIndex = 1;
    modelSelectionSource = previousWasAuto || (!previous && !rememberedModel && !configuredDefault) ? 'auto' : 'manual';
    lastAutoModel = modelSelectionSource === 'auto' ? select.value : '';
    const selectedLabel = select.selectedOptions[0]?.textContent || uiCopy('Chọn model', 'Select model');
    $('modelLabel').textContent = selectedLabel;
    $('modelBrand').innerHTML = select.value ? brandIcon(brandKey(select.value, activeProvider), selectedLabel) : '';
    renderModelMenu();
    modelsProvider = incomingProvider;
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
  } else if (data.type === 'modelSwitched') {
    const option = [...$('model').options].find((item) => item.value === data.model);
    if (option) {
      $('model').value = data.model;
      modelSelectionSource = 'manual';
      lastAutoModel = '';
      $('modelLabel').textContent = option.textContent || data.model;
      $('modelBrand').innerHTML = brandIcon(brandKey(data.model, activeProvider), option.textContent || data.model);
      renderModelMenu($('modelSearch').value);
      updateCodexTuning();
    }
  } else if (data.type === 'contextBudget') {
    const meter = $('contextMeter');
    const percent = Math.min(100, Math.round(((data.used || 0) / Math.max(1, data.limit || 1)) * 100));
    meter.querySelector('i').style.width = percent + '%';
    meter.classList.toggle('compacted', Boolean(data.compacted));
  } else if (data.type === 'chatGptWebActivity') {
    appendChatGptWebActivity(data.activity);
  } else if (data.type === 'notice') {
    appendMessage('assistant', data.message, false, Date.now());
  } else if (data.type === 'recoveredTurn') {
    if (running) return;
    document.querySelectorAll('.recovery-card').forEach((card) => card.remove());
    $('messages').querySelector('.empty')?.remove();
    setRunning(false);
    const item = document.createElement('article'); item.className = 'recovery-card';
    item.dataset.runId = data.runId || '';
    const lastStatus = data.checkpoint?.lastStatus || uiCopy('Tác vụ bị gián đoạn khi IDE reload.', 'The task was interrupted when the IDE reloaded.');
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
    if (data.status) setWorkingStatus(data.status);
    else if (!workingStatus) workingStatus = uiCopy('Đang tiếp tục tác vụ', 'Resuming the task');
    if (!workingLabel) startWorkingLabel();
    setRunning(true);
    updateActivity(data.status || uiCopy('Đang tiếp tục tác vụ', 'Resuming the task'));
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
    renderModelMenu();
    scrollSelectedModelIntoView();
    $('modelSearch').focus();
  } else if (data.type === 'configSaved') {
    $('configEndpoint').value = data.endpoint;
    const nextProvider = data.provider || '9router';
    if (activeProvider !== nextProvider) clearModelSelectionForProviderSwitch();
    activeProvider = nextProvider;
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
    $('connectionEndpoint').textContent = data.endpoint || uiCopy('Chưa có endpoint', 'No endpoint');
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
    currentProfileId = data.profile?.id || currentProfileId;
    checkingModels = false;
    modelHealth = {};
    modelHealthMode = '';
    $('checkModels').textContent = uiCopy('Kiá»ƒm tra model', 'Check models');
    $('checkModels').classList.remove('checking');
    applyProfileUi(data.profile);
    const nextProvider = data.profile?.kind || '9router';
    if (activeProvider !== nextProvider) clearModelSelectionForProviderSwitch();
    activeProvider = nextProvider;
    updateConnectionBadge(providerMeta[activeProvider]?.label || activeProvider, 'checking');
    $('configApiKey').value = '';
    $('keyState').textContent = data.hasApiKey ? uiCopy('Đã lưu API key an toàn', 'API key stored securely') : uiCopy('Chưa lưu API key', 'No API key saved');
    $('keyState').classList.toggle('saved', data.hasApiKey);
`;
