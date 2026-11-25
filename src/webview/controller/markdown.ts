export const CHAT_CONTROLLER_MARKDOWN = String.raw`function formatCompact(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, notation: 'compact' }).format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function fileTypeIcon(path) {
  const icon = fileUiIcon(String(path || '').replace(/:\d+(?::\d+)?$/, ''));
  return '<span class="file-type-icon ' + icon + '" data-file-kind="' + icon + '" aria-hidden="true">'
    + uiIcon(icon)
    + '</span>';
}

function inlineMarkdown(source) {
  const tokens = [];
  const reserve = (html) => {
    const token = '\u0000' + tokens.length + '\u0000';
    tokens.push(html);
    return token;
  };
  let text = escapeHtml(source);
  text = text.replace(/\x60([^\x60\r\n]+)\x60/g, (_, code) => {
    const plain = String(code).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const looksLikeUrl = /^https?:\/\//i.test(plain);
    const looksLikeFile = !looksLikeUrl && /^(?:[a-z]:[\\/]|\.{0,2}[\\/])?.+\.[a-z0-9]{1,10}(?::\d+(?::\d+)?)?$/i.test(plain);
    const looksLikeProse = plain.length > 90 && plain.trim().split(/\s+/).length > 14 && !/[{};=]/.test(plain);
    if (looksLikeProse) return code;
    return reserve(looksLikeFile
      ? '<button type="button" class="file-link" data-file="' + encodeURIComponent(plain) + '">' + fileTypeIcon(plain) + '<span>' + code + '</span></button>'
      : '<code class="inline-code">' + code + '</code>');
  });
  text = text.replace(/\(\[([^\]]+)\]\((https?:\/\/[^)]+)\)\)/gi, (_, label, rawTarget) => {
    const target = String(rawTarget).replace(/&amp;/g, '&');
    return reserve('<span class="rich-link-group">(' + richLinkMarkup(target, label) + ')</span>');
  });
  text = text.replace(/\((https?:\/\/[^\s<)]+)\)/gi, (_, rawTarget) => {
    const target = String(rawTarget).replace(/&amp;/g, '&');
    return reserve('<span class="rich-link-group">(' + richLinkMarkup(target) + ')</span>');
  });
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, rawTarget) => {
    const target = String(rawTarget).replace(/&amp;/g, '&');
    if (/^https?:\/\//i.test(target)) {
      return reserve(richLinkMarkup(target, label));
    }
    const location = target.match(/:(\d+)(?::\d+)?$/);
    const line = location && !/\bline\s+\d+/i.test(label) ? '<span class="file-line">(line ' + location[1] + ')</span>' : '';
    return reserve('<button type="button" class="file-link" data-file="' + encodeURIComponent(target) + '">' + fileTypeIcon(target) + '<span>' + label + '</span>' + line + '</button>');
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\((\+[\d.,]+)\s+(-[\d.,]+)\)/g, (_, added, removed) => reserve('<span class="diff-inline">(<b class="diff-add">' + added + '</b><b class="diff-remove">' + removed + '</b>)</span>'));
  text = text.replace(/\[((?:\d{1,2}:)?\d{1,2}:\d{2})\]/g, (_, stamp) => {
    const parts = String(stamp).split(':').map(Number);
    const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    return reserve('<button type="button" class="video-timestamp-link" data-video-ts="' + seconds + '">' + stamp + '</button>');
  });
  text = text.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (_, prefix, rawUrl) => {
    const trimmed = String(rawUrl).replace(/[.,;:!?)]+$/, '');
    const trailing = String(rawUrl).slice(trimmed.length);
    const target = trimmed.replace(/&amp;/g, '&');
    return prefix + reserve(richLinkMarkup(target)) + trailing;
  });
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
}

function compactExternalLink(target, explicitLabel = '') {
  if (explicitLabel) return explicitLabel;
  // Preserve exactly what the user pasted. The icon and blue treatment are
  // enough visual affordance; silently dropping protocol/port changes content.
  return escapeHtml(target);
}

function richLinkMarkup(target, explicitLabel = '') {
  const label = compactExternalLink(target, explicitLabel);
  let isGithub = false;
  try { isGithub = new URL(target).hostname.replace(/^www\./, '') === 'github.com'; } catch {}
  const icon = isGithub ? brandIcon('github', 'GitHub') : uiIcon('globe');
  return '<button type="button" class="rich-link" data-url="' + encodeURIComponent(target) + '"><span class="rich-link-icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span></button>';
}

function bindRichContent(container) {
  container.querySelectorAll('[data-url]').forEach((item) => item.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternal', url: decodeURIComponent(item.dataset.url) });
  }));
  container.querySelectorAll('[data-file]').forEach((item) => item.addEventListener('click', () => {
    vscode.postMessage({ type: 'openFile', path: decodeURIComponent(item.dataset.file) });
  }));
  container.querySelectorAll('[data-code-copy]').forEach((button) => button.addEventListener('click', async () => {
    const value = decodeURIComponent(button.dataset.codeCopy || '');
    await navigator.clipboard.writeText(value);
    button.classList.add('copied');
    button.innerHTML = uiIcon('check');
    button.setAttribute('aria-label', uiCopy('Đã sao chép', 'Copied'));
    if (typeof refreshFloatingHint === 'function') refreshFloatingHint(button);
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.classList.remove('copied');
      button.innerHTML = uiIcon('copy');
      button.setAttribute('aria-label', uiCopy('Sao chép', 'Copy'));
      if (typeof refreshFloatingHint === 'function') refreshFloatingHint(button);
    }, 1400);
  }));
  container.querySelectorAll('[data-code-insert]').forEach((button) => button.addEventListener('click', () => {
    const value = decodeURIComponent(button.dataset.codeInsert || '');
    vscode.postMessage({ type: 'insertCode', code: value });
    button.classList.add('copied');
    button.setAttribute('aria-label', uiCopy('Đã chèn vào editor', 'Inserted into editor'));
    if (typeof refreshFloatingHint === 'function') refreshFloatingHint(button);
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.classList.remove('copied');
      button.setAttribute('aria-label', uiCopy('Chèn vào editor', 'Insert at cursor'));
      if (typeof refreshFloatingHint === 'function') refreshFloatingHint(button);
    }, 1200);
  }));
  container.querySelectorAll('[data-code-run]').forEach((button) => button.addEventListener('click', () => {
    const command = decodeURIComponent(button.dataset.codeRun || '').replace(/^\$\s*/gm, '').trim();
    if (command) vscode.postMessage({ type: 'runCodeBlock', command });
  }));
  container.querySelectorAll('[data-video-ts]').forEach((button) => button.addEventListener('click', () => {
    if (typeof seekChatVideoTo === 'function') seekChatVideoTo(Number(button.dataset.videoTs || 0));
  }));
}

function updateTaskChoiceButtons() {
  document.querySelectorAll('.task-continue').forEach((button) => {
    button.disabled = running;
    button.setAttribute('aria-disabled', String(running));
  });
}

function submitTaskChoices(container) {
  if (running) return;
  const choices = [...container.querySelectorAll('.task-checkbox')];
  if (!choices.length) return;
  const lines = choices.map((choice) => {
    const label = choice.getAttribute('aria-label') || '';
    return '- [' + (choice.checked ? 'x' : ' ') + '] ' + label;
  });
  const prompt = uiCopy(
    'Tôi đã chọn các mục sau:\n' + lines.join('\n') + '\n\nHãy tiếp tục dựa trên các lựa chọn này.',
    'I selected the following options:\n' + lines.join('\n') + '\n\nPlease continue based on these selections.'
  );
  $('prompt').value = prompt;
  resizePrompt();
  updateSendState();
  send();
}

function bindTaskChoices(container, previousState = new Map(), choiceHost = container) {
  const choices = [...container.querySelectorAll('.task-checkbox')];
  if (!choices.length) return;
  choices.forEach((choice) => {
    const key = choice.dataset.taskIndex;
    if (previousState.has(key)) choice.checked = previousState.get(key);
  });
  const actions = document.createElement('div');
  actions.className = 'task-choice-actions';
  const continueButton = document.createElement('button');
  continueButton.type = 'button';
  continueButton.className = 'task-continue';
  continueButton.innerHTML = uiIcon('arrowRight') + '<span>' + uiCopy('Tiếp tục với lựa chọn', 'Continue with selections') + '</span>';
  continueButton.addEventListener('click', () => submitTaskChoices(choiceHost));
  actions.append(continueButton);
  container.append(actions);
  updateTaskChoiceButtons();
}

function splitMarkdownTableRow(source) {
  const text = String(source || '').trim();
  if (!text.includes('|')) return null;
  const cells = [];
  let cell = '';
  let escaped = false;
  let inCode = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (escaped) {
      cell += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && (text[index + 1] === '|' || text[index + 1] === '\\')) {
      escaped = true;
      continue;
    }
    if (char === '\x60') {
      inCode = !inCode;
      cell += char;
      continue;
    }
    if (char === '|' && !inCode) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  if (text.startsWith('|')) cells.shift();
  if (text.endsWith('|')) cells.pop();
  return cells.length >= 2 ? cells : null;
}

function markdownTableAlignment(cell) {
  const marker = String(cell || '').replace(/\s+/g, '');
  if (!/^:?-{3,}:?$/.test(marker)) return null;
  if (marker.startsWith(':') && marker.endsWith(':')) return 'center';
  if (marker.endsWith(':')) return 'right';
  return 'left';
}

function renderMarkdownTable(headers, alignments, rows) {
  const renderCell = (tag, value, index) => '<' + tag + ' class="align-' + (alignments[index] || 'left') + '">' + inlineMarkdown(value || '') + '</' + tag + '>';
  const head = '<thead><tr>' + headers.map((cell, index) => renderCell('th', cell, index)).join('') + '</tr></thead>';
  const body = rows.length
    ? '<tbody>' + rows.map(row => '<tr>' + headers.map((_, index) => renderCell('td', row[index] || '', index)).join('') + '</tr>').join('') + '</tbody>'
    : '';
  return '<div class="markdown-table-wrap"><table class="markdown-table">' + head + body + '</table></div>';
}

function renderCodeBlock(lines, languageHint = '') {
  const rawContent = lines.join('\n');
  const content = escapeHtml(rawContent);
  const languageName = String(languageHint || '').toLowerCase();
  const commands = lines.map((line) => line.trim()).filter(Boolean);
  const explicitShell = /^(?:sh|shell|bash|zsh|fish|powershell|ps1|cmd|console|terminal)$/.test(languageName);
  const inferredShell = commands.length > 0 && commands.every((line) => /^(?:\$\s*)?(?:npm|pnpm|yarn|bun|npx|node|deno|python|python3|pip|pip3|uv|git|cargo|go|dotnet|code|docker|docker-compose|make|cmake|gradle|mvn)\b/i.test(line));
  if (explicitShell || inferredShell) {
    const encoded = encodeURIComponent(rawContent);
    return '<div class="markdown-terminal"><div class="markdown-terminal-head"><span aria-hidden="true">' + uiIcon('terminalWindow') + '</span><b>Terminal</b><div class="markdown-code-actions"><button type="button" class="markdown-code-run" data-code-run="' + encoded + '" aria-label="' + uiCopy('Chạy trong Terminal', 'Run in Terminal') + '">' + uiIcon('arrowRight') + '<span>' + uiCopy('Chạy', 'Run') + '</span></button><button type="button" class="markdown-code-copy" data-code-copy="' + encoded + '" aria-label="' + uiCopy('Sao chép', 'Copy') + '">' + uiIcon('copy') + '</button></div></div><div class="markdown-terminal-code"><code>' + content + '</code></div></div>';
  }
  const labels = { text: 'Plain text', plaintext: 'Plain text', txt: 'Plain text', json: 'JSON', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript', html: 'HTML', css: 'CSS', markdown: 'Markdown', md: 'Markdown', python: 'Python', py: 'Python' };
  const label = labels[languageName] || (languageName ? languageName.charAt(0).toUpperCase() + languageName.slice(1) : 'Plain text');
  const encoded = encodeURIComponent(rawContent);
  return '<div class="markdown-code-block"><div class="markdown-code-head"><span>' + escapeHtml(label) + '</span><div class="markdown-code-actions"><button type="button" class="markdown-code-insert" data-code-insert="' + encoded + '" aria-label="' + uiCopy('Chèn vào editor', 'Insert at cursor') + '">' + uiIcon('plus') + '<span>' + uiCopy('Chèn', 'Insert') + '</span></button><button type="button" class="markdown-code-copy" data-code-copy="' + encoded + '" aria-label="' + uiCopy('Sao chép', 'Copy') + '">' + uiIcon('copy') + '</button></div></div><pre><code>' + content + '</code></pre></div>';
}

function renderMarkdownInto(container, source, choiceHost = container) {
  const rawLines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  let insideFence = false;
  const lines = rawLines.map((line) => {
    if (/^\s*\x60{3}/.test(line)) {
      insideFence = !insideFence;
      return line;
    }
    if (insideFence) return line;
    return line
      .replace(/(?:\x60{1,3}[ \t]*)?(?:<|＜)?[|｜][ \t]*DSML[ \t]*[|｜][ \t]*(?:function_calls?|tool_calls?)(?:>|＞)?(?:[ \t]*\x60{1,3})?/giu, '')
      .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, '');
  });
  let html = '';
  let list = '';
  let paragraph = [];
  let code = [];
  let inCode = false;
  let codeLanguage = '';
  let taskIndex = 0;
  const previousTaskState = new Map([...container.querySelectorAll('.task-checkbox')].map((choice) => [choice.dataset.taskIndex, choice.checked]));
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += '<p>' + paragraph.map(inlineMarkdown).join('<br>') + '</p>';
    paragraph = [];
  };
  const closeList = () => {
    if (!list) return;
    html += '</' + list + '>';
    list = '';
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const fence = line.match(/^\s*\x60{3}\s*([\w+-]*)/);
    if (fence) {
      flushParagraph(); closeList();
      if (inCode) {
        html += renderCodeBlock(code, codeLanguage);
        code = [];
        codeLanguage = '';
      } else {
        codeLanguage = fence[1] || '';
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const tableHeaders = splitMarkdownTableRow(line);
    const tableSeparators = tableHeaders && lineIndex + 1 < lines.length
      ? splitMarkdownTableRow(lines[lineIndex + 1])
      : null;
    const tableAlignments = tableSeparators?.map(markdownTableAlignment) || [];
    if (tableHeaders && tableSeparators && tableHeaders.length === tableSeparators.length && tableAlignments.every(Boolean)) {
      flushParagraph(); closeList();
      const rows = [];
      lineIndex += 2;
      while (lineIndex < lines.length) {
        const row = splitMarkdownTableRow(lines[lineIndex]);
        if (!row) break;
        rows.push(row);
        lineIndex++;
      }
      lineIndex--;
      html += renderMarkdownTable(tableHeaders, tableAlignments, rows);
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const nextList = bullet ? 'ul' : 'ol';
      if (list !== nextList) { closeList(); list = nextList; html += '<' + list + '>'; }
      const listText = (bullet || numbered)[1];
      const task = bullet && listText.match(/^\[(x| )\]\s+(.+)$/i);
      if (task) {
        const checked = task[1].toLowerCase() === 'x';
        html += '<li class="task-item"><input type="checkbox" class="task-checkbox" data-task-index="' + taskIndex + '" aria-label="' + escapeHtml(task[2]) + '"' + (checked ? ' checked' : '') + '>' + inlineMarkdown(task[2]) + '</li>';
        taskIndex++;
      } else {
        html += '<li>' + inlineMarkdown(listText) + '</li>';
      }
      continue;
    }
    closeList();
    const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(4, heading[1].length + 1);
      html += '<h' + level + '>' + inlineMarkdown(heading[2]) + '</h' + level + '>';
      continue;
    }
    const quote = line.match(/^\s*>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      html += '<blockquote>' + inlineMarkdown(quote[1]) + '</blockquote>';
      continue;
    }
    if (!line.trim()) { flushParagraph(); continue; }
    paragraph.push(line);
  }
  flushParagraph(); closeList();
  if (inCode || code.length) html += renderCodeBlock(code, codeLanguage);
  container.innerHTML = html;
  bindRichContent(container);
  bindTaskChoices(container, previousTaskState, choiceHost);
}

`;
