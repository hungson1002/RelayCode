import { describe, expect, it } from 'vitest';
import { detectResponseLanguage, responseLanguageInstruction } from '../src/responseLanguage';

describe('response language detection', () => {
  it('detects Vietnamese even when the message contains technical English', () => {
    expect(detectResponseLanguage('Giúp tôi sửa lỗi trong API này')).toBe('vi');
  });

  it('detects English prompts independently of the interface language', () => {
    expect(detectResponseLanguage('Please explain how to fix this API error')).toBe('en');
  });

  it('lets the model preserve an unrecognised language instead of forcing Vietnamese', () => {
    expect(detectResponseLanguage('¿Puedes explicar este error?')).toBe('same');
  });

  it('falls back to the configured language for an empty prompt', () => {
    expect(detectResponseLanguage('', 'en')).toBe('en');
  });

  it('creates an explicit same-language instruction', () => {
    expect(responseLanguageInstruction('same')).toContain('same natural language');
  });
});
