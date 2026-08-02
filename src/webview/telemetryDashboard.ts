import type * as vscode from 'vscode';
import type { QuotaAccount, QuotaItem, QuotaSnapshot } from '../nineRouterQuota';
import type { ProviderProfile, TelemetryRecord } from '../providerProfiles';
import { brandKeyFor, brandMarkup } from '../brandIcons';
import { UI_ICONS, type UiIconName } from '../uiIcons';

interface ModelStats {
  profile: string;
  provider: string;
  model: string;
  calls: number;
  tokens: number;
  latency: number;
  latest: number;
}

export function renderTelemetryDashboard(
  webview: vscode.Webview,
  records: TelemetryRecord[],
  quota: QuotaSnapshot,
  nonce: string,
  activeProfile?: ProviderProfile,
  language: 'vi' | 'en' = 'vi'
): string {
  const visibleRecords = activeProfile ? records.filter((record) => record.profileId === activeProfile.id) : records;
  const displayedQuota = activeProfile && activeProfile.kind !== '9router'
    ? quotaFromTelemetry(activeProfile, visibleRecords)
    : quota;
  const accountCount = displayedQuota.accounts.length;
  const quotaCount = displayedQuota.accounts.reduce((sum, account) => sum + account.quotas.length, 0);
  const availableCount = displayedQuota.accounts.reduce((sum, account) => sum + account.quotas.filter((item) => item.unlimited || (item.remainingPercentage !== undefined && item.remainingPercentage > 15)).length, 0);
  const lowCount = displayedQuota.accounts.reduce((sum, account) => sum + account.quotas.filter((item) => item.remainingPercentage !== undefined && item.remainingPercentage <= 15).length, 0);
  const providers = [...new Set(displayedQuota.accounts.map((account) => account.provider))].sort();
  const models = [...new Map(displayedQuota.accounts.flatMap((account) => account.quotas).map((item) => [item.id, item.name])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1]));
  const providerOptions = providers.map((provider) => [provider, providerName(provider)] as const);
  const accountOptions = displayedQuota.accounts.map((account) => [account.id, account.name] as const);
  const modelOptions = models.map(([id, name]) => [id, name] as const);
  const providerLabel = activeProfile ? providerName(activeProfile.kind) : /20128|9router/i.test(quota.origin) ? '9Router' : 'Provider';
  const providerKey = brandKeyFor(activeProfile?.kind ?? providerLabel);
  const isNineRouter = activeProfile?.kind === '9router' || providerLabel === '9Router';
  const providerDescription = language === 'en'
    ? (isNineRouter
      ? 'Account quotas from 9Router and recent RelayCode activity.'
      : `Rate limits, tokens and response speed for ${providerLabel}.`)
    : (isNineRouter
      ? 'Hạn mức tài khoản từ 9Router và hoạt động gần đây của RelayCode.'
      : `Rate limit, token và tốc độ phản hồi của ${providerLabel}.`);
  const modelStats = aggregate(visibleRecords);
  const requestRows = modelStats.map(requestRow).join('');
  const quotaBadge = `${quotaCount} ${language === 'en' ? 'limits' : 'hạn mức'}`;
  const modelBadge = `${modelStats.length} ${language === 'en' ? 'models' : 'model'}`;
  const openProviderAction = activeProfile?.kind === '9router'
    ? `<button class="button secondary" id="openProvider">${utilityIcon('external')}Mở 9Router</button>`
    : '';

  const document = `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
:root{color-scheme:dark;--canvas:#141617;--surface:#1b1d1f;--surface2:#202326;--line:#303438;--lineStrong:#41464b;--text:#f3f5f6;--muted:#92989e;--quiet:#6f757b;--accent:#62d7bd;--danger:#ed7f84;--warning:#deb95b}
*{box-sizing:border-box}html{background:var(--canvas)}body{margin:0;background:var(--canvas);color:var(--text);font:13px/1.5 var(--vscode-font-family,Segoe UI,sans-serif)}button,select{font:inherit;color:inherit}
.app{width:min(1240px,100%);margin:auto;padding:28px 32px 54px}.masthead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:30px;align-items:end;padding:14px 0 26px;border-bottom:1px solid var(--line)}.identity{display:grid;grid-template-columns:46px minmax(0,1fr);gap:14px;align-items:center}.hero-brand{width:46px;height:46px;padding:9px;border:1px solid var(--lineStrong);border-radius:12px;background:var(--surface)}.brand-symbol{display:grid;place-items:center;width:100%;height:100%;color:#f4f5f6}.brand-symbol svg,.brand-symbol img{display:block;width:100%;height:100%;object-fit:contain}.kicker{display:block;margin-bottom:4px;color:var(--accent);font-size:9px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}.masthead h1{margin:0;font-size:29px;line-height:1.04;letter-spacing:-.04em}.masthead p{max-width:620px;margin:7px 0 0;color:var(--muted);font-size:12px}.actions{display:flex;gap:8px}.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:35px;padding:0 13px;border:1px solid var(--lineStrong);border-radius:8px;background:var(--surface2);cursor:pointer;transition:background .14s,border-color .14s,transform .14s}.button:hover{border-color:#596067;background:#282b2e}.button:active{transform:translateY(1px)}.button.primary{border-color:rgba(98,215,189,.5);background:var(--accent);color:#10211d;font-weight:720}.button.primary:hover{background:#79e3ca}.button svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.snapshot{display:grid;grid-template-columns:1.15fr repeat(3,1fr);margin:20px 0 0;border:1px solid var(--line);background:var(--surface)}.metric{min-width:0;padding:17px 18px;border-left:1px solid var(--line)}.metric:first-child{border-left:0}.metric span{display:block;color:var(--muted);font-size:9px;letter-spacing:.04em;text-transform:uppercase}.metric strong{display:block;margin-top:5px;font:720 24px/1 var(--vscode-editor-font-family,monospace);letter-spacing:-.04em}.metric.primary strong{color:var(--accent)}.metric.warning strong{color:var(--warning)}
.notice{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:12px;align-items:center;margin-top:12px;padding:12px 14px;border:1px solid var(--line);background:var(--surface)}.notice.error{border-color:rgba(237,127,132,.4)}.notice-icon{display:grid;place-items:center;width:32px;height:32px;color:var(--muted)}.notice.error .notice-icon{color:var(--danger)}.notice-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7}.notice-copy strong,.notice-copy span{display:block}.notice-copy strong{font-size:11px}.notice-copy span{margin-top:2px;color:var(--muted);font-size:10px}
.filters{display:grid;grid-template-columns:1fr 1fr 1.25fr .9fr;gap:8px;margin:18px 0 25px}.field{width:100%;height:36px;padding:0 10px;border:1px solid var(--line);border-radius:7px;outline:0;background:var(--surface);color:#dadddf}.field:focus{border-color:#5a6268}.field option{background:#1d1f21}
.section-head{display:flex;align-items:end;gap:14px;margin:0 0 10px}.section-head h2{margin:0;flex:1;font-size:12px;letter-spacing:.01em}.section-head span{color:var(--quiet);font-size:9px}.accounts{display:grid;gap:12px}.account{border:1px solid var(--line);background:var(--surface)}.account[hidden]{display:none}.account-head{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;gap:11px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)}.account-brand{width:34px;height:34px;padding:6px;border:1px solid var(--lineStrong);border-radius:8px;background:#17191b}.account-name{min-width:0}.account-name strong,.account-name span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account-name strong{font-size:12px}.account-name span{color:var(--muted);font-size:9px}.plan{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:9px}.state{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:9px}.state:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent)}.state.off:before{background:var(--danger)}
.quota-columns,.quota-row{display:grid;grid-template-columns:minmax(220px,1.15fr) minmax(260px,1.6fr) 110px;gap:20px;align-items:center}.quota-columns{padding:8px 14px;color:var(--quiet);font-size:8px;letter-spacing:.08em;text-transform:uppercase}.quota-columns span:last-child{text-align:right}.quota-list{padding:0 14px 5px}.quota-row{padding:13px 0;border-top:1px solid #292d30}.quota-row[hidden]{display:none}.model{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:center;min-width:0}.model-brand{width:30px;height:30px;padding:5px;border:1px solid #363b3f;border-radius:8px;background:#17191b}.model-copy{min-width:0}.model-copy strong,.model-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.model-copy strong{font-size:10.5px}.model-copy span{color:var(--quiet);font-size:8.5px}.bar{height:5px;background:#2d3235;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent);transition:width .28s ease}.quota-numbers{display:flex;justify-content:space-between;gap:10px;margin-top:6px;color:var(--muted);font-size:8.5px}.quota-numbers b{color:#cfd3d6}.reset{text-align:right;color:var(--muted);font-size:8.5px}.reset strong{display:block;color:var(--text);font:700 12px var(--vscode-editor-font-family,monospace)}.account-error{margin:12px 14px;padding:10px 11px;border-left:2px solid var(--danger);background:rgba(237,127,132,.07);color:#e8a1a4;font-size:10px}
.history{margin-top:30px}.request-table{border:1px solid var(--line);background:var(--surface)}.request-head,.request-row{display:grid;grid-template-columns:minmax(260px,1.6fr) minmax(150px,.8fr) 90px 110px;gap:16px;align-items:center}.request-head{padding:8px 13px;color:var(--quiet);font-size:8px;letter-spacing:.08em;text-transform:uppercase}.request-head span:nth-child(3),.request-head span:nth-child(4){text-align:right}.request-row{padding:10px 13px;border-top:1px solid #292d30}.request-model{display:grid;grid-template-columns:26px minmax(0,1fr);gap:9px;align-items:center;min-width:0}.request-brand{width:26px;height:26px;padding:4px}.request-model strong,.request-model small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.request-model strong{font-size:10px}.request-model small,.request-row>span{color:var(--muted);font-size:8.5px}.request-row b{text-align:right;color:var(--accent);font:650 10px var(--vscode-editor-font-family,monospace)}.request-row>em{text-align:right;color:#c9cdd0;font:normal 9px var(--vscode-editor-font-family,monospace)}
.empty{display:grid;place-items:center;min-height:190px;padding:26px;border:1px dashed var(--lineStrong);color:var(--muted);text-align:center}.empty strong{display:block;margin-bottom:3px;color:var(--text);font-size:13px}.footnote{margin:14px 0 0;color:var(--quiet);font-size:9px;line-height:1.6}
.dialog-backdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:rgba(8,9,10,.72);backdrop-filter:blur(6px)}.dashboard-dialog{width:min(420px,100%);border:1px solid var(--lineStrong);border-radius:14px;background:#202326;box-shadow:0 24px 70px rgba(0,0,0,.48);overflow:hidden}.dialog-head{display:flex;align-items:center;gap:10px;padding:16px 17px 0}.dialog-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:rgba(78,211,170,.1);color:var(--accent)}.dialog-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8}.dialog-head strong{flex:1;font-size:13px}.dialog-close{display:grid;place-items:center;width:28px;height:28px;border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:18px}.dialog-copy{padding:12px 17px 0;color:var(--muted);font-size:10px;line-height:1.55}.dialog-field{display:grid;gap:6px;padding:14px 17px 0;color:var(--muted);font-size:9px}.dialog-field input{height:38px;padding:0 11px;border:1px solid var(--lineStrong);border-radius:8px;outline:0;background:#181a1c;color:var(--text);font:inherit}.dialog-field input:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(78,211,170,.12)}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;padding:17px}.dialog-actions .danger{border-color:rgba(237,127,132,.45);background:rgba(237,127,132,.1);color:#f19a9e}.dialog-actions .danger:hover{background:rgba(237,127,132,.16)}
/* Usage workspace v2 */
:root{--canvas:#111314;--surface:#181a1c;--surface2:#202326;--line:#303438;--lineStrong:#454a50;--text:#f2f4f5;--muted:#969ca3;--quiet:#6f767d;--accent:#66d8be;--danger:#ef858b;--warning:#e0bb5c}
body{background:linear-gradient(180deg,#121415 0,#101213 100%)}
.app{width:min(1180px,100%);padding:24px 28px 64px}
.masthead{align-items:center;gap:24px;padding:18px 20px;border:1px solid var(--line);border-radius:16px;background:#181a1c}
.identity{grid-template-columns:42px minmax(0,1fr);gap:13px}.hero-brand{display:grid;place-items:center;width:42px;height:42px;padding:8px;border-color:#3c4146;border-radius:11px;background:#101213;line-height:0;overflow:hidden}.hero-brand svg,.hero-brand img{display:block;width:24px!important;height:24px!important;max-width:24px!important;max-height:24px!important;object-fit:contain}.kicker{margin-bottom:3px;font-size:8px;letter-spacing:.14em}.masthead h1{font-size:25px;letter-spacing:-.035em}.masthead p{margin-top:5px;font-size:10.5px}
.actions{align-items:center}.button{height:33px;border-radius:8px;background:#202326;font-size:10px}.button.primary{border-color:var(--accent);background:var(--accent)}.button svg{display:block;width:14px;height:14px;fill:currentColor;stroke:none}
.snapshot{grid-template-columns:repeat(4,1fr);gap:0;margin:12px 0 0;border:1px solid var(--line);border-radius:14px;background:#181a1c;overflow:hidden}
.metric{display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:11px;min-height:78px;padding:14px 16px;border-left:1px solid var(--line)}
.metric-icon{display:grid!important;place-items:center;width:34px;height:34px;border:1px solid #363b40;border-radius:10px;background:#202326;color:#8f969d}
.metric-icon svg{display:block;width:17px;height:17px;fill:currentColor}.metric.primary .metric-icon{border-color:rgba(102,216,190,.28);background:rgba(102,216,190,.08);color:var(--accent)}.metric.warning .metric-icon{border-color:rgba(224,187,92,.28);background:rgba(224,187,92,.08);color:var(--warning)}
.metric>div{min-width:0}.metric>div>span{display:block;color:#828990;font-size:8px;letter-spacing:.08em;text-transform:uppercase}.metric>div>strong{display:block;margin-top:4px;font:720 22px/1 var(--vscode-editor-font-family,monospace)}
.notice{margin-top:12px;border-radius:12px}.notice-icon svg,.dialog-icon svg{fill:currentColor;stroke:none}
.filter-bar{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(0,2fr);align-items:center;gap:20px;margin:12px 0 24px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#181a1c}.filter-bar>div:first-child{display:grid;gap:2px}.filter-bar>div:first-child strong{font-size:10.5px}.filter-bar>div:first-child span{color:var(--quiet);font-size:8.5px}
.view-tabs{display:flex;align-items:center;gap:7px;margin:16px 0 14px;padding:6px;border:1px solid #3d4349;border-radius:12px;background:#191c1e}.view-tab{position:relative;display:flex;align-items:center;gap:8px;min-height:38px;padding:0 13px;border:1px solid #343a40;border-radius:8px;background:#22262a;color:#c3c9ce;font-size:10px;font-weight:680;cursor:pointer}.view-tab:hover{border-color:#596169;background:#2a2f33;color:#fff}.view-tab:focus-visible{outline:2px solid #66b8ee;outline-offset:1px}.view-tab[aria-selected="true"]{border-color:rgba(102,216,190,.48);background:linear-gradient(180deg,rgba(102,216,190,.14),rgba(102,216,190,.065));color:#f5fffc;box-shadow:inset 0 0 0 1px rgba(102,216,190,.08)}.view-tab:before{content:"";width:7px;height:7px;border-radius:2px;background:#8a9299}.view-tab[data-view="quota"][aria-selected="true"]:before{background:var(--accent);box-shadow:0 0 0 3px rgba(102,216,190,.12)}.view-tab[data-view="activity"][aria-selected="true"]{border-color:rgba(102,184,238,.5);background:linear-gradient(180deg,rgba(102,184,238,.15),rgba(102,184,238,.065))}.view-tab[data-view="activity"][aria-selected="true"]:before{background:#66b8ee;box-shadow:0 0 0 3px rgba(102,184,238,.12)}.view-tab b{min-width:20px;padding:3px 7px;border:1px solid #3a4147;border-radius:6px;background:#171a1c;color:#d5dade;font:650 8px/1.35 var(--vscode-editor-font-family,monospace)}.view-tab[aria-selected="true"] b{border-color:rgba(255,255,255,.12);background:#101314;color:#fff}.tab-panel{outline:0}.panel-heading{align-items:center;margin:0 0 12px;padding:11px 13px;border:1px solid #353a3f;border-radius:10px;background:#191c1e}.panel-heading h2{font-size:11.5px;font-weight:760}.panel-heading h2:before{content:"";display:inline-block;width:3px;height:12px;margin-right:9px;border-radius:2px;vertical-align:-2px}.quota-heading{border-color:rgba(102,216,190,.22);background:linear-gradient(90deg,rgba(102,216,190,.075),#191c1e 38%)}.quota-heading h2{color:#dff9f3}.quota-heading h2:before{background:var(--accent)}.activity-heading{border-color:rgba(102,184,238,.22);background:linear-gradient(90deg,rgba(102,184,238,.075),#191c1e 38%)}.activity-heading h2{color:#e3f3fd}.activity-heading h2:before{background:#66b8ee}
.filters{grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:0}.dashboard-select{position:relative;min-width:0}.dashboard-select>select{display:none}.select-trigger{display:flex;align-items:center;justify-content:space-between;gap:9px;width:100%;height:35px;padding:0 11px;border:1px solid #393e43;border-radius:9px;background:#202326;color:#d9dde0;font-size:9.5px;text-align:left;cursor:pointer}.select-trigger:hover,.dashboard-select.open .select-trigger{border-color:#596068;background:#25282b}.select-trigger>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.select-trigger:after{content:"";width:7px;height:7px;flex:none;border-right:1.5px solid #a7adb2;border-bottom:1.5px solid #a7adb2;transform:rotate(45deg) translateY(-2px)}.dashboard-select.open .select-trigger:after{transform:rotate(225deg) translate(-2px,-2px)}.select-menu{position:absolute;z-index:20;top:calc(100% + 6px);left:0;right:0;display:grid;gap:2px;max-height:min(320px,45vh);overflow:auto;padding:6px;border:1px solid #454b51;border-radius:11px;background:#202326;box-shadow:0 18px 46px rgba(0,0,0,.58);scrollbar-width:thin;scrollbar-color:#596067 transparent}.select-menu button{width:100%;min-height:32px;padding:7px 9px;border:0;border-radius:7px;background:transparent;color:#cfd3d6;font-size:9.5px;text-align:left;white-space:normal;cursor:pointer}.select-menu button:hover,.select-menu button.active{background:#303438;color:#fff}.select-menu button.active:after{content:"✓";float:right;color:var(--accent);font-weight:700}
.section-head{align-items:center;margin:0 2px 9px}.section-head h2{font-size:11px}.section-head span{font-size:8.5px}.panel-heading{margin:0 0 12px;padding:11px 13px}.panel-heading h2{font-size:11.5px}
.accounts{gap:14px}.account{border-color:#3a4147;border-radius:16px;background:#181a1c;overflow:hidden}.account-head{position:relative;grid-template-columns:38px minmax(0,1fr) auto auto;gap:12px;padding:14px 16px 14px 19px;border-bottom-color:#41484e;background:linear-gradient(90deg,rgba(102,216,190,.1),#24282b 32%,#202326)}.account-head:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--accent)}.account-brand{display:grid;place-items:center;width:38px;height:38px;padding:7px;border-color:#4a5259;border-radius:10px;background:#111314}.account-brand svg,.account-brand img{display:block;width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;object-fit:contain}.account-name strong{color:#f7fafb;font-size:11.5px}.account-name span{margin-top:2px;color:#aeb5bb;font-size:8.5px}.plan{padding:4px 7px;border:1px solid #485057;border-radius:6px;background:#171a1c;color:#c3c9ce}.state{color:#c2c8cd;font-size:8.5px}
.quota-columns,.quota-row{grid-template-columns:minmax(210px,1.05fr) minmax(280px,1.65fr) 116px;gap:22px}.quota-columns{padding:8px 16px 6px;font-size:7.5px}.quota-list{padding:0 16px 4px}.quota-row{min-height:78px;padding:13px 0;border-top-color:#2b2f33}.model{grid-template-columns:36px minmax(0,1fr);gap:11px;align-items:center}.model-brand{display:grid;place-items:center;width:36px;height:36px;padding:7px;border-color:#383d42;border-radius:10px;background:#111314;line-height:0}.model-brand svg,.model-brand img{display:block;width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;object-fit:contain}.model-copy{align-self:center}.model-copy strong{font-size:10.5px}.model-copy span{margin-top:2px;font-size:8px}
.quota-meter{display:grid;gap:7px;min-width:0}.quota-numbers{align-items:center;margin:0;font-size:8.5px}.quota-numbers span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.quota-numbers b{flex:none;color:#e5e8ea;font-size:9px}
.quota-gauge{display:block;width:100%;height:11px;padding:2px;border:1px solid #d9dde0;border-radius:5px;background:transparent;overflow:hidden;appearance:none;-webkit-appearance:none}
.quota-gauge::-webkit-progress-bar{border-radius:2px;background:#202428}.quota-gauge::-webkit-progress-value{border-radius:2px;background:var(--accent);transition:width .25s ease}.quota-gauge::-moz-progress-bar{border-radius:2px;background:var(--accent)}
.quota-gauge.low::-webkit-progress-value{background:var(--warning)}.quota-gauge.low::-moz-progress-bar{background:var(--warning)}.quota-gauge.critical::-webkit-progress-value{background:var(--danger)}.quota-gauge.critical::-moz-progress-bar{background:var(--danger)}.quota-gauge.unknown{border-color:#555b61;opacity:.65}
.reset{display:grid;gap:3px;text-align:right}.reset span{color:#737a81;font-size:7.5px;letter-spacing:.08em;text-transform:uppercase}.reset strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d8dcdf;font:600 9px/1.3 var(--vscode-font-family,Segoe UI,sans-serif)}
.account-error{border-left:0;border-radius:9px}
.history{margin-top:0}.request-table{border-color:#34383d;border-radius:14px;background:#181a1c;overflow:hidden}.request-head{padding:9px 14px;background:#1b1d1f}.request-row{min-height:52px;padding:10px 14px;border-top-color:#2b2f33}.request-brand{display:grid;place-items:center;width:30px;height:30px;padding:5px;border:1px solid #353a3f;border-radius:8px;background:#111314}.request-brand svg,.request-brand img{display:block;width:18px!important;height:18px!important;max-width:18px!important;max-height:18px!important;object-fit:contain}
.footnote{margin-top:16px;padding:0 2px}
*{scrollbar-width:thin;scrollbar-color:#596067 transparent;scrollbar-gutter:auto}
*::-webkit-scrollbar{width:10px;height:10px;background:transparent}
*::-webkit-scrollbar-track,*::-webkit-scrollbar-track-piece,*::-webkit-scrollbar-corner{border:0;background:transparent;box-shadow:none}
*::-webkit-scrollbar-thumb{min-height:28px;border:2px solid transparent;border-radius:999px;background:#596067;background-clip:padding-box;box-shadow:none}
*::-webkit-scrollbar-thumb:hover{background:#747b82;background-clip:padding-box}
*::-webkit-scrollbar-button:single-button{display:block;width:10px;height:11px;border:0;background-color:transparent;background-position:center;background-repeat:no-repeat;background-size:7px 7px}
*::-webkit-scrollbar-button:single-button:vertical:decrement{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 6.5 5 3.5l3 3' fill='none' stroke='%238b9299' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}
*::-webkit-scrollbar-button:single-button:vertical:increment{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='m2 3.5 3 3 3-3' fill='none' stroke='%238b9299' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}
[hidden]{display:none!important}
@media(max-width:900px){.app{padding:20px 18px 48px}.masthead{grid-template-columns:1fr;align-items:start}.actions{justify-content:flex-start}.snapshot{grid-template-columns:1fr 1fr}.metric:nth-child(3){border-left:0;border-top:1px solid var(--line)}.metric:nth-child(4){border-top:1px solid var(--line)}.filter-bar{grid-template-columns:1fr;gap:9px}.filters{grid-template-columns:1fr 1fr}.quota-columns,.quota-row{grid-template-columns:minmax(190px,1fr) minmax(220px,1.4fr) 100px;gap:16px}}
@media(max-width:680px){.app{padding-inline:12px}.quota-columns{display:none}.quota-row{grid-template-columns:1fr;gap:11px;padding:14px 0}.reset{grid-template-columns:auto 1fr;align-items:center;gap:8px;text-align:left}.account-head{grid-template-columns:36px minmax(0,1fr) auto}.account-head .plan{display:none}.request-head{display:none}.request-row{grid-template-columns:minmax(0,1fr) minmax(92px,auto);grid-template-areas:"model token" "model latency";column-gap:14px;row-gap:4px;min-height:74px;padding:12px 14px}.request-model{grid-area:model;align-self:center}.request-row>span{display:none}.request-row>b{grid-area:token;align-self:end;justify-self:stretch}.request-row>em{grid-area:latency;align-self:start;justify-self:stretch}}
@media(max-width:470px){.app{padding:10px 8px 36px}.masthead{padding:14px}.masthead h1{font-size:22px}.identity{grid-template-columns:38px minmax(0,1fr)}.hero-brand{width:38px;height:38px}.actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.actions .button{width:100%}.snapshot,.filters{grid-template-columns:1fr}.metric{border-left:0;border-top:1px solid var(--line)}.metric:first-child{border-top:0}.filter-bar{padding:10px}.notice{grid-template-columns:28px 1fr}.notice .button{grid-column:1/-1}.account-head{padding-inline:12px}.quota-list{padding-inline:12px}.view-tabs{display:grid;grid-template-columns:1fr 1fr}.view-tab{justify-content:center;padding-inline:8px}.view-tab b{display:none}.panel-heading{align-items:flex-start}.panel-heading span{max-width:45%;text-align:right}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.button,.bar i{transition:none}}
</style></head><body><main class="app">
<header class="masthead"><div class="identity">${brandMarkup(providerKey, providerLabel, 'hero-brand')}<div><span class="kicker">RelayCode usage</span><h1>Model activity</h1><p>${safe(providerDescription)}</p></div></div><nav class="actions">${openProviderAction}<button class="button secondary" id="clear">${utilityIcon('trash')}Xóa dữ liệu</button><button class="button primary" id="refresh">${utilityIcon('refresh')}Làm mới</button></nav></header>
<section class="snapshot">
  ${metric(String(accountCount), 'Tài khoản', 'primary', 'database')}
  ${metric(String(quotaCount), 'Hạn mức / model', '', 'pulse')}
  ${metric(String(availableCount), 'Đang khả dụng', '', 'checkCircle')}
  ${metric(String(lowCount), 'Còn ≤ 15%', lowCount ? 'warning' : '', 'warning')}
</section>
${stateNotice(displayedQuota, providerLabel)}
<nav class="view-tabs" role="tablist" aria-label="Chọn nhóm số liệu">
  <button class="view-tab" id="quotaTab" type="button" role="tab" aria-selected="true" aria-controls="quotaPanel" data-view="quota">Quota &amp; limits <b>${quotaBadge}</b></button>
  <button class="view-tab" id="activityTab" type="button" role="tab" aria-selected="false" aria-controls="activityPanel" data-view="activity">Token usage <b>${modelBadge}</b></button>
</nav>
<section id="quotaPanel" class="tab-panel" role="tabpanel" aria-labelledby="quotaTab" tabindex="0">
<section class="filter-bar"><div><strong>Bộ lọc</strong><span>Thu hẹp theo provider, tài khoản hoặc model</span></div><div class="filters" aria-label="Bộ lọc số liệu">
  ${dashboardSelect('provider', 'Tất cả provider', providerOptions)}
  ${dashboardSelect('account', 'Tất cả tài khoản', accountOptions)}
  ${dashboardSelect('model', 'Tất cả model', modelOptions)}
  ${dashboardSelect('sort', 'Reset gần nhất', [['reset', 'Reset gần nhất'], ['remaining', 'Còn ít nhất'], ['name', 'Tên tài khoản']], 'reset')}
</div></section>
<div class="section-head panel-heading quota-heading"><h2>Quota by account</h2><span>${displayedQuota.fetchedAt ? `Cập nhật ${safe(relativeTime(displayedQuota.fetchedAt))}` : 'Chưa có rate limit mới'}</span></div>
<section id="accounts" class="accounts">${displayedQuota.accounts.map(accountCard).join('') || emptyState(displayedQuota)}</section>
<p class="footnote">RelayCode chỉ hiển thị hạn mức provider thực sự trả về. Nếu API không gửi rate-limit headers, giao diện ghi rõ là chưa có dữ liệu thay vì tự ước đoán.</p>
</section>
<section id="activityPanel" class="tab-panel history" role="tabpanel" aria-labelledby="activityTab" tabindex="0" hidden><div class="section-head panel-heading activity-heading"><h2>Token usage by model</h2><span>${visibleRecords.length} request được lưu cục bộ</span></div>
<div class="request-table"><div class="request-head"><span>Model</span><span>Hồ sơ</span><span>Token</span><span>Latency</span></div>${requestRows || '<div class="empty"><div><strong>Chưa có request</strong><span>Số liệu xuất hiện sau lần dùng Chat hoặc Agent đầu tiên.</span></div></div>'}</div><p class="footnote">Token usage được tổng hợp từ các request lưu cục bộ theo model và hồ sơ đang chọn.</p></section>
</main>
<div class="dialog-backdrop" id="dashboardDialog" hidden>
  <section class="dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle">
    <header class="dialog-head"><span class="dialog-icon" id="dialogIcon"></span><strong id="dialogTitle"></strong><button class="dialog-close" id="dialogClose" aria-label="Đóng">×</button></header>
    <div class="dialog-copy" id="dialogMessage"></div>
    <label class="dialog-field" id="dialogField" hidden><span>Mật khẩu quản trị</span><input id="dialogInput" type="password" autocomplete="current-password" /></label>
    <footer class="dialog-actions"><button class="button secondary" id="dialogCancel">Hủy</button><button class="button primary" id="dialogConfirm"></button></footer>
  </section>
</div>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi(),accounts=[...document.querySelectorAll('.account')],provider=document.getElementById('provider'),account=document.getElementById('account'),model=document.getElementById('model'),sort=document.getElementById('sort'),grid=document.getElementById('accounts');
const viewTabs=[...document.querySelectorAll('.view-tab')],viewPanels=[...document.querySelectorAll('.tab-panel')];
function setView(view,focus=false){viewTabs.forEach(tab=>{const active=tab.dataset.view===view;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus()});viewPanels.forEach(panel=>panel.hidden=panel.id!==(view==='activity'?'activityPanel':'quotaPanel'));const previous=vscode.getState()||{};vscode.setState({...previous,dashboardView:view})}
viewTabs.forEach((tab,index)=>{tab.onclick=()=>setView(tab.dataset.view);tab.onkeydown=event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();const next=(index+(event.key==='ArrowRight'?1:-1)+viewTabs.length)%viewTabs.length;setView(viewTabs[next].dataset.view,true)}});
setView(vscode.getState()?.dashboardView==='activity'?'activity':'quota');
function apply(){const p=provider.value,a=account.value,m=model.value;accounts.forEach(card=>{let rows=0;card.querySelectorAll('.quota-row').forEach(row=>{const show=!m||row.dataset.model===m;row.hidden=!show;if(show)rows++});card.hidden=!!((p&&card.dataset.provider!==p)||(a&&card.dataset.account!==a)||(m&&!rows))});accounts.filter(card=>!card.hidden).sort((x,y)=>sort.value==='name'?x.dataset.name.localeCompare(y.dataset.name):Number(x.dataset[sort.value])-Number(y.dataset[sort.value])).forEach(card=>grid.append(card))}
provider.onchange=apply;account.onchange=apply;model.onchange=apply;sort.onchange=apply;
const customSelects=[...document.querySelectorAll('.dashboard-select')];
function closeSelects(except){customSelects.forEach(picker=>{if(picker===except)return;picker.classList.remove('open');picker.querySelector('.select-menu').hidden=true;picker.querySelector('.select-trigger').setAttribute('aria-expanded','false')})}
customSelects.forEach(picker=>{const trigger=picker.querySelector('.select-trigger'),menu=picker.querySelector('.select-menu'),select=picker.querySelector('select');trigger.onclick=event=>{event.stopPropagation();const open=menu.hidden;closeSelects(open?picker:null);menu.hidden=!open;picker.classList.toggle('open',open);trigger.setAttribute('aria-expanded',String(open))};menu.onclick=event=>event.stopPropagation();menu.querySelectorAll('button').forEach(option=>option.onclick=()=>{select.value=option.dataset.value;trigger.querySelector('span').textContent=option.textContent.trim();menu.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===option));select.dispatchEvent(new Event('change'));closeSelects()})});
document.addEventListener('click',()=>closeSelects());document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSelects()});
document.getElementById('refresh').onclick=()=>vscode.postMessage({type:'refreshQuota'});
document.getElementById('openProvider')?.addEventListener('click',()=>vscode.postMessage({type:'openRouterQuota'}));
const dialog=document.getElementById('dashboardDialog'),dialogInput=document.getElementById('dialogInput');let dialogMode='';
function closeDialog(){dialog.hidden=true;dialogMode='';dialogInput.value=''}
function openDialog(mode){dialogMode=mode;const login=mode==='login';document.getElementById('dialogTitle').textContent=login?'Đăng nhập quản trị 9Router':'Xóa dữ liệu sử dụng?';document.getElementById('dialogMessage').textContent=login?'Mật khẩu chỉ được dùng để tạo session và không được lưu.':'Toàn bộ lịch sử request đã lưu cục bộ sẽ bị xóa. Thao tác này không thể hoàn tác.';document.getElementById('dialogField').hidden=!login;document.getElementById('dialogConfirm').textContent=login?'Đăng nhập':'Xóa dữ liệu';document.getElementById('dialogConfirm').classList.toggle('danger',!login);document.getElementById('dialogIcon').innerHTML=login?${JSON.stringify(utilityIcon('lock'))}:${JSON.stringify(utilityIcon('trash'))};dialog.hidden=false;requestAnimationFrame(()=>login?dialogInput.focus():document.getElementById('dialogConfirm').focus())}
document.getElementById('clear').onclick=()=>openDialog('clear');
document.getElementById('quotaLogin')?.addEventListener('click',()=>openDialog('login'));
document.getElementById('dialogClose').onclick=closeDialog;document.getElementById('dialogCancel').onclick=closeDialog;
dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog()});
document.getElementById('dialogConfirm').onclick=()=>{if(dialogMode==='login'){if(!dialogInput.value.trim()){dialogInput.focus();return}vscode.postMessage({type:'loginQuota',password:dialogInput.value})}else if(dialogMode==='clear')vscode.postMessage({type:'clearConfirmed'});closeDialog()};
document.addEventListener('keydown',event=>{if(dialog.hidden)return;if(event.key==='Escape')closeDialog();if(event.key==='Enter'){event.preventDefault();document.getElementById('dialogConfirm').click()}});
const refreshTimer=setInterval(()=>vscode.postMessage({type:'refreshQuota',silent:true}),60000);window.addEventListener('unload',()=>clearInterval(refreshTimer));
</script></body></html>`;
  return language === 'en' ? localizeTelemetryDocument(document) : document;
}

function localizeTelemetryDocument(document: string): string {
  const translations: Array<readonly [string, string]> = [
    ['Hạn mức tài khoản từ 9Router và hoạt động gần đây của RelayCode.', 'Account quotas from 9Router and recent RelayCode activity.'],
    ['Rate limit, token và tốc độ phản hồi của', 'Rate limits, tokens and response speed for'],
    ['RelayCode chỉ hiển thị hạn mức provider thực sự trả về. Nếu API không gửi rate-limit headers, giao diện ghi rõ là chưa có dữ liệu thay vì tự ước đoán.', 'RelayCode only displays limits actually returned by the provider. If the API sends no rate-limit headers, the dashboard shows that no data is available instead of estimating it.'],
    ['Token usage được tổng hợp từ các request lưu cục bộ theo model và hồ sơ đang chọn.', 'Token usage is aggregated from locally stored requests for the selected model and profile.'],
    ['Toàn bộ lịch sử request đã lưu cục bộ sẽ bị xóa. Thao tác này không thể hoàn tác.', 'All locally stored request history will be deleted. This action cannot be undone.'],
    ['Mật khẩu chỉ được dùng để tạo session và không được lưu.', 'The password is only used to create a session and is not stored.'],
    ['Số liệu xuất hiện sau lần dùng Chat hoặc Agent đầu tiên.', 'Usage appears after the first Chat or Agent request.'],
    ['Thu hẹp theo provider, tài khoản hoặc model', 'Narrow results by provider, account or model'],
    ['Provider chưa trả về hạn mức cho tài khoản nào.', 'The provider has not returned limits for any account.'],
    ['Dữ liệu xuất hiện sau khi kết nối thành công.', 'Data appears after a successful connection.'],
    ['Tài khoản chưa trả dữ liệu hạn mức.', 'The account has not returned quota data.'],
    ['RelayCode đang tải dữ liệu từng model.', 'RelayCode is loading data for each model.'],
    ['Chưa có request cho hồ sơ này. Gửi một tin nhắn để ghi nhận token và rate limit.', 'No requests exist for this profile. Send a message to record tokens and rate limits.'],
    ['Đăng nhập quản trị 9Router', 'Sign in to 9Router administration'],
    ['Xóa dữ liệu sử dụng?', 'Delete usage data?'],
    ['Mật khẩu quản trị', 'Administrator password'],
    ['Đăng nhập an toàn', 'Sign in securely'],
    ['Đang đọc hạn mức từ', 'Reading limits from'],
    ['Cần đăng nhập', 'Sign-in required for'],
    ['Chưa lấy được hạn mức', 'Unable to retrieve limits'],
    ['Kiểm tra ', 'Check '],
    [' rồi thử lại.', ' and try again.'],
    ['Đang tải dữ liệu…', 'Loading data…'],
    ['Chưa có tài khoản quota', 'No quota accounts'],
    ['Chưa có rate limit mới', 'No recent rate-limit data'],
    ['request được lưu cục bộ', 'requests stored locally'],
    ['Chưa có request', 'No requests yet'],
    ['Chọn nhóm số liệu', 'Choose usage view'],
    ['Bộ lọc số liệu', 'Usage filters'],
    ['Tất cả provider', 'All providers'],
    ['Tất cả tài khoản', 'All accounts'],
    ['Tất cả model', 'All models'],
    ['Reset gần nhất', 'Nearest reset'],
    ['Còn ít nhất', 'Lowest remaining'],
    ['Tên tài khoản', 'Account name'],
    ['Hạn mức còn lại', 'Remaining quota'],
    ['hạn mức còn lại', 'remaining quota'],
    ['Provider chưa gửi hạn mức', 'Provider has not sent a quota'],
    ['Chưa có dữ liệu hạn mức', 'No quota data'],
    ['Không giới hạn', 'Unlimited'],
    ['Không có lịch', 'No schedule'],
    [' ngày nữa', ' days remaining'],
    [' ngày trước', ' days ago'],
    [' giờ nữa', ' hours remaining'],
    [' giờ trước', ' hours ago'],
    [' phút nữa', ' minutes remaining'],
    [' phút trước', ' minutes ago'],
    ['trong ít phút', 'in a few minutes'],
    ['vừa xong', 'just now'],
    ['Cập nhật ', 'Updated '],
    ['Đang bật', 'Enabled'],
    ['Đã tắt', 'Disabled'],
    ['Mở 9Router', 'Open 9Router'],
    ['Xóa dữ liệu', 'Delete data'],
    ['Làm mới', 'Refresh'],
    ['Tài khoản', 'Accounts'],
    ['Hạn mức / model', 'Limits / model'],
    ['Đang khả dụng', 'Available'],
    ['Còn ≤ 15%', 'At or below 15%'],
    ['Bộ lọc', 'Filters'],
    ['Hồ sơ', 'Profile'],
    ['Chu kỳ', 'Reset cycle'],
    ['Chưa có dữ liệu', 'No data'],
    ['còn lại', 'remaining'],
    ['Đăng nhập', 'Sign in'],
    ['Đóng', 'Close'],
    ['Hủy', 'Cancel']
  ];
  return translations
    .sort(([left], [right]) => right.length - left.length)
    .reduce((result, [source, target]) => result.replaceAll(source, target), document);
}

function dashboardSelect(
  id: string,
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  initialValue = ''
): string {
  const nativeOptions = options.map(([value, optionLabel]) =>
    `<option value="${safe(value)}"${value === initialValue ? ' selected' : ''}>${safe(optionLabel)}</option>`
  ).join('');
  const menuOptions = options.map(([value, optionLabel]) =>
    `<button type="button" data-value="${safe(value)}" class="${value === initialValue ? 'active' : ''}">${safe(optionLabel)}</button>`
  ).join('');
  const initialLabel = options.find(([value]) => value === initialValue)?.[1] ?? label;
  const blankMenuOption = initialValue ? '' : `<button type="button" data-value="" class="active">${safe(label)}</button>`;
  const blankNativeOption = initialValue ? '' : `<option value="">${safe(label)}</option>`;
  return `<div class="dashboard-select" data-select="${safe(id)}"><button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false"><span>${safe(initialLabel)}</span></button><div class="select-menu" role="listbox" hidden>${blankMenuOption}${menuOptions}</div><select id="${safe(id)}" aria-hidden="true" tabindex="-1">${blankNativeOption}${nativeOptions}</select></div>`;
}

function accountCard(account: QuotaAccount): string {
  const minimum = account.quotas.reduce((result, item) => Math.min(result, item.remainingPercentage ?? 100), 100);
  const reset = account.quotas.reduce((result, item) => {
    const value = item.resetAt ? Date.parse(item.resetAt) : Number.MAX_SAFE_INTEGER;
    return Math.min(result, Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER);
  }, Number.MAX_SAFE_INTEGER);
  const rows = account.quotas.map((item) => quotaRow(item, account.provider)).join('');
  return `<article class="account" data-account="${safe(account.id)}" data-provider="${safe(account.provider)}" data-name="${safe(account.name.toLowerCase())}" data-remaining="${minimum}" data-reset="${reset}">
  <header class="account-head">${brandMarkup(brandKeyFor(account.provider), providerName(account.provider), 'account-brand')}<div class="account-name"><strong>${safe(providerName(account.provider))}</strong><span title="${safe(account.email || account.name)}">${safe(account.email || account.name)}</span></div>${account.plan ? `<span class="plan">${safe(account.plan)}</span>` : '<span></span>'}<span class="state${account.active ? '' : ' off'}">${account.active ? 'Đang bật' : 'Đã tắt'}</span></header>
  ${rows ? '<div class="quota-columns"><span>Model</span><span>Hạn mức còn lại</span><span>Chu kỳ</span></div><div class="quota-list">' + rows + '</div>' : `<div class="account-error">${safe(account.error || 'Tài khoản chưa trả dữ liệu hạn mức.')}</div>`}
  ${rows && account.error ? `<div class="account-error">${safe(account.error)}</div>` : ''}</article>`;
}

function quotaRow(item: QuotaItem, provider: string): string {
  const known = item.unlimited || item.remainingPercentage !== undefined;
  const percent = item.unlimited ? 100 : Math.round(item.remainingPercentage ?? 0);
  const detail = item.unlimited
    ? 'Không giới hạn'
    : item.total !== undefined
      ? `${compact(item.used ?? Math.max(0, item.total - (item.remaining ?? 0)))} / ${compact(item.total)}`
      : item.remaining !== undefined ? `${compact(item.remaining)} còn lại` : item.used !== undefined ? `${compact(item.used)} token đã ghi nhận` : 'Provider chưa gửi hạn mức';
  const modelKey = brandKeyFor(`${item.id} ${item.name}`, provider);
  const level = !known ? 'unknown' : percent <= 15 ? 'critical' : percent <= 40 ? 'low' : 'healthy';
  const gaugeValue = item.unlimited ? 100 : known ? percent : 0;
  return `<div class="quota-row" data-model="${safe(item.id)}"><div class="model">${brandMarkup(modelKey, item.name, 'model-brand')}<div class="model-copy"><strong title="${safe(item.name)}">${safe(item.name)}</strong><span>${safe(providerName(provider))}</span></div></div><div class="quota-meter"><div class="quota-numbers"><span>${safe(detail)}</span><b>${item.unlimited ? 'Không giới hạn' : known ? `${percent}% còn lại` : item.used !== undefined ? 'Đã ghi nhận sử dụng' : 'Chưa có dữ liệu'}</b></div><progress class="quota-gauge ${level}" max="100" value="${gaugeValue}" aria-label="${known ? `${percent}% hạn mức còn lại` : 'Chưa có dữ liệu hạn mức'}">${gaugeValue}%</progress></div><div class="reset"><span>Reset</span><strong>${item.resetAt ? safe(relativeTime(Date.parse(item.resetAt))) : 'Không có lịch'}</strong></div></div>`;
}

function stateNotice(quota: QuotaSnapshot, provider: string): string {
  if (quota.status === 'ready') return '';
  const loading = quota.status === 'loading';
  const auth = quota.status === 'auth-required';
  const error = quota.status === 'unavailable';
  return `<section class="notice${error ? ' error' : ''}"><span class="notice-icon">${utilityIcon(loading ? 'refresh' : auth ? 'lock' : 'alert')}</span><div class="notice-copy"><strong>${loading ? `Đang đọc hạn mức từ ${safe(provider)}…` : auth ? `Cần đăng nhập ${safe(provider)}` : 'Chưa lấy được hạn mức'}</strong><span>${safe(quota.message || (loading ? 'RelayCode đang tải dữ liệu từng model.' : `Kiểm tra ${provider} rồi thử lại.`))}</span></div>${auth ? '<button class="button primary" id="quotaLogin">Đăng nhập an toàn</button>' : ''}</section>`;
}

function emptyState(quota: QuotaSnapshot): string {
  const title = quota.status === 'loading' ? 'Đang tải dữ liệu…' : 'Chưa có tài khoản quota';
  const detail = quota.status === 'ready' ? 'Provider chưa trả về hạn mức cho tài khoản nào.' : 'Dữ liệu xuất hiện sau khi kết nối thành công.';
  return `<div class="empty"><div><strong>${title}</strong><span>${detail}</span></div></div>`;
}

function quotaFromTelemetry(profile: ProviderProfile, records: TelemetryRecord[]): QuotaSnapshot {
  const latestByModel = new Map<string, TelemetryRecord>();
  const tokensByModel = new Map<string, number>();
  for (const record of records) {
    const current = latestByModel.get(record.model);
    if (!current || record.timestamp > current.timestamp) latestByModel.set(record.model, record);
    tokensByModel.set(record.model, (tokensByModel.get(record.model) ?? 0) + record.totalTokens);
  }
  const quotas: QuotaItem[] = [...latestByModel.values()].map((record) => {
    const rate = record.rateLimit;
    const total = numeric(rate?.tokensLimit) ?? numeric(rate?.requestsLimit);
    const remaining = numeric(rate?.tokensRemaining) ?? numeric(rate?.requestsRemaining);
    return {
      id: record.model,
      name: record.model,
      total,
      remaining,
      used: total !== undefined && remaining !== undefined ? Math.max(0, total - remaining) : tokensByModel.get(record.model),
      remainingPercentage: total !== undefined && total > 0 && remaining !== undefined ? Math.max(0, Math.min(100, (remaining / total) * 100)) : undefined,
      resetAt: parseReset(rate?.reset),
      unlimited: false
    };
  });
  return {
    status: 'ready',
    origin: profile.endpoint,
    fetchedAt: records.reduce((latest, record) => Math.max(latest, record.timestamp), 0) || undefined,
    accounts: [{
      id: profile.id,
      provider: profile.kind,
      name: profile.name,
      email: profile.endpoint,
      active: true,
      quotas,
      error: quotas.length ? undefined : 'Chưa có request cho hồ sơ này. Gửi một tin nhắn để ghi nhận token và rate limit.'
    }]
  };
}

function aggregate(records: TelemetryRecord[]): ModelStats[] {
  const groups = new Map<string, ModelStats>();
  for (const record of records) {
    const key = `${record.profileId}:${record.model}`;
    const item = groups.get(key) ?? { profile: record.profileName, provider: record.provider, model: record.model, calls: 0, tokens: 0, latency: 0, latest: record.timestamp };
    item.calls++;
    item.tokens += record.totalTokens;
    item.latency += record.latencyMs;
    item.latest = Math.max(item.latest, record.timestamp);
    groups.set(key, item);
  }
  return [...groups.values()].sort((left, right) => right.latest - left.latest);
}

function requestRow(item: ModelStats): string {
  const average = item.calls ? Math.round(item.latency / item.calls) : 0;
  const key = brandKeyFor(item.model, item.provider);
  return `<div class="request-row"><div class="request-model">${brandMarkup(key, item.model, 'request-brand')}<span><strong title="${safe(item.model)}">${safe(item.model)}</strong><small>${number(item.calls)} request · ${safe(providerName(item.provider))}</small></span></div><span>${safe(item.profile)}</span><b>${compact(item.tokens)} tok</b><em>${number(average)} ms</em></div>`;
}

function metric(value: string, label: string, className = '', icon: UiIconName = 'pulse'): string {
  return `<article class="metric ${className}"><span class="metric-icon" aria-hidden="true">${iconMarkup(icon)}</span><div><span>${label}</span><strong>${value}</strong></div></article>`;
}

function providerName(provider: string): string {
  if (provider === 'antigravity') return 'Google Antigravity';
  if (provider === 'codex') return 'OpenAI Codex';
  if (provider === 'kiro') return 'Kiro';
  if (provider === 'anthropic' || provider === 'claude') return 'Anthropic Claude';
  if (provider === 'openai') return 'OpenAI';
  if (provider === '9router') return '9Router';
  if (provider === 'cockpit') return 'Cockpit Tools';
  if (provider === 'openai-compatible') return 'OpenAI-compatible';
  if (provider === 'opencode') return 'OpenCode';
  if (provider === 'lm-studio') return 'LM Studio';
  return provider.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relativeTime(timestamp: number): string {
  const delta = timestamp - Date.now();
  const absolute = Math.abs(delta);
  const suffix = delta >= 0 ? 'nữa' : 'trước';
  if (absolute < 60_000) return delta >= 0 ? 'trong ít phút' : 'vừa xong';
  if (absolute < 3_600_000) return `${Math.max(1, Math.round(absolute / 60_000))} phút ${suffix}`;
  if (absolute < 86_400_000) return `${Math.round(absolute / 3_600_000)} giờ ${suffix}`;
  return `${Math.round(absolute / 86_400_000)} ngày ${suffix}`;
}

function numeric(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseReset(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  const numericValue = Number(trimmed);
  if (Number.isFinite(numericValue)) {
    const timestamp = numericValue >= 1_000_000_000_000
      ? numericValue
      : numericValue >= 1_000_000_000
        ? numericValue * 1_000
        : Date.now() + numericValue * 1_000;
    return new Date(timestamp).toISOString();
  }
  const units: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const parts = [...trimmed.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g)];
  if (parts.length && parts.map((part) => part[0]).join('') === trimmed.replace(/\s+/g, '')) {
    const duration = parts.reduce((total, part) => total + Number(part[1]) * (units[part[2]!] ?? 0), 0);
    return new Date(Date.now() + duration).toISOString();
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function compact(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
}

function number(value: number): string {
  return new Intl.NumberFormat('vi-VN', { notation: value >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

function safe(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

type UtilityIcon = 'refresh' | 'external' | 'alert' | 'lock' | 'trash';
function utilityIcon(name: UtilityIcon): string {
  const icons: Record<UtilityIcon, UiIconName> = {
    refresh: 'arrowsClockwise',
    external: 'export',
    alert: 'warning',
    lock: 'key',
    trash: 'trash'
  };
  return iconMarkup(icons[name]);
}

function iconMarkup(name: UiIconName): string {
  const source = UI_ICONS[name];
  if (source.startsWith('data:image/svg+xml;base64,')) {
    return Buffer.from(source.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8');
  }
  if (source.startsWith('data:image/svg+xml,')) {
    return decodeURIComponent(source.slice('data:image/svg+xml,'.length));
  }
  return source;
}
