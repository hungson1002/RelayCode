export const AGENT_DESIGN_SYSTEM_STYLES = String.raw`
  /* ==========================================================================
     RelayCode Unified Agent Design System
     Calm, monochrome-first, editor-native craft (Antigravity / Linear / Codex)
     ========================================================================== */
  :root{
    --ui-bg:var(--vscode-sideBar-background,#141517);
    --ui-surface-1:color-mix(in srgb,var(--ui-bg) 80%,#000 20%);
    --ui-surface-2:color-mix(in srgb,var(--vscode-editorWidget-background,#1c1d20) 94%,var(--ui-bg) 6%);
    --ui-surface-3:color-mix(in srgb,var(--vscode-quickInput-background,#1f2024) 96%,#000 4%);
    --ui-hover:rgba(255,255,255,.058);
    --ui-active:rgba(255,255,255,.095);
    --ui-line-subtle:rgba(255,255,255,.068);
    --ui-line:rgba(255,255,255,.105);
    --ui-line-strong:rgba(255,255,255,.18);
    --ui-ink:var(--vscode-foreground,#eceef2);
    --ui-ink-2:#b6bcc6;
    --ui-muted:#828894;
    --ui-faint:#616773;
    --ui-cta-bg:#eceef2;
    --ui-cta-hover:#ffffff;
    --ui-cta-ink:#111316;
    --ui-ok:#5ec496;
    --ui-warn:#d8b357;
    --ui-err:#e27980;
    --ui-link:var(--vscode-textLink-foreground,#66b2ea);
    --ui-radius-xs:6px;
    --ui-radius-sm:8px;
    --ui-radius-md:12px;
    --ui-radius-lg:14px;
    --ui-radius-xl:16px;
    --ui-shadow-pop:0 14px 36px rgba(0,0,0,.46),0 2px 6px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.04);
    --ui-shadow-sheet:0 18px 48px rgba(0,0,0,.48),0 2px 8px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.035);
  }

  body{
    background:var(--ui-bg)!important;color:var(--ui-ink)!important;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility
  }
  button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[role="button"]:focus-visible{
    outline:1.5px solid rgba(255,255,255,.32)!important;outline-offset:1px!important
  }

  /* 1. Seamless Minimal Header (zero double-boxed pills) */
  .route-header{
    height:44px!important;min-height:44px!important;padding:0 10px!important;gap:8px!important;
    border-bottom:1px solid var(--ui-line-subtle)!important;background:var(--ui-bg)!important
  }
  .console{height:calc(100vh - 44px)!important;background:var(--ui-bg)!important}
  #connectionBadge.route-meta{
    height:30px!important;padding:0 8px 0 6px!important;gap:7px!important;
    border:0!important;border-radius:var(--ui-radius-sm)!important;
    background:transparent!important;box-shadow:none!important;
    color:var(--ui-ink-2)!important;transition:background-color .12s ease,color .12s ease!important
  }
  #connectionBadge.route-meta:hover{
    border:0!important;background:var(--ui-hover)!important;color:var(--ui-ink)!important
  }
  .connection-emblem{
    width:20px!important;height:20px!important;border:0!important;border-radius:5px!important;
    background:transparent!important
  }
  #connectionBadge .connection-brand,
  #connectionBadge .connection-brand .brand-symbol,
  #connectionBadge .connection-brand svg,
  #connectionBadge .connection-brand img{
    width:17px!important;height:17px!important;min-width:17px!important
  }
  #connectionBadge .dot{
    right:-2px!important;bottom:-2px!important;width:7px!important;height:7px!important;
    border:1.5px solid var(--ui-bg)!important;box-shadow:none!important;background:var(--ui-faint)!important
  }
  #connectionBadge:hover .dot{border-color:color-mix(in srgb,var(--ui-bg) 94%,#fff 6%)!important}
  #connectionBadge .dot.online,
  #connectionBadge[data-state="ready"] .dot,
  #connectionBadge[data-state="running"] .dot{background:var(--ui-ok)!important;box-shadow:none!important}
  #connectionBadge[data-state="setup"] .dot,
  #connectionBadge[data-state="recovering"] .dot{background:var(--ui-warn)!important;box-shadow:none!important}
  #connectionBadge[data-state="offline"] .dot{background:var(--ui-err)!important;box-shadow:none!important}
  #connectionBadge .connection-copy strong{
    color:inherit!important;font-size:12px!important;font-weight:560!important;letter-spacing:-.01em!important
  }

  .header-actions{
    height:30px!important;padding:0!important;gap:2px!important;
    border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important
  }
  .header-action,.header-action.icon-only,#settings{
    width:28px!important;min-width:28px!important;height:28px!important;min-height:28px!important;
    border:0!important;border-radius:7px!important;background:transparent!important;
    color:var(--ui-muted)!important;transition:background-color .12s ease,color .12s ease!important
  }
  .header-action:hover,.header-action:focus-visible{
    background:var(--ui-hover)!important;color:var(--ui-ink)!important
  }
  .header-action[aria-expanded="true"]{
    background:var(--ui-active)!important;color:var(--ui-ink)!important
  }
  .header-action.connect-action{color:var(--ui-muted)!important}
  .header-action.connect-action.online{color:color-mix(in srgb,var(--ui-ok) 82%,var(--ui-ink) 18%)!important}
  .header-action.connect-action.attention{background:rgba(216,179,87,.12)!important;color:var(--ui-warn)!important}
  .header-action>span:first-child,.header-action .ui-symbol,.header-action .ui-symbol svg,.header-action svg{
    width:15.5px!important;height:15.5px!important;min-width:15.5px!important
  }

  /* 2. Transcript Spacing & Live Agent Execution Timeline */
  .messages{padding:14px 16px 20px!important;gap:14px!important}
  .message.assistant + .message.user{margin-top:10px!important}

  .worked-label.working-live{
    font-size:12.5px!important;font-weight:480!important;margin:0 0 6px!important
  }
  /* Keep single-point focus: once an active tool/step row is visible below, calm the top timer header */
  .message.assistant:has(.agent-activity:not(.archived))>.worked-label.working-live,
  .message.assistant:has(.thinking-block.is-streaming)>.worked-label.working-live{
    animation:none!important;background:none!important;filter:none!important;
    -webkit-text-fill-color:var(--ui-muted)!important;color:var(--ui-muted)!important
  }
  .message.assistant:has(.agent-activity:not(.archived))>.worked-label.working-live::before,
  .message.assistant:has(.thinking-block.is-streaming)>.worked-label.working-live::before{
    display:none!important;content:none!important;animation:none!important
  }
  .worked-label:not(.working-live),
  .worked-history>summary.worked-label{
    font-size:12px!important;font-weight:480!important;color:var(--ui-muted)!important
  }
  .worked-history-details{
    display:grid!important;gap:6px!important;
    margin:4px 0 10px 3px!important;padding:2px 0 2px 13px!important;
    border-left:1.5px solid var(--ui-line-subtle)!important
  }

  .agent-commentary{
    color:var(--ui-ink-2)!important;font-size:13px!important;line-height:1.68!important;
    margin:2px 0 8px!important
  }
  .agent-commentary p{margin:0 0 8px!important}
  .agent-commentary p:last-child{margin-bottom:0!important}

  /* Antigravity-style inline compact Agent step toggles (chevron sits beside text, not stranded far right) */
  .agent-activity{margin:2px 0 8px!important;padding:0!important}
  .activity-toggle{
    display:inline-flex!important;align-items:center!important;gap:7px!important;
    width:auto!important;max-width:calc(100% + 12px)!important;min-height:28px!important;
    margin:0 -6px!important;padding:4px 8px 4px 6px!important;border:0!important;border-radius:7px!important;
    background:transparent!important;color:var(--ui-ink-2)!important;
    transition:background-color .12s ease,color .12s ease!important
  }
  .activity-toggle:hover{background:var(--ui-hover)!important;color:var(--ui-ink)!important}
  .activity-current-icon{
    position:relative!important;display:inline-grid!important;place-items:center!important;
    flex:none!important;width:15px!important;height:15px!important;color:var(--ui-muted)!important
  }
  .activity-current-icon .ui-symbol,.activity-current-icon svg{width:14px!important;height:14px!important}
  /* Sleek orbital hairline spinner for active thinking/waiting/provider step */
  .agent-activity:not(.archived) .activity-current-icon[data-icon="brain"] .ui-symbol,
  .agent-activity:not(.archived) .activity-current-icon[data-icon="spinnerGap"] .ui-symbol,
  .agent-activity:not(.archived) .activity-current-icon[data-icon="pulse"] .ui-symbol{
    display:none!important
  }
  .agent-activity:not(.archived) .activity-current-icon[data-icon="brain"]::before,
  .agent-activity:not(.archived) .activity-current-icon[data-icon="spinnerGap"]::before,
  .agent-activity:not(.archived) .activity-current-icon[data-icon="pulse"]::before{
    content:""!important;display:block!important;width:13px!important;height:13px!important;
    box-sizing:border-box!important;border-radius:50%!important;
    border:1.5px solid rgba(255,255,255,.14)!important;border-top-color:#d2d8e2!important;
    animation:rcOrbitSpin .9s linear infinite!important
  }
  .activity-current{
    min-width:0!important;font-size:12.5px!important;font-weight:460!important;
    color:inherit!important;line-height:1.45!important
  }
  /* Disable legacy ::after sweep so only ONE smooth luminous glide runs */
  .activity-current.sweeping::after{content:none!important;display:none!important;animation:none!important}
  .agent-activity:not(.archived) .activity-current.sweeping{
    background:linear-gradient(105deg,#747a86 0%,#747a86 34%,#b4bcc8 43%,#f6f8fc 50%,#b4bcc8 57%,#747a86 66%,#747a86 100%)!important;
    background-size:320% 100%!important;background-position:100% 0!important;
    -webkit-background-clip:text!important;background-clip:text!important;
    -webkit-text-fill-color:transparent!important;
    filter:drop-shadow(0 0 6px rgba(236,240,248,.1))!important;
    animation:rcTextShimmer 3.4s cubic-bezier(.42,0,.25,1) infinite!important
  }
  .agent-activity.archived .activity-current{
    background:none!important;filter:none!important;-webkit-text-fill-color:var(--ui-muted)!important;
    color:var(--ui-muted)!important;animation:none!important
  }
  .activity-caret{
    flex:none!important;display:inline-grid!important;place-items:center!important;
    width:13px!important;height:13px!important;margin-left:-1px!important;
    color:var(--ui-faint)!important;transition:color .12s ease!important
  }
  .activity-caret .ui-symbol,.activity-caret svg{width:11.5px!important;height:11.5px!important}
  .activity-toggle:hover .activity-caret{color:var(--ui-ink-2)!important}
  .activity-trace{
    margin:3px 0 4px 6px!important;padding:2px 0 2px 13px!important;
    border-left:1.5px solid var(--ui-line-subtle)!important;gap:3px!important
  }
  .worked-history-details .agent-activity .activity-trace{
    margin:0!important;padding:0!important;border-left:0!important;gap:3px!important
  }
  .activity-row{
    grid-template-columns:16px minmax(0,1fr) auto!important;gap:8px!important;
    padding:3px 0!important;font-size:12px!important;line-height:1.45!important
  }
  .activity-row .activity-copy{color:var(--ui-muted)!important;font-weight:430!important}
  .activity-row.active .activity-copy{color:var(--ui-ink)!important;font-weight:480!important}
  .activity-duration{color:var(--ui-faint)!important;font-size:10.5px!important}

  /* Command & Edit History Summaries inside live/archived workflow (inline compact chevron) */
  .activity-history-summary{margin:2px 0 6px!important;color:var(--ui-muted)!important}
  .activity-history-summary>summary{
    display:inline-flex!important;align-items:center!important;gap:7px!important;
    width:auto!important;max-width:calc(100% + 12px)!important;min-height:28px!important;
    margin:0 -6px!important;padding:4px 8px 4px 6px!important;border-radius:7px!important;
    color:var(--ui-ink-2)!important;cursor:pointer!important;list-style:none!important;
    transition:background-color .12s ease,color .12s ease!important
  }
  .edit-history>summary{display:inline-flex!important;align-items:center!important;gap:7px!important}
  .activity-history-summary>summary::-webkit-details-marker{display:none}
  .activity-history-summary>summary:hover{background:var(--ui-hover)!important;color:var(--ui-ink)!important}
  .activity-history-icon{flex:none!important;width:15px!important;height:15px!important;color:var(--ui-muted)!important}
  .activity-history-icon .ui-symbol,.activity-history-icon svg{width:14px!important;height:14px!important}
  .activity-history-copy{min-width:0!important;font-size:12.5px!important;font-weight:460!important}
  .activity-history-caret{flex:none!important;width:13px!important;height:13px!important;color:var(--ui-faint)!important}
  .activity-history-caret .ui-symbol,.activity-history-caret svg{width:11.5px!important;height:11.5px!important}
  .activity-history-summary>summary:hover .activity-history-caret{color:var(--ui-ink-2)!important}
  .activity-history-summary.command-history>.activity-history-details,
  .edit-history-details{
    margin:3px 0 4px 6px!important;padding:2px 0 2px 13px!important;
    border-left:1.5px solid var(--ui-line-subtle)!important
  }
  .terminal-card>summary{
    display:inline-flex!important;align-items:center!important;gap:7px!important;
    width:auto!important;max-width:calc(100% + 12px)!important;min-height:28px!important;
    padding:4px 8px 4px 6px!important;margin:0 -6px!important;
    border-radius:7px!important;color:var(--ui-ink-2)!important;
    transition:background-color .12s ease,color .12s ease!important
  }
  .terminal-card>summary:hover{background:var(--ui-hover)!important;color:var(--ui-ink)!important}
  .terminal-command{font:460 11.5px/1.4 var(--vscode-editor-font-family)!important;color:var(--ui-ink-2)!important}
  .terminal-elapsed{color:var(--ui-faint)!important;font-size:10.5px!important;font-variant-numeric:tabular-nums!important}
  .terminal-card pre{
    margin:5px 0 6px!important;padding:10px 12px!important;
    border:1px solid var(--ui-line-subtle)!important;border-radius:var(--ui-radius-sm)!important;
    background:var(--ui-surface-1)!important;color:#c7cdd6!important;
    font:11.5px/1.58 var(--vscode-editor-font-family)!important
  }

  /* Inline File Diff Preview Cards */
  .edited-file-entry{
    border:1px solid var(--ui-line-subtle)!important;border-radius:9px!important;
    background:var(--ui-surface-1)!important;overflow:hidden!important
  }
  .edited-file-entry>summary{
    min-height:34px!important;padding:4px 10px!important;color:var(--ui-ink-2)!important;
    transition:background-color .12s ease,color .12s ease!important
  }
  .edited-file-entry>summary:hover{background:var(--ui-hover)!important;color:var(--ui-ink)!important}
  .edited-file-preview{
    border-top:1px solid var(--ui-line-subtle)!important;background:#111315!important;
    color:var(--ui-ink-2)!important;font:11px/1.58 var(--vscode-editor-font-family)!important
  }
  .edited-file-line.hunk{background:rgba(102,178,234,.08)!important;color:#7ec0ee!important}
  .edited-file-line.removed{background:rgba(226,121,128,.11)!important}
  .edited-file-line.removed>code{color:#ebb2b6!important}
  .edited-file-line.added{background:rgba(94,196,150,.11)!important}
  .edited-file-line.added>code{color:#a8dfc3!important}
  .edited-file-open{
    margin:7px 10px 8px auto!important;padding:5px 9px!important;
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-xs)!important;
    background:rgba(255,255,255,.04)!important;color:var(--ui-ink-2)!important;font-size:10.5px!important
  }
  .edited-file-open:hover{background:var(--ui-active)!important;color:var(--ui-ink)!important}

  /* In-Chat Permission Request Card */
  .permission-card-v2{
    margin:6px 0 14px!important;padding:13px 14px!important;
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-md)!important;
    background:var(--ui-surface-2)!important;
    box-shadow:0 8px 24px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)!important
  }
  .permission-card-v2 .permission-icon{
    width:28px!important;height:28px!important;border:1px solid var(--ui-line-subtle)!important;
    border-radius:8px!important;background:rgba(255,255,255,.04)!important;color:var(--ui-ink-2)!important
  }
  .permission-card-v2 .permission-title{color:var(--ui-muted)!important;font-size:11px!important;font-weight:500!important}
  .permission-card-v2 .permission-copy{color:var(--ui-ink)!important;font-size:13px!important;font-weight:580!important}
  .permission-card-v2 .permission-command{
    margin-top:9px!important;padding:9px 11px!important;
    border:1px solid var(--ui-line-subtle)!important;border-radius:var(--ui-radius-sm)!important;
    background:var(--ui-surface-1)!important;color:#cfd5de!important;
    font:11.5px/1.58 var(--vscode-editor-font-family)!important
  }
  .permission-card-v2 button{
    min-height:30px!important;padding:0 12px!important;border-radius:var(--ui-radius-sm)!important;
    border:1px solid var(--ui-line)!important;background:rgba(255,255,255,.04)!important;
    color:var(--ui-ink-2)!important;font-size:11.5px!important;font-weight:540!important
  }
  .permission-card-v2 button:hover{
    border-color:var(--ui-line-strong)!important;background:var(--ui-active)!important;color:var(--ui-ink)!important
  }
  .permission-card-v2 .permission-allow-once{
    border-color:transparent!important;border-radius:var(--ui-radius-sm) 0 0 var(--ui-radius-sm)!important;
    background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important;font-weight:600!important
  }
  .permission-card-v2 .permission-allow-wrap>.permission-allow-once:only-child{
    border-radius:var(--ui-radius-sm)!important
  }
  .permission-card-v2 .permission-menu-trigger{
    width:28px!important;padding:0!important;border:0!important;
    border-left:1px solid rgba(0,0,0,.14)!important;
    border-radius:0 var(--ui-radius-sm) var(--ui-radius-sm) 0!important;
    background:#dde0e5!important;color:var(--ui-cta-ink)!important
  }
  .permission-card-v2 .permission-allow-once:hover,
  .permission-card-v2 .permission-menu-trigger:hover{
    background:var(--ui-cta-hover)!important;color:#0a0b0d!important
  }
  .permission-card-v2 .permission-menu{
    padding:5px!important;border:1px solid var(--ui-line)!important;
    border-radius:var(--ui-radius-md)!important;background:var(--ui-surface-3)!important;
    box-shadow:var(--ui-shadow-pop)!important
  }
  .permission-card-v2 .permission-menu button{
    min-height:34px!important;border:0!important;border-radius:var(--ui-radius-sm)!important;
    background:transparent!important;color:var(--ui-ink-2)!important;font-size:11.5px!important
  }
  .permission-card-v2 .permission-menu button:hover{
    background:var(--ui-hover)!important;color:var(--ui-ink)!important
  }

  /* Plan Artifact Card & Inline Change Summary */
  .plan-artifact{
    margin:6px 0 12px!important;padding:11px 13px!important;gap:11px!important;
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-md)!important;
    background:var(--ui-surface-2)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)!important
  }
  .plan-artifact-icon{
    width:32px!important;height:32px!important;border:1px solid var(--ui-line-subtle)!important;
    border-radius:8px!important;background:rgba(255,255,255,.04)!important;color:var(--ui-ink-2)!important
  }
  .plan-artifact-copy strong{color:var(--ui-ink)!important;font-size:12.5px!important;font-weight:580!important}
  .plan-artifact-copy small{color:var(--ui-muted)!important;font-size:11px!important}
  .plan-artifact-open{
    height:30px!important;padding:0 11px!important;border:0!important;border-radius:var(--ui-radius-sm)!important;
    background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important;
    font-size:11.5px!important;font-weight:600!important
  }
  .plan-artifact-open:hover{background:var(--ui-cta-hover)!important;color:#0a0b0d!important}

  .chat-change-summary{
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-md)!important;
    background:var(--ui-surface-2)!important;overflow:hidden!important
  }
  .chat-change-summary>header{
    padding:9px 11px!important;border-bottom:1px solid var(--ui-line-subtle)!important;
    background:transparent!important
  }
  .chat-change-summary .change-summary-actions button{
    height:27px!important;padding:0 9px!important;border-radius:var(--ui-radius-xs)!important;
    font-size:11px!important;font-weight:520!important
  }
  .chat-change-summary .change-summary-actions .summary-review{
    border:1px solid var(--ui-line)!important;background:rgba(255,255,255,.04)!important;color:var(--ui-ink)!important
  }
  .chat-change-summary .change-summary-actions .summary-review:hover{background:var(--ui-active)!important}

  /* Chat Error Card */
  .chat-error-card{
    padding:11px 13px!important;border:1px solid rgba(226,121,128,.24)!important;
    border-radius:10px!important;background:rgba(226,121,128,.07)!important
  }
  .chat-error-icon{
    width:22px!important;height:22px!important;border-radius:50%!important;
    background:rgba(226,121,128,.16)!important;color:var(--ui-err)!important;font-size:12px!important
  }
  .chat-error-copy strong{color:#f3c4c7!important;font-size:12.5px!important;font-weight:600!important}
  .chat-error-copy span{color:#d2a8ab!important;font-size:12px!important;line-height:1.5!important}

  /* Markdown Tables */
  .message.assistant .markdown-table-wrap{
    border:1px solid var(--ui-line-subtle)!important;border-radius:9px!important;
    background:var(--ui-surface-1)!important
  }
  .message.assistant .markdown-table th{
    background:rgba(255,255,255,.03)!important;color:var(--ui-ink)!important;
    font-weight:600!important;border-color:var(--ui-line-subtle)!important
  }
  .message.assistant .markdown-table td{
    color:var(--ui-ink-2)!important;border-color:var(--ui-line-subtle)!important
  }

  /* Message Inline Edit Box */
  .message-editor{
    border:1px solid var(--ui-line-strong)!important;border-radius:var(--ui-radius-md)!important;
    background:var(--ui-surface-2)!important;padding:10px 12px!important
  }
  .message-edit-hint{color:var(--ui-muted)!important;font-size:11px!important}
  .message-edit-cancel{
    height:28px!important;padding:0 10px!important;border:0!important;border-radius:var(--ui-radius-xs)!important;
    background:transparent!important;color:var(--ui-muted)!important;font-size:11.5px!important
  }
  .message-edit-cancel:hover{background:var(--ui-hover)!important;color:var(--ui-ink)!important}
  .message-edit-submit{
    height:28px!important;padding:0 12px!important;border:0!important;border-radius:var(--ui-radius-xs)!important;
    background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important;font-size:11.5px!important;font-weight:600!important
  }
  .message-edit-submit:hover{background:var(--ui-cta-hover)!important}

  /* 3. Change Tray, Collapsed Changes & Change Review Modal */
  .collapsed-changes{
    min-height:36px!important;margin:0 10px 8px!important;padding:4px 6px 4px 12px!important;
    border:1px solid var(--ui-line)!important;border-radius:10px!important;
    background:var(--ui-surface-2)!important;color:var(--ui-ink-2)!important;font-size:11.5px!important
  }
  .collapsed-changes button{
    height:26px!important;padding:0 9px!important;border-radius:var(--ui-radius-xs)!important;
    font-size:11px!important;font-weight:540!important;color:var(--ui-ink)!important
  }
  .change-tray{
    margin:0 10px 8px!important;border:1px solid var(--ui-line)!important;
    border-radius:var(--ui-radius-md)!important;background:var(--ui-surface-2)!important;
    box-shadow:0 8px 24px rgba(0,0,0,.22)!important
  }
  .change-tray.hidden{display:none!important}
  .change-tray-footer{
    min-height:42px!important;padding:6px 10px!important;gap:6px!important;
    border-top:1px solid var(--ui-line-subtle)!important;background:rgba(255,255,255,.018)!important;
    color:var(--ui-ink-2)!important;font-size:11.5px!important
  }
  .change-row-review{
    min-height:38px!important;padding:6px 10px!important;
    border-bottom:1px solid var(--ui-line-subtle)!important;color:var(--ui-ink-2)!important
  }
  .change-row-review:hover,.change-row-review:focus-within{background:var(--ui-hover)!important}
  .change-row-actions button,.change-tray-footer .tray-button,.change-tray-footer .tray-accept{
    height:26px!important;padding:0 9px!important;border:0!important;border-radius:var(--ui-radius-xs)!important;
    font-size:11px!important;font-weight:520!important
  }
  .change-row-actions button,.change-tray-footer .tray-button{
    background:transparent!important;color:var(--ui-muted)!important
  }
  .change-row-actions button:hover,.change-tray-footer .tray-button:hover{
    background:var(--ui-active)!important;color:var(--ui-ink)!important
  }
  .change-row-actions .tray-undo:hover{background:rgba(226,121,128,.14)!important;color:var(--ui-err)!important}
  .change-row-actions .tray-accept{
    background:rgba(255,255,255,.08)!important;color:var(--ui-ink)!important
  }
  .change-row-actions .tray-accept:hover{background:rgba(255,255,255,.15)!important;color:#fff!important}
  .change-tray-footer .tray-accept{
    background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important;font-weight:600!important
  }
  .change-tray-footer .tray-accept:hover{background:var(--ui-cta-hover)!important}

  .change-review-backdrop{background:rgba(0,0,0,.6)!important;backdrop-filter:blur(4px)!important}
  .change-review-dialog{
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-lg)!important;
    background:var(--ui-surface-3)!important;box-shadow:var(--ui-shadow-sheet)!important
  }
  .change-review-dialog>header{
    background:transparent!important;border-bottom:1px solid var(--ui-line-subtle)!important;
    padding:12px 14px!important
  }
  .review-file-icon{
    border:1px solid var(--ui-line-subtle)!important;border-radius:8px!important;
    background:rgba(255,255,255,.04)!important
  }
  .hunk-list{background:var(--ui-surface-1)!important;padding:12px!important}
  .hunk-card{
    border:1px solid var(--ui-line-subtle)!important;border-radius:10px!important;
    background:var(--ui-surface-2)!important
  }
  .hunk-card header{
    background:rgba(255,255,255,.025)!important;border-bottom:1px solid var(--ui-line-subtle)!important
  }
  .hunk-lines{background:#111315!important}
  .hunk-line.add{border-left:2px solid var(--ui-ok)!important;background:rgba(94,196,150,.11)!important}
  .hunk-line.remove{border-left:2px solid var(--ui-err)!important;background:rgba(226,121,128,.11)!important}
  .change-review-dialog>footer{
    background:transparent!important;border-top:1px solid var(--ui-line-subtle)!important;
    padding:10px 14px!important
  }
  .change-review-dialog>footer button{
    height:32px!important;padding:0 12px!important;border:1px solid var(--ui-line)!important;
    border-radius:var(--ui-radius-sm)!important;background:rgba(255,255,255,.04)!important;
    color:var(--ui-ink-2)!important;font-size:11.5px!important;font-weight:520!important
  }
  .change-review-dialog>footer button:hover{background:var(--ui-active)!important;color:var(--ui-ink)!important}
  .change-review-dialog>footer .review-accept-file{
    border-color:transparent!important;background:var(--ui-cta-bg)!important;
    color:var(--ui-cta-ink)!important;font-weight:600!important
  }
  .change-review-dialog>footer .review-accept-file:hover{background:var(--ui-cta-hover)!important}

  /* 4. Composer Shell, Controls, Tokens, Queue & Scroll FAB */
  .composer-shell{
    margin:0 10px 10px!important;border:1px solid var(--ui-line)!important;
    border-radius:var(--ui-radius-xl)!important;background:var(--ui-surface-2)!important;
    box-shadow:0 4px 18px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.03)!important;
    transition:border-color .14s ease,box-shadow .14s ease!important
  }
  .composer-shell:focus-within,.composer-shell.prompt-focused{
    border-color:var(--ui-line-strong)!important;
    box-shadow:0 6px 24px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.045)!important
  }
  .composer-input{min-height:52px!important;padding:10px 14px 3px!important}
  .composer-input .prompt-editor{
    min-height:32px!important;font-size:13.25px!important;line-height:1.55!important;color:var(--ui-ink)!important
  }
  .context-meter{margin:0 14px 3px!important;background:var(--ui-line-subtle)!important;opacity:.65!important}
  .composer-tokens{gap:5px!important;padding:0 0 6px!important}
  .composer-token{
    height:25px!important;min-height:25px!important;padding:0 8px!important;
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-xs)!important;
    background:rgba(255,255,255,.045)!important;color:var(--ui-ink)!important;font-size:11.5px!important
  }
  .composer-token:hover{background:var(--ui-active)!important}
  .composer-actions{
    min-height:40px!important;padding:3px 8px 7px!important;gap:3px!important
  }
  .tool-button.plus-button,.mode-trigger,.perm-trigger,.model-trigger,.goal-dock-trigger{
    height:30px!important;min-height:30px!important;border-radius:var(--ui-radius-sm)!important;
    color:var(--ui-muted)!important;font-size:11.5px!important;font-weight:520!important;
    transition:background-color .12s ease,color .12s ease!important
  }
  .tool-button.plus-button{width:30px!important;min-width:30px!important}
  .composer-actions .perm-trigger{
    width:auto!important;min-width:0!important;max-width:116px!important;padding:0 8px!important;gap:6px!important
  }
  .tool-button.plus-button:hover,.tool-button.plus-button.active,
  .mode-trigger:hover,.mode-picker.open .mode-trigger,
  .perm-trigger:hover,.perm-wrap.open .perm-trigger,
  .model-trigger:hover,.model-picker.open .model-trigger,
  .goal-dock-trigger:hover,.goal-dock.open .goal-dock-trigger{
    background:var(--ui-hover)!important;color:var(--ui-ink)!important
  }
  .composer-actions .perm-trigger[data-mode="full"],
  .composer-actions .perm-trigger[data-mode="full"]:hover,
  .perm-wrap.open .perm-trigger[data-mode="full"]{
    color:var(--ui-warn)!important
  }
  .model-picker.open .model-trigger{
    border:0!important;box-shadow:none!important;background:var(--ui-active)!important
  }
  #modelLabel{color:var(--ui-ink)!important;font-size:11.5px!important;font-weight:540!important}
  .composer-actions .send{
    width:28px!important;min-width:28px!important;height:28px!important;min-height:28px!important;
    border-radius:999px!important;background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important;
    transition:background-color .12s ease,opacity .12s ease!important
  }
  .composer-actions .send:hover:not(:disabled){background:var(--ui-cta-hover)!important}
  .composer-actions .send:disabled{
    background:rgba(255,255,255,.07)!important;color:var(--ui-faint)!important;opacity:1!important
  }
  .composer-actions .send.running{background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important}
  .composer-actions .send svg,.composer-actions .send .send-icon,.composer-actions .send .send-icon .ui-symbol{
    width:15px!important;height:15px!important
  }

  /* Circular Floating Scroll-to-Bottom Button */
  .composer-shell>.running-scroll-indicator{
    bottom:calc(100% + 10px)!important;width:32px!important;height:32px!important;
    border:1px solid var(--ui-line)!important;border-radius:999px!important;
    background:var(--ui-surface-3)!important;color:var(--ui-ink-2)!important;
    box-shadow:0 8px 22px rgba(0,0,0,.38)!important;
    transition:background-color .12s ease,border-color .12s ease,color .12s ease!important
  }
  .running-scroll-indicator:hover{
    border-color:var(--ui-line-strong)!important;background:#27292e!important;color:var(--ui-ink)!important
  }
  .running-scroll-arrow{width:16px!important;height:16px!important}

  /* Follow-Up Queue */
  .composer-shell>.follow-up-queue .queue-row{
    border:1px solid var(--ui-line)!important;border-radius:10px!important;
    background:var(--ui-surface-2)!important;box-shadow:0 4px 14px rgba(0,0,0,.18)!important
  }
  .composer-shell>.follow-up-queue .queue-steer:hover{
    border-color:transparent!important;background:var(--ui-hover)!important;
    color:var(--ui-ink)!important;box-shadow:none!important
  }
  .composer-shell>.follow-up-queue .queue-icon-button:hover{
    background:var(--ui-hover)!important;color:var(--ui-ink)!important
  }

  /* 5. Unified Luxury Popups & Menus (Add, Slash, Mode, Perm, Model, Goal, Settings Selects) */
  .add-menu,.composer-menu,.mode-menu,.perm-menu,.model-menu,.reasoning-menu,
  .language-menu,.provider-menu,.profile-menu,.queue-row-menu,.goal-rail,.settings-menu-floating{
    padding:5px!important;border:1px solid var(--ui-line)!important;
    border-radius:var(--ui-radius-md)!important;background:var(--ui-surface-3)!important;
    box-shadow:var(--ui-shadow-pop)!important;color:var(--ui-ink)!important
  }
  .add-menu,.composer-menu{padding:0 5px 5px!important}
  .menu-section-label{
    min-height:28px!important;margin:0 -5px 3px!important;padding:0 11px!important;
    border-bottom:1px solid var(--ui-line-subtle)!important;background:var(--ui-surface-3)!important;
    color:var(--ui-faint)!important;font-size:10px!important;font-weight:600!important;
    letter-spacing:.04em!important;text-transform:uppercase!important;box-shadow:none!important
  }
  .menu-section-label:not(:first-child){margin-top:4px!important;border-top:1px solid var(--ui-line-subtle)!important}
  .add-menu button,.composer-menu button,
  .mode-menu button,.perm-opt,.model-option,.reasoning-menu button,
  .language-menu button,.provider-option,.profile-option,.queue-row-menu button{
    border:0!important;border-radius:var(--ui-radius-sm)!important;background:transparent!important;
    color:var(--ui-ink)!important;box-shadow:none!important;
    transition:background-color .1s ease,color .1s ease!important
  }
  .add-menu button:hover,.composer-menu button:hover,
  .mode-menu button:hover,.perm-opt:hover,.model-option:hover,.reasoning-menu button:hover,
  .language-menu button:hover,.provider-option:hover,.profile-option:hover,.queue-row-menu button:hover{
    background:var(--ui-hover)!important;color:var(--ui-ink)!important
  }
  .add-menu button.selected,.composer-menu button.selected,
  .mode-menu button.active,.perm-opt.active,.model-option.active,.model-option.active:hover,
  .reasoning-menu button.active,.language-menu button.active,.provider-option.active,.profile-option.active{
    background:var(--ui-active)!important;color:var(--ui-ink)!important;box-shadow:none!important
  }
  .add-menu button,.composer-menu button{
    grid-template-columns:28px minmax(0,1fr) auto!important;min-height:44px!important;
    padding:6px 8px!important;gap:9px!important
  }
  .menu-glyph{
    width:28px!important;height:28px!important;border-radius:7px!important;
    background:rgba(255,255,255,.045)!important;color:var(--ui-ink-2)!important
  }
  .menu-main{
    display:grid!important;gap:2px!important;min-width:0!important;text-align:left!important
  }
  .menu-main strong{
    display:block!important;color:var(--ui-ink)!important;font-size:12px!important;
    font-weight:560!important;line-height:1.25!important
  }
  .menu-main small{
    display:block!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;
    color:var(--ui-muted)!important;font-size:10.5px!important;line-height:1.3!important
  }
  .menu-meta{
    color:var(--ui-faint)!important;font:500 10.5px/1 var(--vscode-editor-font-family)!important;
    padding-right:2px!important
  }
  .mode-menu strong,.reasoning-menu strong,.language-menu strong,.profile-option strong,.provider-option strong{
    color:var(--ui-ink)!important;font-size:12px!important;font-weight:560!important
  }
  .mode-menu small,.reasoning-menu small,.language-menu small,.profile-option small,.provider-option small{
    color:var(--ui-muted)!important;font-size:10.5px!important
  }
  .perm-opt{min-height:48px!important;padding:7px 9px!important;gap:10px!important}
  .perm-choice-icon{
    width:28px!important;height:28px!important;border-radius:7px!important;
    background:rgba(255,255,255,.045)!important;color:var(--ui-ink-2)!important
  }
  .perm-choice-copy strong{font-size:12px!important;font-weight:560!important}
  .perm-choice-copy small{color:var(--ui-muted)!important;font-size:10.5px!important}
  .perm-opt-full .perm-choice-icon{background:rgba(216,179,87,.12)!important;color:var(--ui-warn)!important}
  .perm-opt-full .perm-choice-copy strong{color:var(--ui-warn)!important}
  .perm-opt-full .perm-choice-copy small{color:var(--ui-muted)!important}
  .perm-opt-full:hover{background:var(--ui-hover)!important}
  .perm-opt-full.active{background:rgba(216,179,87,.1)!important}

  /* Model Picker Polish */
  .model-menu{padding:7px!important;width:min(352px,calc(100vw - 24px))!important}
  .model-menu-heading{
    padding:5px 7px 9px!important;border-bottom:1px solid var(--ui-line-subtle)!important
  }
  .model-menu-heading strong{font-size:12.5px!important;font-weight:600!important;color:var(--ui-ink)!important}
  .model-menu-heading span{font-size:11px!important;color:var(--ui-muted)!important}
  .model-menu>input{
    height:34px!important;margin:7px 0 5px!important;padding:0 10px!important;
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-sm)!important;
    background:rgba(0,0,0,.24)!important;color:var(--ui-ink)!important;font-size:12px!important
  }
  .model-menu>input:focus{border-color:var(--ui-line-strong)!important;background:rgba(0,0,0,.32)!important}
  .model-check-all{
    min-height:32px!important;margin:0 0 5px!important;padding:0 10px!important;
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-sm)!important;
    background:rgba(255,255,255,.035)!important;color:var(--ui-ink-2)!important;
    font-size:11.5px!important;font-weight:520!important
  }
  .model-check-all:hover{
    border-color:var(--ui-line-strong)!important;background:var(--ui-active)!important;color:var(--ui-ink)!important
  }
  .model-health-filters{
    border:1px solid var(--ui-line-subtle)!important;border-radius:var(--ui-radius-sm)!important;
    background:rgba(0,0,0,.2)!important
  }
  .model-health-filters button{font-size:10.5px!important}
  .model-option{min-height:46px!important;padding:6px 8px!important}
  .model-option-label{font-size:12px!important;font-weight:520!important;color:var(--ui-ink)!important}
  .model-option-meta{font-size:10.5px!important;color:var(--ui-muted)!important}
  .model-option.active .model-option-label{font-weight:600!important;color:#fff!important}
  .model-option.active .model-option-meta{color:var(--ui-ink-2)!important}

  /* 6. Settings Panel, MCP Tools & Telemetry Overlay Sheets */
  .config-panel,.overlay-panel{
    top:50px!important;left:10px!important;right:10px!important;
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-lg)!important;
    background:var(--ui-surface-2)!important;box-shadow:var(--ui-shadow-sheet)!important
  }
  .config-panel{bottom:10px!important}
  .overlay-panel{bottom:auto!important;max-height:calc(100vh - 60px)!important}
  .config-heading,.panel-heading{
    min-height:52px!important;border-bottom:1px solid var(--ui-line-subtle)!important;
    background:var(--ui-surface-2)!important
  }
  .config-heading strong,.panel-heading strong{
    color:var(--ui-ink)!important;font-size:13px!important;font-weight:600!important;letter-spacing:-.01em!important
  }
  .config-heading span,.panel-heading span{color:var(--ui-muted)!important;font-size:11px!important}
  .config-heading>button,.panel-heading>button{
    border-radius:7px!important;color:var(--ui-muted)!important;font-size:11.5px!important
  }
  .config-heading>button:hover,.panel-heading>button:hover{
    background:var(--ui-hover)!important;color:var(--ui-ink)!important
  }
  .config-section{padding:16px 0!important;border-bottom:1px solid var(--ui-line-subtle)!important}
  .config-section-heading{gap:2px!important;margin-bottom:12px!important}
  .config-section-heading strong{color:var(--ui-ink)!important;font-size:12px!important;font-weight:600!important}
  .config-section-heading span{color:var(--ui-muted)!important;font-size:11px!important}
  .config-section>label,.config-section .provider-field,.config-section .language-setting,
  .config-section .price-row>label,.profile-picker>span{
    color:var(--ui-ink-2)!important;font-size:11px!important;font-weight:500!important
  }
  .config-panel input,.config-panel select,.manual-fields input,.mcp-form input,.mcp-form select,
  .language-trigger,.profile-trigger,.provider-trigger{
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-sm)!important;
    background:rgba(0,0,0,.22)!important;color:var(--ui-ink)!important;font-size:12px!important;
    transition:border-color .14s ease,background-color .14s ease,box-shadow .14s ease!important
  }
  .config-panel input:hover,.language-trigger:hover,.profile-trigger:hover,.provider-trigger:hover,
  .manual-fields input:hover,.mcp-form input:hover,.mcp-form select:hover{
    border-color:var(--ui-line-strong)!important;background:rgba(0,0,0,.28)!important
  }
  .config-panel input:focus,.manual-fields input:focus,.mcp-form input:focus,.mcp-form select:focus,
  .language-picker.open .language-trigger,.profile-picker.open .profile-trigger,.provider-picker.open .provider-trigger{
    border-color:rgba(255,255,255,.3)!important;background:rgba(0,0,0,.32)!important;
    box-shadow:0 0 0 3px rgba(255,255,255,.055)!important
  }
  .profile-trigger>span{font-size:12px!important;font-weight:520!important}
  .provider-trigger strong{font-size:12px!important;font-weight:580!important;color:var(--ui-ink)!important}
  .provider-trigger small{font-size:10.5px!important;color:var(--ui-muted)!important}
  .key-state{color:var(--ui-muted)!important;font-size:10.5px!important}
  .profile-actions button{font-size:11px!important;color:var(--ui-muted)!important;border-radius:7px!important}
  .config-action-dock{
    padding:12px 16px 14px!important;border-top:1px solid var(--ui-line-subtle)!important;
    background:var(--ui-surface-2)!important;box-shadow:0 -8px 24px rgba(0,0,0,.14)!important
  }
  .config-actions button,.connection-page-actions button,.manual-fields button,.mcp-form button{
    height:35px!important;min-height:35px!important;border-radius:var(--ui-radius-sm)!important;
    font-size:12px!important;font-weight:560!important
  }
  .config-panel .primary,.overlay-panel .primary,.setup .primary{
    border:0!important;background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important;font-weight:600!important
  }
  .config-panel .primary:hover,.overlay-panel .primary:hover,.setup .primary:hover{
    background:var(--ui-cta-hover)!important;color:#0a0b0d!important
  }
  .config-panel .secondary,.overlay-panel .secondary,.setup .secondary,
  .connection-page-actions #retryConnection.secondary,.config-actions #runDiagnostics.secondary{
    border:1px solid var(--ui-line)!important;background:rgba(255,255,255,.045)!important;
    color:var(--ui-ink)!important;font-weight:520!important
  }
  .config-panel .secondary:hover,.overlay-panel .secondary:hover,.setup .secondary:hover,
  .connection-page-actions #retryConnection.secondary:hover,.config-actions #runDiagnostics.secondary:hover{
    border-color:var(--ui-line-strong)!important;background:var(--ui-active)!important;color:#fff!important
  }
  .config-subactions button{
    font-size:11px!important;color:var(--ui-muted)!important;border:0!important;background:transparent!important
  }
  .config-subactions button:hover{background:var(--ui-hover)!important;color:var(--ui-ink)!important}

  /* MCP Tools Cards & Rows */
  .mcp-catalog{gap:6px!important;margin:0 0 12px!important}
  .mcp-card{
    min-height:54px!important;padding:8px 10px!important;
    border:1px solid var(--ui-line-subtle)!important;border-radius:10px!important;
    background:rgba(255,255,255,.022)!important;transition:background-color .12s ease,border-color .12s ease!important
  }
  .mcp-card:hover{border-color:var(--ui-line)!important;background:var(--ui-hover)!important}
  .mcp-card-copy strong{font-size:12px!important;font-weight:560!important;color:var(--ui-ink)!important}
  .mcp-card-copy small{font-size:10.5px!important;color:var(--ui-muted)!important}
  .mcp-section-label{
    padding:10px 4px 6px!important;border-top:1px solid var(--ui-line-subtle)!important;
    color:var(--ui-faint)!important;font-size:10.5px!important;font-weight:600!important;
    text-transform:uppercase!important;letter-spacing:.04em!important
  }
  .mcp-row{border-bottom:1px solid var(--ui-line-subtle)!important;padding:8px 6px!important}
  .mcp-row-main strong{font-size:12px!important;color:var(--ui-ink)!important}
  .mcp-row-main small{font-size:10.5px!important;color:var(--ui-muted)!important}
  .mcp-action,.mcp-remove{font-size:11px!important;border-radius:var(--ui-radius-xs)!important}

  /* Telemetry Overlay Metrics */
  .telemetry-summary{border-bottom:1px solid var(--ui-line-subtle)!important}
  .metric-card{padding:11px 10px!important}
  .metric-card+.metric-card{border-left:1px solid var(--ui-line-subtle)!important}
  .metric-card strong{font-size:15px!important;font-weight:620!important;font-variant-numeric:tabular-nums!important}
  .metric-card span{font-size:10.5px!important;color:var(--ui-muted)!important}
  .telemetry-rate{
    padding:10px 8px!important;border-bottom:1px solid var(--ui-line-subtle)!important;
    font-size:11px!important;color:var(--ui-muted)!important
  }
  .telemetry-row{
    padding:8px!important;border-bottom:1px solid var(--ui-line-subtle)!important;
    border-radius:var(--ui-radius-xs)!important
  }

  /* 7. Connection Center (#setup) */
  .setup{height:calc(100vh - 44px)!important;background:var(--ui-bg)!important}
  .setup-nav{border-bottom:1px solid var(--ui-line-subtle)!important}
  .setup-hero h1{font-size:21px!important;font-weight:620!important;letter-spacing:-.022em!important;color:var(--ui-ink)!important}
  .setup-hero p{font-size:12.5px!important;color:var(--ui-muted)!important;line-height:1.55!important}
  .launch-panel{
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-lg)!important;
    background:var(--ui-surface-2)!important;box-shadow:0 10px 30px rgba(0,0,0,.2)!important
  }
  .provider-overview{border-bottom:1px solid var(--ui-line-subtle)!important;background:rgba(255,255,255,.018)!important}
  .provider-mark{border:1px solid var(--ui-line)!important;border-radius:10px!important;background:var(--ui-bg)!important}
  .provider-identity strong{font-size:12.5px!important;font-weight:600!important}
  .provider-identity span{font-size:11px!important;color:var(--ui-muted)!important}
  .launch-state{border-bottom:1px solid var(--ui-line-subtle)!important}
  .launch-state strong{font-size:12px!important;font-weight:580!important}
  .launch-state span{font-size:11.5px!important;color:var(--ui-muted)!important}
  .setup-check-result{
    border-top:1px solid var(--ui-line-subtle)!important;background:rgba(0,0,0,.16)!important;
    font-size:11px!important;color:var(--ui-muted)!important
  }
  .manual-setup{
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-md)!important;
    background:var(--ui-surface-2)!important
  }
  .manual-setup summary>span{font-size:12px!important;font-weight:540!important}
  .manual-setup summary small{font-size:10.5px!important;color:var(--ui-muted)!important}

  /* 8. Modal Dialogs & Floating Toasts */
  .modal-backdrop{background:rgba(0,0,0,.58)!important;backdrop-filter:blur(4px)!important}
  .ui-dialog,.connection-dialog{
    border:1px solid var(--ui-line)!important;border-radius:var(--ui-radius-lg)!important;
    background:var(--ui-surface-3)!important;color:var(--ui-ink)!important;
    box-shadow:var(--ui-shadow-sheet)!important
  }
  .ui-dialog-heading>strong,.connection-dialog-head strong{
    font-size:13.5px!important;font-weight:600!important;color:var(--ui-ink)!important
  }
  .ui-dialog-heading>p,.connection-dialog-head span{
    font-size:12px!important;line-height:1.5!important;color:var(--ui-muted)!important
  }
  .ui-dialog-field{font-size:11px!important;color:var(--ui-ink-2)!important}
  .ui-dialog-field input{
    height:36px!important;padding:0 10px!important;border:1px solid var(--ui-line)!important;
    border-radius:var(--ui-radius-sm)!important;background:rgba(0,0,0,.24)!important;
    color:var(--ui-ink)!important;font-size:12px!important
  }
  .ui-dialog-field input:focus{
    border-color:rgba(255,255,255,.3)!important;box-shadow:0 0 0 3px rgba(255,255,255,.055)!important
  }
  .ui-dialog-action,.connection-dialog-actions .secondary,.connection-dialog-actions .primary{
    min-height:33px!important;padding:0 13px!important;border-radius:var(--ui-radius-sm)!important;
    font-size:12px!important;font-weight:540!important
  }
  .ui-dialog-action,.connection-dialog-actions .secondary{
    border:1px solid var(--ui-line)!important;background:rgba(255,255,255,.045)!important;color:var(--ui-ink)!important
  }
  .ui-dialog-action:hover,.connection-dialog-actions .secondary:hover{
    border-color:var(--ui-line-strong)!important;background:var(--ui-active)!important;color:#fff!important
  }
  .ui-dialog-action.primary,.connection-dialog-actions .primary{
    border:0!important;background:var(--ui-cta-bg)!important;color:var(--ui-cta-ink)!important;font-weight:600!important
  }
  .ui-dialog-action.primary:hover,.connection-dialog-actions .primary:hover{
    background:var(--ui-cta-hover)!important;color:#0a0b0d!important
  }
  .ui-dialog-action.danger{
    border:1px solid rgba(226,121,128,.34)!important;background:rgba(226,121,128,.16)!important;color:#f4a8ad!important
  }
  .ui-dialog-action.danger:hover{
    border-color:rgba(226,121,128,.55)!important;background:rgba(226,121,128,.26)!important;color:#ffd8db!important
  }

  .ui-toast{
    padding:10px 10px 10px 12px!important;border:1px solid var(--ui-line)!important;
    border-radius:10px!important;background:var(--ui-surface-3)!important;
    box-shadow:var(--ui-shadow-pop)!important;color:var(--ui-ink)!important
  }
  .ui-toast p{font-size:12px!important;line-height:1.45!important}

  /* 9. Refined Thin Scrollbars (clean modern rails) */
  *{scrollbar-color:rgba(255,255,255,.16) transparent}
  *::-webkit-scrollbar{width:8px!important;height:8px!important}
  *::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15)!important}
  *::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.28)!important}
  *::-webkit-scrollbar-button:single-button{display:none!important;width:0!important;height:0!important}

  /* Responsive Narrow Sidebar Refinements */
  @media(max-width:430px){
    .composer-actions .perm-trigger{
      width:30px!important;min-width:30px!important;max-width:30px!important;padding:0!important;justify-content:center!important
    }
    .config-panel,.overlay-panel{left:6px!important;right:6px!important}
    .config-panel{bottom:6px!important}
  }
  @media(prefers-reduced-motion:reduce){
    .agent-activity:not(.archived) .activity-current.sweeping{
      animation:none!important;background:none!important;filter:none!important;-webkit-text-fill-color:var(--ui-ink-2)!important
    }
    .worked-label.working-live::before,
    .agent-activity:not(.archived) .activity-current-icon::before{animation:none!important}
  }
`;
