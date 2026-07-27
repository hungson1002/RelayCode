import { describe, expect, it } from 'vitest';
import { CHAT_VIEW_CONTROLLER } from '../src/webview/chatViewController';
import { renderChatViewHtml } from '../src/webview/chatViewHtml';
import { CHAT_VIEW_STYLES } from '../src/webview/chatViewStyles';

const html = renderChatViewHtml({
  language: 'vi',
  nonce: 'test-nonce',
  cspSource: 'vscode-webview://test',
  styles: CHAT_VIEW_STYLES,
  controller: CHAT_VIEW_CONTROLLER
});

describe('Chat webview assets', () => {
  it('contains valid standalone controller JavaScript', () => {
    expect(() => new Function(CHAT_VIEW_CONTROLLER)).not.toThrow();
  });

  it('renders CSP, styles and controller without the retired review popup', () => {
    expect(html).toContain("script-src 'nonce-test-nonce'");
    expect(html).toContain(CHAT_VIEW_STYLES);
    expect(html).toContain(CHAT_VIEW_CONTROLLER);
    expect(html).not.toContain('changeReviewPanel');
  });

  it('defines every element ID accessed through the controller helper exactly once', () => {
    const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]!);
    const controllerIds = [...CHAT_VIEW_CONTROLLER.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]!);
    const missing = [...new Set(controllerIds)].filter((id) => !htmlIds.includes(id));
    const duplicates = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
    expect(missing).toEqual([]);
    expect([...new Set(duplicates)]).toEqual([]);
  });
});
