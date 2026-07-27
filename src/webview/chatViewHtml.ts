export interface ChatViewHtmlOptions {
  language: 'vi' | 'en';
  nonce: string;
  cspSource: string;
  styles: string;
  controller: string;
}

export function renderChatViewHtml({ language, nonce, cspSource, styles, controller }: ChatViewHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${cspSource}; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">${styles}</style>
</head>
<body data-language="${language}">
  <header class="route-header">
    <div class="route-meta"><span id="connectionDot" class="dot"></span><span id="connectionLabel">Đang kiểm tra</span></div>
    <div class="header-actions"><button id="topDisconnect" class="header-action hidden">Kiểm tra</button><button id="historyToggle" class="header-action">Lịch sử</button><button id="metricsToggle" class="header-action">Số liệu</button><button id="openExternal" class="header-action">Mở</button><button id="settings" class="header-action">Cài đặt</button></div>
  </header>

  <section id="historyPanel" class="history-panel hidden"><div class="history-heading"><strong id="historyTitle">Lịch sử chat</strong><button id="closeHistory" aria-label="Đóng">×</button></div><div id="historyList" class="history-list"></div><button id="viewAllHistory" class="history-view-all hidden" type="button">View all</button></section>

  <section id="telemetryPanel" class="overlay-panel hidden"><div class="panel-heading"><div><strong>Hoạt động provider</strong><span>Token, chi phí ước tính, tốc độ và rate limit</span></div><button id="closeTelemetry" class="header-action">Đóng</button></div><div id="telemetrySummary" class="telemetry-summary"></div><div id="telemetryRate" class="telemetry-rate"></div><div id="telemetryList" class="telemetry-list"></div><button id="clearTelemetry" class="panel-link">Xóa lịch sử số liệu</button></section>

  <section id="mcpPanel" class="overlay-panel hidden">
    <div class="panel-heading"><div><strong>Kết nối công cụ</strong><span>Chọn dịch vụ và đăng nhập trong trình duyệt</span></div><button id="closeMcp" class="header-action">Đóng</button></div>
    <div id="mcpCatalog" class="mcp-catalog" aria-label="MCP có thể kết nối"></div>
    <div class="mcp-section-label">Đã thêm</div>
    <div id="mcpList" class="mcp-list"></div>
    <details class="mcp-custom">
      <summary>Thêm MCP khác</summary>
      <div class="mcp-form">
        <input id="mcpName" placeholder="Tên server">
        <select id="mcpTransport"><option value="stdio">Local process (stdio)</option><option value="http">Streamable HTTP</option></select>
        <select id="mcpAuth" class="hidden"><option value="oauth">Đăng nhập bằng trình duyệt (OAuth)</option><option value="token">Bearer token</option><option value="none">Không xác thực</option></select>
        <input id="mcpCommand" placeholder="Command, ví dụ npx">
        <input id="mcpArgs" placeholder="Args, phân cách bằng dấu cách">
        <input id="mcpUrl" class="hidden" placeholder="https://example.com/mcp">
        <input id="mcpEnv" placeholder='Env JSON, ví dụ {"TOKEN":"…"}'>
        <input id="mcpToken" class="hidden" type="password" placeholder="Bearer token">
        <button id="saveMcp" class="primary">Kết nối server</button>
      </div>
    </details>
  </section>

  <section id="configPanel" class="config-panel hidden">
    <div class="config-heading"><div><strong>Cấu hình provider</strong><span>Chọn nguồn model cho mọi yêu cầu</span></div><button id="closeConfig" class="header-action">Đóng</button></div>
    <label class="language-setting">Ngôn ngữ giao diện<select id="uiLanguage"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label>
    <div class="profile-bar"><div><span>Hồ sơ đang dùng</span><div id="profileList" class="profile-list"></div></div><button id="newProfile" class="secondary profile-new">+ Hồ sơ mới</button></div>
    <label>Tên hồ sơ<input id="profileName" spellcheck="false" placeholder="Ví dụ: OpenAI cá nhân"></label>
    <div class="provider-field"><span>Provider</span><div class="provider-picker" id="providerPicker"><button id="providerTrigger" class="provider-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span><strong id="providerLabel">9Router</strong><small id="providerHint">Gateway local, nhiều model</small></span></button><div id="providerMenu" class="provider-menu hidden" role="listbox"><button type="button" class="provider-option" data-provider="9router"><strong>9Router</strong><small>Gateway local, nhiều model</small></button><button type="button" class="provider-option" data-provider="openai"><strong>OpenAI</strong><small>API chính thức · cần API key</small></button><button type="button" class="provider-option" data-provider="anthropic"><strong>Anthropic Claude</strong><small>Messages API · cần API key</small></button><button type="button" class="provider-option" data-provider="openai-compatible"><strong>OpenAI-compatible</strong><small>Endpoint tùy chỉnh</small></button><button type="button" class="provider-option" data-provider="ollama"><strong>Ollama</strong><small>Local · không cần API key</small></button><button type="button" class="provider-option" data-provider="lm-studio"><strong>LM Studio</strong><small>Local · không cần API key</small></button></div></div><select id="configProvider" class="hidden" aria-hidden="true" tabindex="-1"><option value="9router">9Router</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="openai-compatible">OpenAI-compatible</option><option value="ollama">Ollama local</option><option value="lm-studio">LM Studio local</option></select></div>
    <label>Endpoint<input id="configEndpoint" spellcheck="false" placeholder="http://localhost:20128/v1"></label>
    <label id="apiKeyField"><span id="apiKeyLabel">API key</span><input id="configApiKey" type="password" autocomplete="off" placeholder="Nhập API key của provider"></label>
    <div class="price-row"><label>Input $ / 1M<input id="inputPrice" type="number" min="0" step="0.01" placeholder="Tùy chọn"></label><label>Output $ / 1M<input id="outputPrice" type="number" min="0" step="0.01" placeholder="Tùy chọn"></label></div>
    <p id="keyState" class="key-state">Chưa lưu API key</p>
    <div class="config-actions"><button id="saveConfig" class="primary">Lưu và kết nối lại</button><button id="runDiagnostics" class="secondary">Chẩn đoán</button></div><div class="config-subactions"><button id="openMcp" class="secondary">MCP tools</button><button id="exportDiagnostics" class="secondary">Xuất chẩn đoán</button><button id="localSetup" class="secondary hidden">Thiết lập local</button></div><p id="diagnosticsResult" class="diagnostics-result hidden" role="status" aria-live="polite"></p>
  </section>

  <section id="setup" class="setup hidden">
    <div class="setup-hero">
      <div id="signalMap" class="signal-map" aria-label="Tuyến kết nối từ IDE qua 9Router đến model">
        <span class="signal-node">IDE</span><span class="signal-wire"><i></i></span><span class="signal-node router-node">9R</span><span class="signal-wire"><i></i></span><span class="signal-node">AI</span>
      </div>
      <h1 id="setupTitle">Kết nối 9Router bằng một nút.</h1>
      <p id="setupCopy">Extension tự chạy dịch vụ nền rồi mở trang quản lý bằng trình duyệt mặc định.</p>
    </div>

    <div class="launch-panel">
      <div class="launch-state">
        <span class="state-mark" aria-hidden="true"></span>
        <div><strong id="launchTitle">9Router chưa chạy</strong><span id="launchDescription">Không cần mở terminal. Một nút là đủ để bắt đầu.</span></div>
      </div>
      <button id="startRouter" class="primary">Kết nối 9Router</button>
      <div class="button-row">
        <button id="openDashboard" class="secondary hidden">Mở lại trình quản lý</button>
        <button id="retryConnection" class="secondary hidden">Kiểm tra lại</button>
        <button id="stopRouter" class="secondary hidden">Kiểm tra kết nối</button>
      </div>
    </div>

    <details id="manualSetup" class="manual-setup">
      <summary>Kết nối thủ công</summary>
      <div class="manual-fields">
        <label>Endpoint<input id="endpoint" value="http://localhost:20128/v1" spellcheck="false"></label>
        <label>API key<input id="apiKey" type="password" autocomplete="off" placeholder="Lưu trong Secret Storage"></label>
        <button id="connect" class="secondary full">Lưu và kết nối</button>
      </div>
    </details>
    <p id="setupError" class="error hidden" role="alert"></p>
  </section>

  <main id="console" class="console hidden">
    <div class="controls hidden"><button id="connectionToggle" class="status-action hidden">Ngắt</button></div>
    <div id="customModelRow" class="custom-model-row hidden"><input id="customModelInput" placeholder="Nhập model ID từ 9Router"><button id="addCustomModel" class="secondary">Dùng model này</button></div>
    <div id="messages" class="messages" aria-live="polite">
      <div class="empty">
        <h2>Nói điều bạn muốn xây.</h2>
        <p>Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.</p>
      </div>
    </div>
    <section id="collapsedChanges" class="collapsed-changes hidden"><span id="collapsedChangeCount">0 files changed</span><button id="expandChanges" type="button">Xem</button></section>
    <section id="changeTray" class="change-tray hidden"><div id="changeList"></div><div class="change-tray-footer"><span id="changeCount">0 files changed</span><button id="hideChanges" class="tray-button">Ẩn</button><button id="undoAllChanges" class="tray-button">Undo all</button><button id="acceptAllChanges" class="tray-accept">Accept all</button></div></section>
    <footer class="composer-shell">
      <div id="attachmentList" class="attachment-list" aria-live="polite"></div>
      <div class="composer-toolbar"><span class="composer-hint">Dùng <b>$</b> cho skill · <b>@</b> cho ngữ cảnh</span><div class="attach-actions"><span id="attachmentProgress" class="attachment-progress hidden"><i></i>Đang tải</span><button id="attach" class="tool-button plus-button" type="button" aria-label="Đính kèm file">＋</button></div></div>
      <div id="composerMenu" class="composer-menu hidden"></div>
      <textarea id="prompt" rows="1" placeholder="Nhập yêu cầu sửa, chạy hoặc kiểm tra code…"></textarea>
      <div id="contextMeter" class="context-meter" title="Context budget"><i></i></div>
      <div class="composer-actions"><div class="mode-picker" id="modePicker"><button id="modeTrigger" class="mode-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span id="modeLabel">Agent</span></button><div id="modeMenu" class="mode-menu hidden" role="listbox"><button data-mode="agent" class="active"><strong>Agent</strong><small>Đọc, sửa file và chạy lệnh</small></button><button data-mode="chat"><strong>Chat</strong><small>Trò chuyện trực tiếp với model</small></button><button data-mode="plan"><strong>Plan</strong><small>Lập kế hoạch trước khi hành động</small></button></div></div><div class="perm-wrap" id="permDropdown"><button class="perm-trigger" id="permissionMode" type="button" data-mode="ask"><span id="permLabel">Hỏi</span></button><div class="perm-menu hidden" id="permMenu"><button class="perm-opt active" data-perm="ask"><span class="perm-check">✓</span>Hỏi mọi thao tác</button><button class="perm-opt" data-perm="edit"><span class="perm-check">✓</span>Cho phép sửa file</button><button class="perm-opt" data-perm="full"><span class="perm-check">✓</span>Full access</button></div></div><div class="model-picker" id="modelPicker"><button id="modelTrigger" class="model-trigger" type="button"><span id="modelLabel">Chọn model</span></button><div id="modelMenu" class="model-menu hidden"><input id="modelSearch" placeholder="Tìm model…"><button id="checkModels" class="model-check-all" type="button">Kiểm tra model</button><div id="modelOptions" class="model-options"></div></div></div><select id="model" class="hidden" aria-label="Chọn model"><option value="">Chọn model</option></select><button id="send" class="send" aria-label="Gửi" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6.5 10.5 12 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
    </footer>
  </main>
  <div id="accessConfirm" class="modal-backdrop hidden"><section class="access-dialog"><strong>Bật Full access?</strong><p>Agent có thể sửa file và chạy lệnh mà không hỏi lại. Chỉ bật khi bạn tin tưởng model và workspace này.</p><div><button id="cancelFull" class="secondary">Hủy</button><button id="confirmFull" class="danger-confirm">Bật Full access</button></div></section></div>
  <div id="connectionDiagnostics" class="modal-backdrop hidden"><section class="connection-dialog" role="dialog" aria-modal="true" aria-labelledby="connectionDialogTitle"><div class="connection-dialog-head"><div><strong id="connectionDialogTitle">Kiểm tra kết nối</strong><span id="connectionDialogSubtitle">Đang kiểm tra provider hiện tại</span></div><button id="closeConnectionDiagnostics" type="button" aria-label="Đóng">×</button></div><div class="connection-provider"><span id="connectionProviderMark">AI</span><div><strong id="connectionProviderName">Provider</strong><small id="connectionEndpoint">Chưa có endpoint</small></div><b id="connectionHealthBadge" class="checking">Đang kiểm tra</b></div><div class="connection-stats"><div><span>Độ trễ</span><strong id="connectionLatency">—</strong></div><div><span>Models</span><strong id="connectionModels">—</strong></div></div><p id="connectionMessage" class="connection-message">Đang gửi yêu cầu kiểm tra…</p><div class="connection-dialog-actions"><button id="openConnectionSettings" class="secondary" type="button">Cấu hình</button><button id="retryDiagnostics" class="primary" type="button">Kiểm tra lại</button></div></section></div>
  <div id="imageLightbox" class="image-lightbox hidden" role="dialog" aria-modal="true" aria-label="Xem ảnh"><button id="closeImage" aria-label="Đóng ảnh">×</button><img id="lightboxImage" alt="Ảnh đính kèm"></div>
  <script nonce="${nonce}">${controller}</script>
</body>
</html>`;
}
