import { describe, expect, it } from 'vitest';
import { smartSessionTitle } from '../src/sessionTitle';

describe('smartSessionTitle', () => {
  it('removes greetings and preserves technical acronyms', () => {
    expect(smartSessionTitle('xin chào, tạo file html')).toBe('Tạo file HTML');
    expect(smartSessionTitle('Hi!')).toBe('Hi');
  });

  it('removes repeated conversational filler', () => {
    expect(smartSessionTitle('Bạn có thể giúp tôi sửa lỗi đăng nhập?')).toBe('Sửa lỗi đăng nhập');
    expect(smartSessionTitle('Tôi muốn làm UI cho trang quản lý API.')).toBe('Làm UI cho trang quản lý API');
  });

  it('uses the first goal and keeps long titles compact', () => {
    expect(smartSessionTitle('Sửa responsive dropdown. Sau đó chạy test.')).toBe('Sửa responsive dropdown');
    expect(smartSessionTitle('Hãy xây dựng một bảng điều khiển quản trị người dùng có bộ lọc trạng thái và phân trang phía máy chủ').length).toBeLessThanOrEqual(53);
  });

  it('keeps short greetings natural and summarizes question lead-ins', () => {
    expect(smartSessionTitle('Broooo')).toBe('Broooo');
    expect(smartSessionTitle('Xin chào!')).toBe('Xin chào');
    expect(smartSessionTitle('Có cách nào để sửa lỗi đăng nhập không?')).toBe('Cách sửa lỗi đăng nhập');
    expect(smartSessionTitle('How can I debug this API error?')).toBe('How to debug this API error');
  });

  it('removes trailing conversational filler', () => {
    expect(smartSessionTitle('Tạo một bảng usage giúp tôi nhé')).toBe('Tạo một bảng usage');
  });
});
