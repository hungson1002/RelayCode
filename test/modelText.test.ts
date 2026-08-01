import { describe, expect, it } from 'vitest';
import { sanitizeModelText } from '../src/modelText';

describe('sanitizeModelText', () => {
  it('removes leaked DSML tool-call markers and adjacent stray backticks', () => {
    expect(sanitizeModelText('Đang kiểm tra. ` <｜DSML｜function_calls`'))
      .toBe('Đang kiểm tra. ');
    expect(sanitizeModelText('Before <|DSML|tool_calls> after')).toBe('Before  after');
  });

  it('preserves normal inline code and prose', () => {
    expect(sanitizeModelText('Dùng `npm test` để kiểm tra.')).toBe('Dùng `npm test` để kiểm tra.');
  });
});
