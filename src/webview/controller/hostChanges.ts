export const CHAT_CONTROLLER_HOST_CHANGES = String.raw`  } else if (data.type === 'changesState') {
    const tray = $('changeTray');
    const collapsed = $('collapsedChanges');
    const messageList = $('messages');
    const shouldFollowChanges = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 90;
    const pendingChanges = data.changes || [];
    for (const change of pendingChanges) {
      knownChangeSnapshots.set(change.id, change);
      resolvedChangeSnapshots.delete(change.id);
    }
    // Only unresolved files belong in the live tray above the composer.
    // Resolved snapshots are retained for transcript history, but must not
    // keep an empty/disabled tray visible after Accept or Undo.
    const allChanges = pendingChanges;
    const nextChangeCount = allChanges.length;
    lastPendingChangeCount = pendingChanges.length;
    if (running) pendingCompletedChangesState = data;
    if (!nextChangeCount || !lastChangeCount) changesHidden = false;
    lastChangeCount = nextChangeCount;
    // Keep the review tray stable across turn completion. It remains visible
    // until the user hides it or resolves every pending change.
    tray.classList.toggle('hidden', !nextChangeCount || changesHidden);
    collapsed.classList.toggle('hidden', !nextChangeCount || !changesHidden);
    const displayAdded = allChanges.reduce((sum, change) => sum + change.added, 0);
    const displayRemoved = allChanges.reduce((sum, change) => sum + change.removed, 0);
    const fileSummary = nextChangeCount + ' ' + (nextChangeCount === 1 ? 'file' : 'files') + ' changed';
    $('changeCount').innerHTML = escapeHtml(fileSummary) + ' <b class="diff-add">+' + displayAdded + '</b> <b class="diff-remove">-' + displayRemoved + '</b>';
    $('collapsedChangeCount').innerHTML = escapeHtml(fileSummary + '  ') + '<b class="diff-add">+' + displayAdded + '</b> <b class="diff-remove">-' + displayRemoved + '</b>';
    const list = $('changeList'); list.replaceChildren();
    let renderedTask = '';
    let renderedChanges = 0;
    const renderChangeBatch = () => {
      list.querySelector('.change-list-more')?.remove();
      const nextChanges = allChanges.slice(renderedChanges, renderedChanges + 60);
      for (const change of nextChanges) {
        if (change.taskId && change.taskId !== renderedTask) {
          renderedTask = change.taskId;
          const taskLabel = document.createElement('div'); taskLabel.className = 'task-group-label';
          const title = document.createElement('span'); title.textContent = uiCopy('Tác vụ ', 'Task ') + change.taskId.replace(/^task-/, '').split('-')[0];
          taskLabel.append(title);
          list.append(taskLabel);
        }
        const resolved = Boolean(change.resolution);
        const row = document.createElement('div');
        row.className = 'change-row change-row-review' + (resolved ? ' is-resolved' : '');
        row.dataset.changeId = change.id;
        const file = document.createElement('button');
        file.type = 'button';
        file.className = 'change-file';
        file.innerHTML = fileTypeIcon(change.path) + '<span>' + escapeHtml(change.path) + '</span>';
        const stats = document.createElement('span');
        stats.className = 'change-row-stats';
        stats.innerHTML = '<b class="diff-add">+' + change.added + '</b> <b class="diff-remove">-' + change.removed + '</b>' + (resolved ? '<em>' + escapeHtml(change.resolution === 'accepted' ? activityCopy('Đã chấp nhận', 'Accepted') : activityCopy('Đã hoàn tác', 'Undone')) + '</em>' : '');
        const actions = document.createElement('span');
        actions.className = 'change-row-actions';
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'tray-undo';
        undo.textContent = activityCopy('Hoàn tác', 'Undo');
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'tray-accept';
        accept.textContent = activityCopy('Chấp nhận', 'Accept');
        actions.append(undo, accept);
        file.addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }));
        undo.addEventListener('click', (event) => {
          event.stopPropagation();
          vscode.postMessage({ type: 'undoChange', id: change.id });
        });
        accept.addEventListener('click', (event) => {
          event.stopPropagation();
          vscode.postMessage({ type: 'acceptChange', id: change.id });
        });
        if (resolved) {
          file.disabled = true;
          undo.disabled = true;
          accept.disabled = true;
        }
        row.append(file, stats, actions);
        list.append(row);
      }
      renderedChanges += nextChanges.length;
      if (renderedChanges < allChanges.length) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'change-list-more';
         more.textContent = uiCopy('Hiện thêm ', 'Show ') + Math.min(60, allChanges.length - renderedChanges) + uiCopy(' file', ' files');
        more.addEventListener('click', renderChangeBatch);
        list.append(more);
      }
      updateChangeActionState();
    };
    renderChangeBatch();
    updateChangeActionState();
    const pendingChangeIds = new Set(pendingChanges.map((change) => change.id));
    const hasInlineChangeSummary = [...document.querySelectorAll('.turn-change-file')]
      .some((row) => pendingChangeIds.has(row.dataset.changeId));
    if (data.changes?.length && !running && !hasInlineChangeSummary) {
      if (!changeSummary) {
        changeSummary = document.createElement('article');
        changeSummary.className = 'chat-change-summary collapsed';
        changeSummary.innerHTML = '<header><span class="change-summary-icon" aria-hidden="true">' + uiIcon('files') + '</span><span class="change-summary-copy"><strong><span class="change-summary-files"></span></strong><small class="change-summary-stats"><b class="diff-add"></b><b class="diff-remove"></b></small></span><span class="change-summary-actions"><button class="summary-undo" type="button">Undo</button><button class="summary-review" type="button">Show files</button></span></header><div class="change-summary-preview"></div>';
        $('messages').append(changeSummary);
      }
      const setSummaryExpanded = (expanded) => {
        changeSummaryExpanded = expanded;
        changeSummary.classList.toggle('collapsed', !expanded);
        changeSummary.querySelector('.summary-review').textContent = expanded ? activityCopy('Ẩn file', 'Hide files') : activityCopy('Xem file', 'Show files');
      };
      const reviewButton = changeSummary.querySelector('.summary-review');
      reviewButton.onclick = () => setSummaryExpanded(!changeSummaryExpanded);
      changeSummary.querySelector('.summary-undo').onclick = () => vscode.postMessage({ type: 'undoAllChanges' });
      changeSummary.querySelector('.change-summary-files').textContent = fileSummary;
      changeSummary.querySelector('.change-summary-stats .diff-add').textContent = '+' + data.added;
      changeSummary.querySelector('.change-summary-stats .diff-remove').textContent = '-' + data.removed;
      changeSummary.querySelector('.change-summary-copy').onclick = () => setSummaryExpanded(!changeSummaryExpanded);
      const preview = changeSummary.querySelector('.change-summary-preview');
      preview.replaceChildren();
      for (const change of (data.changes || [])) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'change-summary-file';
        row.innerHTML = fileTypeIcon(change.path) + '<span>' + escapeHtml(change.path) + '</span><small><b class="diff-add">+' + change.added + '</b> <b class="diff-remove">-' + change.removed + '</b></small>';
        row.addEventListener('click', () => vscode.postMessage({ type: 'reviewChange', id: change.id }));
        preview.append(row);
      }
      setSummaryExpanded(changeSummaryExpanded);
      placeAssistantResponseActionsAfterChangeSummary();
      updateChangeActionState();
    }
    if (shouldFollowChanges && !running) messageList.scrollTop = messageList.scrollHeight;
`;
