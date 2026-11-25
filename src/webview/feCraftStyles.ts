export const FE_CRAFT_NEXT_STYLES = String.raw`
  /* Minimal borderless Thinking disclosure (Antigravity / ChatGPT style) */
  .thinking-block{
    margin:0 0 10px;border:0;border-radius:0;background:transparent;overflow:visible
  }
  .thinking-block>summary{
    display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:2px 0;
    border:0;background:transparent;cursor:pointer;list-style:none;user-select:none;
    color:#828891;font-size:12px;font-weight:450;line-height:1.45;
    font-variant-numeric:tabular-nums;transition:color .14s ease
  }
  .thinking-block>summary::-webkit-details-marker{display:none}
  .thinking-block>summary:hover{background:transparent;color:#d6dae0}
  .thinking-dot{display:none!important}
  .thinking-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .thinking-block.is-streaming .thinking-title{
    background:linear-gradient(105deg,#747a86 0%,#747a86 34%,#b4bcc8 43%,#f6f8fc 50%,#b4bcc8 57%,#747a86 66%,#747a86 100%);
    background-size:320% 100%;background-position:100% 0;
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;
    filter:drop-shadow(0 0 6px rgba(236,240,248,.1));
    animation:rcTextShimmer 3.4s cubic-bezier(.42,0,.25,1) infinite
  }
  .thinking-caret{
    flex:none;display:inline-grid;place-items:center;color:#6d737c;
    transition:transform .14s ease,color .14s ease
  }
  .thinking-block>summary:hover .thinking-caret{color:#c5cbd3}
  .thinking-caret svg{width:12px;height:12px}
  .thinking-block[open] .thinking-caret{transform:rotate(90deg)}
  .thinking-body{
    max-height:200px;overflow-y:auto;margin:5px 0 4px 2px;padding:1px 0 1px 12px;
    border:0;border-left:1.5px solid rgba(255,255,255,.1);background:transparent;
    color:#8e949e;font:400 12px/1.62 var(--vscode-font-family);
    white-space:pre-wrap;overflow-wrap:anywhere
  }

  /* Subtle context budget indicator (auto-hidden below 20%) */
  .context-bar{
    display:flex;align-items:center;gap:8px;padding:0 13px 4px;
    font-size:10px;color:#787e88;font-variant-numeric:tabular-nums
  }
  .context-bar.hidden{display:none!important}
  .context-bar-track{
    flex:1;height:2px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden
  }
  .context-bar-track>i{
    display:block;height:100%;width:0;border-radius:inherit;background:rgba(255,255,255,.34);
    transition:width .24s ease,background-color .24s ease
  }
  .context-bar.warn .context-bar-track>i{background:#d1aa52}
  .context-bar.warn #contextBarLabel{color:#d1aa52}
  .context-bar.critical .context-bar-track>i{background:#d97777}
  .context-bar.critical #contextBarLabel{color:#d97777}
  #contextCompactBtn{
    flex:none;border:0;border-radius:5px;background:transparent;color:#9da4ae;
    padding:2px 6px;font-size:10px;font-weight:500;cursor:pointer;
    transition:background-color .12s ease,color .12s ease
  }
  #contextCompactBtn:hover{background:rgba(255,255,255,.08);color:#eef0f3}

  /* Ghost code block actions (Insert / Run / Copy) */
  .markdown-code-actions{display:inline-flex;align-items:center;gap:2px;margin-left:auto}
  .markdown-code-insert,.markdown-code-run{
    display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 7px;
    border:0;border-radius:5px;background:transparent;color:#8e949e;
    font-size:10.5px;font-weight:480;cursor:pointer;
    transition:background-color .12s ease,color .12s ease
  }
  .markdown-code-insert svg,.markdown-code-run svg{width:12px;height:12px;display:block}
  .markdown-code-insert:hover,.markdown-code-run:hover{
    background:rgba(255,255,255,.08);color:#eef0f3
  }
  .markdown-code-insert.copied{color:#78c6a3}
  .markdown-code-copy{
    width:24px!important;height:24px!important;border-radius:5px!important;color:#8e949e!important
  }
  .markdown-code-copy:hover{background:rgba(255,255,255,.08)!important;color:#eef0f3!important}
  .markdown-terminal-head{display:flex!important;align-items:center!important;gap:7px!important}

  /* History panel: balanced spacing, inset delete button, clean hover states */
  .history-panel{
    border:1px solid rgba(255,255,255,.1)!important;border-radius:12px!important;
    background:var(--vscode-editorWidget-background,#1e1f22)!important;
    box-shadow:0 12px 36px rgba(0,0,0,.44)!important
  }
  .history-heading{
    min-height:50px!important;padding:8px 10px 8px 14px!important;
    border-bottom:1px solid rgba(255,255,255,.07)!important
  }
  .history-search-wrap{padding:8px 10px 6px;border-bottom:1px solid rgba(255,255,255,.06)}
  .history-search{
    width:100%;height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.09);
    border-radius:7px;background:rgba(0,0,0,.22);color:#e5e8ec;font-size:11.5px;outline:none;
    transition:border-color .14s ease,background-color .14s ease
  }
  .history-search:focus{border-color:rgba(255,255,255,.22);background:rgba(0,0,0,.3)}
  .history-search::placeholder{color:#767c85}
  .history-list{padding:6px 8px 8px!important}
  .history-item-row{
    display:grid!important;grid-template-columns:minmax(0,1fr) repeat(4,26px)!important;
    align-items:center!important;gap:3px!important;
    min-height:48px!important;padding:4px 8px 4px 11px!important;
    border-radius:8px!important;transition:background-color .12s ease!important
  }
  .history-item-row:hover,.history-item-row:focus-within{
    background:rgba(255,255,255,.055)!important
  }
  .history-item-row:has(.history-pin.active){
    background:rgba(255,255,255,.03)
  }
  .history-item-row:has(.history-pin.active):hover,
  .history-item-row:has(.history-pin.active):focus-within{
    background:rgba(255,255,255,.065)!important
  }
  .history-item-row .history-item{
    padding:5px 6px 5px 0!important;border-left:0!important;background:transparent!important
  }
  .history-item.is-pinned{border-left:0!important;background:transparent!important}
  .history-pin,.history-rename,.history-export,.history-delete{
    display:grid!important;place-items:center!important;
    width:26px!important;height:26px!important;padding:0!important;
    border:0!important;border-radius:6px!important;background:transparent!important;
    color:#7c828c!important;cursor:pointer!important;opacity:0;
    transform:none!important;
    transition:opacity .12s ease,background-color .12s ease,color .12s ease!important
  }
  .history-pin.active{opacity:.9!important;color:#c7cdd6!important}
  .history-item-row:hover .history-pin,
  .history-item-row:focus-within .history-pin,
  .history-item-row:hover .history-rename,
  .history-item-row:focus-within .history-rename,
  .history-item-row:hover .history-export,
  .history-item-row:focus-within .history-export,
  .history-item-row:hover .history-delete,
  .history-item-row:focus-within .history-delete{opacity:1;transform:none!important}
  .history-pin:hover,.history-rename:hover,.history-export:hover{
    background:rgba(255,255,255,.09)!important;color:#eef0f3!important
  }
  .history-delete:hover{
    background:rgba(235,105,105,.16)!important;color:#f08e93!important
  }
  .history-pin svg,.history-rename svg,.history-export svg,.history-delete svg,
  .history-rename .ui-symbol,.history-export .ui-symbol,.history-delete .ui-symbol{
    display:block!important;width:13.5px!important;height:13.5px!important
  }
  @media(hover:none){
    .history-pin,.history-rename,.history-export,.history-delete{opacity:1}
  }

  /* Viewport-clamped floating tooltip for all icon actions */
  .rc-hint-bubble{
    position:fixed;z-index:1200;top:0;left:0;max-width:240px;padding:4px 8px;
    border:1px solid rgba(255,255,255,.12);border-radius:6px;
    background:#181a1d;color:#eef0f3;box-shadow:0 6px 20px rgba(0,0,0,.44);
    font:500 11px/1.3 var(--vscode-font-family);white-space:nowrap;
    overflow:hidden;text-overflow:ellipsis;pointer-events:none;
    opacity:0;visibility:hidden;transform:translateY(2px);
    transition:opacity .1s ease,visibility .1s ease,transform .1s ease
  }
  .rc-hint-bubble.visible{opacity:1;visibility:visible;transform:translateY(0)}

  /* Inline video playback & clickable timestamp chips */
  .user-video-card{position:relative}
  .user-video-card.playing-inline{width:min(320px,100%)}
  .user-video-inline-player{
    display:block;width:100%;max-height:220px;background:#000;outline:none
  }
  .user-video-expand{
    position:absolute;top:7px;right:7px;z-index:4;
    display:grid;place-items:center;width:26px;height:26px;padding:0;
    border:1px solid rgba(255,255,255,.18);border-radius:6px;
    background:rgba(16,18,21,.76);color:#eef0f3;cursor:pointer;backdrop-filter:blur(6px);
    transition:background-color .12s ease,border-color .12s ease,color .12s ease
  }
  .user-video-expand:hover{background:rgba(240,242,245,.92);border-color:transparent;color:#111316}
  .user-video-expand svg{width:13px;height:13px}
  .video-timestamp-link{
    display:inline-flex;align-items:center;padding:0 5.5px;margin:0 1px;
    border:0;border-radius:5px;background:rgba(88,174,232,.14);color:#7cc0ee;
    font:550 11px/1.55 var(--vscode-editor-font-family);font-variant-numeric:tabular-nums;
    cursor:pointer;vertical-align:baseline;
    transition:background-color .12s ease,color .12s ease
  }
  .video-timestamp-link:hover{background:rgba(88,174,232,.24);color:#b9dff9}

  @media(prefers-reduced-motion:reduce){
    .thinking-block.is-streaming .thinking-title{
      animation:none!important;background:none!important;
      -webkit-text-fill-color:#828891!important;color:#828891!important
    }
    .rc-hint-bubble{transition:none!important}
  }
`;
