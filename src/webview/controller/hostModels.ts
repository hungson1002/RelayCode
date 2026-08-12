export const CHAT_CONTROLLER_HOST_MODELS = String.raw`  } else if (data.type === 'modelRuntimeFailure') {
    if (data.profileId && data.profileId !== currentProfileId) return;
    if (!data.mode || data.mode === mode) {
      const limited = /HTTP 429|rate.?limit|timeout|timed out|quĂ¡ thá»i gian/i.test(data.message || '');
      modelHealth[data.model] = { status: limited ? 'limited' : 'error', message: data.message || '' };
      renderModelMenu($('modelSearch').value);
    }
  } else if (data.type === 'modelCheckStart') {
    if (data.profileId && data.profileId !== currentProfileId) return;
    checkingModels = true;
    modelHealth = {};
    modelHealthMode = data.mode || mode;
     $('checkModels').textContent = uiCopy('Đang kiểm tra 0/' + data.total + ' · Bấm để hủy', 'Checking 0/' + data.total + ' · Click to cancel');
    $('checkModels').classList.add('checking');
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'modelCheck') {
    if (data.profileId && data.profileId !== currentProfileId) return;
    if (!data.mode || data.mode === mode) modelHealth[data.model] = { status: data.status, message: data.message || (data.latencyMs ? 'OK · ' + data.latencyMs + ' ms' : '') };
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'modelCheckProgress') {
    if (data.profileId && data.profileId !== currentProfileId) return;
     $('checkModels').textContent = uiCopy('Đang kiểm tra ' + data.completed + '/' + data.total + ' · Bấm để hủy', 'Checking ' + data.completed + '/' + data.total + ' · Click to cancel');
  } else if (data.type === 'modelCheckEnd') {
    if (data.profileId && data.profileId !== currentProfileId) return;
    checkingModels = false;
     $('checkModels').textContent = data.cancelled ? uiCopy('Đã hủy · Kiểm tra lại', 'Canceled · Check again') : uiCopy('Kiểm tra model', 'Check models');
    $('checkModels').classList.remove('checking');
    renderModelMenu($('modelSearch').value);
  } else if (data.type === 'telemetry') {
    latestTelemetryRecords = data.records || [];
    renderTelemetry(latestTelemetryRecords);
    updateCodexTuning();
  } else if (data.type === 'mcpServers') {
    renderMcpServers(data.servers || [], data.presets || []);
    syncPendingMcpOutcome(data.servers || []);
  } else if (data.type === 'mcpOutcome') {
    renderMcpOutcome(data);
  } else if (data.type === 'checkpoint') {
    const card = document.createElement('article'); card.className = 'checkpoint-card';
    card.innerHTML = '<span>' + uiCopy('Git checkpoint đã tạo · ', 'Git checkpoint created · ') + data.checkpoint.hash + '</span><button>' + uiCopy('Khôi phục', 'Restore') + '</button>';
    card.querySelector('button').addEventListener('click', () => vscode.postMessage({ type: 'restoreCheckpoint', id: data.checkpoint.id }));
    $('messages').append(card); $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'checkpointRestored') {
    appendMessage('assistant', uiCopy('Đã khôi phục workspace về Git checkpoint ', 'Workspace restored to Git checkpoint ') + data.hash + '.', false, Date.now());
  } else if (data.type === 'localRuntime') {
    if (data.message) { $('diagnosticsResult').textContent = data.message; $('diagnosticsResult').className = 'diagnostics-result ' + (data.serverRunning || data.models?.length ? 'success' : 'checking'); }
  } else if (data.type === 'permissionMode') {
    setPermissionMode(data.mode);
  } else if (data.type === 'routerLaunch') {
    setRouterLaunchState(data.progress, data.message);
     $('launchDescription').textContent = data.progress === 'checking'
       ? uiCopy('Đang kiểm tra dịch vụ cục bộ.', 'Checking the local service.')
       : data.progress === 'waiting'
         ? uiCopy('Quá trình chạy nền, bạn có thể tiếp tục dùng IDE.', 'This runs in the background; you can keep using the IDE.')
         : uiCopy('Không cần mở terminal. Một nút là đủ để bắt đầu.', 'No terminal required. One click is enough to start.');
    if (data.progress === 'stopped') {
      $('startRouter').classList.remove('hidden');
      $('openDashboard').classList.add('hidden');
      $('retryConnection').classList.add('hidden');
      $('connectionToggle').classList.add('hidden');
      $('disconnectConnection').classList.add('hidden');
      $('openCockpitCenter').classList.add('hidden');
      $('topConnect').classList.add('attention');
    }
  } else if (data.type === 'browserOpened') {
     const openedProvider = providerMeta[activeProvider]?.label || activeProvider;
     setRouterLaunchState('ready', uiCopy('Đã mở ' + openedProvider, openedProvider + ' opened'));
     $('launchDescription').textContent = uiCopy(openedProvider + ' đang chạy. Trình duyệt đã mở trang quản lý.', openedProvider + ' is running. The dashboard is open in your browser.');
    showError('');
  } else if (data.type === 'attachmentLoading') {
    $('attachmentProgress').classList.toggle('hidden', !data.active);
    $('attach').disabled = Boolean(data.active);
  } else if (data.type === 'attachments') {
    pendingAttachmentCount = Array.isArray(data.attachments) ? data.attachments.length : 0;
    const list = $('attachmentList');
    list.replaceChildren();
    for (const [index, item] of (data.attachments || []).entries()) {
      const initialPreview = item.preview || item.modelPreview;
      if (initialPreview) {
        const preview = document.createElement('div'); preview.className = 'attachment-preview';
        const image = document.createElement('img'); image.src = initialPreview; image.alt = item.name;
        image.addEventListener('click', () => openImage(image.currentSrc || initialPreview));
        let triedModelPreview = false;
        const handleImageError = () => {
          if (!triedModelPreview && item.modelPreview && item.modelPreview !== image.src) {
            triedModelPreview = true;
            image.src = item.modelPreview;
            return;
          }
          image.removeEventListener('error', handleImageError);
          preview.replaceChildren();
          const chip = document.createElement('span'); chip.className = 'attachment-chip';
          chip.innerHTML = fileTypeIcon(item.name) + '<span>' + escapeHtml(item.name) + '</span>';
          preview.classList.add('attachment-preview-fallback');
          preview.append(chip);
          const remove = document.createElement('button'); remove.type = 'button'; remove.innerHTML = uiIcon('x'); remove.setAttribute('aria-label', uiCopy('Bỏ ảnh đính kèm', 'Remove attached image'));
          remove.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'removeAttachment', index }); });
          preview.append(remove);
        };
        image.addEventListener('error', handleImageError);
        const remove = document.createElement('button'); remove.type = 'button'; remove.innerHTML = uiIcon('x'); remove.setAttribute('aria-label', uiCopy('Bỏ ảnh đính kèm', 'Remove attached image'));
        remove.addEventListener('click', (event) => { event.stopPropagation(); vscode.postMessage({ type: 'removeAttachment', index }); });
        preview.append(image, remove); list.append(preview); continue;
      }
      const chip = document.createElement('span');
      chip.className = 'attachment-chip';
      chip.innerHTML = fileTypeIcon(item.name) + '<span>' + escapeHtml(item.name) + '</span>';
      const remove = document.createElement('button');
      remove.type = 'button'; remove.innerHTML = uiIcon('x'); remove.setAttribute('aria-label', uiCopy('Bỏ tệp đính kèm', 'Remove attached file'));
      remove.addEventListener('click', () => vscode.postMessage({ type: 'removeAttachment', index }));
      chip.append(remove); list.append(chip);
    }
    resizePrompt();
    updateSendState();
  } else if (data.type === 'turnReady') {
    queuedFollowUpReady = true;
    if (!running && queuedFollowUps.length) runNextQueuedFollowUp();
`;
