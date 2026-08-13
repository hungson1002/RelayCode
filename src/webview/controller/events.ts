export const CHAT_CONTROLLER_EVENTS = String.raw`$('modeTrigger').addEventListener('click', (event) => {
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
  if (activeProvider === 'omniroute') {
    vscode.postMessage({ type: 'openOmniRoute' });
    return;
  }
  setRouterLaunchState('starting', uiCopy('Đang mở 9Router', 'Opening 9Router'));
  vscode.postMessage({ type: 'startRouter' });
});
$('openDashboard').addEventListener('click', () => vscode.postMessage({ type: 'openDashboard' }));
$('openOmniRoute').addEventListener('click', () => vscode.postMessage({ type: 'openOmniRoute' }));
$('openOmniRouteCenter').addEventListener('click', () => vscode.postMessage({ type: 'openOmniRoute' }));
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
$('zoomOut').addEventListener('click', () => setLightboxZoom(lightboxZoom - 0.25));
$('zoomIn').addEventListener('click', () => setLightboxZoom(lightboxZoom + 0.25));
$('resetZoom').addEventListener('click', resetLightboxView);
$('closeImage').addEventListener('click', closeImageLightbox);
$('imageLightbox').addEventListener('click', (event) => { if (event.target === $('imageLightbox')) closeImageLightbox(); });
$('lightboxViewport').addEventListener('pointerdown', (event) => {
  if (lightboxZoom <= 1 || event.button !== 0) return;
  lightboxDragging = true;
  lightboxPointerId = event.pointerId;
  lightboxDragOffsetX = event.clientX - lightboxPanX;
  lightboxDragOffsetY = event.clientY - lightboxPanY;
  $('lightboxViewport').setPointerCapture(event.pointerId);
  $('lightboxViewport').classList.add('dragging');
  event.preventDefault();
});
$('lightboxViewport').addEventListener('pointermove', (event) => {
  if (!lightboxDragging || event.pointerId !== lightboxPointerId) return;
  lightboxPanX = event.clientX - lightboxDragOffsetX;
  lightboxPanY = event.clientY - lightboxDragOffsetY;
  updateLightboxTransform();
  event.preventDefault();
});
$('lightboxViewport').addEventListener('pointerup', stopLightboxDrag);
$('lightboxViewport').addEventListener('pointercancel', stopLightboxDrag);
$('lightboxViewport').addEventListener('wheel', (event) => {
  if ($('imageLightbox').classList.contains('hidden')) return;
  event.preventDefault();
  setLightboxZoom(lightboxZoom + (event.deltaY < 0 ? 0.25 : -0.25));
}, { passive: false });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('imageLightbox').classList.contains('hidden')) {
    event.preventDefault();
    closeImageLightbox();
  }
});
updateLightboxTransform();
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
  if (open) {
    scrollSelectedModelIntoView();
    $('modelSearch').focus();
  }
});
$('modelMenu').addEventListener('click', (event) => event.stopPropagation());
$('modelSearch').addEventListener('input', () => renderModelMenu($('modelSearch').value));
$('checkModels').addEventListener('click', (event) => {
  event.stopPropagation();
  vscode.postMessage({ type: checkingModels ? 'cancelModelCheck' : 'checkModels', ...(checkingModels ? {} : { mode }) });
});
$('profileTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('profileMenu').classList.contains('hidden');
  if (open) closeDropdowns($('profileMenu'));
  $('profileMenu').classList.toggle('hidden', !open);
  $('profilePicker').classList.toggle('open', open);
  $('profileTrigger').setAttribute('aria-expanded', String(open));
});
$('profileMenu').addEventListener('click', (event) => event.stopPropagation());
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
  const wasHidden = $('connectionDiagnostics').classList.contains('hidden');
  if (wasHidden) connectionDialogReturnFocus = document.activeElement;
  openFloatingSurface('connectionDiagnostics');
  const connectionDialog = $('connectionDiagnostics').querySelector('.connection-dialog');
  connectionDialog?.setAttribute('aria-busy', 'true');
  if (connectionDialog) connectionDialog.dataset.tone = 'neutral';
  $('connectionProviderName').textContent = meta.label;
  $('connectionProviderMark').innerHTML = brandIcon(meta.brand, meta.label);
  $('connectionEndpoint').textContent = $('configEndpoint').value.trim() || uiCopy('Chưa có endpoint', 'No endpoint');
  $('connectionDialogSubtitle').textContent = uiCopy('Đang kiểm tra ', 'Checking ') + meta.label;
  $('connectionHealthBadge').textContent = uiCopy('Đang kiểm tra', 'Checking');
  $('connectionHealthBadge').className = 'checking';
  $('connectionLatency').textContent = '-';
  $('connectionModels').textContent = '-';
  $('connectionMessage').textContent = uiCopy('Đang gửi yêu cầu kiểm tra provider…', 'Sending a provider check request…');
  $('retryDiagnostics').disabled = true;
  vscode.postMessage({ type: 'diagnostics' });
  if (wasHidden) requestAnimationFrame(() => $('closeConnectionDiagnostics').focus());
}
let connectionDialogReturnFocus = null;
function closeConnectionDiagnosticsDialog(restoreFocus = true) {
  $('connectionDiagnostics').classList.add('hidden');
  $('connectionDiagnostics').querySelector('.connection-dialog')?.setAttribute('aria-busy', 'false');
  if (restoreFocus && connectionDialogReturnFocus?.isConnected) connectionDialogReturnFocus.focus();
  connectionDialogReturnFocus = null;
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
$('closeConnectionDiagnostics').addEventListener('click', () => closeConnectionDiagnosticsDialog());
$('connectionDiagnostics').addEventListener('click', (event) => { if (event.target === $('connectionDiagnostics')) closeConnectionDiagnosticsDialog(); });
$('openConnectionSettings').addEventListener('click', () => {
  closeConnectionDiagnosticsDialog(false);
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
    if (opt.dataset.perm === 'full') requestFullAccessDialog();
    else vscode.postMessage({ type: 'setPermissionMode', mode: opt.dataset.perm });
    $('permDropdown').classList.remove('open');
    $('permMenu').classList.add('hidden');
    $('permissionMode').setAttribute('aria-expanded', 'false');
  });
});
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
  if (!$('profilePicker').contains(event.target)) {
    $('profileMenu').classList.add('hidden');
    $('profilePicker').classList.remove('open');
    $('profileTrigger').setAttribute('aria-expanded', 'false');
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
$('send').addEventListener('click', (event) => {
  event.stopPropagation();
  if (running) {
    if ((effectiveComposerPrompt() || pendingAttachmentCount) && followUpQueueEnabled) {
      send();
      return;
    }
    stopCurrentTurn();
    return;
  }
  send();
});
$('goalDock').addEventListener('click', (event) => event.stopPropagation());
$('goalDockTrigger').addEventListener('click', (event) => {
  event.stopPropagation();
  const open = $('goalRail').classList.contains('hidden');
  if (open) closeDropdowns($('goalRail'));
  $('goalRail').classList.toggle('hidden', !open);
  $('goalDock').classList.toggle('open', open);
  $('goalDockTrigger').setAttribute('aria-expanded', String(open));
});
$('goalRail').addEventListener('click', (event) => event.stopPropagation());
$('goalPause').addEventListener('click', () => {
  $('goalRail').classList.add('hidden');
  $('goalDock').classList.remove('open');
  $('goalDockTrigger').setAttribute('aria-expanded', 'false');
  vscode.postMessage({ type: 'pauseGoal' });
});
$('goalResume').addEventListener('click', () => {
  if (!$('model').value) {
    showUiToast({ message: uiCopy('Hãy chọn một model trước khi tiếp tục Goal.', 'Select a model before resuming the Goal.'), tone: 'danger' });
    openComposerModelPicker();
    return;
  }
  $('goalRail').classList.add('hidden');
  $('goalDock').classList.remove('open');
  $('goalDockTrigger').setAttribute('aria-expanded', 'false');
  setRunning(true);
  vscode.postMessage({ type: 'resumeGoal', model: $('model').value });
});
function clearComposerGoal() {
  const hadActiveGoal = Boolean(activeGoal);
  composerGoalMode = false;
  activeGoal = null;
  renderComposerTokens();
  if (hadActiveGoal) vscode.postMessage({ type: 'clearGoal' });
  $('prompt').focus();
}
goalDockQuickClear.addEventListener('click', (event) => {
  event.stopPropagation();
  clearComposerGoal();
});
$('goalClear').addEventListener('click', () => {
  clearComposerGoal();
});
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
      if (composerMenuIndex < 0) composerMenuIndex = event.key === 'ArrowDown' ? 0 : items.length - 1;
      else composerMenuIndex = (composerMenuIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
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
    if (composerContexts.length) composerContexts.pop();
    else if (composerSkills.length) composerSkills.pop();
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
  composerMenuIndex = -1;
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
  if (!pasted) return;
  event.preventDefault();
  const prompt = $('prompt');
  const start = prompt.selectionStart ?? prompt.value.length;
  const end = prompt.selectionEnd ?? start;
  prompt.setRangeText(pasted, start, end, 'end');
  resizePrompt();
  renderComposerMenu();
  updateSendState();
});

`;
