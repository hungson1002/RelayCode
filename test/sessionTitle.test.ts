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
});
