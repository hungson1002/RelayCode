export const CHAT_CONTROLLER_STREAMING = String.raw`function flushAssistantText() {
  if (assistantRenderFrame) { cancelAnimationFrame(assistantRenderFrame); assistantRenderFrame = 0; }
  assistantLastRenderAt = 0;
  assistantCharacterBudget = 0;
  if (assistantMarkdownTimer) { clearTimeout(assistantMarkdownTimer); assistantMarkdownTimer = 0; }
  if (assistantBody && pendingAssistantText) {
    assistantRawText += pendingAssistantText;
    renderMarkdownInto(assistantBody, assistantRawText);
    assistantStreamTextNode = null;
    assistantMarkdownRenderedLength = assistantRawText.length;
    const item = assistantBody.closest('.message');
    if (item) item.dataset.rawContent = assistantRawText;
  } else if (assistantBody && assistantStreamTextNode) {
    // Streaming uses one cheap text node so incoming tokens never rebuild the
    // whole Markdown tree. Materialize the rich result once the stream pauses.
    renderMarkdownInto(assistantBody, assistantRawText);
    assistantStreamTextNode = null;
    assistantMarkdownRenderedLength = assistantRawText.length;
  }
  pendingAssistantText = '';
}

function appendStreamingAssistantText(chunk) {
  if (!assistantBody || !chunk) return;
  if (assistantMarkdownRenderedLength > assistantRawText.length) assistantMarkdownRenderedLength = 0;
  if (!assistantStreamTextNode || !assistantStreamTextNode.isConnected || assistantStreamTextNode.parentElement?.parentElement !== assistantBody) {
    const liveCopy = document.createElement('span');
    liveCopy.className = 'streaming-plain-copy';
    assistantStreamTextNode = document.createTextNode(assistantRawText.slice(assistantMarkdownRenderedLength));
    liveCopy.append(assistantStreamTextNode);
    assistantBody.append(liveCopy);
  } else {
    assistantStreamTextNode.appendData(chunk);
  }
  scheduleStreamingMarkdown();
}

function completedStreamingMarkdownLength(source) {
  let inCodeFence = false;
  let stableLength = 0;
  const completeLine = /([^\r\n]*)(?:\r\n|\n|\r)/g;
  let match;
  while ((match = completeLine.exec(source)) !== null) {
    const line = match[1];
    const lineEnd = match.index + match[0].length;
    if (/^\s*\x60{3}/.test(line)) {
      inCodeFence = !inCodeFence;
      if (!inCodeFence) stableLength = lineEnd;
      continue;
    }
    if (inCodeFence) continue;
    if (!line.trim()
      || /^\s*#{1,4}\s+\S/.test(line)
      || /^\s*>\s?\S/.test(line)
      || /^\s*(?:[-*+]\s+(?!\[[x ]\]\s)|\d+[.)]\s+)\S/i.test(line)) {
      stableLength = lineEnd;
    }
  }
  return stableLength;
}

function appendMaterializedMarkdown(source, beforeNode) {
  const staging = document.createElement('div');
  renderMarkdownInto(staging, source);
  const first = staging.firstElementChild;
  const previous = beforeNode?.previousElementSibling || assistantBody?.lastElementChild;
  if (first && previous && /^(UL|OL)$/.test(first.tagName) && previous.tagName === first.tagName) {
    previous.append(...first.childNodes);
    first.remove();
  }
  const fragment = document.createDocumentFragment();
  fragment.append(...staging.childNodes);
  assistantBody?.insertBefore(fragment, beforeNode || null);
}

function materializeStreamingMarkdown() {
  assistantMarkdownTimer = 0;
  if (!assistantBody || !assistantRawText) return;
  const stableLength = completedStreamingMarkdownLength(assistantRawText);
  if (stableLength <= assistantMarkdownRenderedLength) return;
  const liveCopy = assistantStreamTextNode?.parentElement;
  appendMaterializedMarkdown(assistantRawText.slice(assistantMarkdownRenderedLength, stableLength), liveCopy);
  assistantMarkdownRenderedLength = stableLength;
  const liveTail = assistantRawText.slice(stableLength);
  if (assistantStreamTextNode && liveCopy) {
    if (liveTail) assistantStreamTextNode.data = liveTail;
    else { liveCopy.remove(); assistantStreamTextNode = null; }
  }
  const item = assistantBody.closest('.message');
  if (item) item.dataset.rawContent = assistantRawText;
  if (messagesPinnedToBottom) {
    const messageList = $('messages');
    messageList.scrollTop = messageList.scrollHeight;
  }
  updateRunningScrollIndicator();
}

function scheduleStreamingMarkdown() {
  // Materialize only complete blocks; existing rich nodes remain untouched and
  // the unfinished tail stays in one cheap text node, preventing stream jitter.
  if (!assistantBody || assistantMarkdownTimer) return;
  assistantMarkdownTimer = window.setTimeout(materializeStreamingMarkdown, 96);
}

function renderPendingAssistantText(frameTime = performance.now()) {
  assistantRenderFrame = 0;
  if (!assistantBody || !pendingAssistantText) return;
  // Convert bursty provider chunks into a time-based type-in cadence. Small
  // chunks reveal one or two characters per frame; a growing backlog raises
  // the rate gradually so a completed response is never held for too long.
  const previousFrame = assistantLastRenderAt || frameTime - (1000 / 60);
  const elapsedMs = Math.min(34, Math.max(8, frameTime - previousFrame));
  assistantLastRenderAt = frameTime;
  const maximumRate = pendingTurnEnd ? 720 : 420;
  const charactersPerSecond = Math.min(maximumRate, 110 + pendingAssistantText.length * 0.9);
  assistantCharacterBudget = Math.min(12, assistantCharacterBudget + charactersPerSecond * elapsedMs / 1000);
  const charsThisFrame = Math.min(pendingAssistantText.length, Math.max(1, Math.floor(assistantCharacterBudget)));
  assistantCharacterBudget = Math.max(0, assistantCharacterBudget - charsThisFrame);
  const chunk = pendingAssistantText.slice(0, charsThisFrame);
  assistantRawText += chunk;
  pendingAssistantText = pendingAssistantText.slice(charsThisFrame);
  appendStreamingAssistantText(chunk);
  markAssistantOutput();
  if (messagesPinnedToBottom) {
    const messageList = $('messages');
    messageList.scrollTop = messageList.scrollHeight;
  }
  updateRunningScrollIndicator();
  if (pendingAssistantText) {
    scheduleAssistantTextRender();
    return;
  }
  assistantLastRenderAt = 0;
  assistantCharacterBudget = 0;
  if (pendingTurnEnd) {
    const data = pendingTurnEnd;
    pendingTurnEnd = null;
    settleTurn(data);
  }
}

function scheduleAssistantTextRender() {
  if (assistantRenderFrame) return;
  assistantRenderFrame = requestAnimationFrame(renderPendingAssistantText);
}

function scrollMessagesToBottom() {
  const messageList = $('messages');
  messagesPinnedToBottom = true;
  messageList.scrollTop = messageList.scrollHeight;
  updateRunningScrollIndicator();
  // Webview layout can grow after Markdown, activity, and file icons settle.
  requestAnimationFrame(() => {
    messageList.scrollTop = messageList.scrollHeight;
    updateRunningScrollIndicator();
  });
}

function messagesAreNearBottom() {
  const messageList = $('messages');
  return messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 56;
}

function updateRunningScrollIndicator() {
  const indicator = $('runningScrollIndicator');
  if (!indicator) return;
  const atBottom = messagesPinnedToBottom || messagesAreNearBottom();
  indicator.classList.toggle('hidden', atBottom);
  indicator.classList.toggle('is-running', running);
  const indicatorHint = running
    ? uiCopy('Xuống tác vụ đang chạy', 'Jump to the running task')
    : uiCopy('Xuống cuối', 'Jump to the latest message');
  indicator.setAttribute('aria-label', indicatorHint);
}

$('messages').addEventListener('scroll', () => {
  messagesPinnedToBottom = messagesAreNearBottom();
  updateRunningScrollIndicator();
}, { passive: true });
$('runningScrollIndicator').addEventListener('click', scrollMessagesToBottom);

function queueAssistantText(delta) {
  if (!assistantBody || !delta) return;
  pendingAssistantText += delta;
  scheduleAssistantTextRender();
}

function markAssistantOutput() {
  if (assistantHasOutput) return;
  assistantHasOutput = true;
  workingStatus = '';
  updateWorkingLabel();
}

function reconcileFinalAssistantText(content) {
  const finalText = typeof content === 'string' ? content : '';
  if (!assistantBody || !finalText) return;
  const bufferedText = assistantRawText + pendingAssistantText;
  if (bufferedText === finalText) return;
  if (finalText.startsWith(assistantRawText)) {
    pendingAssistantText = finalText.slice(assistantRawText.length);
    if (pendingAssistantText) scheduleAssistantTextRender();
    return;
  }
  if (assistantRenderFrame) { cancelAnimationFrame(assistantRenderFrame); assistantRenderFrame = 0; }
  pendingAssistantText = '';
  assistantRawText = finalText;
  renderMarkdownInto(assistantBody, assistantRawText);
  assistantStreamTextNode = null;
  assistantMarkdownRenderedLength = assistantRawText.length;
  markAssistantOutput();
  const item = assistantBody.closest('.message');
  if (item) item.dataset.rawContent = assistantRawText;
}

`;
