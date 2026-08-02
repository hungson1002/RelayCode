export interface ChatViewHtmlOptions {
  language: 'vi' | 'en';
  nonce: string;
  cspSource: string;
  styles: string;
  controller: string;
}

export function renderChatViewHtml({ language, nonce, cspSource, styles, controller }: ChatViewHtmlOptions): string {
  const safeLanguage = language === 'en' ? 'en' : 'vi';
  const safeNonce = escapeAttribute(nonce);
  const safeCspSource = escapeAttribute(cspSource);
  return `<!DOCTYPE html>
<html lang="${safeLanguage}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${safeCspSource}; style-src ${safeCspSource} 'nonce-${safeNonce}'; script-src 'nonce-${safeNonce}';">
  <style nonce="${safeNonce}">${styles}</style>
</head>
<body data-language="${safeLanguage}">
  <header class="route-header">
    <div id="connectionBadge" class="route-meta" title="Trạng thái provider hiện tại" role="button" tabindex="0" aria-label="Mở trung tâm kết nối" aria-live="polite"><span id="connectionBrand" class="connection-brand" aria-hidden="true"></span><span id="connectionDot" class="dot"></span><span class="connection-copy"><strong id="connectionLabel">Đang kiểm tra</strong></span></div>
    <nav class="header-actions" aria-label="Điều hướng RelayCode">
      <button id="topConnect" class="header-action connect-action" aria-label="Kết nối provider" data-tooltip="Kết nối provider"><span id="topConnectIcon" aria-hidden="true"></span><span id="topConnectLabel" class="header-action-label">Kết nối</span></button>
      <button id="historyToggle" class="header-action" aria-label="Lịch sử chat" data-tooltip="Lịch sử chat"><span id="historyToggleIcon" aria-hidden="true"></span><span class="header-action-label">Lịch sử</span></button>
      <button id="metricsToggle" class="header-action" aria-label="Số liệu sử dụng" data-tooltip="Số liệu sử dụng"><span id="metricsToggleIcon" aria-hidden="true"></span><span class="header-action-label">Số liệu</span></button>
      <button id="settings" class="header-action icon-only" aria-label="Cài đặt" data-tooltip="Cài đặt"><span id="settingsIcon" aria-hidden="true"></span></button>
    </nav>
  </header>

  <section id="historyPanel" class="history-panel hidden"><div class="history-heading"><strong id="historyTitle">Lịch sử chat</strong><div class="history-heading-actions"><button id="clearAllHistory" class="history-clear-all hidden" type="button">Xóa tất cả</button><button id="closeHistory" aria-label="Đóng">×</button></div></div><div id="historyList" class="history-list"></div><button id="viewAllHistory" class="history-view-all hidden" type="button">View all</button></section>

  <section id="telemetryPanel" class="overlay-panel hidden"><div class="panel-heading"><div><strong>Hoạt động provider</strong><span>Token, chi phí ước tính, tốc độ và rate limit</span></div><button id="closeTelemetry" class="header-action">Đóng</button></div><div id="telemetrySummary" class="telemetry-summary"></div><div id="telemetryRate" class="telemetry-rate"></div><div id="telemetryList" class="telemetry-list"></div><button id="clearTelemetry" class="panel-link">Xóa lịch sử số liệu</button></section>

  <section id="mcpPanel" class="overlay-panel hidden">
    <div class="panel-heading"><div><strong>Kết nối công cụ</strong><span>Chọn dịch vụ và đăng nhập trong trình duyệt</span></div><button id="closeMcp" class="header-action">Đóng</button></div>
    <div id="mcpConnectionNotice" class="mcp-connection-notice hidden" role="status" aria-live="polite"></div>
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
    <label class="language-setting"><span>Ngôn ngữ giao diện</span><div id="languagePicker" class="language-picker"><button id="languageTrigger" class="language-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span id="uiLanguageLabel">Tiếng Việt</span><i aria-hidden="true"></i></button><div id="languageMenu" class="language-menu hidden" role="listbox"><button type="button" data-language="vi"><strong>Tiếng Việt</strong><small>Giao diện tiếng Việt</small></button><button type="button" data-language="en"><strong>English</strong><small>English interface</small></button></div><select id="uiLanguage" class="hidden" aria-hidden="true" tabindex="-1"><option value="vi">Tiếng Việt</option><option value="en">English</option></select></div></label>
    <div class="profile-bar"><div><span>Hồ sơ đang dùng</span><div id="profileList" class="profile-list"></div></div><div class="profile-actions"><button id="deleteProfile" class="profile-delete" disabled>Xóa hồ sơ</button><button id="newProfile" class="secondary profile-new">+ Hồ sơ mới</button></div></div>
    <label>Tên hồ sơ<input id="profileName" spellcheck="false" placeholder="Ví dụ: OpenAI cá nhân"></label>
    <div class="provider-field"><span>Provider</span><div class="provider-picker" id="providerPicker"><button id="providerTrigger" class="provider-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span id="providerBrand" class="provider-brand-slot"></span><span><strong id="providerLabel">9Router</strong><small id="providerHint">Gateway local, nhiều model</small></span></button><div id="providerMenu" class="provider-menu hidden" role="listbox"><button type="button" class="provider-option" data-provider="9router"><span><strong>9Router</strong><small>Gateway local, nhiều model</small></span></button><button type="button" class="provider-option" data-provider="cockpit"><span><strong>Cockpit Tools</strong><small>Gateway local · nhiều tài khoản</small></span></button><button type="button" class="provider-option" data-provider="opencode"><span><strong>OpenCode</strong><small>OpenCode Zen · OpenAI-compatible</small></span></button><button type="button" class="provider-option" data-provider="openai"><span><strong>OpenAI</strong><small>API chính thức · cần API key</small></span></button><button type="button" class="provider-option" data-provider="anthropic"><span><strong>Anthropic Claude</strong><small>Messages API · cần API key</small></span></button><button type="button" class="provider-option" data-provider="openai-compatible"><span><strong>OpenAI-compatible</strong><small>Endpoint tùy chỉnh</small></span></button><button type="button" class="provider-option" data-provider="ollama"><span><strong>Ollama</strong><small>Local · không cần API key</small></span></button><button type="button" class="provider-option" data-provider="lm-studio"><span><strong>LM Studio</strong><small>Local · không cần API key</small></span></button></div></div><select id="configProvider" class="hidden" aria-hidden="true" tabindex="-1"><option value="9router">9Router</option><option value="cockpit">Cockpit Tools</option><option value="opencode">OpenCode</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="openai-compatible">OpenAI-compatible</option><option value="ollama">Ollama local</option><option value="lm-studio">LM Studio local</option></select></div>
    <label>Endpoint<input id="configEndpoint" spellcheck="false" placeholder="http://127.0.0.1:20128/v1"></label>
    <label id="apiKeyField"><span id="apiKeyLabel">API key</span><input id="configApiKey" type="password" autocomplete="off" placeholder="Nhập API key của provider"></label>
    <div class="price-row"><label>Input $ / 1M<input id="inputPrice" type="number" min="0" step="0.01" placeholder="Tùy chọn"></label><label>Output $ / 1M<input id="outputPrice" type="number" min="0" step="0.01" placeholder="Tùy chọn"></label></div>
    <p id="keyState" class="key-state">Chưa lưu API key</p>
    <div class="config-actions"><button id="saveConfig" class="primary">Lưu và kết nối lại</button><button id="runDiagnostics" class="secondary">Chẩn đoán</button></div><div class="config-subactions"><button id="openMcp" class="secondary">MCP tools</button><button id="exportDiagnostics" class="secondary">Xuất chẩn đoán</button><button id="openCockpit" class="secondary hidden">Mở Cockpit</button><button id="localSetup" class="secondary hidden">Thiết lập local</button></div><p id="diagnosticsResult" class="diagnostics-result hidden" role="status" aria-live="polite"></p>
  </section>

  <section id="setup" class="setup hidden">
    <div class="setup-nav"><button id="backToChat" type="button" aria-label="Quay lại chat"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 5-5 5 5 5"/></svg><span>Chat</span></button><span>Connection center</span></div>
    <div class="setup-hero">
      <span class="setup-kicker">Provider</span>
      <h1 id="setupTitle">Kết nối mô hình.</h1>
      <p id="setupCopy">Quản lý provider, kiểm tra API và mở bảng điều khiển tại một nơi.</p>
    </div>

    <div class="launch-panel">
      <div class="provider-overview">
        <span id="setupProviderMark" class="provider-mark">9R</span>
        <div class="provider-identity"><strong id="setupProviderBadge">Provider</strong><span id="setupEndpointLabel">Chưa có endpoint</span></div>
        <span id="signalMap" class="connection-orbit" aria-hidden="true"><i></i></span>
      </div>
      <div class="launch-state">
        <span class="state-mark" aria-hidden="true"></span>
        <div><strong id="launchTitle">Đang kiểm tra kết nối</strong><span id="launchDescription">RelayCode đang xác nhận provider có thể nhận yêu cầu.</span></div>
      </div>
      <div class="connection-page-actions"><button id="startRouter" class="primary">Kết nối provider</button><button id="openDashboard" class="primary hidden">Mở trang quản lý</button><button id="openCockpitCenter" class="secondary hidden">Mở Cockpit</button><button id="retryConnection" class="secondary">Kiểm tra kết nối</button><button id="disconnectConnection" class="secondary hidden">Ngắt kết nối</button></div>
      <p id="setupCheckResult" class="setup-check-result"><span></span>Chưa kiểm tra sức khỏe API trong phiên này.</p>
    </div>

    <details id="manualSetup" class="manual-setup">
      <summary><span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8v3M10 14.2v3M2.8 10h3M14.2 10h3M4.9 4.9 7 7M13 13l2.1 2.1M15.1 4.9 13 7M7 13l-2.1 2.1"/><circle cx="10" cy="10" r="3.2"/></svg>Kết nối thủ công</span><small>Endpoint và API key</small></summary>
      <div class="manual-fields">
        <label>Endpoint<input id="endpoint" value="http://127.0.0.1:20128/v1" spellcheck="false"></label>
        <label>API key<input id="apiKey" type="password" autocomplete="off" placeholder="Lưu trong Secret Storage"></label>
        <button id="connect" class="secondary full">Lưu và kết nối</button>
      </div>
    </details>
    <p id="setupError" class="error hidden" role="alert"></p>
  </section>

  <main id="console" class="console hidden">
    <div class="controls hidden"><button id="connectionToggle" class="status-action hidden">Ngắt</button></div>
    <div id="messages" class="messages" aria-live="polite">
      <div class="empty">
        <h2>Nói điều bạn muốn xây.</h2>
        <p>Agent sẽ đọc dự án, sửa file và chạy lệnh ngay trong workspace.</p>
      </div>
    </div>
    <button id="runningScrollIndicator" class="running-scroll-indicator hidden" type="button" aria-label="Cuộn xuống cuối cuộc trò chuyện">
      <span class="running-scroll-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <svg class="running-scroll-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m0 0 6-6m-6 6-6-6"/></svg>
    </button>
    <section id="collapsedChanges" class="collapsed-changes hidden"><span id="collapsedChangeCount">0 files changed</span><button id="expandChanges" type="button">Xem</button></section>
    <section id="changeTray" class="change-tray hidden"><div id="changeList"></div><div class="change-tray-footer"><span id="changeCount">0 files changed</span><button id="hideChanges" class="tray-button">Ẩn</button><button id="undoAllChanges" class="tray-button">Undo all</button><button id="acceptAllChanges" class="tray-accept">Accept all</button></div></section>
    <footer class="composer-shell">
      <section id="goalRail" class="goal-rail hidden" aria-live="polite">
        <span id="goalState" class="goal-state" aria-hidden="true"></span>
        <div class="goal-copy"><strong id="goalTitle">Tác vụ dài</strong><span id="goalStatus">Sẵn sàng</span></div>
        <div class="goal-actions"><button id="goalPause" type="button">Tạm dừng</button><button id="goalResume" class="hidden" type="button">Tiếp tục</button><button id="goalClear" type="button" aria-label="Xóa mục tiêu">×</button></div>
      </section>
      <section id="followUpQueue" class="follow-up-queue hidden" aria-live="polite"><div class="queue-heading"><span id="queueCount">Tin nhắn tiếp theo</span><button id="clearQueue" type="button">Xóa hàng đợi</button></div><div id="queueList"></div></section>
      <div id="attachmentList" class="attachment-list" aria-live="polite"></div>
      <div id="addMenu" class="add-menu hidden" role="menu" aria-label="Thêm vào yêu cầu"></div>
      <div id="composerMenu" class="composer-menu hidden"></div>
      <div id="composerInput" class="composer-input">
        <div id="composerTokens" class="composer-tokens" aria-live="polite"></div>
        <textarea id="prompt" rows="1" placeholder="Nhập yêu cầu, dùng /, $ hoặc @…"></textarea>
      </div>
      <div id="codexTuning" class="codex-tuning hidden">
        <span class="tuning-label">Codex</span>
        <div id="reasoningPicker" class="reasoning-picker"><button id="reasoningTrigger" class="tuning-button" type="button" aria-haspopup="listbox" aria-expanded="false"><span>Reasoning</span><strong id="reasoningLabel">Medium</strong></button><div id="reasoningMenu" class="reasoning-menu hidden" role="listbox"><button type="button" data-effort="medium" class="active"><strong>Medium</strong><small>Nhanh và cân bằng</small></button><button type="button" data-effort="high"><strong>High</strong><small>Suy luận kỹ hơn</small></button><button type="button" data-effort="xhigh"><strong>Extra high</strong><small>Tối đa, nếu model hỗ trợ</small></button></div></div>
        <button id="fastMode" class="tuning-button fast-toggle" type="button" aria-pressed="false"><span>Speed</span><strong id="fastModeLabel">Standard</strong></button>
        <button id="quotaReset" class="quota-reset hidden" type="button" title="Mở bảng số liệu"><span>Reset</span><strong id="quotaResetLabel"></strong></button>
      </div>
      <div id="contextMeter" class="context-meter" title="Context budget"><i></i></div>
      <div class="composer-actions"><button id="attach" class="tool-button plus-button" type="button" aria-label="Mở menu thêm" aria-haspopup="menu" aria-expanded="false"><span id="attachIcon" aria-hidden="true"></span></button><span id="attachmentProgress" class="attachment-progress hidden"><i></i>Đang tải</span><div class="mode-picker" id="modePicker"><button id="modeTrigger" class="mode-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span id="modeLabel">Agent</span></button><div id="modeMenu" class="mode-menu hidden" role="listbox"><button data-mode="agent" class="active"><strong>Agent</strong><small>Đọc, sửa file và chạy lệnh</small></button><button data-mode="chat"><strong>Chat</strong><small>Trò chuyện trực tiếp với model</small></button><button data-mode="plan"><strong>Plan</strong><small>Lập kế hoạch trước khi hành động</small></button></div></div><div class="perm-wrap" id="permDropdown"><button class="perm-trigger" id="permissionMode" type="button" data-mode="ask" aria-haspopup="listbox" aria-expanded="false"><span class="perm-trigger-icon" aria-hidden="true"><svg class="perm-icon-ask" viewBox="0 0 24 24"><path d="M8 11V7a2 2 0 1 1 4 0v3m0-2V5a2 2 0 1 1 4 0v5m0-2V6a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.24-1.76L4 14.49a2 2 0 0 1 2.83-2.83L8 13V11Z"/></svg><svg class="perm-icon-edit" viewBox="0 0 24 24"><path d="m4 16.5-.7 4.2 4.2-.7L19.2 8.3a2.1 2.1 0 0 0-3-3L4.5 16.5Z"/><path d="m14.9 6.6 3 3"/></svg><svg class="perm-icon-full" viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.6-2.9 8.2-7 10-4.1-1.8-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span><span id="permLabel">Hỏi</span><span class="perm-arrow" aria-hidden="true"></span></button><div class="perm-menu hidden" id="permMenu" role="listbox" aria-label="Quyền thao tác"><button class="perm-opt active" data-perm="ask" role="option"><span class="perm-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 11V7a2 2 0 1 1 4 0v3m0-2V5a2 2 0 1 1 4 0v5m0-2V6a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-2a6 6 0 0 1-4.24-1.76L4 14.49a2 2 0 0 1 2.83-2.83L8 13V11Z"/></svg></span><span class="perm-choice-copy"><strong>Hỏi mọi thao tác</strong><small>Luôn hỏi trước khi thực hiện</small></span><span class="perm-check" aria-hidden="true">✓</span></button><button class="perm-opt" data-perm="edit" role="option"><span class="perm-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 16.5-.7 4.2 4.2-.7L19.2 8.3a2.1 2.1 0 0 0-3-3L4.5 16.5Z"/><path d="m14.9 6.6 3 3"/></svg></span><span class="perm-choice-copy"><strong>Cho phép sửa file</strong><small>Chỉ hỏi khi chạy lệnh</small></span><span class="perm-check" aria-hidden="true">✓</span></button><button class="perm-opt perm-opt-full" data-perm="full" role="option"><span class="perm-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 19 6v5c0 4.6-2.9 8.2-7 10-4.1-1.8-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span><span class="perm-choice-copy"><strong>Full access</strong><small>Không hỏi lại khi Agent hoạt động</small></span><span class="perm-check" aria-hidden="true">✓</span></button></div></div><div class="model-picker" id="modelPicker"><button id="modelTrigger" class="model-trigger" type="button"><span id="modelBrand" class="model-trigger-brand"></span><span id="modelLabel">Chọn model</span></button><div id="modelMenu" class="model-menu hidden"><input id="modelSearch" placeholder="Tìm model…"><button id="checkModels" class="model-check-all" type="button">Kiểm tra model</button><div id="modelOptions" class="model-options"></div></div></div><select id="model" class="hidden" aria-label="Chọn model"><option value="">Chọn model</option></select><button id="send" class="send" aria-label="Gửi" disabled><span id="sendIcon" class="send-icon" aria-hidden="true"></span></button></div>
    </footer>
  </main>
  <div id="accessConfirm" class="modal-backdrop hidden"><section class="access-dialog"><strong>Bật Full access?</strong><p>Agent có thể sửa file và chạy lệnh mà không hỏi lại. Chỉ bật khi bạn tin tưởng model và workspace này.</p><div><button id="cancelFull" class="secondary">Hủy</button><button id="confirmFull" class="danger-confirm">Bật Full access</button></div></section></div>
  <div id="connectionDiagnostics" class="modal-backdrop hidden"><section class="connection-dialog" role="dialog" aria-modal="true" aria-labelledby="connectionDialogTitle"><div class="connection-dialog-head"><div><strong id="connectionDialogTitle">Kiểm tra kết nối</strong><span id="connectionDialogSubtitle">Đang kiểm tra provider hiện tại</span></div><button id="closeConnectionDiagnostics" type="button" aria-label="Đóng">×</button></div><div class="connection-provider"><span id="connectionProviderMark">AI</span><div><strong id="connectionProviderName">Provider</strong><small id="connectionEndpoint">Chưa có endpoint</small></div><b id="connectionHealthBadge" class="checking">Đang kiểm tra</b></div><div class="connection-stats"><div><span>Độ trễ</span><strong id="connectionLatency">—</strong></div><div><span>Models</span><strong id="connectionModels">—</strong></div></div><p id="connectionMessage" class="connection-message">Đang gửi yêu cầu kiểm tra…</p><div class="connection-dialog-actions"><button id="openConnectionSettings" class="secondary" type="button">Cấu hình</button><button id="retryDiagnostics" class="primary" type="button">Kiểm tra lại</button></div></section></div>
  <div id="uiDialog" class="modal-backdrop ui-dialog-backdrop hidden">
    <section class="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="uiDialogTitle" aria-describedby="uiDialogMessage">
      <header><span id="uiDialogIcon" class="ui-dialog-icon" aria-hidden="true"></span><button id="uiDialogClose" type="button" aria-label="Đóng"></button></header>
      <div class="ui-dialog-copy"><strong id="uiDialogTitle"></strong><p id="uiDialogMessage"></p><small id="uiDialogDetail" class="hidden"></small></div>
      <label id="uiDialogField" class="ui-dialog-field hidden"><span id="uiDialogFieldLabel"></span><input id="uiDialogInput" autocomplete="off"><small id="uiDialogError" class="hidden"></small></label>
      <footer id="uiDialogActions"></footer>
    </section>
  </div>
  <div id="toastStack" class="toast-stack" aria-live="polite"></div>
  <div id="imageLightbox" class="image-lightbox hidden" role="dialog" aria-modal="true" aria-label="Xem ảnh"><button id="closeImage" aria-label="Đóng ảnh">×</button><img id="lightboxImage" alt="Ảnh đính kèm"></div>
  <script nonce="${safeNonce}">${controller}</script>
</body>
</html>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}
