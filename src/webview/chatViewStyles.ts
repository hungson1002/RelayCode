const styles = String.raw`
:root{--accent:#4ec9b0;--accent-s:rgba(78,201,176,.11);--accent-ink:#07201b;--hr:rgba(255,255,255,.09);--hr2:rgba(255,255,255,.15);--muted:var(--vscode-descriptionForeground,#858585);--r:10px}*{box-sizing:border-box}body{padding:0;margin:0;color:var(--vscode-foreground);background:var(--vscode-sideBar-background);font:13px/1.5 var(--vscode-font-family);height:100vh;overflow:hidden}button,input,textarea,select{font:inherit;color:inherit}.hidden{display:none!important}:focus-visible{outline:1px solid var(--accent);outline-offset:2px}
.route-header{display:flex;align-items:center;gap:6px;padding:8px 11px;border-bottom:1px solid var(--hr);background:color-mix(in srgb,var(--vscode-sideBar-background) 70%,var(--vscode-editor-background));height:44px}.brand{display:flex;align-items:center;gap:7px;min-width:0;flex:1}.brand-mark{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;background:rgba(78,201,176,.1);color:var(--accent);font:700 9px var(--vscode-editor-font-family);border:1px solid rgba(78,201,176,.22);flex:none}.brand>span:last-child{display:grid;line-height:1.15;min-width:0}.brand strong{font-size:12px;font-weight:600}.brand small{font-size:9px;color:var(--muted)}.route-meta{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:10px;flex:none}.dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.22);flex:none}.dot.online{background:var(--accent)}#connectionLabel{font-size:10px}#endpointLabel{font:9px var(--vscode-editor-font-family);color:var(--muted);opacity:.7;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.header-actions{display:flex;gap:1px;align-items:center}.header-action{border:0;background:transparent;color:var(--muted);font-size:10px;padding:4px 7px;cursor:pointer;border-radius:5px}.header-action:hover{background:rgba(255,255,255,.07);color:var(--vscode-foreground)}
.config-panel{position:absolute;z-index:20;top:44px;left:10px;right:10px;padding:12px 13px;border-radius:12px;border:1px solid var(--hr2);background:color-mix(in srgb,var(--vscode-sideBar-background) 55%,var(--vscode-editor-background));box-shadow:0 16px 40px rgba(0,0,0,.45)}.config-heading{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px}.config-heading>div{display:grid}.config-heading strong{font-size:12px}.config-heading span,.key-state{font-size:10px;color:var(--muted)}.config-panel label{display:grid;gap:5px;margin:9px 0;color:var(--muted);font-size:10px}.config-panel input,.config-panel select{width:100%;border:1px solid var(--hr2);border-radius:7px;background:color-mix(in srgb,var(--vscode-sideBar-background) 40%,var(--vscode-editor-background));padding:7px 9px;outline:none}.config-panel input:focus,.config-panel select:focus{border-color:var(--accent)}.language-setting{padding:9px 0 10px;border-bottom:1px solid var(--hr)}.language-setting select{height:32px;color:var(--vscode-foreground)}.key-state{margin:-4px 0 8px}.key-state.saved{color:var(--accent)}
.attachment-list{display:flex;gap:5px;flex-wrap:wrap;padding:0 0 4px}.attachment-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 7px;border-radius:999px;background:rgba(78,201,176,.1);color:var(--accent);font-size:10px;border:1px solid rgba(78,201,176,.22)}.attachment-chip button{border:0;background:transparent;color:inherit;padding:0;cursor:pointer;line-height:1}
.setup{height:calc(100vh - 44px);overflow:auto;padding:22px 13px 28px}.setup-hero{max-width:340px}.setup-hero h1{font-size:21px;line-height:1.15;letter-spacing:-.03em;margin:16px 0 8px;max-width:300px}.setup-hero p{color:var(--muted);font-size:12px;margin:0;max-width:300px}.signal-map{display:grid;grid-template-columns:32px minmax(14px,1fr) 32px minmax(14px,1fr) 32px;align-items:center;max-width:250px}.signal-node{display:grid;place-items:center;height:28px;border:1px solid var(--hr2);border-radius:7px;color:var(--muted);font:650 9px var(--vscode-editor-font-family);background:color-mix(in srgb,var(--vscode-sideBar-background) 70%,var(--vscode-editor-background))}.router-node{border-color:rgba(78,201,176,.4);color:var(--accent);background:rgba(78,201,176,.08)}.signal-wire{height:1px;background:var(--hr2);overflow:hidden}.signal-wire i{display:none;height:1px;width:38%;background:var(--accent)}.signal-map.launching .signal-wire i{display:block;animation:signal 1.25s ease-in-out infinite}.signal-map.ready .signal-wire{background:rgba(78,201,176,.4)}
.launch-panel{margin-top:20px;padding:12px;border:1px solid var(--hr2);border-radius:var(--r);background:color-mix(in srgb,var(--vscode-sideBar-background) 60%,var(--vscode-editor-background))}.launch-state{display:flex;gap:9px;align-items:flex-start;margin-bottom:12px}.state-mark{flex:none;width:8px;height:8px;margin-top:4px;border:2px solid var(--muted);border-radius:50%}.launch-state>div{display:grid;gap:2px}.launch-state strong{font-size:12px}.launch-state span{font-size:10px;color:var(--muted)}.launch-panel.launching .state-mark{border-color:var(--accent);border-top-color:transparent;animation:spin .8s linear infinite}.launch-panel.ready .state-mark{border:0;background:var(--accent)}
.primary,.secondary{min-height:32px;border-radius:7px;padding:7px 11px;font-weight:600;cursor:pointer;white-space:nowrap}.primary{width:100%;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink)}.primary:hover{filter:brightness(1.07)}.primary:active,.secondary:active{transform:translateY(1px)}.primary:disabled{opacity:.5;cursor:wait}.secondary{border:1px solid var(--hr2);background:color-mix(in srgb,var(--vscode-sideBar-background) 50%,var(--vscode-editor-background));color:var(--vscode-foreground)}.secondary:hover{border-color:rgba(78,201,176,.4)}.button-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}.full{width:100%}
.manual-setup{margin-top:11px;border:1px solid var(--hr);border-radius:var(--r);background:color-mix(in srgb,var(--vscode-sideBar-background) 70%,var(--vscode-editor-background))}.manual-setup summary{padding:10px 12px;cursor:pointer;color:var(--muted);font-size:11px}.manual-setup[open] summary{border-bottom:1px solid var(--hr);color:var(--vscode-foreground)}.manual-fields{padding:4px 12px 12px}.manual-fields label{display:grid;gap:5px;margin:10px 0;color:var(--muted);font-size:10px}.manual-fields input{width:100%;border:1px solid var(--hr2);border-radius:7px;background:color-mix(in srgb,var(--vscode-sideBar-background) 40%,var(--vscode-editor-background));padding:8px 9px;outline:none}.manual-fields input:focus{border-color:var(--accent);box-shadow:0 0 0 1px rgba(78,201,176,.2)}#setupError{margin:10px 1px 0;padding:9px 10px;border-left:2px solid var(--vscode-errorForeground);background:color-mix(in srgb,var(--vscode-errorForeground) 8%,transparent);color:var(--vscode-errorForeground);font-size:10px}
.console{display:grid;grid-template-rows:auto 1fr auto auto;height:calc(100vh - 44px)}.controls{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;padding:9px 12px;border-bottom:1px solid var(--hr)}.status-action{border:1px solid var(--hr2);border-radius:6px;background:transparent;color:var(--muted);font-size:10px;padding:0 8px;height:26px;cursor:pointer}.status-action:hover{border-color:rgba(78,201,176,.4);color:var(--accent)}
.messages{overflow-y:auto;padding:16px 12px 20px}.empty{margin:18vh auto 0;max-width:220px;text-align:center;color:var(--muted)}.empty-glyph{font:30px var(--vscode-editor-font-family);color:var(--accent);transform:rotate(-10deg)}.empty h2{color:var(--vscode-foreground);font-size:15px;margin:5px 0}.empty p{font-size:11px}.message{margin:0 0 16px}.message .label{font:600 10px var(--vscode-editor-font-family);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px}.message.user .body{padding:8px 11px;background:rgba(255,255,255,.04);border-radius:4px 10px 10px 10px;font-size:12.5px}.message.assistant .label{color:var(--accent)}.message .body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px}.message.error .body{color:var(--vscode-errorForeground)}
.status{display:flex;gap:7px;align-items:center;border-top:1px solid var(--hr);padding:6px 12px;color:var(--muted);font-size:11px}.spinner{width:9px;height:9px;border:1.5px solid var(--hr2);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
.composer-shell{margin:0 9px 9px;border:1px solid var(--hr2);border-radius:12px;background:color-mix(in srgb,var(--vscode-sideBar-background) 60%,var(--vscode-editor-background));padding:8px 10px;transition:border-color .15s}.composer-shell:focus-within{border-color:rgba(78,201,176,.45)}textarea{resize:none;width:100%;border:0;outline:0;background:transparent;padding:2px 0 6px;line-height:1.5;font-size:13px;min-height:20px;max-height:180px;overflow-y:auto}.composer-toolbar{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px}.context-toggle{display:flex;gap:5px;align-items:center;color:var(--muted);font-size:10px;cursor:pointer;user-select:none}.context-toggle input{accent-color:var(--accent);margin:0}.attach-actions{display:flex;gap:4px}.tool-button{border:1px solid var(--hr2);border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;transition:border-color .12s,color .12s}.tool-button:hover{border-color:rgba(78,201,176,.4);color:var(--accent)}.plus-button{font-size:15px;line-height:1;width:26px;height:26px;padding:0;display:grid;place-items:center}
.composer-actions{display:flex;align-items:center;gap:5px;padding-top:4px}.mode-switch{display:flex;border:1px solid var(--hr2);border-radius:7px;padding:2px;gap:1px;flex:none}.mode-switch button{border:0;border-radius:5px;padding:3px 9px;background:transparent;color:var(--muted);font-size:11px;cursor:pointer;font-weight:500;transition:background .12s,color .12s}.mode-switch button.active{background:rgba(78,201,176,.14);color:var(--accent)}.mode-switch button:not(.active):hover{color:var(--vscode-foreground)}
.perm-wrap{position:relative;flex:none}.perm-trigger{display:flex;align-items:center;gap:4px;height:26px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--muted);padding:0 6px;font-size:10px;cursor:pointer;white-space:nowrap;transition:background .12s,color .12s}.perm-trigger:hover,.perm-wrap.open .perm-trigger{background:rgba(255,255,255,.07);color:var(--vscode-foreground)}.perm-arrow{transition:transform .18s;flex:none;opacity:.7}.perm-wrap.open .perm-arrow{transform:rotate(180deg)}.perm-trigger.full{color:#e6c13a}.perm-menu{position:absolute;bottom:calc(100% + 6px);left:0;min-width:170px;border:1px solid var(--hr2);border-radius:9px;background:color-mix(in srgb,var(--vscode-sideBar-background) 30%,#111);box-shadow:0 8px 28px rgba(0,0,0,.5);overflow:hidden;z-index:50;animation:dropIn .15s ease-out}.perm-opt{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:var(--vscode-foreground);padding:8px 12px;font-size:11px;cursor:pointer;text-align:left;transition:background .1s}.perm-opt:hover{background:rgba(78,201,176,.09);color:var(--accent)}.perm-opt:first-child{padding-top:10px}.perm-opt:last-child{padding-bottom:10px}.perm-check{width:12px;font-size:10px;color:var(--accent);visibility:hidden}.perm-opt.active .perm-check{visibility:visible}
select{appearance:none;flex:1;min-width:70px;height:26px;border:1px solid var(--hr2);border-radius:6px;background:color-mix(in srgb,var(--vscode-sideBar-background) 50%,var(--vscode-editor-background));padding:0 18px 0 8px;outline:none;font-size:11px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' fill='none'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23858585' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;color-scheme:dark}select:focus{border-color:rgba(78,201,176,.4)}
.send{display:grid;place-items:center;border:0;width:26px;height:26px;border-radius:50%;background:rgba(78,201,176,.18);color:var(--accent);font-size:13px;font-weight:800;cursor:pointer;transition:background .15s,color .15s;flex:none}.send:not(:disabled):hover{background:var(--accent);color:var(--accent-ink)}.send:disabled{opacity:.3;cursor:default}
.permission-card,.change-card{display:grid;gap:7px;margin:0 0 12px;padding:11px 12px;border:1px solid var(--hr2);border-radius:10px;background:rgba(255,255,255,.03)}.permission-card strong,.change-card strong{font-size:11px;color:var(--accent)}.permission-card span,.change-card span{font-size:11px;overflow-wrap:anywhere;color:var(--muted)}.permission-card div,.change-card div{display:flex;gap:6px}.permission-card button,.change-card button{border:1px solid var(--hr2);border-radius:6px;background:transparent;color:var(--vscode-foreground);padding:4px 10px;cursor:pointer;font-size:10px;font-weight:500;transition:background .1s}.permission-card button:hover,.change-card button:hover{background:rgba(255,255,255,.06)}.permission-allow,.change-accept{background:rgba(78,201,176,.12)!important;color:var(--accent)!important;border-color:rgba(78,201,176,.3)!important}.permission-allow:hover,.change-accept:hover{background:var(--accent)!important;color:var(--accent-ink)!important}.change-summary{display:flex;align-items:center;gap:6px}.diff-add{color:#4ec994;font-weight:600}.diff-remove{color:#f47e7e;font-weight:600}
@keyframes signal{0%{transform:translateX(-120%)}70%,100%{transform:translateX(340%)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes dropIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}@media(max-width:260px){.button-row{grid-template-columns:1fr}.setup{padding-inline:10px}}
`;

const redesignStyles = '';

const interactionStyles = '';
const finalStyles = String.raw`.console{display:flex;flex-direction:column;height:calc(100vh - 44px)}.messages{flex:1 1 auto;min-height:0}.status{flex:0 0 auto}.composer-shell{flex:0 0 auto;align-self:stretch;min-height:0}.composer-shell textarea{height:28px;min-height:28px;max-height:180px}`;
const bubbleStyles = String.raw`.message.user{display:flex;flex-direction:column;align-items:flex-end}.message.user .label{display:none}.message.user .body{width:max-content;max-width:82%;padding:9px 13px;border-radius:15px 15px 4px 15px;background:#2a2b2d;color:#e5e5e5;text-align:left}.message.assistant{display:block;max-width:100%}.message.assistant .body{max-width:100%}.user-attachments{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;max-width:82%;margin:0 0 7px;order:-1}.user-attachments img{display:block;width:96px;height:96px;object-fit:cover;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:#202124}.user-file{display:inline-flex;align-items:center;max-width:210px;padding:7px 10px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#252628;color:#c9c9c9;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message.user:has(.user-attachments) .body{margin-top:0}`;
const polishStyles = String.raw`.composer-shell,.composer-shell:focus-within{background:#252628!important;border-color:#3b3d40!important;box-shadow:none!important}.composer-shell textarea,.composer-shell textarea:focus,.composer-shell textarea:focus-visible{background:#252628!important;outline:none!important;box-shadow:none!important;border:0!important}.composer-toolbar{justify-content:flex-end}.model-picker{position:relative;flex:1;min-width:90px}.model-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:28px;border:1px solid #45474b;border-radius:7px;background:#2b2d30;color:#d5d5d5;padding:0 9px;font-size:11px;cursor:pointer}.model-trigger:hover{background:#323437}.model-arrow,.perm-arrow{font-size:14px;line-height:1;opacity:.72;transform:translateY(-1px)}.perm-wrap.open .perm-arrow{transform:rotate(180deg)}.model-menu{position:absolute;z-index:60;bottom:calc(100% + 7px);left:0;right:0;min-width:220px;max-height:330px;padding:7px;border:1px solid #45474b;border-radius:12px;background:#242527;box-shadow:0 18px 50px rgba(0,0,0,.55)}.model-menu input{width:100%;height:31px;margin-bottom:6px;border:1px solid #44474b;border-radius:7px;background:#1b1c1e;color:#e1e1e1;padding:0 9px;outline:none}.model-menu input:focus{border-color:#666b71}.model-options{max-height:275px;overflow-y:auto}.model-option{display:block;width:100%;border:0;border-radius:6px;background:transparent;color:#c9c9c9;padding:7px 9px;text-align:left;font-size:11px;cursor:pointer}.model-option:hover,.model-option.active{background:#343639;color:#fff}.modal-backdrop{position:absolute;z-index:100;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.6);backdrop-filter:blur(3px)}.access-dialog{width:min(360px,100%);padding:17px;border:1px solid #484a4e;border-radius:15px;background:#292a2d;box-shadow:0 24px 70px rgba(0,0,0,.62)}.access-dialog strong{display:block;font-size:14px;margin-bottom:7px}.access-dialog p{margin:0 0 16px;color:#aaaeb3;font-size:11px;line-height:1.55}.access-dialog>div{display:flex;justify-content:flex-end;gap:8px}.danger-confirm{min-height:32px;border:1px solid #d6b52c;border-radius:8px;background:#d6b52c;color:#211b00;padding:6px 11px;font-weight:650;cursor:pointer}.context-toggle{display:none!important}`;
const changeStyles = String.raw`.change-tray{flex:0 0 auto;margin:0 10px 8px;border:1px solid #34363a;border-radius:12px;background:#252628;overflow:hidden}.change-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:6px;align-items:center;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px}.change-row>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d7d7d7}.tray-review,.tray-undo,.tray-button,.tray-accept{border:0;border-radius:7px;background:transparent;color:#b8bdc2;padding:5px 7px;cursor:pointer;font-size:10px}.tray-review:hover,.tray-undo:hover,.tray-button:hover{background:#34363a;color:#fff}.change-tray-footer{display:flex;align-items:center;gap:6px;padding:8px 10px;color:#aeb4ba;font-size:10px}.change-tray-footer span{flex:1}.tray-accept{background:#2188d9;color:#fff;font-weight:650}.tray-accept:hover{background:#3198e8}.chat-change-summary{display:flex;align-items:center;gap:8px;margin:4px 0 15px;padding:10px 12px;border:1px solid #34363a;border-radius:11px;background:#252628;color:#c8cbd0;font-size:11px}.chat-change-summary span{flex:1}.chat-change-summary button{border:1px solid #424449;border-radius:7px;background:transparent;color:#d7d7d7;padding:5px 9px;font-size:10px;cursor:pointer}.chat-change-summary button:hover{background:#34363a;color:#fff}`;
const historyStyles = String.raw`.history-panel{position:absolute;z-index:75;top:48px;right:10px;width:min(340px,calc(100% - 20px));max-height:min(520px,calc(100vh - 64px));overflow:hidden;border:1px solid #414347;border-radius:14px;background:#252628;box-shadow:0 22px 65px rgba(0,0,0,.58)}.history-heading{display:flex;align-items:center;padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.07)}.history-heading strong{flex:1;font-size:12px}.history-heading button{width:25px;height:25px;border:0;border-radius:7px;background:transparent;color:#aeb2b6;cursor:pointer;font-size:16px}.history-heading button:hover{background:#343639;color:#fff}.history-list{max-height:450px;overflow:auto;padding:6px}.history-empty{padding:24px 12px;color:#85898e;text-align:center;font-size:11px}.history-item{display:grid;width:100%;gap:2px;border:0;border-radius:9px;background:transparent;color:#d5d7da;padding:9px 10px;text-align:left;cursor:pointer}.history-item:hover{background:#323437}.history-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.history-item time{color:#85898e;font-size:9px}.message .label{margin:6px 0 0!important;color:#777c81!important;font:9px/1.3 var(--vscode-font-family)!important;text-transform:none!important;letter-spacing:0!important}.message.user .label{display:block!important;align-self:flex-end}.message.assistant .label{color:#777c81!important}.attachment-list{padding:0 0 6px}.attachment-preview{position:relative;width:58px;height:58px;border:1px solid #45484c;border-radius:10px;background:#1d1f21;overflow:hidden;cursor:zoom-in}.attachment-preview img{display:block;width:100%;height:100%;object-fit:cover}.attachment-preview button{position:absolute;top:3px;right:3px;width:18px;height:18px;border:0;border-radius:50%;background:rgba(238,238,238,.9);color:#191a1b;line-height:18px;padding:0;cursor:pointer}.user-attachments img{cursor:zoom-in}.image-lightbox{position:absolute;z-index:120;inset:0;display:grid;place-items:center;padding:32px;background:rgba(8,9,10,.86);backdrop-filter:blur(8px)}.image-lightbox img{display:block;max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;box-shadow:0 22px 70px rgba(0,0,0,.65)}.image-lightbox button{position:absolute;top:14px;right:14px;width:32px;height:32px;border:1px solid #51545a;border-radius:50%;background:#292b2e;color:#f0f0f0;font-size:19px;cursor:pointer}`;
const compactStyles = String.raw`.route-header{padding:7px 10px}.route-meta{flex:1;min-width:72px}.route-meta #connectionLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8cacc;font-size:11px}.header-actions{min-width:0;flex:none;gap:0}.header-action{padding:4px 6px}.empty{margin-top:20vh}.empty h2{font-size:16px;letter-spacing:-.015em}.empty p{max-width:290px;margin:7px auto 0;line-height:1.6}.console{overflow-x:hidden}.config-actions{display:flex;gap:7px}.config-actions .primary{flex:1}.config-actions .secondary{min-width:88px}.mode-switch button.active{background:#f0f1f2!important;color:#17191b!important}.mode-switch button.active:hover{color:#17191b!important}.model-trigger{justify-content:flex-start}.model-menu{left:auto!important;right:0!important;width:280px!important;min-width:0!important;max-width:calc(100vw - 16px)!important}.send{width:32px!important;height:32px!important;background:#f0f1f2!important;color:#17191b!important}.send svg{width:19px;height:19px;display:block}.send:not(:disabled):hover{background:#fff!important;color:#111315!important}.send:disabled{background:#45484d!important;color:#9b9ea3!important;opacity:.58}.composer-actions{gap:7px}.perm-trigger{padding-inline:5px}@media(max-width:360px){#openExternal{display:none}.header-action{padding-inline:5px}.composer-actions{gap:4px}.mode-switch button{padding-inline:7px}.perm-trigger{max-width:88px;overflow:hidden;text-overflow:ellipsis}.send{width:30px!important;height:30px!important}}`;
const providerStyles = String.raw`.config-panel{z-index:90;background:#242527;border-color:#424449;overflow:visible}.provider-field{display:grid;gap:5px;margin:9px 0;color:#a7abb0;font-size:10px}.provider-field>span,#apiKeyField>span{color:#a7abb0}.provider-picker{position:relative}.provider-trigger{display:flex;align-items:center;width:100%;min-height:44px;border:1px solid #46494e;border-radius:9px;background:#2b2d30;color:#e5e6e7;padding:7px 11px;text-align:left;cursor:pointer}.provider-trigger:hover,.provider-picker.open .provider-trigger{background:#303236;border-color:#5a5d62}.provider-trigger>span{display:grid;gap:1px;min-width:0}.provider-trigger strong{font-size:11px;font-weight:600}.provider-trigger small{color:#92979c;font-size:9px}.provider-menu{position:absolute;z-index:110;top:calc(100% + 6px);left:0;right:0;max-height:min(330px,55vh);overflow:auto;padding:6px;border:1px solid #484b50;border-radius:12px;background:#242527;box-shadow:0 20px 54px rgba(0,0,0,.62);animation:dropIn .12s ease-out}.provider-option{display:grid;width:100%;gap:2px;border:0;border-radius:8px;background:transparent;color:#d8dade;padding:8px 10px;text-align:left;cursor:pointer}.provider-option strong{font-size:11px;font-weight:560}.provider-option small{color:#8f949a;font-size:9px}.provider-option:hover{background:#323438}.provider-option.active{background:#393b3f;color:#fff}.provider-option.active small{color:#b4b8bd}.config-panel input:disabled{opacity:.65;cursor:not-allowed;background:#202123}.config-panel .key-state.local{color:#a9adb2}.config-panel .key-state{min-height:15px}.diagnostics-result{margin:10px 0 0;padding:8px 10px;border:1px solid #404247;border-radius:8px;background:#202123;color:#aeb2b7;font-size:10px;line-height:1.45;overflow-wrap:anywhere}.diagnostics-result.checking{color:#b8bcc1}.diagnostics-result.success{border-color:rgba(78,201,176,.28);background:rgba(78,201,176,.07);color:#79d8c5}.diagnostics-result.failure{border-color:rgba(244,126,126,.28);background:rgba(244,126,126,.07);color:#f08c8c}.config-actions .secondary:disabled{opacity:.58;cursor:wait}`;
const advancedStyles = String.raw`.overlay-panel{position:absolute;z-index:95;top:44px;left:8px;right:8px;max-height:calc(100vh - 54px);overflow:auto;padding:14px;border:1px solid #424449;border-radius:15px;background:#242527;box-shadow:0 24px 70px rgba(0,0,0,.68)}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px}.panel-heading>div{display:grid;gap:2px}.panel-heading strong{font-size:13px}.panel-heading span{color:#959a9f;font-size:10px}.profile-bar{display:flex;align-items:flex-end;gap:8px;margin:4px 0 10px}.profile-bar>div{display:grid;gap:5px;min-width:0;flex:1}.profile-bar>div>span{color:#a7abb0;font-size:10px}.profile-list{display:flex;gap:5px;overflow:auto;padding-bottom:2px}.profile-chip{flex:none;border:1px solid #484b50;border-radius:8px;background:#2b2d30;color:#cdd0d3;padding:6px 9px;font-size:10px;cursor:pointer}.profile-chip.active{border-color:#4ec9b0;background:rgba(78,201,176,.12);color:#8ae0cf}.profile-chip:hover{background:#34363a}.profile-new{min-height:29px;padding:5px 9px;font-size:10px}.price-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.config-subactions{display:flex;gap:7px;margin-top:8px}.config-subactions .secondary{flex:1;font-size:10px}.telemetry-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.metric-card{min-width:0;padding:10px;border:1px solid #3d4045;border-radius:10px;background:#2b2d30}.metric-card strong{display:block;color:#f0f1f2;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.metric-card span{color:#92979f;font-size:9px}.telemetry-rate{margin-top:9px;padding:9px 10px;border:1px solid #3d4045;border-radius:9px;background:#202123;color:#bfc3c7;font-size:10px}.telemetry-list{display:grid;gap:5px;margin-top:9px;max-height:270px;overflow:auto}.telemetry-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:7px 8px;border-radius:8px;background:#2b2d30;color:#c9ccd0;font-size:10px}.telemetry-row small{color:#92979f}.telemetry-row b{color:#79d8c5;font-weight:500}.panel-link{margin-top:10px;border:0;background:transparent;color:#999fa5;font-size:10px;cursor:pointer}.panel-link:hover{color:#fff}.mcp-list{display:grid;gap:6px;margin-bottom:13px}.mcp-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #3d4045;border-radius:9px;background:#2b2d30}.mcp-row strong{display:block;font-size:10px}.mcp-row small{color:#92979f;font-size:9px}.mcp-state{font-size:10px;color:#f08c8c}.mcp-state.online{color:#79d8c5}.mcp-remove{border:0;background:transparent;color:#999fa5;cursor:pointer}.mcp-form{display:grid;gap:7px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08)}.mcp-form strong{font-size:11px}.mcp-form input,.mcp-form select{width:100%;height:31px;border:1px solid #45484d;border-radius:7px;background:#1e2022;color:#d7dadd;padding:0 9px;outline:none}.mcp-form input:focus,.mcp-form select:focus{border-color:#4ec9b0}.mcp-form .primary{min-height:31px}.model-check-all{display:block;width:100%;margin:5px 0 6px;border:1px solid #3e4247;border-radius:7px;background:#2b2d30;color:#bfc3c7;padding:6px 8px;text-align:left;font-size:10px;cursor:pointer}.model-check-all:hover{background:#34363a;color:#fff}.model-option{display:flex!important;align-items:center;gap:7px}.model-health{width:13px;flex:none;font-size:11px;color:#777c81}.model-health.ok{color:#79d8c5}.model-health.error{color:#f08c8c}.model-health.checking{color:#d6b52c}.checkpoint-card{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:9px 10px;border:1px solid #3d4045;border-radius:9px;background:#242b29;color:#a9d7cb;font-size:10px}.checkpoint-card span{flex:1}.checkpoint-card button{border:1px solid #53645f;border-radius:6px;background:transparent;color:#c7e5dc;padding:4px 7px;font-size:10px;cursor:pointer}`;
const dropdownFixStyles = String.raw`.model-picker{min-width:0}.model-menu{box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;height:auto;max-height:min(330px,calc(100vh - 86px));min-height:0}.model-menu>input,.model-menu>.model-check-all{flex:0 0 auto}.model-options{flex:1 1 auto;min-height:0;max-height:none!important;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:auto}.model-option{min-width:0;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.model-option>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-height:460px){.model-menu{max-height:calc(100vh - 72px)}}`;
const mcpGalleryStyles = String.raw`#mcpPanel{background:#202123}.mcp-catalog{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:15px}.mcp-card{position:relative;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:9px;min-width:0;min-height:62px;padding:9px;border:1px solid #3b3d41;border-radius:12px;background:#292a2d;color:#e1e2e4;text-align:left;cursor:pointer}.mcp-card:hover{border-color:#56595e;background:#303135}.mcp-card:focus-visible{outline:1px solid #878b91;outline-offset:2px}.mcp-card.connected{border-color:rgba(104,215,189,.35);cursor:default}.mcp-card.pending{border-color:rgba(214,181,44,.4)}.mcp-card.failed{border-color:rgba(240,140,140,.38)}.mcp-brand-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid #484a4f;border-radius:9px;background:#1d1e20;color:#f0f1f2}.mcp-brand-icon svg{width:20px;height:20px;display:block}.mcp-card-copy{display:grid;gap:1px;min-width:0}.mcp-card-copy strong{font-size:11px;font-weight:620}.mcp-card-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#92969c;font-size:9px}.mcp-card.failed .mcp-card-copy small{color:#f0a0a0}.mcp-card-state{position:absolute;top:7px;right:7px;width:6px;height:6px;border-radius:50%;background:#62666c}.mcp-card.connected .mcp-card-state{background:#68d7bd;box-shadow:0 0 0 3px rgba(104,215,189,.08)}.mcp-card.pending .mcp-card-state{background:#d6b52c}.mcp-card.failed .mcp-card-state{background:#f08c8c}.mcp-section-label{margin:0 0 7px;color:#85898f;font-size:9px;text-transform:uppercase;letter-spacing:.09em}.mcp-list{margin-bottom:10px}.mcp-row{grid-template-columns:minmax(0,1fr) auto!important}.mcp-row-main{display:flex;align-items:center;gap:8px;min-width:0}.mcp-row-main>span{display:grid;min-width:0}.mcp-row-main strong,.mcp-row-main small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mcp-row.has-error .mcp-row-main small{color:#f0a0a0}.mcp-row-actions{display:flex;align-items:center;gap:4px}.mcp-action{border:1px solid #484b50;border-radius:7px;background:transparent;color:#c8cbd0;padding:5px 8px;font-size:9px;cursor:pointer}.mcp-action:hover{background:#36383c;color:#fff}.mcp-action:disabled{opacity:.58;cursor:wait}.mcp-action.login{background:#eceef0;color:#17191b;border-color:#eceef0;font-weight:620}.mcp-action.logout{color:#b0b4b9}.mcp-remove{width:24px;height:24px;border-radius:7px!important}.mcp-custom{border-top:1px solid rgba(255,255,255,.07);padding-top:3px}.mcp-custom summary{padding:9px 1px;color:#aeb2b7;font-size:10px;cursor:pointer}.mcp-custom[open] summary{color:#e1e3e5}.mcp-form{gap:7px!important;padding-top:3px!important;border-top:0!important}.mcp-form input,.mcp-form select{height:32px!important;background:#292a2d!important}.mcp-empty{padding:12px;border:1px dashed #3b3d41;border-radius:10px;color:#85898f;text-align:center;font-size:10px}@media(max-width:330px){.mcp-catalog{grid-template-columns:1fr}.mcp-card{min-height:56px}}`;
const chatExperienceStyles = String.raw`
.message.assistant{color:#d9dade}.message.assistant .body{white-space:normal;line-height:1.78;font-size:13.5px;font-weight:450}.message.assistant .body:empty{display:none}.message.assistant .body p{margin:0 0 13px}.message.assistant .body p:last-child{margin-bottom:0}.message.assistant .body h1,.message.assistant .body h2,.message.assistant .body h3,.message.assistant .body h4{margin:18px 0 9px;color:#f2f3f4;font-size:14px;line-height:1.5;font-weight:760}.message.assistant .body strong{color:#f4f5f6;font-weight:760}.message.assistant .body ul,.message.assistant .body ol{margin:9px 0 15px;padding-left:24px}.message.assistant .body ul{list-style:disc}.message.assistant .body li{margin:7px 0;padding-left:4px}.message.assistant .body li::marker{color:#c3c6ca}.message.assistant .body a,.rich-link{border:0;background:transparent;color:#58aee8;padding:0;text-decoration:none;cursor:pointer;font-weight:650}.message.assistant .body a:hover,.rich-link:hover{text-decoration:underline}.inline-code{display:inline-flex;align-items:center;max-width:100%;border:0;border-radius:6px;background:#303236;color:#edf0f2;padding:1px 6px;font:600 11.5px/1.6 var(--vscode-editor-font-family);vertical-align:baseline}.file-link{display:inline-flex;align-items:baseline;gap:4px;max-width:100%;border:0;background:transparent;color:#58aee8;padding:0;font:650 13px/1.65 var(--vscode-font-family);cursor:pointer;vertical-align:baseline}.file-link:hover{text-decoration:underline}.file-glyph{font:700 11px var(--vscode-editor-font-family);color:#58aee8}.file-line{color:#79b9e5;font-weight:550}.message.assistant pre{margin:13px 0;padding:11px 12px;border:1px solid #35383c;border-radius:11px;background:#202123;overflow:auto;color:#e2e4e6;font:11px/1.62 var(--vscode-editor-font-family)}.message.assistant blockquote{margin:11px 0;padding:3px 0 3px 12px;border-left:2px solid #5b5e63;color:#b1b4b8}.message.error{margin:10px 0 18px}.message.error .body{display:grid!important;grid-template-columns:22px minmax(0,1fr);gap:12px;align-items:start;padding:12px 14px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:#343434;color:#d7d7d7!important;line-height:1.55;font-weight:450}.message.error .body::before{content:"!";display:grid;place-items:center;width:18px;height:18px;margin-top:1px;border:2px solid #d0d0d0;border-radius:50%;color:#d0d0d0;font:750 11px/1 var(--vscode-font-family)}.message.error .body p{min-width:0;margin:0}.message.error .label{display:none}.message.user .body{font-weight:520;line-height:1.65}.agent-activity{display:grid;gap:7px;margin:0 0 14px}.activity-row{display:flex;align-items:center;min-width:0;color:#8f949b;font-size:11.5px}.activity-copy{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.activity-row.active .activity-copy{color:transparent!important;-webkit-text-fill-color:transparent;background:linear-gradient(100deg,#666b72 5%,#ffffff 42%,#747980 78%);background-size:240% 100%;background-clip:text;-webkit-background-clip:text;animation:activityShimmer 2.7s linear infinite}.activity-row.done .activity-copy{color:#858a90;-webkit-text-fill-color:currentColor}.activity-row.stopped .activity-copy{color:#d0a36c;-webkit-text-fill-color:currentColor}.send.running{opacity:1!important;background:#e1e3e5!important;color:#202123!important}.send.running svg{display:none}.send.running::before{content:"";width:8px;height:8px;border-radius:2px;background:currentColor}.send.running:hover{background:#fff!important}.send.stopping{opacity:.55!important;cursor:wait}.message .label{margin-top:9px}.message.assistant .label{color:#7f8388;text-transform:none;letter-spacing:0;font-weight:450}.composer-shell textarea:disabled{opacity:1;color:var(--vscode-foreground)}@keyframes activityShimmer{0%{background-position:190% 0}100%{background-position:-50% 0}}@media(prefers-reduced-motion:reduce){.activity-row.active .activity-copy{color:#d4d7da!important;-webkit-text-fill-color:currentColor;background:none;animation:none}}
.agent-commentary{margin:4px 0 14px;color:#d4d7da;font-size:12.5px;line-height:1.7}.agent-commentary p{margin:0 0 8px}.agent-commentary p:last-child{margin-bottom:0}.agent-commentary a{color:#58aee8;text-decoration:none}.agent-commentary a:hover{text-decoration:underline}
.history-panel.expanded{top:12px;bottom:12px;max-height:none}.history-panel.expanded .history-list{max-height:none;flex:1}.history-panel.expanded{display:flex;flex-direction:column}.history-item-row{display:grid;grid-template-columns:minmax(0,1fr) 28px;gap:3px;align-items:center}.history-item-row .history-item{min-width:0}.history-delete{display:grid;place-items:center;width:27px;height:27px;border:0;border-radius:7px;background:transparent;color:#85898e;cursor:pointer}.history-delete:hover{background:#3a3031;color:#ef9999}.history-delete svg{width:14px;height:14px}.history-view-all{display:block;width:calc(100% - 12px);margin:0 6px 7px;border:0;border-top:1px solid rgba(255,255,255,.07);background:transparent;color:#aeb2b7;padding:9px 10px 4px;text-align:left;font-size:10.5px;cursor:pointer}.history-view-all:hover{color:#fff}.change-tray-footer{flex-wrap:wrap}.change-tray-footer #changeCount{min-width:120px}.chat-change-summary span{cursor:pointer}
.collapsed-changes{display:flex;align-items:center;gap:9px;flex:0 0 auto;margin:0 10px 8px;padding:9px 11px;border:1px solid #35383c;border-radius:11px;background:#242629;color:#c8cbd0;font-size:10.5px}.collapsed-changes span{flex:1}.collapsed-changes button{border:1px solid #44474c;border-radius:7px;background:transparent;color:#d8dade;padding:5px 9px;font-size:10px;cursor:pointer}.collapsed-changes button:hover{background:#333539;color:#fff}.model-check-all.checking{color:#e2c85c;border-color:rgba(226,200,92,.35)}.model-check-all.checking:hover{background:#343128}
.composer-menu{position:absolute;z-index:72;left:10px;right:10px;bottom:calc(100% - 8px);display:grid;gap:2px;max-height:230px;overflow:auto;padding:6px;border:1px solid #46494e;border-radius:12px;background:#25272a;box-shadow:0 18px 48px rgba(0,0,0,.55)}.composer-menu button{display:grid;grid-template-columns:76px 1fr;gap:10px;width:100%;border:0;border-radius:7px;background:transparent;color:#dfe1e3;padding:7px 9px;text-align:left;cursor:pointer}.composer-menu button:hover{background:#34363a}.composer-menu button span:last-child{color:#92979d}.composer-shell{position:relative}.terminal-card{margin:7px 0 14px;border:1px solid #383b40;border-radius:11px;background:#202225;overflow:hidden}.terminal-card summary{display:flex;align-items:center;gap:8px;padding:8px 10px;color:#adb1b6;font-size:10.5px;cursor:pointer;list-style:none}.terminal-card summary::before{content:"›";font-size:15px}.terminal-card[open] summary::before{transform:rotate(90deg)}.terminal-card pre{max-height:190px;margin:0!important;border:0!important;border-top:1px solid #34373b!important;border-radius:0!important;background:#191b1d!important;color:#cbd0d4!important;white-space:pre-wrap}.task-group-label{display:flex;align-items:center;gap:5px;padding:8px 6px 4px;color:#858a90;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.task-group-label span{flex:1}.task-group-label button{border:0;background:transparent;color:#aeb2b7;font-size:9px;text-transform:none;letter-spacing:0;cursor:pointer}.task-group-label button:hover{color:#fff}.model-favorite{margin-left:auto;border:0;background:transparent;color:#656a70;font-size:13px;cursor:pointer}.model-favorite.active{color:#e0c761}.model-option-label{min-width:0;overflow:hidden;text-overflow:ellipsis}
.sandbox-wrap{position:relative;min-width:0}.sandbox-trigger{height:26px;border:0;border-radius:7px;background:transparent;color:#9da2a8;padding:0 5px;font-size:10px;cursor:pointer}.sandbox-trigger:hover,.sandbox-wrap.open .sandbox-trigger{background:#303236;color:#e5e7e9}.sandbox-trigger.active{color:#7bd5c0}.sandbox-menu{position:absolute;z-index:78;left:0;bottom:calc(100% + 7px);width:270px;max-width:calc(100vw - 28px);padding:6px;border:1px solid #46494e;border-radius:12px;background:#25272a;box-shadow:0 20px 55px rgba(0,0,0,.6)}.sandbox-menu button{display:grid;width:100%;gap:2px;border:0;border-radius:8px;background:transparent;color:#d9dbde;padding:8px 9px;text-align:left;cursor:pointer}.sandbox-menu button:hover,.sandbox-menu button.active{background:#34363a}.sandbox-menu strong{font-size:10.5px}.sandbox-menu span{color:#8f949a;font-size:9px}.sandbox-menu .sandbox-check{margin-top:4px;border-top:1px solid #3a3d41;border-radius:0;padding-top:10px}.change-review-dialog{display:flex;flex-direction:column;width:min(560px,100%);max-height:min(720px,88vh);border:1px solid #494c51;border-radius:15px;background:#232528;box-shadow:0 25px 75px rgba(0,0,0,.7);overflow:hidden}.change-review-dialog>header{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid #373a3e}.change-review-dialog>header>div{display:grid;min-width:0;flex:1}.change-review-dialog header strong{font-size:12px}.change-review-dialog header span{color:#92979d;font-size:9px}.change-review-dialog header button{border:0;background:transparent;color:#aeb2b7;font-size:18px;cursor:pointer}.hunk-list{display:grid;gap:9px;min-height:80px;overflow:auto;padding:11px}.hunk-card{border:1px solid #3a3d42;border-radius:11px;background:#1d1f21;overflow:hidden}.hunk-card header{display:flex;align-items:center;gap:8px;padding:7px 9px;border-bottom:1px solid #34373b;color:#9da2a8;font:9px var(--vscode-editor-font-family)}.hunk-card header span{flex:1}.hunk-card header button{border:0;border-radius:6px;background:transparent;color:#c5c8cc;padding:4px 7px;font-size:9px;cursor:pointer}.hunk-card header button:hover{background:#35383c;color:#fff}.hunk-lines{max-height:220px;overflow:auto;padding:6px 0;font:10px/1.55 var(--vscode-editor-font-family)}.hunk-line{display:grid;grid-template-columns:16px minmax(0,1fr);padding:1px 8px;white-space:pre-wrap;overflow-wrap:anywhere}.hunk-line.add{background:rgba(73,173,129,.1);color:#9cdbb9}.hunk-line.remove{background:rgba(211,86,86,.1);color:#e6a0a0}.change-review-dialog>footer{display:flex;justify-content:flex-end;padding:10px 12px;border-top:1px solid #373a3e}.context-meter{height:2px;background:#373a3e;overflow:hidden}.context-meter i{display:block;height:100%;background:#777c82}.context-meter.compacted i{background:#d0aa54}
.context-meter{display:none}
.sandbox-menu{left:auto;right:0;width:min(270px,calc(100vw - 28px));max-width:none}
.sandbox-report{margin:2px 12px 12px;color:#858a90;font-size:10px}
`;
  const codexParityStyles = String.raw`
.composer-menu{padding:7px;gap:2px;background:#242527;border-color:#45484d;max-height:min(310px,44vh);scrollbar-gutter:auto}
.composer-menu button{grid-template-columns:minmax(92px,auto) minmax(0,1fr);align-items:center;min-height:40px;padding:7px 9px;border-radius:8px}
.composer-menu button.selected,.composer-menu button:hover{background:#34363a}
.composer-menu .menu-key{display:flex;align-items:center;gap:7px;min-width:0;color:#f0f1f2;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.composer-menu .menu-copy{min-width:0;color:#92979d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.composer-menu .skill-mark{display:grid;place-items:center;width:20px;height:20px;flex:none;border:1px solid #4a4e53;border-radius:6px;background:#1d1f21;color:#7bd5c0;font:700 11px var(--vscode-editor-font-family)}
.composer-menu .skill-source{margin-left:auto;color:#70757b;font-size:9px;font-weight:450}
.composer-shell{background:#202123!important;border-color:#383a3e!important;padding:7px 9px}
.composer-shell:focus-within{border-color:#565a60!important}
.composer-shell textarea,.composer-shell textarea:focus,.composer-shell textarea:focus-visible{height:26px;min-height:26px;max-height:140px;background:#202123!important;font-size:13px;line-height:1.5;padding-block:2px 4px}
.composer-toolbar{margin-bottom:2px!important}.composer-actions{margin-top:2px}
.send{width:28px;height:28px;background:#e1e3e5;color:#1f2022}
.send:not(:disabled):hover{background:#fff;color:#111}
.send:disabled{background:#4a4d51;color:#9da1a6;opacity:.55}
.agent-activity{padding:2px 0 1px}.activity-row{min-height:22px}
.attachment-progress{display:inline-flex;align-items:center;gap:5px;color:#999da2;font-size:9px}.attachment-progress i{width:9px;height:9px;border:1px solid #60646a;border-top-color:#e1e3e5;border-radius:50%;animation:spin .75s linear infinite}
.composer-hint{color:#777c82;font-size:9px}.composer-hint b{color:#aeb2b7;font:650 10px var(--vscode-editor-font-family)}
.error-actions{display:flex;gap:7px;margin-top:10px}.error-action{border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#eceef0;color:#1c1e20;padding:6px 10px;font-size:10px;font-weight:650;cursor:pointer}.error-action:hover{background:#fff}
.composer-actions{min-width:0}.mode-switch{flex:none}.perm-wrap{min-width:0}.perm-trigger{max-width:112px}.perm-trigger #permLabel{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .model-picker{flex:1 1 84px!important;min-width:0!important}.model-trigger{width:100%;max-width:100%;min-width:0;overflow:hidden;justify-content:space-between!important}.model-trigger::after{content:"";width:6px;height:6px;flex:none;border-right:1.5px solid #aeb2b7;border-bottom:1.5px solid #aeb2b7;transform:rotate(45deg) translateY(-2px);transition:transform .16s ease,color .16s ease}.model-picker.open .model-trigger::after{transform:rotate(225deg) translate(-2px,-2px);border-color:#eef0f2}.model-picker.open .model-trigger{background:#343639;border-color:#5a5d62}#modelLabel{display:block;flex:1 1 auto;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
  .file-link{min-width:0;overflow:hidden}.file-link>span:not(.file-type-icon):not(.file-line){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-type-icon{display:inline-grid;place-items:center;min-width:17px;height:15px;flex:none;border-radius:4px;background:#2e3135;color:#aeb4ba;padding:0 3px;font:750 7px/1 var(--vscode-editor-font-family);letter-spacing:-.04em}.file-type-icon.html{min-width:20px;background:rgba(232,107,62,.11);color:#ed794f}.file-type-icon.css{background:rgba(75,159,225,.11);color:#63afe8;font-size:10px}.file-type-icon.js{background:rgba(225,198,87,.1);color:#e1c657}.file-type-icon.ts{background:rgba(101,174,232,.1);color:#65aee8}.file-type-icon.json{background:rgba(214,198,111,.1);color:#d6c66f}.file-type-icon.md{background:rgba(157,184,210,.1);color:#9db8d2}.file-type-icon.image{min-width:23px;background:rgba(189,139,216,.1);color:#bd8bd8}.file-type-icon.file{min-width:24px;color:#aeb4ba}
.message.assistant .body::after{display:none!important;content:none!important}
.worked-label{margin:2px 0 12px;color:#777c82;font-size:10.5px;font-weight:520}
.composer-shell textarea,.composer-shell textarea:focus,.composer-shell textarea:focus-visible{background:transparent!important;color:#e6e7e9!important;caret-color:#f2f3f4}
.send{position:relative}.send svg{display:none}.send::before{content:"";position:absolute;left:50%;top:7px;width:7px;height:7px;border-top:2px solid currentColor;border-left:2px solid currentColor;transform:translateX(-50%) rotate(45deg);border-radius:1px}.send::after{content:"";position:absolute;left:50%;top:7px;width:2px;height:14px;background:currentColor;transform:translateX(-50%);border-radius:2px}
.send.running::before{left:50%;top:50%;width:8px;height:8px;border:0;background:currentColor;transform:translate(-50%,-50%);border-radius:2px}.send.running::after{display:none}
.plus-button{width:30px!important;height:30px!important;border-radius:50%!important;font-size:17px!important}
.composer-hint{opacity:.42;transition:opacity .15s ease}.composer-shell.prompt-focused:not(.has-input) .composer-hint{opacity:.9}.composer-shell.has-input .composer-hint{opacity:.18}
  .model-option{display:grid!important;grid-template-columns:14px minmax(0,1fr) 20px;align-items:center;min-height:44px;padding:6px 8px!important;white-space:normal!important}.model-option-copy{display:grid;gap:1px;min-width:0}.model-option-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dfe1e3}.model-option-meta{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#777c82;font-size:9px;line-height:1.35}.model-option.active .model-option-label{color:#fff}.model-health{display:grid;place-items:center;width:12px;height:12px;font-size:9px!important;line-height:1;color:#73787e;background:transparent}.model-health.ok{color:#70cfb8;font-weight:750}.model-health.error{color:#e87878;font-size:11px!important;font-weight:650}.model-health.checking{width:9px;height:9px;margin-left:1px;border:1px solid #d9bf58;border-top-color:transparent;border-radius:50%;font-size:0!important;animation:iconSpin .9s linear infinite}.model-favorite{display:grid;place-items:center;width:20px;height:20px;margin:0!important}
  .agent-activity{position:relative;padding:2px 0 4px!important;cursor:default}.agent-activity:not(.expanded) .activity-row{display:flex}.agent-activity::after{display:none}.activity-row{min-height:26px}.activity-row.done .activity-copy{color:#858a90}.message.streaming .terminal-card{display:none}.message.streaming.show-trace .terminal-card{display:block}
.perm-trigger.full{color:#e0c45a!important}.diff-add{color:#70cfb8!important}.diff-remove{color:#e87878!important}.collapsed-changes{background:#232528!important;border-color:#3b3e43!important}.collapsed-changes button{border-radius:8px!important;background:#2d3034!important}.change-tray{background:#222427!important;border-color:#3b3e43!important}
@media(max-width:420px){.composer-actions{gap:4px!important}.mode-switch button{padding-inline:7px!important}.perm-trigger{max-width:78px;padding-inline:4px!important}.model-trigger{padding-inline:8px}.send{flex:none}}
@keyframes iconSpin{to{transform:rotate(360deg)}}
  `;

  const compactModeAndConnectionStyles = String.raw`
  .mode-picker{position:relative;flex:0 0 auto;min-width:0}.mode-trigger{display:flex;align-items:center;gap:8px;height:28px;border:1px solid #45474b;border-radius:8px;background:#2b2d30;color:#eef0f2;padding:0 10px;font-size:11px;font-weight:650;cursor:pointer}.mode-trigger::after{content:"";width:6px;height:6px;border-right:1.5px solid #aeb2b7;border-bottom:1.5px solid #aeb2b7;transform:rotate(45deg) translateY(-2px);transition:transform .15s}.mode-picker.open .mode-trigger::after{transform:rotate(225deg) translate(-2px,-2px)}.mode-trigger:hover,.mode-picker.open .mode-trigger{background:#343639;border-color:#5a5d62}.mode-menu{position:absolute;z-index:65;bottom:calc(100% + 7px);left:0;width:210px;padding:6px;border:1px solid #45484d;border-radius:12px;background:#242527;box-shadow:0 18px 50px rgba(0,0,0,.58);animation:dropIn .12s ease-out}.mode-menu button{display:grid;width:100%;gap:1px;border:0;border-radius:8px;background:transparent;color:#d7d9dc;padding:8px 10px;text-align:left;cursor:pointer}.mode-menu button:hover{background:#323438}.mode-menu button.active{background:#383a3e;color:#fff}.mode-menu strong{font-size:11px;font-weight:650}.mode-menu small{color:#8f949a;font-size:9px;font-weight:400}.mode-menu button.active small{color:#b6babf}
  .connection-dialog{width:min(390px,100%);padding:0;border:1px solid #484b50;border-radius:16px;background:#252628;box-shadow:0 26px 80px rgba(0,0,0,.68);overflow:hidden}.connection-dialog-head{display:flex;align-items:flex-start;gap:12px;padding:15px 16px 13px;border-bottom:1px solid rgba(255,255,255,.07)}.connection-dialog-head>div{display:grid;gap:2px;min-width:0;flex:1}.connection-dialog-head strong{font-size:13px;font-weight:700}.connection-dialog-head span{color:#92969c;font-size:10px}.connection-dialog-head button{display:grid;place-items:center;width:26px;height:26px;border:0;border-radius:7px;background:transparent;color:#9ca0a5;font-size:17px;cursor:pointer}.connection-dialog-head button:hover{background:#34363a;color:#fff}.connection-provider{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;margin:14px 15px 10px;padding:11px;border:1px solid #3f4247;border-radius:11px;background:#2b2d30}.connection-provider>span{display:grid;place-items:center;width:38px;height:38px;border:1px solid #4b4e53;border-radius:10px;background:#202123;color:#dfe1e3;font:750 10px var(--vscode-editor-font-family)}.connection-provider>div{display:grid;gap:1px;min-width:0}.connection-provider strong{font-size:11px;font-weight:680}.connection-provider small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8f949a;font:9px var(--vscode-editor-font-family)}.connection-provider>b{border-radius:999px;padding:4px 7px;background:#35373b;color:#b9bdc2;font-size:9px;font-weight:620;white-space:nowrap}.connection-provider>b.ready{background:rgba(78,201,176,.12);color:#79d8c5}.connection-provider>b.failed{background:rgba(240,140,140,.1);color:#ef9292}.connection-provider>b.checking{animation:statusPulse 1.2s ease-in-out infinite}.connection-stats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 15px}.connection-stats>div{display:grid;gap:3px;padding:9px 10px;border:1px solid #3d4045;border-radius:9px;background:#202123}.connection-stats span{color:#858a90;font-size:9px}.connection-stats strong{font-size:12px;font-weight:680}.connection-message{min-height:36px;margin:10px 15px 13px;color:#aeb2b7;font-size:10px;line-height:1.55;overflow-wrap:anywhere}.connection-dialog-actions{display:flex;gap:7px;padding:12px 15px 15px;border-top:1px solid rgba(255,255,255,.07)}.connection-dialog-actions .secondary{flex:0 0 auto}.connection-dialog-actions .primary{flex:1;width:auto}.connection-dialog-actions .primary:disabled{opacity:.58}@keyframes statusPulse{50%{opacity:.5}}@media(max-width:340px){.connection-provider{grid-template-columns:34px minmax(0,1fr)}.connection-provider>span{width:34px;height:34px}.connection-provider>b{grid-column:2;justify-self:start}.mode-menu{width:min(210px,calc(100vw - 36px))}}
  `;

  const connectionEntryStyles = String.raw`
  #topConnect.connect-action{margin-right:1px;color:#bfc3c7;font-weight:600}#topConnect.connect-action:hover,#topConnect.connect-action.attention{border:1px solid rgba(78,201,176,.28);background:rgba(78,201,176,.09);color:#79d8c5}#topConnect.connect-action.attention:hover{border-color:rgba(78,201,176,.48);background:rgba(78,201,176,.15);color:#9be6d7}
  `;

  const connectionCenterStyles = String.raw`
  .setup{height:calc(100vh - 44px);padding:12px 14px 24px;background:#18191b}.setup-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px}.setup-nav button{display:flex;align-items:center;gap:7px;height:30px;border:0;border-radius:8px;background:transparent;color:#b8bcc1;padding:0 7px;font-size:10.5px;cursor:pointer}.setup-nav button span{font-size:14px;line-height:1}.setup-nav button:hover{background:#292b2e;color:#fff}.setup-nav>span{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid #3d4045;border-radius:999px;background:#222427;color:#9ca1a7;padding:4px 8px;font-size:9px}
  .setup-hero{max-width:none;padding:0 2px}.setup-hero .signal-map{margin:0 0 18px;max-width:310px;grid-template-columns:38px minmax(20px,1fr) 38px minmax(20px,1fr) 38px}.setup-hero .signal-node{height:32px;border-radius:9px;background:#202225}.setup-hero h1{max-width:390px;margin:0 0 7px;font-size:21px;line-height:1.2;letter-spacing:-.025em}.setup-hero p{max-width:410px;color:#a2a7ac;font-size:11.5px;line-height:1.6}
  .launch-panel{margin-top:19px;padding:15px;border-color:#3d4045;border-radius:14px;background:#222427}.launch-state{gap:10px;margin-bottom:14px}.launch-state .state-mark{width:9px;height:9px;margin-top:5px;border-color:#7a7f85}.launch-state strong{font-size:12.5px;font-weight:680}.launch-state span{font-size:10px;line-height:1.5}.launch-panel.ready{border-color:rgba(78,201,176,.24);background:linear-gradient(180deg,rgba(78,201,176,.045),#222427 44%)}.connection-page-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}.connection-page-actions .primary{grid-column:1/-1;min-height:38px;border-radius:9px}.connection-page-actions .secondary{width:100%;min-height:34px;border-radius:9px}.connection-page-actions .secondary:only-child{grid-column:1/-1}.setup-check-result{margin:10px 0 0;padding:9px 10px;border:1px solid #383b3f;border-radius:9px;background:#1d1f21;color:#8e9398;font-size:9.5px;line-height:1.5;overflow-wrap:anywhere}.setup-check-result.checking{color:#c8b96e}.setup-check-result.success{border-color:rgba(78,201,176,.22);background:rgba(78,201,176,.055);color:#79d8c5}.setup-check-result.failure{border-color:rgba(232,120,120,.22);background:rgba(232,120,120,.055);color:#ee9292}
  .manual-setup{margin-top:10px;border-color:#373a3e;border-radius:13px;background:#1e2022}.manual-setup summary{padding:12px 14px;color:#a3a8ad;font-size:10.5px}.manual-setup[open] summary{border-color:#34373b}.manual-fields{padding:3px 14px 14px}.manual-fields label{margin:11px 0 6px}.manual-fields input{height:38px;border-color:#3c3f43;border-radius:9px;background:#191b1d}.manual-fields input:focus{border-color:#5c6166;box-shadow:none}.manual-fields .secondary{min-height:36px;border-radius:9px}.setup .error{margin:10px 0 0;padding:10px 11px;border:1px solid rgba(232,120,120,.22);border-left-width:1px;border-radius:10px;background:rgba(232,120,120,.055);line-height:1.5}
  @media(max-width:330px){.setup{padding-inline:10px}.connection-page-actions{grid-template-columns:1fr}.connection-page-actions .primary{grid-column:auto}}
  `;

  const connectionPageV2Styles = String.raw`
  .setup{padding:14px 16px 30px;background:#171819}.setup>*{width:100%;max-width:520px;margin-left:auto;margin-right:auto}.setup-nav{margin-bottom:25px}.setup-nav button{height:32px;margin-left:-7px;padding:0 8px;color:#c7cacf;font-size:10.5px}.setup-nav button svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}.setup-nav button span{font-size:10.5px}.setup-nav>span{border:0;border-radius:0;background:transparent;padding:0;color:#72777e;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase}
  .setup-hero{padding:0 1px}.setup-kicker{display:block;margin-bottom:7px;color:#72d7c2;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.setup-hero h1{margin:0 0 7px;max-width:none;font-size:23px;line-height:1.15;letter-spacing:-.035em}.setup-hero p{max-width:440px;color:#969ba1;font-size:11px;line-height:1.55}
  .launch-panel{position:relative;margin-top:22px;padding:0;border:1px solid #393c40;border-radius:15px;background:#202224;overflow:hidden}.launch-panel.ready{border-color:#3b4644;background:#202224}.provider-overview{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:11px;padding:14px;border-bottom:1px solid #34373a;background:#232527}.provider-mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid #464a4f;border-radius:11px;background:#1b1d1f;color:#70d5c0;font:750 10px var(--vscode-editor-font-family)}.provider-identity{display:grid;min-width:0;gap:2px}.provider-identity strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:680}.provider-identity span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#858a90;font:8.5px var(--vscode-editor-font-family)}
  .connection-orbit{position:relative;display:grid;place-items:center;width:28px;height:28px;border:1px solid #41454a;border-radius:50%}.connection-orbit:before{content:"";width:7px;height:7px;border-radius:50%;background:#777c82}.connection-orbit.ready{border-color:rgba(78,201,176,.28)}.connection-orbit.ready:before{background:#59d1b6;box-shadow:0 0 0 4px rgba(89,209,182,.08)}.connection-orbit.launching:after{content:"";position:absolute;inset:-1px;border:1px solid transparent;border-top-color:#59d1b6;border-radius:50%;animation:spin .8s linear infinite}
  .launch-state{display:grid;grid-template-columns:8px minmax(0,1fr);align-items:start;gap:10px;margin:0;padding:14px 14px 12px}.launch-state .state-mark{width:7px;height:7px;margin-top:5px;border:0;background:#777c82}.launch-panel.ready .launch-state .state-mark{background:#59d1b6;box-shadow:none}.launch-state strong{font-size:11.5px;font-weight:680}.launch-state span{margin-top:2px;color:#92979d;font-size:9.5px;line-height:1.5}
  .connection-page-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(116px,.42fr);align-items:stretch;gap:8px;padding:0 14px 12px}.connection-page-actions .primary,.connection-page-actions .secondary{display:flex;align-items:center;justify-content:center;height:46px;min-height:46px;margin:0;padding:0 14px;line-height:1}.connection-page-actions .primary{grid-column:auto;border:0;border-radius:9px;background:#eceeef;color:#181a1c;font-weight:650}.connection-page-actions .primary:hover{background:#fff}.connection-page-actions .secondary{border-color:#41454a;border-radius:9px;background:#282a2d;color:#d1d4d7}.connection-page-actions .secondary:hover{background:#303236}.connection-page-actions #disconnectConnection{border-color:#c94b52;background:#c94b52;color:#fff;font-weight:650}.connection-page-actions #disconnectConnection:hover{border-color:#dc5b62;background:#dc5b62;color:#fff}.connection-page-actions .primary:only-child{grid-column:1/-1}.setup-check-result{position:relative;margin:0;padding:10px 14px 11px 31px;border:0;border-top:1px solid #34373a;border-radius:0;background:#1d1f21;color:#858a90;font-size:9px;line-height:1.45}.setup-check-result:before{content:"";position:absolute;left:15px;top:14px;width:6px;height:6px;border-radius:50%;background:#666b71}.setup-check-result.checking{color:#c8b96e}.setup-check-result.checking:before{background:#d7bd65;animation:statusPulse 1s ease-in-out infinite}.setup-check-result.success{border-color:#34373a;background:#1d211f;color:#75cdbb}.setup-check-result.success:before{background:#59d1b6}.setup-check-result.failure{border-color:#34373a;background:#221e1f;color:#e78a8a}.setup-check-result.failure:before{background:#e46f6f}
  .manual-setup{margin-top:11px;border-color:#373a3e;border-radius:13px;background:#1d1f21;overflow:hidden}.manual-setup summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;color:#c0c4c8;font-size:10px}.manual-setup summary>span{display:flex;align-items:center;gap:8px}.manual-setup summary svg{width:14px;height:14px;fill:none;stroke:#858a90;stroke-width:1.5;stroke-linecap:round}.manual-setup summary small{color:#73787e;font-size:8.5px;font-weight:400}.manual-setup[open] summary{border-bottom:1px solid #34373a}.manual-fields{padding:3px 13px 13px}.manual-fields label{color:#92979d}.manual-fields input{height:37px;border-color:#3b3e42;background:#181a1c;color:#e4e6e8}.manual-fields input:focus{border-color:#646a70}.manual-fields .secondary{border-color:#44484c;background:#27292c;color:#e4e6e8}
  .setup .error{max-width:520px;margin-top:10px;border-color:rgba(232,120,120,.2);background:#241e20}
  @media(max-width:350px){.setup{padding-inline:11px}.connection-page-actions{grid-template-columns:1fr}.connection-page-actions .primary{grid-column:auto}.setup-nav>span{display:none}}
  `;

  const modelHealthIconFixStyles = String.raw`
  .model-health{position:relative;display:block!important;width:14px!important;height:14px!important;margin:0!important;padding:0!important;border:0!important;align-self:center;justify-self:center;background:transparent!important;font-size:0!important;line-height:0!important}.model-health:before,.model-health:after{box-sizing:border-box}.model-health:not(.ok):not(.error):not(.limited):not(.checking):before{content:"";position:absolute;left:50%;top:50%;width:3px;height:3px;border-radius:50%;background:#64696f;transform:translate(-50%,-50%)}.model-health.ok:before{content:"✓";position:absolute;inset:0;display:grid;place-items:center;color:#70cfb8;font:750 11px/14px var(--vscode-font-family)}.model-health.error:before,.model-health.error:after{content:"";position:absolute;left:50%;top:50%;width:8px;height:1.5px;border-radius:2px;background:#e87878;transform-origin:center}.model-health.error:before{transform:translate(-50%,-50%) rotate(45deg)}.model-health.error:after{transform:translate(-50%,-50%) rotate(-45deg)}.model-health.limited:before{content:"!";position:absolute;inset:0;display:grid;place-items:center;border:1px solid #d9bf58;border-radius:50%;color:#d9bf58;font:750 9px/12px var(--vscode-font-family)}.model-health.checking{width:12px!important;height:12px!important;margin:0!important;border:1.5px solid #d9bf58!important;border-top-color:transparent!important;border-radius:50%;animation:iconSpin .9s linear infinite}
  `;

  const editableMessageStyles = String.raw`
  .message.user{margin-bottom:19px}.message.user .body{max-width:min(88%,420px);padding:10px 14px;border-radius:16px 16px 4px 16px;background:#28292b;color:#eceeef;font-size:12.5px;font-weight:540;line-height:1.62;box-shadow:inset 0 0 0 1px rgba(255,255,255,.015)}
  .message-meta{display:flex;align-items:center;gap:7px;min-height:24px;margin-top:5px}.message.user .message-meta{align-self:flex-end;justify-content:flex-end}.message.assistant .message-meta{justify-content:flex-start}.message .message-meta .label{display:block!important;order:0;margin:0!important;color:#777c82!important;font-size:9px!important;line-height:22px!important}
  .message-actions{display:flex;align-items:center;gap:1px;min-width:0;opacity:0;transform:translateY(2px);pointer-events:none;transition:opacity .14s ease,transform .14s ease}.message:hover .message-actions,.message:focus-within .message-actions{opacity:1;transform:none;pointer-events:auto}.message-action{position:relative;display:grid;place-items:center;width:25px;height:25px;padding:0;border:0;border-radius:7px;background:transparent;color:#9ba0a6;cursor:pointer;transition:background .12s ease,color .12s ease,transform .12s ease}.message-action:hover{background:#303235;color:#eceeef}.message-action:active{transform:scale(.94)}.message-action svg{width:17px;height:17px}.message-action.copied{color:#68d0b9}.message-action.copied:after{content:"✓";position:absolute;inset:0;display:grid;place-items:center;border-radius:7px;background:#303235;font-size:12px;font-weight:750}.message.editing .message-meta{display:none}.message-editor{width:min(92%,440px);padding:10px;border:1px solid #4b4e53;border-radius:15px;background:#28292b;box-shadow:0 12px 34px rgba(0,0,0,.2)}.message.user .message-editor{align-self:flex-end}.message-editor textarea{display:block;width:100%;min-height:48px;max-height:180px;resize:none;padding:2px 3px;border:0;outline:0;background:transparent;color:#f0f1f2;font:500 12.5px/1.62 var(--vscode-font-family)}.message-edit-controls{display:flex;align-items:center;gap:6px;margin-top:9px}.message-edit-hint{min-width:0;flex:1;color:#858a90;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.message-edit-controls button{height:29px;padding:0 10px;border-radius:8px;font-size:10px;font-weight:620;cursor:pointer}.message-edit-cancel{border:1px solid #45484c;background:transparent;color:#c5c8cb}.message-edit-cancel:hover{background:#323437}.message-edit-submit{border:1px solid #eceeef;background:#eceeef;color:#202123}.message-edit-submit:hover{background:#fff}.message-edit-submit:disabled{opacity:.45;cursor:default}
  @media(max-width:360px){.message.user .body{max-width:92%}.message-edit-hint{display:none}.message-editor{width:96%}}
  @media(hover:none){.message-actions{opacity:.72;transform:none;pointer-events:auto}}
  @media(prefers-reduced-motion:reduce){.message-actions,.message-action{transition:none}}
  `;

const errorAndMotionPolishStyles = String.raw`
  .message.error{margin:10px 0 18px;padding:0!important;border:0!important;border-left:0!important;border-radius:0!important;background:transparent!important}
  .message.error .body.structured-error{display:block!important;padding:0!important;border:0!important;background:transparent!important;color:inherit!important}
  .message.error .body.structured-error::before{display:none!important}
  .chat-error-card{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:10px;padding:13px 14px;border:1px solid rgba(244,126,126,.35);border-radius:15px;background:rgba(72,31,32,.48)}
  .chat-error-icon{position:relative;display:block;align-self:center;justify-self:center;width:22px;height:22px;border:1.5px solid #f09a9a;border-radius:50%;color:#ffaaaa;font-size:0;line-height:0}
  .chat-error-icon::before,.chat-error-icon::after{content:"";position:absolute;left:50%;width:2px;border-radius:2px;background:currentColor;transform:translateX(-50%)}
  .chat-error-icon::before{top:4px;height:8px}
  .chat-error-icon::after{top:14px;height:2px}
  .chat-error-copy{display:grid;gap:4px;min-width:0}
  .chat-error-copy strong{color:#ffabab;font-size:12px;line-height:1.4}
  .chat-error-copy span{color:#e1c9c9;font-size:11px;line-height:1.55;overflow-wrap:anywhere}
  .activity-row.active .activity-copy{animation-duration:3.8s;animation-timing-function:ease-in-out}
  .activity-row[data-kind="error"] .activity-copy{color:#e98787!important;-webkit-text-fill-color:currentColor;background:none}
  @keyframes activityShimmer{0%,12%{background-position:190% 0}50%,100%{background-position:-50% 0}}
  @media(prefers-reduced-motion:reduce){.activity-row.active .activity-copy{animation:none!important}}
  `;

  const recoveryAndRetryStyles = String.raw`
  .recovery-card,.tool-failure-card{display:grid;gap:6px;margin:8px 0 14px;padding:12px 14px;border:1px solid #3d4044;border-radius:18px;background:#25272a;color:#d8dadd}.recovery-card small,.tool-failure-card small{color:#83888e;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.recovery-card strong,.tool-failure-card strong{font-size:12px;line-height:1.45}.recovery-card span,.tool-failure-card span{color:#aeb2b7;font-size:10px;line-height:1.5;overflow-wrap:anywhere}.recovery-card div,.tool-failure-card div{display:flex;gap:7px;flex-wrap:wrap;margin-top:3px}.recovery-card button,.tool-failure-card button{min-height:31px;border:1px solid #46494e;border-radius:999px;background:#2d2f32;color:#d7dade;padding:5px 12px;font-size:10px;cursor:pointer}.recovery-card button:hover,.tool-failure-card button:hover{background:#383a3e;color:#fff}.recovery-resume,.tool-retry{background:#eceeef!important;border-color:#eceeef!important;color:#1d1e20!important;font-weight:650}.tool-failure-card{border-color:rgba(244,126,126,.32);background:rgba(72,31,32,.42)}.tool-failure-card strong{color:#ff9a9a}
  `;

  const brandIdentityStyles = String.raw`
  .brand-symbol{display:grid;place-items:center;width:100%;height:100%;color:#eef0f2}.brand-symbol svg,.brand-symbol img{display:block;width:100%;height:100%;object-fit:contain}.provider-brand-slot{display:grid;place-items:center;width:28px;height:28px;flex:none;padding:4px;border:1px solid #44474b;border-radius:8px;background:#1d1f21}.provider-trigger{gap:9px}.provider-trigger>span:not(.provider-brand-slot){display:grid;gap:1px;min-width:0}.provider-option{grid-template-columns:28px minmax(0,1fr);align-items:center;gap:9px}.provider-option>span:not(.provider-brand-slot){display:grid;gap:2px;min-width:0}.provider-option .provider-brand-slot{width:28px;height:28px}.provider-mark{padding:6px}.provider-mark .brand-symbol{width:100%;height:100%}.model-trigger-brand{display:grid;place-items:center;width:17px;height:17px;flex:none}.model-trigger-brand:empty{display:none}.model-trigger-brand .brand-symbol{width:17px;height:17px}.model-brand{display:grid;place-items:center;width:22px;height:22px;padding:2px}.model-brand .brand-symbol{width:18px;height:18px}.model-option{grid-template-columns:24px minmax(0,1fr) 14px 20px!important}.mcp-brand-icon{padding:7px}.mcp-brand-icon svg,.mcp-brand-icon img{width:100%;height:100%;object-fit:contain}.mcp-brand-icon .brand-symbol{width:100%;height:100%}.telemetry-model{display:grid!important;grid-template-columns:24px minmax(0,1fr);align-items:center;gap:7px;min-width:0}.telemetry-model>span:last-child{display:grid;min-width:0}.telemetry-brand{display:grid;place-items:center;width:24px;height:24px;padding:3px}.telemetry-brand .brand-symbol{width:18px;height:18px}
  .model-option{grid-template-columns:24px minmax(0,1fr) 14px 28px!important}.model-favorite{display:grid;place-items:center;width:28px!important;height:28px!important;margin:-4px!important;border-radius:7px}.model-favorite:hover,.model-favorite:focus-visible{outline:0;background:#3a3d41;color:#c9cdd1}.model-favorite svg{display:block;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.model-favorite.active svg{fill:currentColor}
  `;

  const codexWorkflowStyles = String.raw`
  .profile-bar>div:first-child{display:grid;gap:5px;min-width:0;flex:1}.profile-actions{display:flex!important;flex:none!important;align-items:center;gap:5px!important}.profile-new,.profile-delete{min-height:29px;padding:5px 9px;font-size:10px;white-space:nowrap}.profile-delete{border:1px solid rgba(232,120,120,.28);border-radius:8px;background:transparent;color:#e58a8a;cursor:pointer}.profile-delete:hover:not(:disabled){background:rgba(232,120,120,.09);border-color:rgba(232,120,120,.48)}.profile-delete:disabled{border-color:#3a3d41;color:#666b70;cursor:not-allowed}
  .composer-shell{overflow:visible;border-color:#3d4044;background:#202224;box-shadow:0 -10px 30px rgba(12,13,14,.16)}
  .goal-rail{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:9px;margin:-1px -1px 8px;padding:9px 10px;border:1px solid #3d4044;border-radius:13px 13px 9px 9px;background:#25272a}.goal-state{position:relative;width:14px;height:14px;border:1px solid #666b71;border-radius:50%}.goal-rail[data-state="running"] .goal-state{border-color:#69d0ba;border-top-color:transparent;animation:iconSpin .9s linear infinite}.goal-rail[data-state="paused"] .goal-state:before,.goal-rail[data-state="paused"] .goal-state:after{content:"";position:absolute;top:3px;width:2px;height:7px;border-radius:1px;background:#d7bd65}.goal-rail[data-state="paused"] .goal-state:before{left:3px}.goal-rail[data-state="paused"] .goal-state:after{right:3px}.goal-rail[data-state="ready"] .goal-state{border-color:#69d0ba}.goal-rail[data-state="ready"] .goal-state:after{content:"";position:absolute;left:3px;top:2px;width:5px;height:7px;border-right:1.5px solid #69d0ba;border-bottom:1.5px solid #69d0ba;transform:rotate(40deg)}.goal-rail[data-state="failed"] .goal-state{border-color:#e47c7c}.goal-rail[data-state="failed"] .goal-state:before,.goal-rail[data-state="failed"] .goal-state:after{content:"";position:absolute;left:3px;top:6px;width:7px;height:1px;background:#e47c7c}.goal-rail[data-state="failed"] .goal-state:before{transform:rotate(45deg)}.goal-rail[data-state="failed"] .goal-state:after{transform:rotate(-45deg)}
  .goal-copy{display:grid;gap:1px;min-width:0}.goal-copy strong,.goal-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.goal-copy strong{color:#e8eaec;font-size:10.5px;font-weight:650}.goal-copy span{color:#858a90;font-size:8.5px}.goal-actions{display:flex;align-items:center;gap:3px}.goal-actions button{height:25px;padding:0 7px;border:0;border-radius:7px;background:transparent;color:#aeb3b8;font-size:9px;cursor:pointer}.goal-actions button:hover{background:#34373b;color:#f2f3f4}.goal-actions button:active{transform:translateY(1px)}#goalResume{background:#eceeef;color:#1c1e20;font-weight:650}#goalClear{width:25px;padding:0;color:#858a90;font-size:15px}
  .follow-up-queue{margin:0 0 8px;border-left:2px solid #596068;background:#1c1e20}.queue-heading{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:6px 8px;color:#92979d;font-size:8.5px}.queue-heading button{border:0;background:transparent;color:#858a90;padding:2px 3px;font-size:8.5px;cursor:pointer}.queue-heading button:hover{color:#e6e8ea}.queue-row{display:grid;grid-template-columns:minmax(0,1fr) 22px;align-items:center;gap:5px;padding:6px 6px 6px 8px;border-top:1px solid #2c3033}.queue-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c4c8cc;font-size:9.5px}.queue-row button{display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:6px;background:transparent;color:#73787e;cursor:pointer}.queue-row button:hover{background:#303337;color:#fff}
  .composer-shell.is-running textarea{border-color:transparent}.composer-shell.is-running .composer-hint{opacity:.65}.send.running.queue-ready::before{left:50%;top:7px;width:7px;height:7px;border-top:2px solid currentColor;border-left:2px solid currentColor;background:transparent;transform:translateX(-50%) rotate(45deg);border-radius:1px}.send.running.queue-ready::after{display:block;left:50%;top:7px;width:2px;height:14px;background:currentColor;transform:translateX(-50%);border-radius:2px}.send.running.queue-ready{background:#eceeef;color:#1d1f21}
  @media(max-width:380px){.goal-rail{grid-template-columns:16px minmax(0,1fr)}.goal-actions{grid-column:2;justify-content:flex-start}.goal-copy strong{max-width:230px}}
  @media(prefers-reduced-motion:reduce){.goal-rail[data-state="running"] .goal-state{animation:none;border-top-color:#69d0ba}}
  `;

  const codexComposerStyles = String.raw`
  .composer-shell{margin:0 10px 10px!important;padding:10px 11px 8px!important;border:1px solid #44474c!important;border-radius:18px!important;background:#252628!important;box-shadow:none!important}
  .composer-shell:focus-within{border-color:#5b5f65!important}
  .composer-input{display:flex;align-items:center;align-content:flex-start;flex-wrap:wrap;gap:5px;min-height:36px;padding:1px 2px 4px}
  .composer-tokens{display:flex;order:-1;flex:0 0 100%;width:100%;min-width:0;flex-wrap:wrap;gap:5px;padding:0 0 3px}
  .composer-token{display:inline-flex;align-items:center;gap:5px;max-width:min(260px,86%);height:27px;padding:0 7px;border:0;border-radius:7px;background:#303236;color:#dfe2e5;font:600 11px/1 var(--vscode-font-family);cursor:pointer}
  .composer-token:hover{background:#383b3f}.composer-token:focus-visible{outline:1px solid #6b7076;outline-offset:1px}.composer-token i{display:grid;place-items:center;width:14px;height:14px;color:#65b7ed;font-style:normal;font-size:13px}.composer-token span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.composer-token b{color:#7f858b;font-size:13px;font-weight:450}.composer-token:hover b{color:#d8dbde}
  .composer-token.skill{color:#65b7ed}.composer-token.command{color:#d9dcdf}.composer-token.command i{color:#aeb4ba}.composer-token.goal{color:#72cdb9}.composer-token.goal i{color:#72cdb9}.composer-token.context{color:#c9ccd0}.composer-token.context i{color:#9da2a8;font-size:10px;font-weight:700}
  .message.user .body:has(.sent-prompt-tokens){display:grid;gap:8px}.sent-prompt-tokens{display:flex;flex-wrap:wrap;gap:5px}.sent-prompt-token{display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;min-height:28px;padding:4px 8px;border:1px solid #3f454b;border-radius:8px;background:#25282b;color:#cfd4d8;font-size:10.5px;font-weight:650}.sent-prompt-token i{display:grid;place-items:center;width:15px;height:15px;flex:none;color:#9da5ac}.sent-prompt-token i svg{width:15px;height:15px}.sent-prompt-token b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit}.sent-prompt-token.skill{border-color:rgba(65,157,219,.28);background:rgba(48,129,184,.12);color:#66b9ef}.sent-prompt-token.skill i{color:#66b9ef}.sent-prompt-token.command{border-color:rgba(114,205,185,.25);background:rgba(80,167,148,.1);color:#87d5c4}.sent-prompt-token.command i{color:#72cdb9}.sent-prompt-token.context{color:#c8ccd0}.sent-prompt-copy{display:block;white-space:pre-wrap}
  .composer-input textarea,.composer-input textarea:focus,.composer-input textarea:focus-visible{flex:1 1 100%;width:100%!important;min-width:90px!important;height:28px;min-height:28px;max-height:132px;padding:4px 1px!important;background:transparent!important;color:#e7e9eb!important;font-size:13px;line-height:20px}
  .composer-input textarea::placeholder{color:#858a90;opacity:.72}
  .context-meter{height:1px!important;margin:1px 2px 5px!important;background:#303337!important;opacity:.72}.context-meter i{border-radius:1px}
  .composer-actions{display:flex;align-items:center;gap:2px!important;min-width:0;margin:0!important}
  .composer-actions .tool-button,.composer-actions .mode-trigger,.composer-actions .perm-trigger,.composer-actions .model-trigger{height:30px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:#aeb2b7!important;box-shadow:none!important}
  .composer-actions .tool-button:hover,.composer-actions .mode-trigger:hover,.composer-actions .perm-trigger:hover,.composer-actions .model-trigger:hover,.model-picker.open .model-trigger,.mode-picker.open .mode-trigger,.perm-wrap.open .perm-trigger{border:0!important;background:#303236!important;color:#f1f2f3!important}
  .composer-actions .plus-button{flex:none;width:30px!important;padding:0!important;font-size:20px!important;font-weight:300}
  .composer-actions .mode-trigger{width:auto!important;min-width:0;padding:0 7px!important;font-size:11px;font-weight:650}
  .composer-actions .mode-trigger:after{content:"";width:5px;height:5px;margin-left:7px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:rotate(45deg) translateY(-2px)}
  .composer-actions .perm-wrap{flex:none}.composer-actions .perm-trigger{max-width:104px;padding:0 7px!important;color:#d8bd39!important;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .composer-actions .model-picker{flex:0 1 auto!important;min-width:0!important;margin-left:auto}.composer-actions .model-trigger{width:auto!important;max-width:160px!important;min-width:0!important;padding:0 7px!important;gap:6px!important;font-size:10.5px}
  .composer-actions .model-trigger:after{width:5px;height:5px;margin-left:2px;border-width:0 1px 1px 0;transform:rotate(45deg) translateY(-2px)}
  .composer-actions #modelLabel{max-width:112px}
  .composer-actions .model-trigger-brand{width:15px;height:15px}.composer-actions .model-trigger-brand .brand-symbol{width:15px;height:15px}
  .composer-actions .send{flex:none;width:34px!important;height:34px!important;margin-left:2px;border-radius:50%!important}
  .attachment-progress{flex:none;margin:0 3px;color:#92979d;font-size:9px;white-space:nowrap}
  .composer-menu{left:0!important;right:0!important;bottom:calc(100% + 7px)!important;max-height:min(310px,48vh)!important;border-color:#484b50!important;border-radius:13px!important;background:#27292c!important}
  .composer-menu button{grid-template-columns:minmax(72px,auto) minmax(0,1fr);align-items:center;min-height:39px;padding:7px 9px!important}.composer-menu button.selected,.composer-menu button:hover{background:#34373b!important}.composer-menu .menu-key{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e7e9eb;font-weight:650}.composer-menu .menu-copy{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @media(max-width:390px){.composer-shell{margin-inline:7px!important}.composer-actions .perm-trigger{max-width:78px}.composer-actions .model-trigger{max-width:126px!important}.composer-actions #modelLabel{max-width:80px}.composer-token{max-width:94%}}
  @media(max-width:330px){.composer-actions .perm-wrap{display:none}.composer-actions .model-trigger{max-width:115px!important}}
  @media(prefers-reduced-motion:reduce){.composer-shell,.composer-token{transition:none!important}}
  `;

  const composerMenuV2Styles = String.raw`
  .add-menu,.composer-menu{position:absolute;z-index:74;left:8px!important;right:8px!important;bottom:calc(100% + 7px)!important;display:block;max-height:min(390px,58vh)!important;padding:5px!important;overflow-y:auto;overscroll-behavior:contain;border:1px solid #42454a!important;border-radius:14px!important;background:#292b2e!important;box-shadow:0 16px 38px rgba(0,0,0,.42)!important;scrollbar-width:thin;scrollbar-color:#5a5d62 transparent}
  .add-menu.hidden,.composer-menu.hidden{display:none!important}
  .menu-section-label{position:sticky;top:-5px;z-index:1;height:27px;margin:0;padding:7px 10px 5px;background:#292b2e;color:#898e94;font-size:10px;font-weight:520;line-height:15px}
  .add-menu button,.composer-menu button{display:grid!important;grid-template-columns:22px minmax(0,1fr) auto!important;align-items:center;width:100%;min-height:34px!important;margin:0;padding:5px 8px!important;gap:7px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:#d4d7da!important;text-align:left;cursor:pointer}
  .add-menu button:hover,.add-menu button.selected,.composer-menu button:hover,.composer-menu button.selected{background:#34373b!important;color:#f2f3f4!important}
  .menu-glyph{display:grid;place-items:center;width:20px;height:20px;color:#aeb3b8!important;font:500 15px/1 var(--vscode-font-family)}
  .menu-main{display:flex;align-items:baseline;min-width:0;gap:8px;overflow:hidden}
  .menu-main strong{flex:none;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit;font-size:11.5px;font-weight:510;line-height:18px}
  .menu-main small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8e9399!important;font-size:10.5px;font-weight:400;line-height:18px}
  .menu-meta{max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#777c82!important;font-size:9.5px;font-weight:400;text-align:right}
  .composer-menu .menu-main strong{max-width:46%}.composer-menu button.selected .menu-glyph,.composer-menu button:hover .menu-glyph{color:#dce0e3!important}
  .add-menu button:nth-of-type(n+4) .menu-glyph,.composer-token.skill i{color:#65b7ed!important}
  .composer-actions .plus-button.active{background:#36383c!important;color:#f1f2f3!important}
  .composer-actions .send{display:grid!important;place-items:center!important;padding:0!important}
  .composer-actions .send svg{display:block!important;width:20px!important;height:20px!important;margin:0!important;transform:none!important;overflow:visible}
  .composer-actions .send.running svg{display:none!important}
  .composer-actions .send:not(.running) svg path{transform:none}
  @media(max-width:390px){.add-menu,.composer-menu{left:2px!important;right:2px!important}.menu-main strong{max-width:58%}.menu-main small{display:none}.menu-meta{max-width:62px}.composer-menu .menu-main strong{max-width:100%}}
  @media(prefers-reduced-motion:reduce){.add-menu button,.composer-menu button,.composer-actions .plus-button{transition:none!important}}
  `;

  const codexTranscriptV2Styles = String.raw`
  .ui-symbol{display:grid;place-items:center;width:100%;height:100%;color:inherit}.ui-symbol svg{display:block;width:100%;height:100%;fill:currentColor}
  .menu-glyph{width:19px!important;height:19px!important;padding:1px;font-size:0!important}.menu-glyph .ui-symbol{width:17px;height:17px}
  .composer-token i{width:15px!important;height:15px!important;font-size:0!important}.composer-token i .ui-symbol{width:14px;height:14px}
  .composer-actions .plus-button{font-size:0!important}.composer-actions .plus-button>span{display:grid;place-items:center;width:18px;height:18px}.composer-actions .plus-button .ui-symbol{width:18px;height:18px}
  .send-icon{display:grid;place-items:center;width:20px;height:20px}.send-icon .ui-symbol{width:20px;height:20px}
  .composer-actions .send:not(.running)::before,.composer-actions .send:not(.running)::after{display:none!important;content:none!important}
  .composer-actions .send.running .send-icon{display:none!important}
  .agent-activity{gap:3px!important;margin:1px 0 12px!important;padding:1px 0!important}
  .activity-row{display:grid!important;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:7px;min-height:25px!important;color:#858a90;font-size:11.5px}
  .activity-icon{display:grid;place-items:center;width:17px;height:17px;color:#777d83}.activity-icon .ui-symbol{width:15px;height:15px}
  .activity-row.active .activity-icon{color:#a9afb5}.activity-row[data-kind="edit"].active .activity-icon,.activity-row[data-kind="inspect"].active .activity-icon{color:#65b7ed}.activity-row[data-kind="test"].active .activity-icon{color:#70c9ad}.activity-row[data-kind="error"] .activity-icon{color:#e98787}
  .activity-row.active[data-kind="waiting"] .activity-icon,.activity-row.active[data-kind="thinking"] .activity-icon,.activity-row.active[data-kind="provider"] .activity-icon{animation:activityIconBreathe 2.8s ease-in-out infinite}
  .activity-copy{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px}
  .activity-row.active .activity-copy{color:#969ba1!important;-webkit-text-fill-color:currentColor!important;background:none!important;animation:none!important}
  .activity-row.done .activity-icon{color:#70757b}.activity-row.done .activity-copy{color:#7e8389!important;-webkit-text-fill-color:currentColor!important;background:none!important;animation:none!important}
  .file-type-icon{display:grid!important;place-items:center!important;width:17px!important;height:17px!important;min-width:17px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#8f969d!important;font-size:0!important}
  .file-type-icon .ui-symbol{width:16px;height:16px}.file-type-icon.fileTs,.file-type-icon.fileTsx{color:#5ba9dd!important}.file-type-icon.fileJs,.file-type-icon.fileJsx{color:#d8bd58!important}.file-type-icon.fileCss{color:#689fe0!important}.file-type-icon.fileHtml{color:#df835f!important}.file-type-icon.fileMd{color:#aab0b6!important}.file-type-icon.filePy{color:#d0ae55!important}.file-type-icon.fileRs{color:#d88668!important}.file-type-icon.fileImage{color:#9c86d7!important}.file-type-icon.filePdf{color:#dd6969!important}.file-type-icon.fileXls{color:#62b586!important}.file-type-icon.filePpt{color:#d8845e!important}
  .file-link{gap:5px!important}.message-action .ui-symbol{width:17px;height:17px}
  .attachment-chip{display:inline-flex!important;align-items:center;gap:6px}.attachment-chip>span:not(.file-type-icon){max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .change-file{display:flex!important;align-items:center;min-width:0;gap:6px}.change-file>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @keyframes activityTextSweep{0%,8%{background-position:170% 0}86%,100%{background-position:-70% 0}}
  @keyframes activityIconBreathe{0%,100%{opacity:.55}50%{opacity:1}}
  @media(prefers-reduced-motion:reduce){.activity-row.active .activity-copy{color:#d5d8db!important;-webkit-text-fill-color:currentColor!important;background:none!important;animation:none!important}.activity-row.active .activity-icon{animation:none!important}}
  `;

  const codexTranscriptV3Styles = String.raw`
  .messages{padding:17px 12px 24px}
  .message{margin-bottom:19px}.message.assistant{color:#dfe1e4}.message.assistant.complete{margin-bottom:22px}
  .message.assistant .body{font-size:13px;line-height:1.72;letter-spacing:-.003em}.message.assistant .body p{margin-bottom:12px}.message.assistant .body h1,.message.assistant .body h2,.message.assistant .body h3,.message.assistant .body h4{margin:17px 0 8px;font-size:13.5px;line-height:1.45;letter-spacing:-.01em}.message.assistant .body ul,.message.assistant .body ol{margin:8px 0 13px;padding-left:21px}.message.assistant .body li{margin:5px 0;padding-left:2px}.composer-shell.is-running textarea{caret-color:transparent!important}
  .worked-label{display:flex;align-items:center;min-height:22px;margin:0 0 7px;color:#777c82;font-size:9.5px;font-weight:450}.worked-label.working-live{padding-bottom:7px;border-bottom:1px solid rgba(255,255,255,.075);color:#8e9399}
  .agent-activity{display:block!important;margin:0 0 10px!important;padding:0!important}
  .activity-toggle{display:grid;width:100%;grid-template-columns:18px minmax(0,1fr) 14px;align-items:center;gap:7px;min-height:29px;padding:2px 0;border:0;border-radius:7px;background:transparent;color:#969ba1;text-align:left;cursor:pointer}
  .activity-toggle:hover{color:#c8ccd0}.activity-toggle:focus-visible{outline:1px solid #5b6066;outline-offset:2px}
  .activity-current-icon,.activity-caret{display:grid;place-items:center;width:16px;height:16px;color:#858b91}.activity-current-icon .ui-symbol{width:15px;height:15px}.activity-caret .ui-symbol{width:12px;height:12px}
  .activity-current{position:relative;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#92979d;-webkit-text-fill-color:currentColor;background:none;font-size:11.5px;line-height:20px}
  .activity-current.sweeping::after{content:attr(data-sweep);position:absolute;inset:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:transparent;-webkit-text-fill-color:transparent;background:linear-gradient(90deg,transparent 28%,rgba(255,255,255,0) 38%,rgba(255,255,255,.72) 45%,#fff 50%,rgba(255,255,255,.72) 55%,rgba(255,255,255,0) 62%,transparent 72%);background-size:260% 100%;background-position:170% 0;background-clip:text;-webkit-background-clip:text;filter:drop-shadow(0 0 2px rgba(255,255,255,.22));pointer-events:none;animation:activityTextSweep 3s cubic-bezier(.22,.62,.32,1) infinite}
  .agent-activity.archived .activity-current.sweeping::after{display:none;animation:none}
  .agent-activity:not(.expanded) .activity-trace{display:none!important}.agent-activity.expanded .activity-trace{display:grid;gap:1px;padding:2px 0 2px 25px}.agent-activity.expanded .activity-row.active{display:none!important}.agent-activity.expanded .activity-row{grid-template-columns:16px minmax(0,1fr)!important;min-height:23px!important;gap:6px!important;font-size:10.5px}.agent-activity.expanded .activity-icon{width:15px;height:15px}.agent-activity.expanded .activity-icon .ui-symbol{width:13px;height:13px}
  .terminal-card{margin:2px 0 11px;border:1px solid #34373b;border-radius:9px;background:#1f2123}.terminal-card summary{display:grid;grid-template-columns:17px minmax(0,1fr) auto 13px;align-items:center;gap:7px;min-height:32px;padding:5px 8px;color:#9da2a8;list-style:none}.terminal-card summary::-webkit-details-marker{display:none}.terminal-card summary::before{display:none!important;content:none!important}.terminal-icon,.terminal-caret{display:grid;place-items:center;width:15px;height:15px;color:#858b91}.terminal-icon .ui-symbol{width:14px;height:14px}.terminal-caret .ui-symbol{width:11px;height:11px}.terminal-command{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bfc3c7;font:10px/1.4 var(--vscode-editor-font-family)}.terminal-elapsed{color:#747a80;font-size:9px}.terminal-card pre{max-height:210px!important;padding:9px 10px!important;font-size:10px!important;line-height:1.55!important}
  .activity-history-summary{margin:2px 0 12px;color:#92979d}.activity-history-summary>summary{display:grid;grid-template-columns:18px minmax(0,1fr) 14px;align-items:center;gap:7px;min-height:30px;padding:2px 0;border:0;list-style:none;cursor:pointer}.activity-history-summary>summary::-webkit-details-marker{display:none}.activity-history-summary>summary:hover{color:#c8ccd0}.activity-history-icon,.activity-history-caret{display:grid;place-items:center;width:16px;height:16px}.activity-history-icon .ui-symbol{width:15px;height:15px}.activity-history-caret .ui-symbol{width:12px;height:12px}.activity-history-copy{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px}.activity-history-details{display:grid;gap:2px;padding:3px 0 3px 25px}.activity-history-details .agent-activity{margin-bottom:3px!important}.activity-history-details .terminal-card{margin-bottom:3px!important}
  .message-meta{margin-top:4px}.message.assistant .message-meta{min-height:23px}.message-action{width:24px;height:24px}.message-action .ui-symbol{width:16px;height:16px}
  .plan-artifact{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;margin:3px 0 11px;padding:10px;border:1px solid #3a3e43;border-radius:11px;background:#222426;color:#dfe2e5}.plan-artifact-icon{display:grid;width:34px;height:34px;place-items:center;border-radius:8px;background:#2c3034;color:#70b7e8}.plan-artifact-icon .ui-symbol{width:18px;height:18px}.plan-artifact-copy{display:grid;gap:2px;min-width:0}.plan-artifact-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8eaec;font-size:11.5px;font-weight:650}.plan-artifact-copy small{color:#858b91;font-size:9.5px}.plan-artifact-open{display:inline-flex;align-items:center;gap:5px;height:29px;padding:0 8px;border:1px solid #44484d;border-radius:7px;background:#2a2d30;color:#d8dbde;font-size:10px;white-space:nowrap;cursor:pointer}.plan-artifact-open:hover{background:#35393d;color:#fff}.plan-artifact-open:active{transform:translateY(1px)}.plan-artifact-open i{display:grid;width:12px;height:12px;place-items:center}.plan-artifact-open .ui-symbol{width:11px;height:11px}
  .chat-change-summary{display:block;margin:12px 0 50px;padding:0;border:1px solid #383b3f;border-radius:11px;background:#222426;color:#d4d7da;overflow:hidden}.chat-change-summary>header{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:55px;padding:9px 11px}.change-summary-icon{display:grid!important;place-items:center;width:22px!important;height:22px!important;color:#92989e}.change-summary-icon .ui-symbol{width:18px;height:18px}.change-summary-copy{display:grid;gap:3px;min-width:0;cursor:pointer}.change-summary-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e7e9eb;font-size:12px;font-weight:650}.change-summary-copy small{display:flex;gap:6px;color:#858b91;font-size:10px}.change-summary-actions{display:flex;align-items:center;gap:4px}.chat-change-summary .change-summary-actions button{height:29px;padding:0 9px;border:1px solid transparent;border-radius:7px;background:transparent;color:#b6bbc0;font-size:10.5px}.chat-change-summary .change-summary-actions button:hover{background:#34373b;color:#eef0f2}.chat-change-summary .change-summary-actions .summary-review{border-color:#41454a;background:#292b2e;color:#e0e3e5}.change-summary-preview{display:grid;border-top:1px solid #34383c;background:#202224}.chat-change-summary .change-summary-file,.chat-change-summary .change-summary-more{display:grid;width:100%;height:auto;min-height:40px;margin:0;padding:8px 11px;border:0;border-bottom:1px solid rgba(255,255,255,.05);border-radius:0;background:transparent;color:#c4c8cc;text-align:left;cursor:pointer}.chat-change-summary .change-summary-file{grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:9px}.chat-change-summary .change-summary-file>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.chat-change-summary .change-summary-file>small{font-size:10px}.chat-change-summary .change-summary-file:hover,.chat-change-summary .change-summary-more:hover{background:#292c2f;color:#eef0f2}.chat-change-summary .change-summary-more{place-items:center;border-bottom:0;color:#9ba1a7;font-size:10.5px;text-align:center}
  @media(max-width:360px){.change-summary-copy small{display:flex}.chat-change-summary>header{grid-template-columns:20px minmax(0,1fr) auto;padding-inline:8px}.change-summary-actions{gap:1px}.chat-change-summary .change-summary-actions button{padding-inline:6px}.message.assistant .body{font-size:12.5px}.plan-artifact{grid-template-columns:30px minmax(0,1fr);padding:8px}.plan-artifact-icon{width:30px;height:30px}.plan-artifact-open{grid-column:2;justify-self:start}}
  @media(prefers-reduced-motion:reduce){.activity-current{color:#c9cdd1!important;-webkit-text-fill-color:currentColor!important;background:none!important}.activity-current.sweeping::after{display:none!important;animation:none!important}}
  `;

  const narrowLayoutAndProfileFixStyles = String.raw`
  html,body{width:100%;max-width:100%;overflow-x:hidden}
  input[type="number"]{-moz-appearance:textfield;appearance:textfield}
  input[type="number"]::-webkit-inner-spin-button,input[type="number"]::-webkit-outer-spin-button{-webkit-appearance:none;appearance:none;margin:0}
  .route-header,.console,.setup,.config-panel,.overlay-panel,.composer-shell{max-width:100%}
  .config-panel{top:44px;bottom:7px;max-height:calc(100vh - 51px);overflow-x:hidden!important;overflow-y:auto!important}
  .profile-list{max-width:100%;scrollbar-width:thin}.profile-actions{min-width:0}
  @media(max-width:420px){
    .config-panel{left:6px;right:6px;padding:11px}
    .profile-bar{display:grid!important;align-items:stretch!important;gap:7px!important}
    .profile-actions{justify-content:flex-start;flex-wrap:wrap}
    .profile-new,.profile-delete{flex:0 1 auto}
    .config-subactions{display:grid!important;grid-template-columns:1fr 1fr;gap:6px!important}
    .config-subactions .secondary{min-width:0;white-space:normal;line-height:1.25}
    #openCockpit,#localSetup{grid-column:1/-1}
    .setup{padding-inline:11px!important}.setup-hero h1{font-size:21px!important}
    .launch-panel{max-width:100%}.provider-overview{grid-template-columns:38px minmax(0,1fr) 28px!important;padding:12px!important}
  }
  @media(max-width:340px){
    .route-header{padding-inline:7px!important}.route-meta{min-width:60px!important}.route-meta #connectionLabel{max-width:74px}
    .header-action{padding-inline:3px!important;font-size:9px!important}
    .config-panel{left:4px;right:4px;padding:9px}
    .price-row,.config-actions,.config-subactions{display:grid!important;grid-template-columns:1fr!important}
    .config-actions .secondary,.config-subactions .secondary{width:100%;min-width:0}
    .profile-actions{display:grid!important;grid-template-columns:1fr 1fr;width:100%}
    .profile-new,.profile-delete{width:100%;padding-inline:6px}
    .provider-trigger{padding-inline:8px}.provider-trigger small{white-space:normal}
    .composer-shell{margin-inline:5px!important;padding-inline:8px!important}
    .composer-actions .mode-trigger{padding-inline:5px!important}.composer-actions .model-trigger{max-width:105px!important}
    .connection-page-actions{grid-template-columns:1fr!important}.connection-page-actions .primary{grid-column:auto!important}
  }
  `;

  const unifiedDialogStyles = String.raw`
  .ui-dialog-backdrop{z-index:130;padding:12px;background:rgba(10,11,12,.72);backdrop-filter:blur(6px)}
  .ui-dialog{width:min(400px,100%);overflow:hidden;border:1px solid #45494e;border-radius:14px;background:#242628;box-shadow:0 26px 78px rgba(0,0,0,.68);animation:dialogEnter .16s cubic-bezier(.16,1,.3,1)}
  .ui-dialog>header{display:flex;align-items:center;justify-content:space-between;padding:13px 14px 0}.ui-dialog-icon{display:grid;place-items:center;width:30px;height:30px;border:1px solid #3f4347;border-radius:9px;background:#1d1f21;color:#aeb4ba}.ui-dialog-icon .ui-symbol{width:17px;height:17px}.ui-dialog[data-tone="danger"] .ui-dialog-icon{border-color:rgba(232,120,120,.28);background:rgba(232,120,120,.07);color:#ec8989}.ui-dialog[data-tone="warning"] .ui-dialog-icon{border-color:rgba(214,181,44,.3);background:rgba(214,181,44,.07);color:#dcc261}.ui-dialog[data-tone="success"] .ui-dialog-icon{border-color:rgba(78,201,176,.28);background:rgba(78,201,176,.07);color:#70d4bf}
  .ui-dialog>header>button{display:grid;place-items:center;width:27px;height:27px;padding:0;border:0;border-radius:7px;background:transparent;color:#858b91;cursor:pointer}.ui-dialog>header>button:hover{background:#323539;color:#eef0f2}.ui-dialog>header>button .ui-symbol{width:15px;height:15px}
  .ui-dialog-copy{display:grid;gap:6px;padding:12px 15px 4px}.ui-dialog-copy>strong{color:#f0f2f3;font-size:13.5px;font-weight:700;line-height:1.35;letter-spacing:-.01em}.ui-dialog-copy>p{margin:0;color:#bdc1c5;font-size:11px;line-height:1.58;white-space:pre-wrap}.ui-dialog-copy>small{padding:8px 9px;border:1px solid #373b3f;border-radius:8px;background:#1e2022;color:#898f95;font-size:9.5px;line-height:1.5;white-space:pre-wrap}
  .ui-dialog-field{display:grid;gap:6px;padding:9px 15px 4px;color:#979da3;font-size:9.5px}.ui-dialog-field input{width:100%;height:37px;padding:0 10px;border:1px solid #42464b;border-radius:8px;outline:0;background:#191b1d;color:#edf0f2;font-size:11px}.ui-dialog-field input:focus{border-color:#697078;box-shadow:0 0 0 1px rgba(105,112,120,.18)}.ui-dialog-field>small{color:#eb8989;font-size:9px}
  .ui-dialog>footer{display:flex;justify-content:flex-end;gap:7px;padding:13px 15px 15px}.ui-dialog-action{min-height:32px;padding:6px 11px;border:1px solid #44484d;border-radius:8px;background:#2c2f32;color:#d5d9dc;font-size:10px;font-weight:620;cursor:pointer;white-space:nowrap}.ui-dialog-action:hover{background:#36393d;color:#fff}.ui-dialog-action:active{transform:translateY(1px)}.ui-dialog-action.primary{border-color:#eceeef;background:#eceeef;color:#1b1d1f}.ui-dialog-action.primary:hover{background:#fff}.ui-dialog-action.danger{border-color:#d86f73;background:#d86f73;color:#1d1011}.ui-dialog-action.danger:hover{background:#e47b7f}
  .ui-dialog>footer.many{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.ui-dialog>footer.many .ui-dialog-action{width:100%;white-space:normal;line-height:1.25}
  .toast-stack{position:fixed;z-index:145;left:10px;right:10px;bottom:11px;display:grid;justify-items:end;gap:8px;pointer-events:none}.ui-toast{display:grid;grid-template-columns:22px minmax(0,1fr) 28px;align-items:center;gap:10px;width:min(430px,100%);padding:12px 10px 12px 12px;border:1px solid #41454a;border-radius:12px;background:#292c2f;color:#d9dcdf;box-shadow:0 16px 42px rgba(0,0,0,.45);pointer-events:auto;animation:toastEnter .18s cubic-bezier(.16,1,.3,1)}.ui-toast>span{display:grid;place-items:center;width:21px;height:21px;color:#9da3a9}.ui-toast>span .ui-symbol{width:19px;height:19px}.ui-toast.success>span{color:#70d4bf}.ui-toast.warning>span{color:#dcc261}.ui-toast.danger>span{color:#ec8989}.ui-toast p{margin:0;font-size:11.5px;line-height:1.5}.ui-toast button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;color:#858b91;cursor:pointer}.ui-toast button:hover{background:#373a3e;color:#fff}.ui-toast button .ui-symbol{width:15px;height:15px}
  @keyframes dialogEnter{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}@keyframes toastEnter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  @media(max-width:340px){.ui-dialog-backdrop{padding:7px}.ui-dialog>footer{display:grid;grid-template-columns:1fr}.ui-dialog-action{width:100%}.toast-stack{left:6px;right:6px}}
  @media(prefers-reduced-motion:reduce){.ui-dialog,.ui-toast{animation:none!important}}
  `;

  const linkPresentationStyles = String.raw`
  .composer-token.link{display:inline-flex;height:27px;padding:0 3px;border:0;background:transparent;color:#58aee8;cursor:default}
  .composer-token.link:hover{background:rgba(88,174,232,.07)}
  .composer-link-open{display:inline-flex;align-items:center;gap:6px;min-width:0;height:27px;padding:0 2px;border:0;background:transparent;color:inherit;font:650 12.5px/1 var(--vscode-font-family);cursor:pointer}
  .composer-link-open:hover{text-decoration:underline}.composer-link-open>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .composer-token.link i{flex:none;width:16px!important;height:16px!important;color:#58aee8}.composer-token.link i .brand-symbol,.composer-token.link i .ui-symbol{width:15px;height:15px}
  .composer-link-remove{display:grid;place-items:center;width:20px;height:20px;margin-left:1px;padding:0;border:0;border-radius:6px;background:transparent;color:#7e8992;cursor:pointer;opacity:0}
  .composer-token.link:hover .composer-link-remove,.composer-link-remove:focus-visible{opacity:1}.composer-link-remove:hover{background:#34383c;color:#dce1e5}.composer-link-remove .ui-symbol{width:11px;height:11px}
  .rich-link{display:inline-flex;align-items:center;gap:4px;max-width:100%;vertical-align:-2px}.rich-link>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rich-link-icon{display:inline-grid;place-items:center;flex:none;width:14px;height:14px}.rich-link-icon .brand-symbol,.rich-link-icon .ui-symbol{width:13px;height:13px}
  @media(max-width:390px){.composer-token.link{max-width:96%}.composer-link-open{max-width:calc(100% - 22px)}}
  @media(hover:none){.composer-link-remove{opacity:1}}
  `;

  const headerRedesignStyles = String.raw`
  .route-header{height:58px!important;padding:8px 10px!important;gap:10px!important;border-bottom:1px solid #303338!important;background:linear-gradient(180deg,#1c1e20 0%,#191b1d 100%)!important}
  .route-meta{display:flex!important;align-items:center!important;gap:9px!important;flex:1!important;min-width:0!important;height:40px;padding:0 10px;border:1px solid #33373b;border-radius:11px;background:#222426}
  .route-meta .dot{width:7px;height:7px;box-shadow:0 0 0 3px rgba(98,215,189,.08)}
  .connection-copy{display:grid;min-width:0;gap:1px}.connection-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e7e9eb;font-size:10.5px!important;font-weight:620}.connection-copy small{color:#737980;font-size:8px}
  .header-actions{height:40px;gap:2px!important;padding:3px;border:1px solid #33373b;border-radius:11px;background:#222426}
  .header-action{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:32px;padding:0 8px!important;border-radius:8px!important;color:#9da3a9!important;font-size:9.5px!important;white-space:nowrap}
  .header-action:hover,.header-action[aria-expanded="true"]{background:#303338!important;color:#f1f3f4!important}
  .header-action>span:first-child{display:grid;place-items:center;width:14px;height:14px;flex:none}.header-action .ui-symbol{width:14px;height:14px}
  .header-action.connect-action{color:#76d9c3!important}.header-action.connect-action.attention{background:rgba(222,185,91,.1)!important;color:#e4c66f!important}
  .header-action.icon-only{width:32px;padding:0!important}
  @media(max-width:390px){.route-header{padding-inline:7px!important}.route-meta{padding-inline:8px!important}.connection-copy small{display:none}.header-action{width:31px;padding:0!important}.header-action>span:last-child{display:none}.header-action.icon-only{width:31px}.header-actions{flex:none}}
  `;

  const settingsAndSpacingPolishStyles = String.raw`
  .console{height:calc(100vh - 58px)!important;padding-bottom:5px}
  .composer-shell{margin:0 10px 13px!important}
  .config-panel{top:64px!important;bottom:9px!important;max-height:calc(100vh - 73px)!important}
  .config-panel,.provider-menu,.language-menu,.profile-list,.model-options,.overlay-panel{scrollbar-width:thin!important;scrollbar-color:#5a6066 transparent!important}
  .header-actions{flex:0 0 auto!important;overflow:visible!important}
  .header-action.icon-only{display:inline-flex!important;visibility:visible!important;opacity:1!important;flex:0 0 32px!important}
  .language-setting{display:grid!important;gap:6px!important;margin:0!important;padding:9px 0 11px!important}.language-setting>span{color:#a7abb0;font-size:10px}
  .language-picker{position:relative}.language-trigger{display:flex;align-items:center;justify-content:space-between;width:100%;height:37px;padding:0 11px;border:1px solid #42464b;border-radius:9px;background:#1d1f21;color:#e3e5e7;text-align:left;cursor:pointer}
  .language-trigger:hover,.language-picker.open .language-trigger{border-color:#5b6167;background:#222426}.language-trigger i{width:7px;height:7px;border-right:1.5px solid #a1a6ab;border-bottom:1.5px solid #a1a6ab;transform:rotate(45deg) translateY(-2px);transition:transform .14s}.language-picker.open .language-trigger i{transform:rotate(225deg) translate(-2px,-2px)}
  .language-menu{position:absolute;z-index:125;top:calc(100% + 6px);left:0;right:0;display:grid;gap:3px;max-height:180px;overflow:auto;padding:6px;border:1px solid #464b50;border-radius:11px;background:#222426;box-shadow:0 18px 48px rgba(0,0,0,.58)}
  .language-menu button{display:grid;gap:1px;width:100%;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:#e0e2e4;text-align:left;cursor:pointer}.language-menu button:hover{background:#303338}.language-menu strong{font-size:10.5px}.language-menu small{color:#858b91;font-size:8.5px}
  .profile-bar{display:grid!important;grid-template-columns:minmax(66px,1fr) auto!important;align-items:end!important;gap:8px!important}.profile-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;flex-wrap:nowrap!important;min-width:max-content!important}.profile-list{min-width:0;overflow:auto}.profile-new,.profile-delete{flex:none!important;width:auto!important}
  .provider-trigger{position:relative;padding-right:34px}.provider-trigger:after{content:"";position:absolute;right:14px;top:50%;width:7px;height:7px;border-right:1.5px solid #9fa4a9;border-bottom:1.5px solid #9fa4a9;transform:translateY(-65%) rotate(45deg)}.provider-picker.open .provider-trigger:after{transform:translateY(-35%) rotate(225deg)}
  .provider-menu{padding:7px}.provider-option{grid-template-columns:34px minmax(0,1fr)!important;align-items:center;gap:9px!important;min-height:51px}.provider-option .provider-brand-slot{display:grid;place-items:center;width:34px;height:34px;padding:6px;border:1px solid #44494e;border-radius:9px;background:#181a1c}.provider-option .provider-brand-slot svg,.provider-option .provider-brand-slot img{display:block;width:20px;height:20px;object-fit:contain}
  .model-option>.model-brand{display:grid!important;place-items:center!important;width:28px!important;height:28px!important;min-width:28px!important;padding:5px!important;border:1px solid #41464b!important;border-radius:8px!important;background:#1b1d1f!important;line-height:0!important}.model-option>.model-brand>.brand-symbol{display:grid!important;place-items:center!important;transform:none!important}.model-option>.model-brand svg,.model-option>.model-brand img{display:block!important;width:17px!important;height:17px!important;max-width:17px!important;max-height:17px!important;object-fit:contain}.model-trigger-brand>.brand-symbol{transform:none!important}
  .model-option-copy{display:grid;align-content:center;gap:1px;min-width:0;flex:1}.model-option-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7f858b;font-size:8.5px}
  .codex-tuning{display:flex;align-items:center;gap:5px;min-width:0;margin:1px 0 7px;padding:5px;border:1px solid #373b3f;border-radius:10px;background:#202224}.tuning-label{flex:none;padding:0 5px;color:#6db9e8;font-size:8px;font-weight:750;letter-spacing:.09em;text-transform:uppercase}.reasoning-picker{position:relative;min-width:0}.tuning-button,.quota-reset{display:flex;align-items:center;gap:5px;height:27px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:#92989e;font-size:8.5px;cursor:pointer;white-space:nowrap}.tuning-button:hover,.reasoning-picker.open .tuning-button,.quota-reset:hover{background:#2d3033;color:#dce0e3}.tuning-button strong,.quota-reset strong{color:#d7dade;font-size:9px;font-weight:650}.fast-toggle.active{background:rgba(102,216,190,.09);color:#76d8c2}.fast-toggle.active strong{color:#84dfca}.quota-reset{margin-left:auto;color:#858b91}.quota-reset strong{color:#d9bf66}
  .reasoning-menu{position:absolute;z-index:90;left:0;bottom:calc(100% + 7px);display:grid;gap:2px;width:210px;padding:6px;border:1px solid #464b50;border-radius:11px;background:#24272a;box-shadow:0 18px 45px rgba(0,0,0,.56)}.reasoning-menu button{display:grid;gap:1px;width:100%;padding:7px 9px;border:0;border-radius:7px;background:transparent;color:#d8dbde;text-align:left;cursor:pointer}.reasoning-menu button:hover,.reasoning-menu button.active{background:#34373a}.reasoning-menu strong{font-size:10px}.reasoning-menu small{color:#858b91;font-size:8px}.reasoning-menu button.active strong{color:#7bd7c2}
  @media(max-width:420px){.profile-bar{grid-template-columns:minmax(62px,1fr) auto!important}.profile-actions{gap:4px!important}.profile-new,.profile-delete{padding-inline:7px!important;font-size:9px!important}}
  @media(max-width:390px){.route-meta{flex:1 1 auto!important;min-width:0!important}.header-action.icon-only{flex-basis:31px!important}}
  @media(max-width:380px){.codex-tuning{gap:2px}.tuning-label{display:none}.tuning-button,.quota-reset{padding-inline:6px}.tuning-button>span,.quota-reset>span{display:none}}
  @media(max-width:340px){.profile-bar{grid-template-columns:minmax(56px,1fr) auto!important}.profile-actions{display:flex!important;width:auto!important}.profile-new,.profile-delete{width:auto!important;padding-inline:5px!important;font-size:8.5px!important}.composer-shell{margin-bottom:11px!important}}
  `;
  
  const changeReviewV2Styles = String.raw`
  .change-review-backdrop{padding:12px;background:rgba(5,6,7,.68);backdrop-filter:blur(4px)}
  .change-review-dialog{width:min(680px,100%);max-height:min(760px,calc(100vh - 24px));border-color:#464b50;border-radius:16px;background:#202224}
  .change-review-dialog>header{min-height:58px;padding:11px 13px;border-color:#363a3e;background:linear-gradient(180deg,#292c2f,#242629)}
  .review-file-icon{display:grid;place-items:center;width:34px;height:34px;flex:none;border:1px solid #41464b;border-radius:9px;background:#1b1d1f}.review-file-icon .file-type-icon{width:auto}.review-file-icon .ui-symbol{width:18px;height:18px}
  .change-review-dialog>header>div{gap:3px}.change-review-dialog header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eef0f2;font-size:11.5px}.change-review-dialog header span{font-size:9px}.change-review-dialog>header>button{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;font-size:0}.change-review-dialog>header>button:hover{background:#35383c}.change-review-dialog>header>button .ui-symbol{width:15px;height:15px}
  .hunk-list{gap:10px;min-height:120px;padding:12px;background:#191b1d;scrollbar-width:thin;scrollbar-color:#555a60 transparent}.hunk-card{border-color:#393e43;border-radius:10px;background:#202225}.hunk-card header{min-height:35px;padding:6px 8px;background:#272a2d}.hunk-card header span{color:#8e959c}.hunk-card header button{height:24px;padding:0 8px;border:1px solid transparent}.hunk-card header .hunk-undo:hover{border-color:rgba(232,120,120,.28);background:rgba(232,120,120,.08);color:#ef9292}.hunk-card header .hunk-accept:hover{border-color:rgba(112,207,184,.28);background:rgba(112,207,184,.08);color:#7cdbc5}
  .hunk-lines{max-height:260px;padding:4px 0;background:#181a1c}.hunk-line{grid-template-columns:14px 34px minmax(0,1fr);gap:4px;padding:1px 9px;font:10px/1.55 var(--vscode-editor-font-family)}.hunk-line i{font-style:normal;font-weight:750;text-align:center}.hunk-line em{color:#646a70;font-style:normal;text-align:right;user-select:none}.hunk-line code{min-width:0;color:#d0d3d6;white-space:pre-wrap;overflow-wrap:anywhere}.hunk-line.add{border-left:2px solid #55bd9f;background:rgba(69,172,120,.11)}.hunk-line.add i{color:#70cfb8}.hunk-line.remove{border-left:2px solid #d96868;background:rgba(211,86,86,.105)}.hunk-line.remove i{color:#ef8585}.review-empty{margin:auto;color:#858b91;font-size:10.5px}
  .change-review-dialog>footer{align-items:center;gap:7px;padding:10px 12px;border-color:#363a3e;background:#242629}.change-review-dialog>footer>span{flex:1}.change-review-dialog>footer button{height:30px;padding:0 10px;border:1px solid #42474c;border-radius:8px;background:#292c2f;color:#c8ccd0;font-size:9.5px;cursor:pointer}.change-review-dialog>footer button:hover{background:#34383c;color:#fff}.change-review-dialog>footer .review-full-diff{color:#aeb4ba}.change-review-dialog>footer .review-undo-file:hover{border-color:rgba(232,120,120,.38);color:#ef9292}.change-review-dialog>footer .review-accept-file{border-color:rgba(112,207,184,.32);background:rgba(112,207,184,.1);color:#80dbc6}.change-review-dialog>footer .review-accept-file:hover{background:#67cdb5;color:#10251f}
  .change-summary-stats{display:inline-flex;gap:6px;margin-left:7px}.message.assistant .diff-inline{display:inline-flex;gap:5px;margin-inline:2px}.message.assistant .diff-inline .diff-add,.message.assistant .diff-inline .diff-remove{font-variant-numeric:tabular-nums}
  @media(max-width:420px){.change-review-backdrop{padding:6px}.change-review-dialog{max-height:calc(100vh - 12px);border-radius:13px}.change-review-dialog>footer{display:grid;grid-template-columns:1fr 1fr}.change-review-dialog>footer>span{display:none}.change-review-dialog>footer .review-full-diff{grid-column:1/-1}.hunk-line{grid-template-columns:13px 27px minmax(0,1fr);padding-inline:6px}.hunk-card header span{font-size:8px}}
  `;

  const boundedChangeTrayStyles = String.raw`
  .change-tray{--change-tray-max:clamp(240px,46vh,500px);position:relative;z-index:3;display:grid!important;grid-template-rows:minmax(0,auto) auto;flex:0 0 auto!important;height:auto!important;min-height:45px!important;max-height:var(--change-tray-max)!important;margin-bottom:10px!important;overflow:hidden!important;contain:layout paint}
  .change-tray.hidden{display:none!important}
  .change-tray #changeList{min-height:0;max-height:calc(var(--change-tray-max) - 45px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:auto;scrollbar-width:thin;scrollbar-color:#555a60 transparent}
  .change-tray #changeList::-webkit-scrollbar{width:7px}.change-tray #changeList::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:9px;background:#555a60;background-clip:padding-box}
  .change-tray-footer{position:relative;z-index:2;display:flex!important;flex-wrap:nowrap!important;min-height:45px;padding:8px 10px!important;border-top:1px solid #383c40;background:#242629;box-shadow:0 -10px 24px rgba(10,11,12,.24)}
  .change-tray-footer #changeCount{min-width:0!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.change-tray-footer button{flex:none}
  .change-row{min-width:0}.change-row-review{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;width:100%;min-height:39px;padding:7px 10px;border:0;border-bottom:1px solid rgba(255,255,255,.055);border-radius:0;background:transparent;color:#d7d7d7;text-align:left;cursor:pointer}.change-row-review:hover,.change-row-review:focus-visible{background:#2b2e31;outline:none}.change-row .change-file{display:flex;align-items:center;gap:7px;min-width:0}.change-row .change-file>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.change-row .file-type-icon{display:grid;place-items:center;flex:none}.change-row-stats{display:flex;align-items:center;gap:4px;font-size:9.5px;font-variant-numeric:tabular-nums}
  .change-list-more{display:block;width:calc(100% - 16px);min-height:32px;margin:7px 8px;border:1px solid #3e4348;border-radius:8px;background:#292c2f;color:#aeb4ba;font-size:9.5px;cursor:pointer}.change-list-more:hover{border-color:#51575d;background:#313438;color:#eef0f2}
  .change-tray.is-busy{opacity:.78}.change-tray button:disabled{cursor:default;opacity:.48;pointer-events:none}
  .chat-change-summary.collapsed .change-summary-preview{display:none}.change-summary-preview{max-height:min(400px,46vh);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#555a60 transparent}.chat-change-summary .summary-review{min-width:48px}
  .terminal-card{margin:1px 0 5px!important;border:0!important;border-radius:0!important;background:transparent!important;overflow-anchor:none}.terminal-card summary{min-height:27px!important;padding:3px 1px!important}.terminal-card pre{margin-top:3px!important;border:1px solid #34373b!important;border-radius:8px!important;background:#191b1d!important}
  .change-row-review.is-resolved{cursor:default;opacity:.7}.change-row-review.is-resolved:hover{background:transparent}.change-row-stats em{margin-left:5px;color:#8d949a;font-size:9px;font-style:normal}
  @media(max-width:390px){.change-tray{--change-tray-max:clamp(230px,46vh,420px)}.change-row-review{grid-template-columns:minmax(0,1fr) auto!important}.change-row .change-file{grid-column:auto}.change-row>span:nth-child(2){grid-column:auto;justify-self:end}.change-tray-footer{gap:4px!important;padding-inline:7px!important}.change-tray-footer button{padding-inline:6px!important;font-size:9px!important}}
  @media(max-height:650px){.change-tray{--change-tray-max:clamp(210px,44vh,286px)}}
  `;

  const compactScrollbarStyles = String.raw`
  *{scrollbar-width:thin;scrollbar-color:#596067 transparent;scrollbar-gutter:auto}
  *::-webkit-scrollbar{width:10px!important;height:10px!important;background:transparent!important}
  *::-webkit-scrollbar-track,*::-webkit-scrollbar-track-piece,*::-webkit-scrollbar-corner{border:0!important;background:transparent!important;box-shadow:none!important}
  *::-webkit-scrollbar-thumb{min-height:28px;border:2px solid transparent!important;border-radius:999px!important;background:#596067!important;background-clip:padding-box!important;box-shadow:none!important}
  *::-webkit-scrollbar-thumb:hover{background:#747b82!important;background-clip:padding-box!important}
  *::-webkit-scrollbar-button:single-button{display:block!important;width:10px!important;height:11px!important;border:0!important;background-color:transparent!important;background-position:center!important;background-repeat:no-repeat!important;background-size:7px 7px!important}
  *::-webkit-scrollbar-button:single-button:vertical:decrement{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 6.5 5 3.5l3 3' fill='none' stroke='%238b9299' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important}
  *::-webkit-scrollbar-button:single-button:vertical:increment{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='m2 3.5 3 3 3-3' fill='none' stroke='%238b9299' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important}
  *::-webkit-scrollbar-button:single-button:horizontal:decrement{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M6.5 2 3.5 5l3 3' fill='none' stroke='%238b9299' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important}
  *::-webkit-scrollbar-button:single-button:horizontal:increment{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='m3.5 2 3 3-3 3' fill='none' stroke='%238b9299' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")!important}
  `;

  const ideNativeHeaderAndFileStyles = String.raw`
  .route-header{height:49px!important;padding:0 10px!important;gap:7px!important;border-bottom:1px solid #303338!important;background:#191b1d!important}
  .route-meta{height:48px!important;padding:0 4px!important;gap:8px!important;border:0!important;border-radius:0!important;background:transparent!important}
  .route-meta .dot{width:7px;height:7px;box-shadow:0 0 0 3px rgba(98,215,189,.07)}
  .connection-copy{gap:1px}.connection-copy strong{font-size:10.5px!important}.connection-copy small{color:#737a81;font-size:8px}
  .header-actions{height:34px!important;padding:1px!important;gap:1px!important;border:0!important;border-radius:9px!important;background:transparent!important}
  .header-action{height:30px!important;padding:0 7px!important;gap:5px!important;border:1px solid transparent!important;border-radius:7px!important;color:#9da4aa!important;font-size:9.5px!important}
  .header-action:hover,.header-action:focus-visible,.header-action[aria-expanded="true"]{border-color:#373c41!important;background:#25282b!important;color:#edf0f2!important;outline:none!important}
  .header-action.connect-action{color:#78d9c4!important}.header-action.icon-only{display:inline-flex!important;visibility:visible!important;opacity:1!important;width:30px!important;min-width:30px!important;flex:0 0 30px!important}
  .header-action>span:first-child,.header-action .ui-symbol{width:15px!important;height:15px!important}
  .console{height:calc(100vh - 49px)!important}.config-panel{top:54px!important;max-height:calc(100vh - 63px)!important}
  .file-type-icon,.file-type-icon[class]{display:inline-grid!important;place-items:center!important;align-self:center!important;width:17px!important;height:17px!important;min-width:17px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#58aee8!important;font-size:0!important;line-height:0!important;vertical-align:-3px!important;transform:none!important}
  .file-type-icon .ui-symbol,.file-type-icon .ui-symbol svg{display:block!important;width:15px!important;height:15px!important;margin:auto!important;transform:none!important}
  .file-link{display:inline-flex!important;align-items:center!important;gap:5px!important;max-width:100%;padding:0!important;color:#58aee8!important;line-height:inherit!important;vertical-align:-3px!important}
  .file-link>span:not(.file-type-icon){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-link:hover{color:#7fc4f0!important;text-decoration:underline}
  .change-summary-icon{color:#58aee8!important}.change-summary-icon .ui-symbol{width:18px!important;height:18px!important}
  .change-summary-file .file-type-icon,.change-row .file-type-icon{justify-self:center!important}.change-file>span:last-child,.change-summary-file>span:nth-child(2){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @media(max-width:440px){.header-action{width:30px!important;padding:0!important}.header-action>span:last-child{display:none!important}.connection-copy small{display:none}.route-header{padding-inline:8px!important}.route-meta{min-width:0!important}}
  @media(max-width:330px){.route-header{padding-inline:6px!important;gap:4px!important}.route-meta{padding-inline:2px!important}.connection-copy strong{max-width:92px}.header-actions{flex:0 0 auto!important}.header-action.icon-only{display:inline-flex!important}}
  `;

  const responsiveHeaderAndFileIconsV2Styles = String.raw`
  :root{--relay-file-accent:var(--vscode-textLink-foreground,#59b6f3)}
  .route-header{
    position:relative!important;
    z-index:52!important;
    display:grid!important;
    grid-template-columns:minmax(150px,320px) max-content!important;
    justify-content:space-between!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    height:52px!important;
    padding:7px 10px!important;
    gap:10px!important;
    overflow:visible!important;
    border-bottom:1px solid #2f3337!important;
    background:linear-gradient(180deg,#1b1d1f 0%,#181a1c 100%)!important
  }
  .route-meta{
    display:flex!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    max-width:320px!important;
    height:36px!important;
    padding:0 10px!important;
    gap:9px!important;
    overflow:hidden!important;
    border:1px solid #34393e!important;
    border-radius:10px!important;
    background:#202326!important
  }
  .route-meta .dot{width:7px!important;height:7px!important;box-shadow:0 0 0 3px rgba(98,215,189,.08)!important}
  .connection-copy{display:grid!important;min-width:0!important;gap:0!important;overflow:hidden!important}
  .connection-copy strong,.connection-copy small{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  .connection-copy strong{color:#e2e6e9!important;font-size:10.5px!important;line-height:1.35!important}
  .connection-copy small{color:#747c83!important;font-size:8px!important;line-height:1.25!important}
  .header-actions{
    display:flex!important;
    align-items:center!important;
    justify-content:flex-end!important;
    min-width:0!important;
    height:36px!important;
    padding:0!important;
    gap:2px!important;
    overflow:visible!important;
    border:0!important;
    background:transparent!important
  }
  .header-action,.header-action.icon-only{
    position:relative!important;
    display:inline-flex!important;
    visibility:visible!important;
    opacity:1!important;
    flex:0 0 auto!important;
    align-items:center!important;
    justify-content:center!important;
    min-width:32px!important;
    width:auto!important;
    height:32px!important;
    padding:0 8px!important;
    gap:6px!important;
    overflow:visible!important;
    border:1px solid transparent!important;
    border-radius:8px!important;
    background:transparent!important;
    color:#9ea6ad!important
  }
  .header-action.icon-only{width:32px!important;padding:0!important}
  .header-action:hover,.header-action:focus-visible,.header-action[aria-expanded="true"]{border-color:#3b4146!important;background:#262a2d!important;color:#f0f3f5!important}
  .header-action.connect-action{color:#73d7c0!important}
  .header-action>span:first-child,.header-action .ui-symbol,.header-action .ui-symbol svg{display:grid!important;place-items:center!important;width:16px!important;height:16px!important;flex:none!important}
  .header-action-label{display:block;max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .header-action::after{
    content:attr(data-tooltip);
    position:absolute;
    top:calc(100% + 7px);
    right:0;
    z-index:150;
    display:none;
    width:max-content;
    max-width:190px;
    padding:5px 7px;
    border:1px solid #454b50;
    border-radius:6px;
    background:#25282b;
    color:#e7eaec;
    box-shadow:0 8px 22px rgba(0,0,0,.42);
    font-size:9px;
    font-weight:500;
    line-height:1.3;
    pointer-events:none;
    white-space:nowrap
  }
  .header-action.icon-only:hover::after,.header-action.icon-only:focus-visible::after{display:block}
  .console{height:calc(100vh - 52px)!important}.config-panel{top:57px!important;max-height:calc(100vh - 66px)!important}

  body .file-type-icon,body .file-type-icon[class]{
    position:relative!important;
    top:0!important;
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    align-self:center!important;
    flex:0 0 16px!important;
    width:16px!important;
    min-width:16px!important;
    height:16px!important;
    min-height:16px!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    color:var(--relay-file-accent)!important;
    font-size:0!important;
    line-height:0!important;
    vertical-align:-.18em!important;
    transform:none!important
  }
  body .file-type-icon .ui-symbol,body .file-type-icon .ui-symbol svg{
    display:block!important;
    width:16px!important;
    min-width:16px!important;
    height:16px!important;
    margin:0!important;
    color:inherit!important;
    transform:none!important
  }
  body .file-type-badge{
    display:grid!important;
    place-items:center!important;
    width:18px!important;
    height:18px!important;
    padding:0!important;
    border:1px solid color-mix(in srgb,currentColor 38%,transparent)!important;
    border-radius:5px!important;
    background:color-mix(in srgb,currentColor 11%,#1b1e20)!important;
    color:inherit!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.045)!important;
    font:750 6.5px/1 var(--vscode-editor-font-family,monospace)!important;
    letter-spacing:-.045em!important;
    text-rendering:geometricPrecision
  }
  body .file-type-icon.fileTs,body .file-type-icon.fileTsx{color:#5cb3f2!important}
  body .file-type-icon.fileJs,body .file-type-icon.fileJsx{color:#e8c84f!important}
  body .file-type-icon.fileCss{color:#5aa7e8!important}
  body .file-type-icon.fileHtml{color:#ed764b!important}
  body .file-type-icon.fileMd,body .file-type-icon.fileText,body .file-type-icon.fileTxt{color:#75b8e8!important}
  body .file-type-icon.fileJson,body .file-type-icon.fileCode,body .file-type-icon.fileIni{color:#c8b966!important}
  body .file-type-icon.filePy{color:#e1b74d!important}
  body .file-type-icon.fileRs{color:#df805f!important}
  body .file-type-icon.fileVue{color:#54bf8a!important}
  body .file-type-icon.fileC,body .file-type-icon.fileCpp,body .file-type-icon.fileCSharp{color:#8d92e8!important}
  body .file-type-icon.fileSql,body .file-type-icon.fileCsv{color:#65c0b6!important}
  body .file-type-icon.filePng,body .file-type-icon.fileJpg,body .file-type-icon.fileSvg,body .file-type-icon.fileImage{color:#b488df!important}
  body .file-type-icon.fileVideo,body .file-type-icon.fileAudio{color:#dc83c4!important}
  body .file-type-icon.filePdf{color:#e66f71!important}
  body .file-type-icon.fileDoc{color:#629ce5!important}
  body .file-type-icon.fileXls{color:#5bb77c!important}
  body .file-type-icon.filePpt{color:#dd825b!important}
  body .file-type-icon.fileZip{color:#b8a76a!important}
  body .file-link{
    display:inline-flex!important;
    align-items:center!important;
    gap:5px!important;
    max-width:100%!important;
    color:var(--relay-file-accent)!important;
    line-height:1.55!important;
    vertical-align:-.18em!important
  }
  body .file-link:hover{color:color-mix(in srgb,var(--relay-file-accent) 78%,white)!important}
  body .change-file,body .change-summary-file{align-items:center!important}
  body .change-row .file-type-icon,body .change-summary-file .file-type-icon,body .review-file-icon .file-type-icon{justify-self:center!important;align-self:center!important}
  body .change-summary-icon{color:var(--relay-file-accent)!important}
  .header-action.connect-action.online{color:#73d7c0!important}
  .header-action.connect-action.online::before{content:"";position:absolute;right:4px;bottom:4px;width:4px;height:4px;border:1px solid #202326;border-radius:50%;background:#65d5bb}
  #connectionProviderMark{padding:7px!important}
  #connectionProviderMark .brand-symbol,#connectionProviderMark .brand-symbol svg,#connectionProviderMark .brand-symbol img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}

  @media(max-width:520px){
    .route-header{grid-template-columns:minmax(0,1fr) max-content!important;padding-inline:8px!important;gap:6px!important}
    .route-meta{max-width:none!important;padding-inline:9px!important}
    .header-action,.header-action.icon-only{flex:0 0 31px!important;width:31px!important;min-width:31px!important;padding:0!important}
    .header-action-label{display:none!important}
    .header-action:hover::after,.header-action:focus-visible::after{display:block}
  }
  @media(max-width:350px){
    .route-header{padding-inline:6px!important;gap:4px!important}
    .route-meta{height:34px!important;padding-inline:7px!important;gap:7px!important}
    .connection-copy small{display:none!important}
    .header-actions{gap:0!important}
    .header-action,.header-action.icon-only{flex-basis:29px!important;width:29px!important;min-width:29px!important;height:30px!important}
  }
  `;

  const responsiveHeaderAndFileIconsV3Styles = String.raw`
  :root{--relay-file-accent:var(--vscode-textLink-foreground,#4daafc)}
  .route-header{
    position:relative!important;
    z-index:52!important;
    display:grid!important;
    grid-template-columns:minmax(150px,240px) minmax(0,1fr)!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    height:50px!important;
    padding:6px 10px!important;
    gap:10px!important;
    overflow:visible!important;
    border-bottom:1px solid color-mix(in srgb,var(--vscode-panel-border,#30343a) 86%,transparent)!important;
    background:color-mix(in srgb,var(--vscode-sideBar-background,#181a1c) 92%,var(--vscode-editor-background,#151719))!important
  }
  .route-meta{
    display:grid!important;
    grid-template-columns:8px minmax(0,1fr)!important;
    align-items:center!important;
    width:100%!important;
    min-width:0!important;
    max-width:240px!important;
    height:34px!important;
    padding:0 9px!important;
    gap:8px!important;
    overflow:hidden!important;
    border:1px solid #34393e!important;
    border-radius:9px!important;
    background:#202326!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important
  }
  .route-meta .dot{width:7px!important;height:7px!important;margin:0!important;box-shadow:0 0 0 3px rgba(98,215,189,.08)!important}
  .connection-copy{display:grid!important;min-width:0!important;gap:0!important;overflow:hidden!important}
  .connection-copy strong,.connection-copy small{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  .connection-copy strong{color:#e3e7ea!important;font-size:10.5px!important;line-height:1.3!important}
  .connection-copy small{color:#747c83!important;font-size:8px!important;line-height:1.25!important}
  .header-actions{
    display:flex!important;
    align-items:center!important;
    justify-content:flex-end!important;
    min-width:0!important;
    height:34px!important;
    padding:0!important;
    gap:2px!important;
    overflow:visible!important;
    border:0!important;
    background:transparent!important
  }
  .header-action,.header-action.icon-only{
    position:relative!important;
    display:inline-flex!important;
    visibility:visible!important;
    opacity:1!important;
    flex:0 0 auto!important;
    align-items:center!important;
    justify-content:center!important;
    min-width:30px!important;
    width:auto!important;
    height:30px!important;
    padding:0 7px!important;
    gap:5px!important;
    overflow:visible!important;
    border:1px solid transparent!important;
    border-radius:7px!important;
    background:transparent!important;
    color:#9ca4ab!important
  }
  .header-action.icon-only,#settings{display:inline-flex!important;width:30px!important;min-width:30px!important;padding:0!important;flex:0 0 30px!important}
  .header-action:hover,.header-action:focus-visible,.header-action[aria-expanded="true"]{border-color:#3a4045!important;background:#262a2d!important;color:#f0f3f5!important;outline:none!important}
  .header-action.connect-action{color:#72d5be!important}
  .header-action>span:first-child,.header-action .ui-symbol,.header-action .ui-symbol svg{display:grid!important;place-items:center!important;width:15px!important;height:15px!important;min-width:15px!important;flex:none!important;margin:0!important}
  .header-action-label{display:block;max-width:82px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .header-action::after{
    content:attr(data-tooltip);
    position:absolute;
    top:calc(100% + 6px);
    left:50%;
    z-index:150;
    display:none;
    width:max-content;
    max-width:190px;
    padding:5px 7px;
    transform:translateX(-50%);
    border:1px solid #454b50;
    border-radius:6px;
    background:#25282b;
    color:#e7eaec;
    box-shadow:0 8px 22px rgba(0,0,0,.42);
    font-size:9px;
    font-weight:500;
    line-height:1.3;
    pointer-events:none;
    white-space:nowrap
  }
  .header-action:last-child::after{right:0;left:auto;transform:none}
  .header-action.icon-only:hover::after,.header-action.icon-only:focus-visible::after{display:block}
  .console{height:calc(100vh - 50px)!important}.config-panel{top:55px!important;max-height:calc(100vh - 64px)!important}

  body .file-type-icon,body .file-type-icon[class]{
    position:static!important;
    display:inline-grid!important;
    place-items:center!important;
    align-self:center!important;
    justify-self:center!important;
    flex:0 0 18px!important;
    width:18px!important;
    min-width:18px!important;
    height:18px!important;
    min-height:18px!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    color:var(--relay-file-accent)!important;
    font-size:0!important;
    line-height:0!important;
    vertical-align:middle!important;
    transform:none!important
  }
  body .file-type-icon .ui-symbol,body .file-type-icon .ui-symbol svg{
    display:block!important;
    width:16px!important;
    min-width:16px!important;
    height:16px!important;
    margin:0!important;
    color:inherit!important;
    fill:currentColor!important;
    transform:none!important
  }
  body .file-type-icon.fileTs,body .file-type-icon.fileTsx{color:#5cb3f2!important}
  body .file-type-icon.fileJs,body .file-type-icon.fileJsx{color:#e8c84f!important}
  body .file-type-icon.fileCss{color:#5aa7e8!important}
  body .file-type-icon.fileHtml{color:#ed764b!important}
  body .file-type-icon.fileMd,body .file-type-icon.fileText,body .file-type-icon.fileTxt{color:#75b8e8!important}
  body .file-type-icon.fileCode,body .file-type-icon.fileIni{color:#c8b966!important}
  body .file-type-icon.filePy{color:#e1b74d!important}
  body .file-type-icon.fileRs{color:#df805f!important}
  body .file-type-icon.fileVue{color:#54bf8a!important}
  body .file-type-icon.fileC,body .file-type-icon.fileCpp,body .file-type-icon.fileCSharp{color:#9b9fe8!important}
  body .file-type-icon.fileSql,body .file-type-icon.fileCsv{color:#65c0b6!important}
  body .file-type-icon.filePng,body .file-type-icon.fileJpg,body .file-type-icon.fileSvg,body .file-type-icon.fileImage{color:#b488df!important}
  body .file-type-icon.fileVideo,body .file-type-icon.fileAudio{color:#dc83c4!important}
  body .file-type-icon.filePdf{color:#e66f71!important}
  body .file-type-icon.fileDoc{color:#629ce5!important}
  body .file-type-icon.fileXls{color:#5bb77c!important}
  body .file-type-icon.filePpt{color:#dd825b!important}
  body .file-type-icon.fileZip{color:#b8a76a!important}
  body .file-link{
    display:inline-flex!important;
    align-items:center!important;
    gap:5px!important;
    max-width:100%!important;
    padding:0!important;
    color:var(--relay-file-accent)!important;
    line-height:1.45!important;
    vertical-align:middle!important
  }
  body .file-link:hover{color:color-mix(in srgb,var(--relay-file-accent) 76%,white)!important;text-decoration:underline}
  body .change-file{display:grid!important;grid-template-columns:24px minmax(0,1fr)!important;align-items:center!important;gap:8px!important;min-width:0!important}
  body .change-summary-file{grid-template-columns:24px minmax(0,1fr) auto!important;align-items:center!important;column-gap:8px!important}
  body .change-file .file-type-icon,body .change-summary-file .file-type-icon{
    width:24px!important;
    min-width:24px!important;
    height:24px!important;
    min-height:24px!important;
    border-radius:6px!important;
    transition:background-color .14s ease,color .14s ease,filter .14s ease!important
  }
  body .change-file .file-type-icon>.ui-symbol,body .change-summary-file .file-type-icon>.ui-symbol,
  body .change-file .file-type-icon>.ui-symbol svg,body .change-summary-file .file-type-icon>.ui-symbol svg{
    width:20px!important;
    min-width:20px!important;
    height:20px!important;
    stroke-width:1.65!important;
    filter:drop-shadow(0 1px 4px color-mix(in srgb,currentColor 24%,transparent))!important
  }
  body .change-row:hover .file-type-icon,body .change-summary-file:hover .file-type-icon{background:color-mix(in srgb,currentColor 10%,transparent)!important;filter:saturate(1.12) brightness(1.08)}
  body .review-file-icon{display:grid!important;place-items:center!important}
  body .change-summary-icon{color:var(--relay-file-accent)!important}

  @media(max-width:620px){
    .route-header{grid-template-columns:minmax(0,1fr) max-content!important;padding-inline:8px!important;gap:6px!important}
    .route-meta{max-width:none!important}
    .header-action,.header-action.icon-only{flex:0 0 30px!important;width:30px!important;min-width:30px!important;padding:0!important}
    .header-action-label{display:none!important}
    .header-action:hover::after,.header-action:focus-visible::after{display:block}
  }
  @media(max-width:350px){
    .route-header{padding-inline:6px!important;gap:4px!important}
    .route-meta{height:32px!important;padding-inline:7px!important;gap:7px!important}
    .connection-copy small{display:none!important}
    .header-actions{gap:0!important}
    .header-action,.header-action.icon-only,#settings{flex-basis:28px!important;width:28px!important;min-width:28px!important;height:28px!important}
  }
  `;

const mcpConnectionStatusStyles = String.raw`
.mcp-connection-notice{display:flex;align-items:center;gap:8px;margin:0 0 11px;padding:9px 10px;border:1px solid #45494e;border-radius:9px;background:#292c2f;color:#cfd3d6;font-size:10px;line-height:1.4}
.mcp-connection-notice::before{content:"";width:7px;height:7px;flex:none;border-radius:50%;background:#92979d}
.mcp-connection-notice.success{border-color:rgba(104,215,189,.36);background:rgba(104,215,189,.08);color:#bcecdf}
.mcp-connection-notice.success::before{background:#68d7bd;box-shadow:0 0 0 3px rgba(104,215,189,.1)}
.mcp-connection-notice.warning{border-color:rgba(214,181,44,.36);background:rgba(214,181,44,.07);color:#e3d390}
.mcp-connection-notice.warning::before{background:#d6b52c}
.mcp-connection-notice.danger{border-color:rgba(240,140,140,.4);background:rgba(240,140,140,.08);color:#f1aaaa}
.mcp-connection-notice.danger::before{background:#f08c8c}
`;

const composerRunningAndSpacingStyles = String.raw`
.composer-actions .model-picker{margin-right:7px!important}
.composer-actions .send{margin-left:0!important}
.composer-actions .send.running{opacity:1!important;background:#f0f2f1!important;color:#171a19!important;box-shadow:0 0 0 1px rgba(255,255,255,.08)!important}
.composer-actions .send.running::before{display:block!important;content:""!important;position:absolute!important;left:50%!important;top:50%!important;width:9px!important;height:9px!important;border:0!important;border-radius:2px!important;background:currentColor!important;transform:translate(-50%,-50%)!important}
.composer-actions .send.running::after{display:none!important;content:none!important}
@media(max-width:390px){
  .composer-actions{gap:3px!important}
  .composer-actions .model-picker{flex:1 1 76px!important;max-width:122px!important;margin-left:auto!important;margin-right:7px!important}
  .composer-actions .model-trigger{width:100%!important;max-width:100%!important;padding-inline:5px!important}
  .composer-actions #modelLabel{max-width:76px!important}
  .composer-actions .perm-trigger{max-width:66px!important;padding-inline:4px!important}
}
@media(max-width:350px){
  .composer-actions .perm-wrap{display:none!important}
  .composer-actions .model-picker{max-width:128px!important}
  .composer-actions #modelLabel{max-width:82px!important}
}
`;

const historyClearStyles = String.raw`
.history-heading-actions{display:flex;align-items:center;gap:4px}
.history-heading .history-clear-all{width:auto;height:25px;padding:0 8px;color:#d99a9f;font-size:10px}
.history-heading .history-clear-all:hover{background:#3a3031;color:#ffb1b6}
`;

const permissionAndRunningIndicatorStyles = String.raw`
.console{position:relative}
.permission-card-v2{position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:16px!important;row-gap:2px!important;margin:8px 0 16px!important;padding:11px 12px!important;border:1px solid #3d4044!important;border-radius:18px!important;background:#26282b!important;box-shadow:0 7px 20px rgba(0,0,0,.12)!important;color:#e4e5e7}
.permission-card-v2>header{display:flex;grid-column:1;grid-row:1;align-items:center;gap:9px;min-width:0;color:#979ca2}
.permission-card-v2 .permission-icon{display:grid;place-items:center;width:26px;height:26px;flex:none;border:1px solid #44484d;border-radius:50%;background:#2d3033;color:#b9bdc2}
.permission-card-v2 .permission-icon .ui-symbol,.permission-card-v2 .permission-icon svg{display:block;width:14px;height:14px}
.permission-card-v2 .permission-text{display:grid;align-content:center;gap:2px;min-width:0}
.permission-card-v2 .permission-title{overflow:hidden;color:#aeb2b7;font-size:10px;font-weight:620;text-overflow:ellipsis;white-space:nowrap}
.permission-card-v2 .permission-copy{min-width:0;margin:0;padding:0;color:#f0f1f2;font-size:12.5px;line-height:1.42;font-weight:650;overflow-wrap:anywhere}
.permission-card-v2 .permission-command{grid-column:1/-1;grid-row:2;max-height:130px;margin:7px 0 0;padding:8px 10px;border:1px solid #36393d;border-radius:8px;background:#202225;color:#b9bdc2;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:10.5px/1.55 var(--vscode-editor-font-family)}
.permission-card-v2 .permission-actions{display:flex;grid-column:2;grid-row:1;align-self:center;align-items:center;justify-content:flex-end;gap:7px;min-height:32px;margin:0}
.permission-card-v2 button{min-height:32px;border:1px solid #474b50;border-radius:999px;background:transparent;color:#cdd0d4;padding:5px 12px;font-size:10.5px;font-weight:620;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.permission-card-v2 button:hover{border-color:#5b6066;background:#303337;color:#fff}
.permission-card-v2 .permission-deny{margin:0}
.permission-card-v2 .permission-allow-wrap{position:relative;display:flex!important;gap:0!important;align-items:stretch}
.permission-card-v2 .permission-allow-once{border-color:#e4e6e8;border-radius:999px 0 0 999px;background:#e4e6e8;color:#202225}
.permission-card-v2 .permission-allow-wrap>.permission-allow-once:only-child{border-radius:999px}
.permission-card-v2 .permission-allow-once:hover,.permission-card-v2 .permission-menu-trigger:hover{border-color:#fff;background:#fff;color:#151719}
.permission-card-v2 .permission-menu-trigger{display:grid;place-items:center;width:30px;padding:0;border-color:#d0d3d6;border-left-color:#b9bdc1;border-radius:0 999px 999px 0;background:#d9dcdf;color:#34373a}
.permission-card-v2 .permission-menu-trigger .ui-symbol,.permission-card-v2 .permission-menu-trigger svg{width:14px;height:14px}
.permission-card-v2 .permission-menu{position:absolute;z-index:76;right:0;bottom:calc(100% + 7px);display:grid!important;gap:2px!important;width:220px;padding:6px;border:1px solid #484b50;border-radius:13px;background:#292a2d;box-shadow:0 18px 48px rgba(0,0,0,.58)}
.permission-card-v2 .permission-menu.hidden{display:none!important}
.permission-card-v2 .permission-menu button{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:38px;border:0;border-radius:8px;padding:7px 9px;text-align:left}
.permission-card-v2 .permission-menu button:hover{background:#37393c}
.permission-card-v2 .permission-menu .ui-symbol,.permission-card-v2 .permission-menu svg{width:15px;height:15px;color:#9da1a6}
.console>.running-scroll-indicator{position:absolute;z-index:69;left:50%;bottom:132px;display:flex;align-items:center;justify-content:center;width:42px;height:40px;padding:0;border:1px solid #494c50;border-radius:999px;background:#303236;color:#d8dade;box-shadow:0 9px 26px rgba(0,0,0,.44);transform:translateX(-50%);cursor:pointer}
.running-scroll-indicator:hover{background:#393b3f;border-color:#5b5e63}
.running-scroll-dots{display:none;align-items:center;justify-content:center;gap:3px}.running-scroll-indicator.is-running .running-scroll-dots{display:flex}.running-scroll-dots>i{width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.34;animation:runningDot 1.15s ease-in-out infinite}.running-scroll-dots>i:nth-child(2){animation-delay:.14s}.running-scroll-dots>i:nth-child(3){animation-delay:.28s}
.running-scroll-arrow{display:block;width:20px;height:20px}.running-scroll-arrow path{stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.running-scroll-indicator.is-running .running-scroll-arrow{display:none}
@keyframes runningDot{0%,58%,100%{opacity:.28;transform:translateY(0)}28%{opacity:1;transform:translateY(-2px)}}
body .message.assistant .body .file-link{position:relative!important;top:0!important;display:inline-flex!important;align-items:center!important;gap:5px!important;max-width:min(100%,260px)!important;margin:0 .2em!important;padding:2px 7px!important;border:1px solid rgba(88,174,232,.3)!important;border-radius:6px!important;background:rgba(88,174,232,.08)!important;color:#69b8ee!important;font:650 12px/1.35 var(--vscode-font-family)!important;white-space:nowrap!important;text-decoration:none!important;vertical-align:middle!important}
body .message.assistant .body .file-link:hover{border-color:rgba(105,184,238,.58)!important;background:rgba(88,174,232,.15)!important;color:#9bd5fb!important;text-decoration:none!important}
body .message.assistant .body .file-link>span:not(.file-type-icon):not(.file-line){display:inline-block!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:inherit!important}
body .message.assistant .body .file-link .file-type-icon{align-self:center!important;vertical-align:middle!important;transform:none!important}
@media(max-width:420px){.permission-card-v2{grid-template-columns:1fr;padding:11px!important}.permission-card-v2 .permission-actions{grid-column:1;grid-row:2;justify-content:flex-end;margin-top:8px}.permission-card-v2 .permission-command{grid-row:2}.permission-card-v2:has(.permission-command) .permission-actions{grid-row:3}.permission-card-v2 button{padding-inline:10px}.permission-card-v2 .permission-menu{width:min(220px,calc(100vw - 48px))}}
@media(prefers-reduced-motion:reduce){.running-scroll-dots>i{animation:none!important;opacity:.75}.running-scroll-dots>i:nth-child(2){opacity:.5}.running-scroll-dots>i:nth-child(3){opacity:.3}}
`;

const permissionPickerV2Styles = String.raw`
.composer-actions .perm-wrap{position:relative;flex:none}
.composer-actions .perm-trigger{display:flex!important;align-items:center!important;gap:7px!important;height:34px!important;max-width:132px!important;padding:0 9px!important;border:1px solid transparent!important;border-radius:9px!important;background:transparent!important;color:#d6d8db!important;font-size:11.5px!important;font-weight:650!important;letter-spacing:-.01em;overflow:visible!important}
.composer-actions .perm-trigger:hover,.perm-wrap.open .perm-trigger{background:#303236!important;color:#f1f2f3!important}
.composer-actions .perm-trigger[data-mode="full"],.composer-actions .perm-trigger[data-mode="full"]:hover,.perm-wrap.open .perm-trigger[data-mode="full"]{color:#e3c95b!important}
.perm-trigger-icon{display:grid;place-items:center;width:16px;height:16px;flex:none}
.perm-trigger-icon svg{display:none;width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.perm-trigger[data-mode="ask"] .perm-icon-ask,.perm-trigger[data-mode="edit"] .perm-icon-edit,.perm-trigger[data-mode="full"] .perm-icon-full{display:block}
.perm-trigger #permLabel{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.perm-arrow{width:6px;height:6px;flex:none;margin-left:1px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);opacity:.75;transition:transform .16s ease}
.perm-wrap.open .perm-arrow{transform:rotate(225deg) translate(-2px,-2px)}
.perm-menu{position:absolute!important;z-index:90!important;bottom:calc(100% + 8px)!important;left:-5px!important;display:grid!important;gap:3px!important;width:300px!important;min-width:0!important;padding:6px!important;border:1px solid #484b50!important;border-radius:14px!important;background:#292b2e!important;box-shadow:0 20px 54px rgba(0,0,0,.62)!important;overflow:hidden!important}
.perm-menu.hidden{display:none!important}
.perm-opt{display:grid!important;grid-template-columns:27px minmax(0,1fr) 18px!important;align-items:center!important;gap:9px!important;min-height:55px!important;width:100%!important;margin:0!important;border:0!important;border-radius:10px!important;background:transparent!important;color:#dfe1e3!important;padding:8px 9px!important;text-align:left!important;font-size:12px!important}
.perm-opt:hover,.perm-opt.active:not(.perm-opt-full){background:#383a3e!important;color:#f4f5f6!important}
.perm-choice-icon{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:#35373b;color:#b8bdc2}
.perm-choice-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.perm-choice-copy{display:grid;gap:2px;min-width:0}
.perm-choice-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.2;font-weight:670}
.perm-choice-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#959aa0;font-size:9.5px;line-height:1.25}
.perm-check{visibility:hidden!important;display:grid!important;place-items:center;width:18px;height:18px;color:#f0f1f2!important;font-size:14px!important;font-weight:750!important}
.perm-opt.active .perm-check{visibility:visible!important}
.perm-opt-full{color:#e3c95b!important}
.perm-opt-full .perm-choice-icon{background:rgba(216,183,58,.15);color:#e3c95b}
.perm-opt-full .perm-choice-copy small{color:#c7b15a}
.perm-opt-full:hover,.perm-opt-full.active{background:rgba(216,183,58,.13)!important;color:#f0d86e!important}
.perm-opt-full.active .perm-check{color:#e3c95b!important}
.perm-opt:focus-visible,.perm-trigger:focus-visible{outline:2px solid #e3c95b!important;outline-offset:2px}
.composer-actions .mode-trigger:after,.composer-actions .perm-arrow{display:none!important}
.composer-actions .model-picker{flex:0 1 auto!important;width:auto!important;max-width:118px!important;margin-left:auto!important;margin-right:4px!important}
.composer-actions .model-trigger{justify-content:flex-start!important;width:auto!important;max-width:118px!important;padding-inline:5px!important;gap:4px!important}
.composer-actions #modelLabel{max-width:82px!important}
.composer-actions .model-trigger:after{flex:none!important;margin-left:1px!important}
.perm-menu{left:0!important;right:auto!important;transform:translateX(var(--perm-menu-shift,0px))!important}
@media(max-width:420px){
  .composer-actions{gap:2px!important}
  .composer-actions .mode-trigger{flex:none!important;padding-inline:6px!important}
  .composer-actions .perm-wrap{display:block!important;flex:none!important}
  .composer-actions .perm-trigger{max-width:106px!important;padding-inline:6px!important;gap:5px!important}
  .composer-actions .model-picker{flex:0 1 auto!important;width:auto!important;max-width:106px!important;min-width:42px!important;margin-left:auto!important;margin-right:2px!important}
  .composer-actions .model-trigger{width:auto!important;max-width:106px!important;min-width:0!important;padding-inline:4px!important;gap:4px!important}
  .composer-actions #modelLabel{max-width:72px!important}
  .composer-actions .model-trigger:after{margin-left:0!important}
  .perm-menu{left:0!important;right:auto!important;width:min(300px,calc(100vw - 22px))!important}
}
@media(max-width:330px){
  .composer-actions .perm-wrap{display:block!important}
  .composer-actions .perm-trigger{max-width:96px!important;padding-inline:5px!important;font-size:10.5px!important}
  .composer-actions .model-picker{max-width:84px!important;min-width:38px!important}
  .composer-actions .model-trigger{max-width:84px!important}
  .composer-actions #modelLabel{max-width:54px!important}
  .perm-choice-copy small{display:none}.perm-opt{min-height:47px!important}
}
`;

const connectionBadgeV4Styles = String.raw`
.route-header{grid-template-columns:max-content minmax(0,1fr)!important}
#connectionBadge.route-meta{display:inline-flex!important;grid-template-columns:none!important;flex:0 1 auto!important;width:fit-content!important;min-width:0!important;max-width:min(184px,calc(100vw - 154px))!important;height:32px!important;padding:0 10px!important;gap:6px!important;border-color:#353a3f!important;border-radius:9px!important;background:#202326!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}
#connectionBadge .connection-brand{display:inline-grid!important;place-items:center!important;flex:none!important;width:15px!important;height:15px!important}
#connectionBadge .connection-brand .brand-symbol,#connectionBadge .connection-brand svg,#connectionBadge .connection-brand img{width:15px!important;height:15px!important}
#connectionBadge .connection-copy{display:block!important;min-width:0!important;overflow:hidden!important}
#connectionBadge .connection-copy small{display:none!important}
#connectionBadge .connection-copy strong{display:block!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#dfe4e7!important;font-size:10.5px!important;font-weight:650!important;line-height:1!important}
#connectionBadge .dot{width:7px!important;height:7px!important;margin:0!important;background:#7b838a!important;box-shadow:none!important}
#connectionBadge[data-state="ready"] .dot,#connectionBadge[data-state="running"] .dot{background:#61d1bb!important;box-shadow:0 0 0 3px rgba(97,209,187,.09)!important}
#connectionBadge[data-state="setup"] .dot,#connectionBadge[data-state="recovering"] .dot{background:#d7b75f!important;box-shadow:0 0 0 3px rgba(215,183,95,.08)!important}
#connectionBadge[data-state="offline"] .dot{background:#bd7474!important;box-shadow:0 0 0 3px rgba(189,116,116,.08)!important}
#connectionBadge:hover{border-color:#474e54!important;background:#24282b!important}
#connectionBadge[role="button"]{cursor:pointer!important}#connectionBadge[role="button"]:focus-visible{outline:1px solid #7d858c!important;outline-offset:2px!important}
.message.assistant .body p{text-wrap:pretty}
.rich-link-group{display:inline-flex;align-items:center;max-width:100%;white-space:nowrap;vertical-align:-2px}.rich-link-group .rich-link{min-width:0}
@media(max-width:350px){#connectionBadge.route-meta{max-width:112px!important;padding-inline:8px!important}}
`;

const markdownTableStyles = String.raw`
.message.assistant .body strong{font-weight:650}
.message.assistant .body blockquote{padding:2px 0 2px 12px!important;background:transparent!important}
.message.assistant .markdown-table-wrap{max-width:100%;margin:12px 0 15px;overflow-x:auto;border:1px solid #3a3d42;border-radius:10px;background:#191b1d}
.message.assistant .markdown-table{width:100%;min-width:360px;border-collapse:collapse;font-size:12px;line-height:1.5}
.message.assistant .markdown-table th,.message.assistant .markdown-table td{padding:9px 11px;border-right:1px solid #34373b;border-bottom:1px solid #34373b;vertical-align:top;overflow-wrap:anywhere}
.message.assistant .markdown-table th{background:#24272a;color:#f1f2f3;font-weight:700}
.message.assistant .markdown-table td{color:#d5d7da}
.message.assistant .markdown-table tr:last-child td{border-bottom:0}
.message.assistant .markdown-table th:last-child,.message.assistant .markdown-table td:last-child{border-right:0}
.message.assistant .markdown-table .align-left{text-align:left}.message.assistant .markdown-table .align-center{text-align:center}.message.assistant .markdown-table .align-right{text-align:right}
`;

export const CHAT_VIEW_STYLES = styles + redesignStyles + interactionStyles + finalStyles + bubbleStyles + polishStyles + changeStyles + historyStyles + compactStyles + providerStyles + advancedStyles + dropdownFixStyles + mcpGalleryStyles + chatExperienceStyles + codexParityStyles + compactModeAndConnectionStyles + connectionEntryStyles + connectionCenterStyles + connectionPageV2Styles + modelHealthIconFixStyles + editableMessageStyles + errorAndMotionPolishStyles + recoveryAndRetryStyles + brandIdentityStyles + codexWorkflowStyles + codexComposerStyles + composerMenuV2Styles + codexTranscriptV2Styles + codexTranscriptV3Styles + narrowLayoutAndProfileFixStyles + unifiedDialogStyles + linkPresentationStyles + headerRedesignStyles + settingsAndSpacingPolishStyles + changeReviewV2Styles + boundedChangeTrayStyles + compactScrollbarStyles + ideNativeHeaderAndFileStyles + responsiveHeaderAndFileIconsV2Styles + responsiveHeaderAndFileIconsV3Styles + mcpConnectionStatusStyles + composerRunningAndSpacingStyles + historyClearStyles + permissionAndRunningIndicatorStyles + permissionPickerV2Styles + connectionBadgeV4Styles + markdownTableStyles;
