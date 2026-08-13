export const CHAT_CONTROLLER_MODELS = String.raw`function updateComposerPlaceholder() {
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
  const modeChanged = mode !== next;
  mode = next;
  if (modeChanged) {
    modelHealth = {};
    modelHealthMode = next;
    renderModelMenu($('modelSearch')?.value || '');
  }
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

function clearModelSelectionForProviderSwitch() {
  modelHealth = {};
  modelHealthMode = '';
  modelSelectionSource = 'auto';
  lastAutoModel = '';
  const select = $('model');
  select.replaceChildren(new Option(uiCopy('Đang tải model…', 'Loading models…'), ''));
  $('modelLabel').textContent = uiCopy('Đang tải model…', 'Loading models…');
  $('modelBrand').innerHTML = '';
  renderModelMenu('');
  updateCodexTuning();
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
    omniroute: 'Local gateway · automatic routing',
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
  $('setupTitle').textContent = next === '9router' || next === 'omniroute' ? uiCopy('Mở ' + meta.label + '.', 'Open ' + meta.label + '.') : uiCopy('Kết nối ' + meta.label + '.', 'Connect ' + meta.label + '.');
  $('setupCopy').textContent = next === '9router'
    ? uiCopy('Kiểm tra hoặc cài 9Router rồi mở bảng điều khiển. Không cần API key để mở trang quản lý.', 'Check or install 9Router, then open its dashboard. An API key is not required to open the management page.')
    : next === 'ollama' || next === 'lm-studio'
      ? uiCopy('Provider local không cần API key, nhưng ứng dụng, model và API server phải đang chạy trên máy.', 'A local provider needs no API key, but its app, model and API server must be running.')
      : next === 'omniroute'
        ? uiCopy('Mở dashboard OmniRoute để quản lý provider và model. OmniRoute phải đang chạy ở cổng 20128.', 'Open the OmniRoute dashboard to manage providers and models. OmniRoute must be running on port 20128.')
        : uiCopy('Mở Cài đặt để kiểm tra endpoint và API key của provider này.', 'Open Settings to check this provider endpoint and API key.');
  $('setupEndpointLabel').textContent = $('configEndpoint').value.trim() || meta.endpoint || uiCopy('Chưa có endpoint', 'No endpoint');
  $('apiKeyLabel').textContent = meta.keyLabel;
  document.querySelectorAll('#providerMenu .provider-option').forEach(option => option.classList.toggle('active', option.dataset.provider === next));
  const keyInput = $('configApiKey');
  keyInput.disabled = meta.local;
   keyInput.placeholder = meta.local ? uiCopy('Provider local không dùng API key', 'Local providers do not use an API key') : uiCopy('Nhập key mới hoặc để trống để giữ key đã lưu', 'Enter a new key or leave blank to keep the saved key');
  $('apiKeyField').classList.toggle('local', meta.local);
  $('openCockpit').classList.toggle('hidden', next !== 'cockpit');
  $('openOmniRoute').classList.toggle('hidden', next !== 'omniroute');
  $('openOmniRoute').textContent = uiCopy('Mở OmniRoute', 'Open OmniRoute');
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
  $('setupEndpointLabel').textContent = $('configEndpoint').value.trim() || meta.endpoint || uiCopy('Chưa có endpoint', 'No endpoint');
  $('startRouter').textContent = next === '9router' ? uiCopy('Mở 9Router', 'Open 9Router') : next === 'omniroute' ? uiCopy('Mở OmniRoute', 'Open OmniRoute') : uiCopy('Kết nối ' + meta.label, 'Connect ' + meta.label);
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
  if (minutes < 1) return uiCopy('sắp reset', 'resetting soon');
  if (minutes < 60) return minutes + uiCopy(' phút', ' min');
  const hours = Math.ceil(minutes / 60);
  return hours < 24 ? hours + uiCopy(' giờ', ' hr') : Math.ceil(hours / 24) + uiCopy(' ngày', ' days');
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

let modelHealthTooltip = null;
let modelHealthTooltipTarget = null;

function hideModelHealthTooltip() {
  modelHealthTooltip?.classList.remove('visible');
  modelHealthTooltipTarget = null;
}

function positionModelHealthTooltip() {
  if (!modelHealthTooltip || !modelHealthTooltipTarget || !modelHealthTooltip.classList.contains('visible')) return;
  const targetRect = modelHealthTooltipTarget.getBoundingClientRect();
  const tooltipRect = modelHealthTooltip.getBoundingClientRect();
  const edge = 8;
  const left = Math.max(edge, Math.min(window.innerWidth - tooltipRect.width - edge, targetRect.left + targetRect.width / 2 - tooltipRect.width / 2));
  const above = targetRect.top - tooltipRect.height - edge >= edge;
  const top = above ? targetRect.top - tooltipRect.height - edge : Math.min(window.innerHeight - tooltipRect.height - edge, targetRect.bottom + edge);
  modelHealthTooltip.style.left = Math.round(left) + 'px';
  modelHealthTooltip.style.top = Math.round(Math.max(edge, top)) + 'px';
}

function showModelHealthTooltip(target, message) {
  if (!modelHealthTooltip) {
    modelHealthTooltip = document.createElement('div');
    modelHealthTooltip.className = 'model-health-tooltip';
    modelHealthTooltip.setAttribute('role', 'tooltip');
    document.body.append(modelHealthTooltip);
  }
  modelHealthTooltipTarget = target;
  modelHealthTooltip.textContent = message;
  modelHealthTooltip.classList.add('visible');
  positionModelHealthTooltip();
}

window.addEventListener('resize', positionModelHealthTooltip);

function scrollSelectedModelIntoView() {
  const selected = $('modelOptions').querySelector('.model-option.active');
  if (!selected) return;
  window.requestAnimationFrame(() => {
    if (!$('modelMenu').classList.contains('hidden')) {
      selected.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  });
}

function renderModelMenu(query = '') {
  hideModelHealthTooltip();
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
  if (!options.length) {
    const empty = document.createElement('div');
    empty.className = 'model-empty';
    empty.innerHTML = uiIcon('circlesThree');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = needle ? uiCopy('Không tìm thấy model', 'No models found') : uiCopy('Đang chờ danh sách model', 'Waiting for the model list');
    const detail = document.createElement('small');
    detail.textContent = needle ? uiCopy('Thử một từ khóa khác.', 'Try a different search.') : uiCopy('Kiểm tra kết nối provider nếu danh sách chưa xuất hiện.', 'Check the provider connection if the list does not appear.');
    copy.append(title, detail);
    empty.append(copy);
    list.append(empty);
    return;
  }
  for (const option of options) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'model-option'; button.setAttribute('role', 'option');
    const selected = option.value === $('model').value;
    const healthStatus = modelHealth[option.value]?.status || '';
    const icon = document.createElement('span'); icon.className = 'model-brand'; icon.innerHTML = brandIcon(brandKey(option.value, activeProvider), option.text);
    const healthHint = healthStatus === 'ok'
      ? uiCopy('Model đã phản hồi đúng theo chế độ hiện tại.', 'The model responded correctly for the current mode.')
      : healthStatus === 'limited'
        ? uiCopy('! Model bị timeout hoặc rate limit tạm thời; không có nghĩa là model hỏng. Hãy thử lại sau.', '! The model timed out or was rate-limited temporarily; this does not necessarily mean it is broken. Try again later.')
        : healthStatus === 'error'
          ? mode === 'agent'
            ? uiCopy('Model không trả về tool-call Agent. Model có thể vẫn dùng được ở Chat.', 'No Agent tool-call was returned. This model may still work in Chat mode.')
            : uiCopy('Model không phản hồi đúng theo chế độ hiện tại.', 'The model did not respond correctly for the current mode.')
          : healthStatus === 'checking'
            ? uiCopy('Đang kiểm tra model…', 'Checking model…')
            : uiCopy('Chưa kiểm tra model.', 'Model has not been checked.');
    const health = document.createElement('span'); health.className = 'model-health has-glyph';
    const healthGlyph = document.createElement('span'); healthGlyph.className = 'model-health-glyph ' + healthStatus;
    healthGlyph.textContent = healthStatus === 'ok' ? '✓' : healthStatus === 'error' ? '×' : healthStatus === 'limited' ? '!' : '';
    healthGlyph.setAttribute('aria-label', healthHint); healthGlyph.tabIndex = 0;
    healthGlyph.addEventListener('mouseenter', () => showModelHealthTooltip(healthGlyph, healthHint));
    healthGlyph.addEventListener('mouseleave', hideModelHealthTooltip);
    healthGlyph.addEventListener('focus', () => showModelHealthTooltip(healthGlyph, healthHint));
    healthGlyph.addEventListener('blur', hideModelHealthTooltip);
    health.append(healthGlyph);
    const label = document.createElement('span'); label.className = 'model-option-label'; label.textContent = option.text;
    const meta = document.createElement('small'); meta.className = 'model-option-meta';
    const healthMessage = modelHealth[option.value]?.message || '';
    const latency = healthMessage.match(/(\d+)\s*ms/i)?.[1];
    meta.textContent = healthStatus === 'limited'
      ? uiCopy('Tạm giới hạn · thử lại sau', 'Temporarily limited · retry later')
      : healthStatus === 'error'
        ? mode === 'agent'
          ? uiCopy('Agent tool-call không thành công', 'Agent tool-call failed')
          : uiCopy('Kiểm tra không thành công', 'Check failed')
        : option.dataset.tools === 'false'
          ? 'Chat only'
          : (option.dataset.reasoning === 'true' ? uiCopy('Agent · reasoning', 'Agent · reasoning') : 'Agent') + (latency ? ' · ' + latency + ' ms' : '');
    const copy = document.createElement('span'); copy.className = 'model-option-copy'; copy.append(label, meta);
    const favorite = document.createElement('span'); favorite.className = 'model-favorite' + (favoriteModels.includes(option.value) ? ' active' : ''); favorite.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7a1.75 1.75 0 0 1 1.75 1.75v16L12 17.5l-5.25 3.25v-16Z"/></svg>'; const favoriteHint = favoriteModels.includes(option.value) ? uiCopy('Bỏ dấu model', 'Remove model bookmark') : uiCopy('Đánh dấu model', 'Bookmark model'); favorite.setAttribute('aria-label', favoriteHint); favorite.setAttribute('role', 'button'); favorite.tabIndex = 0;
    favorite.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'toggleFavoriteModel', model: option.value }); });
    favorite.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); favorite.click(); } });
    button.append(icon, copy, health, favorite);
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
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
  const list = $('profileMenu'); list.replaceChildren();
  const selected = profiles.find((profile) => profile.id === currentProfileId);
  $('activeProfileLabel').textContent = selected?.name || uiCopy('Chưa chọn hồ sơ', 'No profile selected');
  for (const profile of profiles) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'profile-option'; button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(profile.id === currentProfileId));
    const name = document.createElement('strong'); name.textContent = profile.name;
    const detail = document.createElement('small'); detail.textContent = providerMeta[profile.kind]?.label || profile.kind;
    button.append(name, detail);
    button.classList.toggle('active', profile.id === currentProfileId);
    button.addEventListener('click', (event) => { event.stopPropagation(); closeDropdowns(); vscode.postMessage({ type: 'activateProfile', id: profile.id }); });
    list.append(button);
  }
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

`;
