import type * as vscode from 'vscode';
import { UI_ICONS } from '../uiIcons';

export interface PlanDocumentData {
  title: string;
  prompt: string;
  plan: string;
  createdAt: number;
  language: 'vi' | 'en';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] ?? character);
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" data-external="$2">$1</a>');
}

export function inlineIcon(source: string): string {
  const trimmed = source.trim();
  if (/^<svg[\s>]/i.test(trimmed)) return trimmed;
  const comma = source.indexOf(',');
  if (!source.startsWith('data:image/svg+xml') || comma < 0) return '';
  try {
    return decodeURIComponent(source.slice(comma + 1));
  } catch {
    return '';
  }
}

function renderFileTree(value: string): string | undefined {
  const lines = value.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  const branchCount = lines.filter((line) => /(?:├──|└──|\|--|`--)/.test(line)).length;
  if (lines.length < 2 || branchCount < 1) return undefined;

  const cleaned = lines
    .map((line) => line.replace(/\|--/g, '├──').replace(/`--/g, '└──').replace(/[ \t]+$/g, ''))
  const normalized = normalizeFlatPathTree(cleaned) ?? cleaned.join('\n');
  const highlighted = normalized.split('\n').map((line) => {
    const match = /^((?:(?:│   |    ))*(?:(?:├──|└──)\s+)?)(.*?)(?:\s+#\s+(.+))?$/.exec(line);
    if (!match) return escapeHtml(line);
    const connector = match[1] ? `<span class="tree-connector">${escapeHtml(match[1])}</span>` : '';
    const node = `<span class="tree-node">${escapeHtml(match[2])}</span>`;
    const comment = match[3] ? `<span class="tree-comment">  # ${escapeHtml(match[3])}</span>` : '';
    return connector + node + comment;
  }).join('\n');
  return `<div class="file-tree-code"><div class="tree-code-toolbar"><span>text</span><button class="tree-copy" type="button" data-tree="${escapeHtml(encodeURIComponent(normalized))}"><span class="symbol">${inlineIcon(UI_ICONS.copy)}</span><span>Copy</span></button></div><pre><code>${highlighted}</code></pre></div>`;
}

interface TreeNode {
  name: string;
  folder: boolean;
  comment?: string;
  children: Map<string, TreeNode>;
}

function normalizeFlatPathTree(lines: string[]): string | undefined {
  const entries = lines.map((line) => {
    const content = line.replace(/^(?:[│ ]{4})*(?:├──|└──)\s*/, '').trim();
    const match = /^(.*?)(?:\s+#\s+(.+))?$/.exec(content);
    const path = (match?.[1] ?? '').replace(/\\/g, '/').trim();
    return { path, comment: match?.[2]?.trim() };
  }).filter((entry) => entry.path);
  if (entries.length < 3) return undefined;

  const paths = entries.map(({ path }) => path.replace(/^\.\//, '').replace(/\/+$/, ''));
  const roots = paths.map((path) => path.split('/')[0]).filter(Boolean);
  if (!paths.some((path) => path.includes('/')) || !roots.length || !roots.every((root) => root === roots[0])) return undefined;

  const root: TreeNode = { name: `${roots[0]}/`, folder: true, children: new Map() };
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const segments = paths[index]!.split('/').filter(Boolean);
    if (segments[0] !== roots[0]) return undefined;
    if (segments.length === 1) {
      root.folder = entry.path.endsWith('/');
      root.name = `${segments[0]}${root.folder ? '/' : ''}`;
      root.comment = entry.comment ?? root.comment;
      continue;
    }
    let parent = root;
    for (let partIndex = 1; partIndex < segments.length; partIndex += 1) {
      const name = segments[partIndex]!;
      const last = partIndex === segments.length - 1;
      const folder = !last || entry.path.endsWith('/');
      let node = parent.children.get(name);
      if (!node) {
        node = { name: `${name}${folder ? '/' : ''}`, folder, children: new Map() };
        parent.children.set(name, node);
      } else if (folder) {
        node.folder = true;
        node.name = `${name}/`;
      }
      if (last && entry.comment) node.comment = entry.comment;
      parent = node;
    }
  }

  const output = [`${root.name}${root.comment ? ` # ${root.comment}` : ''}`];
  const renderChildren = (node: TreeNode, prefix: string) => {
    const children = [...node.children.values()];
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      output.push(`${prefix}${last ? '└──' : '├──'} ${child.name}${child.comment ? ` # ${child.comment}` : ''}`);
      renderChildren(child, `${prefix}${last ? '    ' : '│   '}`);
    });
  };
  renderChildren(root, '');
  return output.join('\n');
}

function renderCodeBlock(value: string, language: string): string {
  const tree = renderFileTree(value);
  if (tree) return tree;
  const languageAttribute = language ? ` data-language="${escapeHtml(language)}"` : '';
  return `<pre${languageAttribute}><code>${escapeHtml(value.replace(/^\n+|\n+$/g, ''))}</code></pre>`;
}

export function renderPlanMarkdown(source: string): string {
  const lines = source.replace(/\r/g, '').split('\n');
  const result: string[] = [];
  let list: 'ul' | 'ol' | undefined;
  const closeList = () => {
    if (list) result.push(`</${list}>`);
    list = undefined;
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const fence = /^```\s*([^\s`]*)/.exec(line.trim());
    if (fence) {
      closeList();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index]!.trim())) {
        code.push(lines[index]!);
        index += 1;
      }
      result.push(renderCodeBlock(code.join('\n'), fence[1] ?? ''));
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(4, heading[1]!.length + 1);
      result.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
      continue;
    }
    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const nextList = unordered ? 'ul' : 'ol';
      if (list !== nextList) {
        closeList();
        list = nextList;
        result.push(`<${nextList}>`);
      }
      result.push(`<li>${inlineMarkdown((unordered ?? ordered)![1]!)}</li>`);
      continue;
    }
    closeList();
    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) result.push(`<blockquote>${inlineMarkdown(quote[1]!)}</blockquote>`);
    else if (line.trim()) result.push(`<p>${inlineMarkdown(line.trim())}</p>`);
  }
  closeList();
  return result.join('\n');
}

export function planDocumentTitle(plan: string, prompt: string): string {
  const heading = /^#{1,2}\s+(.+)$/m.exec(plan)?.[1]?.replace(/[*_`]/g, '').trim();
  const fallback = prompt.replace(/\s+/g, ' ').trim();
  const title = heading || fallback || 'Implementation Plan';
  return title.length > 78 ? `${title.slice(0, 75).trim()}...` : title;
}

export function renderPlanDocumentHtml(webview: Pick<vscode.Webview, 'cspSource'>, data: PlanDocumentData): string {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const documentBody = data.plan.replace(/^#{1,2}\s+[^\n]+\n+/, '');
  const en = data.language === 'en';
  const copy = en ? 'Copy' : 'Sao chép';
  const save = en ? 'Save Markdown' : 'Lưu Markdown';
  const revise = en ? 'Request changes' : 'Yêu cầu chỉnh sửa';
  const proceed = en ? 'Proceed' : 'Thực hiện';
  const review = en ? 'Review' : 'Review';
  const reviewTitle = en ? 'Review before implementation' : 'Kiểm tra trước khi thực hiện';
  const reviewBody = en
    ? 'No workspace files have been changed. Continue only when this plan matches what you want.'
    : 'Chưa có file nào trong workspace bị thay đổi. Chỉ tiếp tục khi kế hoạch này đúng với điều bạn muốn.';
  const generated = new Intl.DateTimeFormat(data.language === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(data.createdAt);
  const promptSummary = data.prompt.length > 320 ? `${data.prompt.slice(0, 317).trim()}...` : data.prompt;
  const icon = (name: keyof typeof UI_ICONS) => inlineIcon(UI_ICONS[name]);
  return `<!doctype html>
<html lang="${en ? 'en' : 'vi'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>${escapeHtml(data.title)}</title><style>
:root{color-scheme:light dark;--bg:var(--vscode-editor-background);--fg:var(--vscode-editor-foreground);--muted:var(--vscode-descriptionForeground);--line:var(--vscode-panel-border);--surface:var(--vscode-editorWidget-background);--hover:var(--vscode-toolbar-hoverBackground);--accent:var(--vscode-button-background);--accentFg:var(--vscode-button-foreground);--focus:var(--vscode-focusBorder);--code:var(--vscode-textCodeBlock-background)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.65 var(--vscode-font-family);-webkit-font-smoothing:antialiased}.shell{min-height:100vh}.toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;min-height:62px;padding:10px clamp(20px,5vw,64px);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(14px)}.identity{min-width:0;flex:1}.identity-row{display:flex;align-items:baseline;gap:10px}.identity strong{font-size:14px}.identity span{color:var(--muted);font-size:11px;white-space:nowrap}.actions{display:flex;align-items:center;gap:8px}button,summary{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 12px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--fg);font:600 12px var(--vscode-font-family);cursor:pointer;white-space:nowrap}button:hover,summary:hover{background:var(--hover)}button:focus-visible,summary:focus-visible,a:focus-visible{outline:1px solid var(--focus);outline-offset:2px}.primary{border-color:transparent;background:var(--accent);color:var(--accentFg)}.primary:hover{background:var(--vscode-button-hoverBackground)}.symbol{display:grid;width:16px;height:16px;place-items:center}.symbol img,.symbol svg{display:block;width:16px;height:16px;fill:currentColor}.review-menu{position:relative}.review-menu>summary{list-style:none}.review-menu>summary::-webkit-details-marker{display:none}.menu{position:absolute;top:40px;right:0;width:210px;padding:6px;border:1px solid var(--line);border-radius:9px;background:var(--surface);box-shadow:0 12px 32px rgb(0 0 0/.28)}.menu button{width:100%;justify-content:flex-start;border:0;background:transparent}.content{width:min(920px,calc(100% - 40px));margin:0 auto;padding:48px 0 96px}.hero{padding-bottom:26px;border-bottom:1px solid var(--line)}.kicker{margin:0 0 8px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.hero h1{max-width:780px;margin:0;font-size:clamp(24px,3.8vw,38px);line-height:1.15;letter-spacing:-.025em}.summary{max-width:760px;margin:14px 0 0;color:var(--muted)}.review-note{display:grid;grid-template-columns:34px 1fr;gap:13px;margin:28px 0 38px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--focus) 55%,var(--line));border-left:3px solid var(--focus);border-radius:9px;background:color-mix(in srgb,var(--surface) 82%,transparent)}.review-note .symbol{width:28px;height:28px;color:var(--focus)}.review-note strong,.review-note span{display:block}.review-note span{margin-top:2px;color:var(--muted);font-size:12px}.document{max-width:820px}.document h2{margin:38px 0 12px;font-size:22px;line-height:1.25;letter-spacing:-.015em}.document h3{margin:30px 0 10px;font-size:17px}.document h4{margin:24px 0 8px;font-size:14px}.document p{margin:10px 0}.document ul,.document ol{margin:10px 0 18px;padding-left:25px}.document li{margin:6px 0}.document strong{font-weight:650}.document code{padding:2px 5px;border-radius:4px;background:var(--code);font-family:var(--vscode-editor-font-family);font-size:.92em}.document pre{overflow:auto;padding:15px;border:1px solid var(--line);border-radius:8px;background:var(--code)}.document pre code{padding:0;background:transparent}.document blockquote{margin:18px 0;padding:12px 16px;border-left:3px solid var(--focus);background:var(--surface);color:var(--muted)}.document a{color:var(--vscode-textLink-foreground);text-decoration:none}.document a:hover{text-decoration:underline}.mobile-proceed{display:none}
@media(max-width:620px){.toolbar{align-items:flex-start;padding:10px 14px}.identity-row{display:block}.identity span{display:block;margin-top:2px}.actions>button:not(.primary),.review-menu{display:none}.content{width:calc(100% - 28px);padding-top:30px}.hero h1{font-size:25px}.mobile-proceed{display:flex;position:fixed;right:14px;bottom:14px;z-index:6;box-shadow:0 8px 24px rgb(0 0 0/.3)}}
.file-tree-code{margin:16px 0 24px;border:1px solid var(--line);border-radius:9px;background:var(--code);overflow:hidden}.tree-code-toolbar{display:flex;align-items:center;min-height:34px;padding:0 10px;border-bottom:1px solid var(--line);color:var(--muted);font:11px var(--vscode-font-family)}.tree-code-toolbar>span{flex:1}.tree-code-toolbar button{height:26px;padding:0 5px;border:0;background:transparent;color:var(--muted);font-size:11px;font-weight:500}.tree-code-toolbar button:hover{background:var(--hover);color:var(--fg)}.tree-code-toolbar .symbol,.tree-code-toolbar .symbol svg{width:14px;height:14px}.document .file-tree-code pre{max-height:480px;margin:0;padding:16px;border:0;border-radius:0;background:transparent;scrollbar-width:thin}.document .file-tree-code pre code{display:block;min-width:max-content;color:var(--fg);font:12px/1.72 var(--vscode-editor-font-family);white-space:pre}.tree-connector{color:color-mix(in srgb,var(--fg) 58%,transparent);font-weight:450}.tree-node{color:color-mix(in srgb,var(--fg) 96%,white);font-weight:650}.tree-comment{color:color-mix(in srgb,var(--muted) 78%,transparent);font-weight:400}
@media(max-width:620px){.document .file-tree-code pre{padding:13px}.document .file-tree-code pre code{font-size:11px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style></head><body><main class="shell">
<header class="toolbar"><div class="identity"><div class="identity-row"><strong>Implementation Plan</strong><span>${escapeHtml(generated)}</span></div></div><div class="actions">
<button id="copy"><span class="symbol">${icon('copy')}</span>${copy}</button>
<details class="review-menu"><summary>${review}<span class="symbol">${icon('caretDown')}</span></summary><div class="menu"><button id="save"><span class="symbol">${icon('downloadSimple')}</span>${save}</button><button id="revise"><span class="symbol">${icon('chatCircle')}</span>${revise}</button></div></details>
<button class="primary proceed" type="button"><span class="symbol">${icon('checkCircle')}</span>${proceed}</button></div></header>
<article class="content"><section class="hero"><p class="kicker">RelayCode Plan</p><h1>${escapeHtml(data.title)}</h1><p class="summary">${escapeHtml(promptSummary)}</p></section>
<aside class="review-note"><span class="symbol">${icon('info')}</span><div><strong>${reviewTitle}</strong><span>${reviewBody}</span></div></aside>
<section class="document">${renderPlanMarkdown(documentBody)}</section></article>
<button class="primary mobile-proceed proceed" type="button"><span class="symbol">${icon('checkCircle')}</span>${proceed}</button>
</main><script nonce="${nonce}">const vscode=acquireVsCodeApi();const plan=${JSON.stringify(data.plan)};
document.getElementById('copy').addEventListener('click',async()=>{await navigator.clipboard.writeText(plan);document.getElementById('copy').lastChild.textContent=${JSON.stringify(en ? 'Copied' : 'Đã sao chép')};});
document.getElementById('save').addEventListener('click',()=>vscode.postMessage({type:'save'}));
document.getElementById('revise').addEventListener('click',()=>vscode.postMessage({type:'revise'}));
document.querySelectorAll('.tree-copy').forEach(button=>button.addEventListener('click',async()=>{await navigator.clipboard.writeText(decodeURIComponent(button.dataset.tree||''));const label=button.querySelector('span:last-child');if(label){const original=label.textContent;label.textContent=${JSON.stringify(en ? 'Copied' : 'Đã sao chép')};setTimeout(()=>label.textContent=original,1400);}}));
document.querySelectorAll('.proceed').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.proceed').forEach(item=>{item.disabled=true;item.lastChild.textContent=${JSON.stringify(en ? 'Starting...' : 'Đang bắt đầu...')};});vscode.postMessage({type:'proceed'});}));
window.addEventListener('message',({data})=>{if(data.type==='proceedReady')document.querySelectorAll('.proceed').forEach(item=>{item.disabled=false;item.lastChild.textContent=${JSON.stringify(proceed)};});});
document.querySelectorAll('[data-external]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();vscode.postMessage({type:'openExternal',url:link.dataset.external});}));
</script></body></html>`;
}
