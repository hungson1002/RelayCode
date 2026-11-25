import { describe, expect, it } from 'vitest';
import { isWebviewMessage } from '../src/chatViewMessages';

describe('chat webview message validation', () => {
  it('accepts bounded draft diagnostics without requiring a saved profile', () => {
    expect(isWebviewMessage({
      type: 'diagnostics',
      draft: true,
      endpoint: 'http://localhost:20128/v1',
      apiKey: 'draft-key',
      provider: '9router',
      profileId: 'profile-1'
    })).toBe(true);
    expect(isWebviewMessage({ type: 'diagnostics' })).toBe(true);
  });

  it('rejects malformed draft diagnostic payloads', () => {
    expect(isWebviewMessage({ type: 'diagnostics', draft: 'yes' })).toBe(false);
    expect(isWebviewMessage({ type: 'diagnostics', provider: 'unknown' })).toBe(false);
    expect(isWebviewMessage({ type: 'diagnostics', endpoint: 'x'.repeat(4_001) })).toBe(false);
  });

  it('validates provider key-state requests', () => {
    expect(isWebviewMessage({ type: 'getProviderKeyState', provider: 'openai', profileId: 'profile-1' })).toBe(true);
    expect(isWebviewMessage({ type: 'getProviderKeyState', provider: 'opencode', profileId: 'profile-2' })).toBe(true);
    expect(isWebviewMessage({ type: 'getProviderKeyState', provider: 'opencode', requestId: 3 })).toBe(true);
    expect(isWebviewMessage({ type: 'getProviderKeyState', provider: 'unknown' })).toBe(false);
  });

  it('accepts persistent approval decisions', () => {
    expect(isWebviewMessage({ type: 'approval', id: 'approval-1', decision: 'always' })).toBe(true);
    expect(isWebviewMessage({ type: 'approval', id: 'approval-1', decision: 'forever' })).toBe(false);
  });

  it('validates persisted composer preferences without accepting oversized values', () => {
    expect(isWebviewMessage({
      type: 'saveComposerPreferences',
      mode: 'agent',
      model: 'cx/gpt-5.6-luna',
      rememberMode: true,
      reasoningEffort: 'high',
      serviceTier: 'fast'
    })).toBe(true);
    expect(isWebviewMessage({ type: 'saveComposerPreferences', mode: 'sideways' })).toBe(false);
    expect(isWebviewMessage({ type: 'saveComposerPreferences', model: 'x'.repeat(301) })).toBe(false);
  });

  it('validates media picking, external media opening, drag-drop paths and session renaming', () => {
    expect(isWebviewMessage({ type: 'pickFiles', kind: 'media' })).toBe(true);
    expect(isWebviewMessage({ type: 'pickFiles', kind: 'unknown' })).toBe(false);
    expect(isWebviewMessage({ type: 'openMediaExternal', path: 'C:/videos/demo.mp4' })).toBe(true);
    expect(isWebviewMessage({ type: 'openMediaExternal', path: '' })).toBe(false);
    expect(isWebviewMessage({ type: 'attachLocalPaths', paths: ['C:/videos/demo.mp4', 'C:/img/a.png'] })).toBe(true);
    expect(isWebviewMessage({ type: 'attachLocalPaths', paths: [] })).toBe(false);
    expect(isWebviewMessage({ type: 'renameSession', id: 'session-1', title: 'Sửa gửi video' })).toBe(true);
    expect(isWebviewMessage({ type: 'renameSession', id: 'session-1', title: '' })).toBe(false);
    expect(isWebviewMessage({ type: 'togglePinSession', id: 'session-1' })).toBe(true);
    expect(isWebviewMessage({ type: 'exportSessionMarkdown', id: 'session-1' })).toBe(true);
    expect(isWebviewMessage({ type: 'rollbackToTurn', turnIndex: 2 })).toBe(true);
    expect(isWebviewMessage({ type: 'rollbackToTurn', turnIndex: -1 })).toBe(false);
    expect(isWebviewMessage({ type: 'searchWorkspacePaths', kind: 'file', query: 'app', requestId: 1 })).toBe(true);
    expect(isWebviewMessage({ type: 'searchWorkspacePaths', kind: 'unknown', query: 'app' })).toBe(false);
    expect(isWebviewMessage({ type: 'insertCode', code: 'const x = 1;' })).toBe(true);
    expect(isWebviewMessage({ type: 'insertCode', code: '' })).toBe(false);
    expect(isWebviewMessage({ type: 'runCodeBlock', command: 'npm test' })).toBe(true);
    expect(isWebviewMessage({ type: 'runCodeBlock', command: '   ' })).toBe(false);
  });
});
