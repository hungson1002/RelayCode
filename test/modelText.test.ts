import { describe, expect, it } from 'vitest';
import { sanitizeModelText, sanitizeVisibleModelText } from '../src/modelText';

describe('sanitizeModelText', () => {
  it('removes leaked DSML tool-call markers and adjacent stray backticks', () => {
    expect(sanitizeModelText('Đang kiểm tra. ` <｜DSML｜function_calls`'))
      .toBe('Đang kiểm tra. ');
    expect(sanitizeModelText('Before <|DSML|tool_calls> after')).toBe('Before  after');
  });

  it('preserves normal inline code and prose', () => {
    expect(sanitizeModelText('Dùng `npm test` để kiểm tra.')).toBe('Dùng `npm test` để kiểm tra.');
  });

  it('hides tagged provider reasoning while preserving the final answer', () => {
    expect(sanitizeVisibleModelText('<think>Inspect files and plan the patch.</think>\nĐã sửa lỗi thành công.'))
      .toBe('Đã sửa lỗi thành công.');
    expect(sanitizeVisibleModelText('analysis: inspect and test\nfinal answer: Build đã chạy thành công.'))
      .toBe('Build đã chạy thành công.');
  });

  it('keeps only the answer after a leaked draft self-review', () => {
    const leaked = `Let's write the response.\n\nOutcome: fixed.\n\nLet's count words: about 12 words, within the limit. Excellent.Đã xác định đúng nguyên nhân và sửa thành công.`;
    expect(sanitizeVisibleModelText(leaked)).toBe('Đã xác định đúng nguyên nhân và sửa thành công.');
  });

  it('deduplicates repeated answer blocks without changing normal prose', () => {
    const block = 'Đã sửa bộ lọc asset và kiểm tra lại toàn bộ quá trình giải nén.';
    expect(sanitizeVisibleModelText(`${block}\n\n${block}`)).toBe(block);
    expect(sanitizeVisibleModelText('Phân tích nguyên nhân.\n\nKết quả cuối.')).toBe('Phân tích nguyên nhân.\n\nKết quả cuối.');
  });
});
