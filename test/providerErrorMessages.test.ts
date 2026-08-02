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

  it('explains an HTML 404 as an endpoint problem instead of showing the document', () => {
    const raw = 'HTTP 404 · <!DOCTYPE html><html><head><title>Not found</title></head></html>';
    expect(localizeProviderError(raw, 'vi')).toContain('Endpoint không tồn tại');
    expect(localizeProviderError(raw, 'en')).toContain('Endpoint not found');
    expect(localizeProviderError(raw, 'en')).not.toContain('<!DOCTYPE');
  });

  it('explains malformed URLs and unreachable providers', () => {
    expect(localizeProviderError('Invalid URL', 'vi')).toContain('URL hợp lệ');
    expect(localizeProviderError('fetch failed', 'en')).toContain('Could not reach the endpoint');
  });
});
