import { BRAND_ICONS } from '../brandIcons';

export type McpOAuthResultReason = 'expired' | 'cancelled' | 'failed';

export interface McpOAuthResultOptions {
  language: 'vi' | 'en';
  ok: boolean;
  serverName?: string;
  reason?: McpOAuthResultReason;
}

export function renderMcpOAuthResult(options: McpOAuthResultOptions): string {
  const en = options.language === 'en';
  const name = escapeHtml(options.serverName || 'MCP');
  const serviceIcon = oauthServiceIcon(options.serverName);
  const copy = resultCopy(options, en);
  const tone = options.ok ? 'success' : 'danger';
  const cleanPath = options.ok ? 'connected' : 'failed';

  return `<!doctype html>
<html lang="${options.language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(copy.title)} · RelayCode</title>
  <style>
    :root{--ink:#f4f7f6;--muted:#929c98;--quiet:#68716e;--page:#0d100f;--surface:#151918;--surface-2:#1a1f1d;--line:#2b322f;--line-strong:#3b4541;--success:#65dfbd;--success-soft:#18332b;--danger:#ff9b9b;--danger-soft:#3a2022}
    *{box-sizing:border-box}
    html,body{min-height:100%;margin:0}
    body{display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 50% 40%,#18201d 0,#101412 34%,var(--page) 68%);color:var(--ink);font:15px/1.55 Inter,"Segoe UI Variable Text","Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
    .page{width:min(540px,100%)}
    .brand{display:flex;align-items:center;justify-content:space-between;margin:0 2px 18px}
    .wordmark{display:flex;align-items:center;gap:10px;color:#dce3e0;font:700 11px/1 "Cascadia Code","SFMono-Regular",monospace;letter-spacing:.12em;text-transform:uppercase}
    .wordmark-mark{display:grid;width:30px;height:30px;place-items:center;border:1px solid var(--line-strong);border-radius:9px;background:#181d1b;color:var(--ink);font-size:10px;letter-spacing:0}
    .secure{display:flex;align-items:center;gap:7px;color:var(--quiet);font-size:11px}
    .secure svg{width:13px;height:13px}
    .card{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:24px;background:linear-gradient(155deg,#191e1c 0,var(--surface) 58%);box-shadow:0 28px 90px rgba(0,0,0,.38)}
    .card::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.035),transparent 32%)}
    .bridge{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:15px;padding:28px 30px 24px;border-bottom:1px solid var(--line)}
    .endpoint{position:relative;z-index:1;display:grid;width:48px;height:48px;place-items:center;border:1px solid var(--line-strong);border-radius:15px;background:var(--surface-2);color:#e8eeeb;font:750 13px/1 "Cascadia Code","SFMono-Regular",monospace;box-shadow:0 8px 24px rgba(0,0,0,.2)}
    .endpoint.service{border-color:${options.ok ? '#376c5d' : '#744347'};background:${options.ok ? '#162720' : '#2d1c1e'};color:${options.ok ? 'var(--success)' : 'var(--danger)'}}
    .endpoint.service svg{display:block;width:25px;height:25px}.endpoint.service svg[fill="currentColor"]{color:${options.ok ? 'var(--success)' : 'var(--danger)'}}
    .route{position:relative;height:1px;background:var(--line-strong)}
    .route::before{content:"";position:absolute;top:-3px;left:0;width:7px;height:7px;border-radius:50%;background:${options.ok ? 'var(--success)' : 'var(--danger)'};box-shadow:0 0 18px ${options.ok ? 'rgba(101,223,189,.75)' : 'rgba(255,155,155,.65)'}}
    .route::after{content:"";position:absolute;top:-2px;right:0;width:5px;height:5px;border-top:1px solid ${options.ok ? 'var(--success)' : 'var(--danger)'};border-right:1px solid ${options.ok ? 'var(--success)' : 'var(--danger)'};transform:rotate(45deg)}
    .route span{position:absolute;left:50%;top:-11px;transform:translateX(-50%);padding:2px 8px;background:var(--surface);color:var(--quiet);font:650 9px/1.7 "Cascadia Code","SFMono-Regular",monospace;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap}
    .content{position:relative;z-index:1;padding:31px 34px 34px}
    .status{display:inline-flex;align-items:center;gap:8px;margin-bottom:15px;color:${options.ok ? 'var(--success)' : 'var(--danger)'};font:700 10px/1 "Cascadia Code","SFMono-Regular",monospace;letter-spacing:.12em;text-transform:uppercase}
    .status-mark{display:grid;width:20px;height:20px;place-items:center;border-radius:50%;background:${options.ok ? 'var(--success-soft)' : 'var(--danger-soft)'};font:800 12px/1 Inter,sans-serif}
    h1{max-width:430px;margin:0;color:var(--ink);font:680 clamp(28px,6vw,38px)/1.08 "Segoe UI Variable Display","Segoe UI",sans-serif;letter-spacing:-.045em}
    .message{max-width:430px;margin:14px 0 0;color:#b8c0bd;font-size:15px}
    .service-name{color:var(--ink);font-weight:650}
    .next{display:flex;align-items:flex-start;gap:11px;margin:27px 0 0;padding:15px 16px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.018);color:var(--muted);font-size:12px}
    .next svg{flex:0 0 auto;width:15px;height:15px;margin-top:2px;color:${options.ok ? 'var(--success)' : 'var(--danger)'}}
    button{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;height:46px;margin-top:14px;border:1px solid ${options.ok ? '#477d6d' : '#805053'};border-radius:13px;background:${options.ok ? '#dff8ef' : '#ffe7e7'};color:${options.ok ? '#10231d' : '#321617'};font:700 13px/1 Inter,"Segoe UI",sans-serif;cursor:pointer;transition:transform .16s ease,filter .16s ease}
    button:hover{filter:brightness(1.04);transform:translateY(-1px)}
    button:focus-visible{outline:2px solid ${options.ok ? 'var(--success)' : 'var(--danger)'};outline-offset:3px}
    button svg{width:15px;height:15px}
    .foot{margin:15px 2px 0;color:#606a66;font:10px/1.5 "Cascadia Code","SFMono-Regular",monospace;text-align:center}
    @media(max-width:560px){body{place-items:end center;padding:16px}.secure{display:none}.brand{margin-bottom:12px}.card{border-radius:20px}.bridge{padding:22px 22px 20px}.content{padding:25px 24px 26px}.endpoint{width:43px;height:43px;border-radius:13px}}
  </style>
</head>
<body class="${tone}">
  <main class="page">
    <header class="brand">
      <div class="wordmark"><span class="wordmark-mark">RC</span><span>RelayCode</span></div>
      <div class="secure">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        <span>${escapeHtml(copy.secure)}</span>
      </div>
    </header>
    <section class="card">
      <div class="bridge" aria-label="RelayCode to ${name}">
        <div class="endpoint">RC</div>
        <div class="route"><span>MCP</span></div>
        <div class="endpoint service" aria-label="${name}">${serviceIcon}</div>
      </div>
      <div class="content">
        <div class="status"><span class="status-mark">${options.ok ? '✓' : '!'}</span><span>${escapeHtml(copy.eyebrow)}</span></div>
        <h1>${escapeHtml(copy.title)}</h1>
        <p class="message">${copy.message.replace('{name}', `<span class="service-name">${name}</span>`)}</p>
        <div class="next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <span>${escapeHtml(copy.next)}</span>
        </div>
        <button type="button" onclick="closeResult(this)">
          <span>${escapeHtml(copy.button)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
        </button>
      </div>
    </section>
    <p class="foot">${escapeHtml(copy.foot)}</p>
  </main>
  <script>
    history.replaceState(null,"","/relaycode/${cleanPath}");
    function closeResult(button){
      window.close();
      setTimeout(function(){button.querySelector("span").textContent=${JSON.stringify(copy.closeFallback)};button.disabled=true},250);
    }
  </script>
</body>
</html>`;
}

function resultCopy(options: McpOAuthResultOptions, en: boolean): {
  secure: string;
  eyebrow: string;
  title: string;
  message: string;
  next: string;
  button: string;
  closeFallback: string;
  foot: string;
} {
  if (options.ok) {
    return en
      ? {
          secure: 'Secure handoff',
          eyebrow: 'Connection ready',
          title: 'You’re connected.',
          message: '{name} is ready to use in RelayCode.',
          next: 'Return to Antigravity. Your MCP tools are available now.',
          button: 'Close this tab',
          closeFallback: 'You can close this tab',
          foot: 'LOCAL CALLBACK COMPLETE · NO ACTION NEEDED'
        }
      : {
          secure: 'Chuyển tiếp an toàn',
          eyebrow: 'Kết nối sẵn sàng',
          title: 'Đã kết nối.',
          message: '{name} đã sẵn sàng để sử dụng trong RelayCode.',
          next: 'Quay lại Antigravity. Các công cụ MCP đã có thể sử dụng.',
          button: 'Đóng tab này',
          closeFallback: 'Bạn có thể đóng tab này',
          foot: 'CALLBACK CỤC BỘ HOÀN TẤT · KHÔNG CẦN THAO TÁC THÊM'
        };
  }

  const reason = options.reason || 'failed';
  if (en) {
    if (reason === 'expired') return {
      secure: 'Secure handoff',
      eyebrow: 'Session expired',
      title: 'Start the connection again.',
      message: 'This authorization session is no longer active.',
      next: 'Return to RelayCode and select Sign in once more.',
      button: 'Close this tab',
      closeFallback: 'You can close this tab',
      foot: 'NO CREDENTIALS WERE SAVED'
    };
    if (reason === 'cancelled') return {
      secure: 'Secure handoff',
      eyebrow: 'Access not granted',
      title: 'Connection not completed.',
      message: '{name} did not receive authorization.',
      next: 'Return to RelayCode when you are ready to try again.',
      button: 'Close this tab',
      closeFallback: 'You can close this tab',
      foot: 'NO CREDENTIALS WERE SAVED'
    };
    return {
      secure: 'Secure handoff',
      eyebrow: 'Connection failed',
      title: 'Couldn’t finish connecting.',
      message: '{name} could not be made available in RelayCode.',
      next: 'Return to RelayCode to view the error and try again.',
      button: 'Close this tab',
      closeFallback: 'You can close this tab',
      foot: 'CONNECTION NOT COMPLETED'
    };
  }

  if (reason === 'expired') return {
    secure: 'Chuyển tiếp an toàn',
    eyebrow: 'Phiên đã hết hạn',
    title: 'Hãy kết nối lại.',
    message: 'Phiên cấp quyền này không còn hoạt động.',
    next: 'Quay lại RelayCode và chọn Đăng nhập thêm một lần.',
    button: 'Đóng tab này',
    closeFallback: 'Bạn có thể đóng tab này',
    foot: 'CHƯA LƯU THÔNG TIN ĐĂNG NHẬP'
  };
  if (reason === 'cancelled') return {
    secure: 'Chuyển tiếp an toàn',
    eyebrow: 'Chưa cấp quyền',
    title: 'Kết nối chưa hoàn tất.',
    message: '{name} chưa được cấp quyền truy cập.',
    next: 'Quay lại RelayCode khi bạn muốn thử kết nối lại.',
    button: 'Đóng tab này',
    closeFallback: 'Bạn có thể đóng tab này',
    foot: 'CHƯA LƯU THÔNG TIN ĐĂNG NHẬP'
  };
  return {
    secure: 'Chuyển tiếp an toàn',
    eyebrow: 'Kết nối thất bại',
    title: 'Không thể hoàn tất kết nối.',
    message: 'Chưa thể sử dụng {name} trong RelayCode.',
    next: 'Quay lại RelayCode để xem lỗi và thử lại.',
    button: 'Đóng tab này',
    closeFallback: 'Bạn có thể đóng tab này',
    foot: 'KẾT NỐI CHƯA HOÀN TẤT'
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char] || char);
}

function oauthServiceIcon(serverName?: string): string {
  const name = (serverName || '').toLowerCase();
  const key: keyof typeof BRAND_ICONS = name.includes('notion')
    ? 'notion'
    : name.includes('linear')
      ? 'linear'
      : name.includes('sentry')
        ? 'sentry'
        : name.includes('figma')
          ? 'figma'
          : name.includes('stitch') || name.includes('google')
            ? 'google'
            : 'mcp';
  return BRAND_ICONS[key] ?? BRAND_ICONS.mcp ?? '';
}
