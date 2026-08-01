import { describe, expect, it } from 'vitest';
import { localizeProviderError } from '../src/providerErrorMessages';

describe('localizeProviderError', () => {
  it('translates invalid model errors using the selected UI language', () => {
    const raw = 'HTTP 400 · Invalid model ID. Please select a different model. INVALID_MODEL_ID';
    expect(localizeProviderError(raw, 'vi')).toContain('ID model không hợp lệ');
    expect(localizeProviderError(raw, 'en')).toContain('model ID is invalid');
  });

  it('does not report a timeout as a confirmed unavailable model', () => {
    expect(localizeProviderError('The operation was aborted due to timeout', 'vi'))
      .toContain('không có nghĩa là model không dùng được');
  });
});
