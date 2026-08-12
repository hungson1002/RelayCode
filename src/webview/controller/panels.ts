export const CHAT_CONTROLLER_PANELS = String.raw`function renderTelemetry(records = []) {
  const totalInput = records.reduce((sum, item) => sum + (item.inputTokens || 0), 0);
  const totalOutput = records.reduce((sum, item) => sum + (item.outputTokens || 0), 0);
  const costs = records.filter(item => typeof item.cost === 'number').reduce((sum, item) => sum + item.cost, 0);
  const avgLatency = records.length ? Math.round(records.reduce((sum, item) => sum + (item.latencyMs || 0), 0) / records.length) : 0;
  $('telemetrySummary').innerHTML = '<div class="metric-card"><strong>' + formatCompact(totalInput + totalOutput) + '</strong><span>' + uiCopy('Tổng token', 'Total tokens') + '</span></div><div class="metric-card"><strong>' + (costs ? '$' + costs.toFixed(4) : uiCopy('Chưa có', 'Not available')) + '</strong><span>' + uiCopy('Chi phí ước tính', 'Estimated cost') + '</span></div><div class="metric-card"><strong>' + avgLatency + ' ms</strong><span>' + uiCopy('Latency trung bình', 'Average latency') + '</span></div>';
  const latest = records[0]?.rateLimit;
  $('telemetryRate').textContent = latest ? 'Rate limit · requests ' + (latest.requestsRemaining || '?') + ' / ' + (latest.requestsLimit || '?') + ' · tokens ' + (latest.tokensRemaining || '?') + ' / ' + (latest.tokensLimit || '?') + ' · reset ' + (latest.reset || '?') : uiCopy('Chưa nhận được header rate limit từ provider.', 'The provider has not returned rate-limit headers.');
  const list = $('telemetryList'); list.replaceChildren();
  for (const item of records.slice(0, 40)) {
    const row = document.createElement('div'); row.className = 'telemetry-row';
    row.innerHTML = '<span class="telemetry-model"><span class="telemetry-brand">' + brandIcon(brandKey(item.model, item.provider), item.model) + '</span><span><strong>' + escapeHtml(item.model) + '</strong><small>' + escapeHtml(item.profileName) + ' · ' + formatTime(item.timestamp) + '</small></span></span><b>' + formatCompact((item.inputTokens || 0) + (item.outputTokens || 0)) + ' tok</b><small>' + (item.latencyMs || 0) + ' ms</small>';
    list.append(row);
  }
}

function mcpIcon(kind) {
  return brandIcons[kind === 'stitch' ? 'google' : kind] || brandIcons.mcp;
}

function renderMcpCatalog(presets = [], servers = []) {
  const catalog = $('mcpCatalog'); catalog.replaceChildren();
  for (const preset of presets) {
    const server = servers.find(item => item.catalogId === preset.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mcp-card' + (server?.connected ? ' connected' : server?.authPending ? ' pending' : server?.error ? ' failed' : '');
    const cardStatus = server?.connected
      ? (server.toolCount || 0) + uiCopy(' công cụ sẵn sàng', ' tools ready')
      : server?.authPending
        ? uiCopy('Đang chờ đăng nhập', 'Waiting for sign-in')
          : server?.error
            ? server.error
          : server?.hasToken
          ? uiCopy('Có API key · cần kết nối lại', 'API key saved · reconnect required')
          : preset.description;
    card.innerHTML = '<span class="mcp-brand-icon">' + mcpIcon(preset.icon) + '</span><span class="mcp-card-copy"><strong>' + escapeHtml(preset.name) + '</strong><small>' + escapeHtml(cardStatus) + '</small></span><i class="mcp-card-state"></i>';
    card.addEventListener('click', () => {
      if (server?.connected) return;
      if (preset.authMode === 'api-key') {
        vscode.postMessage({ type: server ? 'configureMcpApiKey' : 'installMcpPreset', ...(server ? { id: server.id } : { presetId: preset.id }) });
        return;
      }
      if (server?.authMode === 'none') vscode.postMessage({ type: 'reconnectMcp', id: server.id });
      else if (server?.hasOAuthTokens) vscode.postMessage({ type: 'loginMcp', id: server.id });
      else vscode.postMessage({ type: 'installMcpPreset', presetId: preset.id });
    });
    catalog.append(card);
  }
}

function renderMcpOutcome(data) {
  const notice = $('mcpConnectionNotice');
  notice.dataset.serverId = data.serverId || '';
  notice.textContent = data.message || '';
  notice.className = 'mcp-connection-notice ' + (data.tone || 'neutral');
  notice.classList.toggle('hidden', !data.message);
  if (data.message) showUiToast({ message: data.message, tone: data.tone || 'neutral' });
}

function syncPendingMcpOutcome(servers) {
  const notice = $('mcpConnectionNotice');
  if (!notice.classList.contains('warning') || !notice.dataset.serverId) return;
  const server = servers.find((item) => item.id === notice.dataset.serverId);
  if (!server || server.authPending) return;
  if (server.connected) {
    notice.textContent = server.name + uiCopy(' đã kết nối thành công · ', ' connected successfully · ') + (server.toolCount || 0) + uiCopy(' công cụ sẵn sàng.', ' tools ready.');
    notice.className = 'mcp-connection-notice success';
  } else if (server.error) {
    notice.textContent = uiCopy('Không thể kết nối ', 'Unable to connect to ') + server.name + ': ' + server.error;
    notice.className = 'mcp-connection-notice danger';
  }
}

function renderMcpServers(servers = [], presets = []) {
  mcpServerState = servers;
  mcpPresetState = presets;
  renderMcpCatalog(presets, servers);
  const list = $('mcpList'); list.replaceChildren();
  if (!servers.length) { list.innerHTML = '<div class="mcp-empty">' + escapeHtml(uiCopy('Chọn một dịch vụ ở trên hoặc thêm MCP riêng.', 'Choose a service above or add a custom MCP.')) + '</div>'; return; }
  for (const server of servers) {
    const row = document.createElement('div'); row.className = 'mcp-row' + (server.error ? ' has-error' : '');
    const main = document.createElement('div'); main.className = 'mcp-row-main';
    const iconKind = presets.find(item => item.id === server.catalogId)?.icon || 'mcp';
    const icon = document.createElement('span'); icon.className = 'mcp-brand-icon'; icon.innerHTML = mcpIcon(iconKind);
    const info = document.createElement('span');
    const stateText = server.connected
      ? (server.toolCount || 0) + uiCopy(' công cụ · Đã kết nối', ' tools · Connected')
      : server.error
        ? server.error
      : server.authPending
        ? uiCopy('Đang chờ đăng nhập trên trình duyệt', 'Waiting for browser sign-in')
        : server.hasOAuthTokens
          ? uiCopy('Cần kết nối lại', 'Reconnect required')
          : server.authMode === 'oauth' ? uiCopy('Chưa đăng nhập', 'Not signed in') : uiCopy('Ngoại tuyến', 'Offline');
    info.innerHTML = '<strong>' + escapeHtml(server.name) + '</strong><small>' + escapeHtml(stateText) + '</small>';
    main.append(icon, info);

    const actions = document.createElement('div'); actions.className = 'mcp-row-actions';
    if (server.authMode === 'oauth') {
      const auth = document.createElement('button'); auth.type = 'button';
      auth.className = 'mcp-action ' + (server.hasOAuthTokens ? 'logout' : 'login');
      auth.textContent = server.hasOAuthTokens ? uiCopy('Đăng xuất', 'Sign out') : (server.authPending ? uiCopy('Đang mở…', 'Opening…') : uiCopy('Đăng nhập', 'Sign in'));
      auth.disabled = Boolean(server.authPending);
      auth.addEventListener('click', () => vscode.postMessage({ type: server.hasOAuthTokens ? 'logoutMcp' : 'loginMcp', id: server.id }));
      actions.append(auth);
    } else if (server.authMode === 'api-key') {
      const key = document.createElement('button'); key.type = 'button'; key.className = 'mcp-action ' + (server.hasToken ? 'logout' : 'login');
      key.textContent = server.hasToken ? uiCopy('Đổi key', 'Change key') : uiCopy('Nhập key', 'Enter key');
      key.addEventListener('click', () => vscode.postMessage({ type: 'configureMcpApiKey', id: server.id }));
      actions.append(key);
    } else if (!server.connected) {
      const reconnect = document.createElement('button'); reconnect.type = 'button'; reconnect.className = 'mcp-action login';
      reconnect.textContent = uiCopy('Kết nối lại', 'Reconnect');
      reconnect.addEventListener('click', () => vscode.postMessage({ type: 'reconnectMcp', id: server.id }));
      actions.append(reconnect);
    }
    const remove = document.createElement('button'); remove.className = 'mcp-remove'; remove.type = 'button'; remove.setAttribute('aria-label', uiCopy('Xóa MCP', 'Remove MCP')); remove.textContent = '×'; remove.addEventListener('click', () => vscode.postMessage({ type: 'removeMcpServer', id: server.id }));
    actions.append(remove);
    row.append(main, actions); list.append(row);
  }
}

`;
