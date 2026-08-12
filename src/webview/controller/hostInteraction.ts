export const CHAT_CONTROLLER_HOST_INTERACTION = String.raw`  } else if (data.type === 'approval') {
    const item = document.createElement('article');
    item.className = 'permission-card permission-card-v2';
    item.dataset.approvalKey = [data.kind, data.title, data.message, data.command || ''].join('|');
    const duplicate = [...document.querySelectorAll('.permission-card-v2')]
      .find((card) => card.dataset.approvalKey === item.dataset.approvalKey);
    if (duplicate) return;

    const heading = document.createElement('header');
    const icon = document.createElement('span');
    icon.className = 'permission-icon';
    icon.innerHTML = uiIcon(data.kind === 'command' ? 'terminalWindow' : 'shieldWarning');
    const title = document.createElement('span');
    title.className = 'permission-title';
    title.textContent = data.title || (data.kind === 'command'
      ? 'Terminal'
      : (language === 'en' ? 'Permission required' : 'Cần bạn cho phép'));
    const copy = document.createElement('p');
    copy.className = 'permission-copy';
    copy.textContent = data.message || 'RelayCode needs your permission.';
    const permissionText = document.createElement('div');
    permissionText.className = 'permission-text';
    permissionText.append(title, copy);
    heading.append(icon, permissionText);
    item.append(heading);

    if (data.command) {
      const command = document.createElement('pre');
      command.className = 'permission-command';
      command.textContent = data.command;
      item.append(command);
    }

    const actions = document.createElement('footer');
    actions.className = 'permission-actions';
    const deny = document.createElement('button');
    deny.type = 'button';
    deny.className = 'permission-deny';
    deny.textContent = language === 'en' ? 'Deny' : 'Từ chối';

    const allowWrap = document.createElement('div');
    allowWrap.className = 'permission-allow-wrap';
    const allowOnce = document.createElement('button');
    allowOnce.type = 'button';
    allowOnce.className = 'permission-allow-once';
    allowOnce.textContent = language === 'en' ? 'Allow once' : 'Cho phép';
    allowWrap.append(allowOnce);

    const finishApproval = (decision) => {
      vscode.postMessage({ type: 'approval', id: data.id, decision });
      item.remove();
      updateRunningScrollIndicator();
    };

    if (data.allowSimilar || data.allowAlways) {
      const menuTrigger = document.createElement('button');
      menuTrigger.type = 'button';
      menuTrigger.className = 'permission-menu-trigger';
      menuTrigger.setAttribute('aria-label', language === 'en' ? 'More permission options' : 'Tùy chọn cấp quyền');
      menuTrigger.setAttribute('aria-haspopup', 'menu');
      menuTrigger.setAttribute('aria-expanded', 'false');
      menuTrigger.innerHTML = uiIcon('caretDown');
      const allowMenu = document.createElement('div');
      allowMenu.className = 'permission-menu hidden';
      allowMenu.setAttribute('role', 'menu');
      if (data.allowSimilar) {
        const similar = document.createElement('button');
        similar.type = 'button';
        similar.className = 'permission-similar';
        similar.setAttribute('role', 'menuitem');
        const similarLabel = document.createElement('span');
        similarLabel.textContent = language === 'en' ? 'Allow similar commands' : 'Cho phép lệnh tương tự';
        const similarInfo = document.createElement('span');
        similarInfo.innerHTML = uiIcon('info');
        similar.append(similarLabel, similarInfo);
        allowMenu.append(similar);
        similar.addEventListener('click', () => finishApproval('similar'));
      }
      if (data.allowAlways) {
        const always = document.createElement('button');
        always.type = 'button';
        always.className = 'permission-always';
        always.setAttribute('role', 'menuitem');
        const alwaysLabel = document.createElement('span');
        alwaysLabel.textContent = language === 'en' ? 'Always allow file edits' : 'Luôn cho phép sửa file';
        const alwaysInfo = document.createElement('span');
        alwaysInfo.innerHTML = uiIcon('check');
        always.append(alwaysLabel, alwaysInfo);
        allowMenu.append(always);
        always.addEventListener('click', () => finishApproval('always'));
      }
      allowWrap.append(menuTrigger, allowMenu);
      menuTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const opening = allowMenu.classList.contains('hidden');
        if (opening) closeDropdowns(allowMenu);
        allowMenu.classList.toggle('hidden', !opening);
        menuTrigger.setAttribute('aria-expanded', String(opening));
      });
    }

    actions.append(deny, allowWrap);
    item.append(actions);
    allowOnce.addEventListener('click', () => finishApproval('once'));
    deny.addEventListener('click', () => finishApproval('deny'));
    item.addEventListener('click', (event) => event.stopPropagation());
    $('messages').append(item);
    if (messagesPinnedToBottom) scrollMessagesToBottom();
    else updateRunningScrollIndicator();
  } else if (data.type === 'toolFailure') {
    const item = document.createElement('article'); item.className = 'tool-failure-card';
    item.dataset.toolFailureId = data.id;
    item.innerHTML = '<small>' + escapeHtml(data.tool) + ' · ' + uiCopy('lần ', 'attempt ') + data.attempt + '</small><strong>' + uiCopy('Tool chưa hoàn thành', 'Tool did not complete') + '</strong><span>' + escapeHtml(data.message) + '</span><div><button class="tool-retry">' + uiCopy('Thử lại', 'Retry') + '</button><button class="tool-change-model">' + uiCopy('Đổi model', 'Change model') + '</button><button class="tool-skip">' + uiCopy('Bỏ qua', 'Skip') + '</button></div>';
    const finish = (action, model) => {
      if (pendingToolFailureId === data.id) pendingToolFailureId = '';
      vscode.postMessage({ type: 'resolveToolFailure', id: data.id, action, model });
      item.remove();
    };
    item.querySelector('.tool-retry').addEventListener('click', () => finish('retry'));
    item.querySelector('.tool-change-model').addEventListener('click', () => {
      pendingToolFailureId = data.id;
      favoriteModelsAtMenuOpen = [...favoriteModels];
      $('modelMenu').classList.remove('hidden');
      $('modelPicker').classList.add('open');
      $('modelTrigger').setAttribute('aria-expanded', 'true');
      renderModelMenu();
      scrollSelectedModelIntoView();
      $('modelSearch').focus();
    });
    item.querySelector('.tool-skip').addEventListener('click', () => finish('skip'));
    $('messages').append(item); $('messages').scrollTop = $('messages').scrollHeight;
  } else if (data.type === 'changeOperation') {
    changeOperationBusy = Boolean(data.busy);
    updateChangeActionState();
  } else if (data.type === 'changePreview') {
    renderChangePreview(data);
  } else if (data.type === 'changeResolved') {
    for (const id of data.ids || []) {
      const snapshot = knownChangeSnapshots.get(id);
      if (snapshot) resolvedChangeSnapshots.set(id, { ...snapshot, resolution: data.action });
    }
`;
