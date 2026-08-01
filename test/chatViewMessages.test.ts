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
    expect(isWebviewMessage({ type: 'getProviderKeyState', provider: 'unknown' })).toBe(false);
  });
});
