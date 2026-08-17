import { describe, expect, it } from 'vitest';
import { smartSessionTitle, smartSessionTitleFromTurns } from '../src/sessionTitle';

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

  it('uses the subject instead of conversational question filler', () => {
    expect(smartSessionTitle('Có biết về tool 9Router không')).toBe('9Router');
    expect(smartSessionTitle('Nhé, bạn có biết 9Router')).toBe('9Router');
    expect(smartSessionTitle('Biết 9router')).toBe('9Router');
    expect(smartSessionTitle('Vậy còn cockpit')).toBe('Cockpit');
    expect(smartSessionTitle('Trước hết bạn biết về harnes không')).toBe('Harness');
  });

  it('removes trailing conversational filler', () => {
    expect(smartSessionTitle('Tạo một bảng usage giúp tôi nhé')).toBe('Tạo một bảng usage');
    expect(smartSessionTitle('Sửa cho tôi cái dropdown phải để lên cái kia luôn')).toBe('Sửa vị trí dropdown');
    expect(smartSessionTitle('cái đặt tên vẫn ngu ngu, phần model cho hiện chạy được và lỗi để lọc, làm active bớt chói đi')).toBe('Cải thiện tên lịch sử và bộ lọc model');
  });

  it('uses a later substantive request instead of a greeting', () => {
    expect(smartSessionTitleFromTurns([
      { role: 'user', content: 'Xin chào' },
      { role: 'assistant', content: 'Chào bạn!' },
      { role: 'user', content: 'thử viết 1 file json đi' }
    ])).toBe('Thử viết 1 file JSON');
  });

  it('updates history to the most recent concrete change request', () => {
    expect(smartSessionTitleFromTurns([
      { role: 'user', content: 'Bạn biết về harnes không?' },
      { role: 'assistant', content: 'Có.' },
      { role: 'user', content: 'Sửa cho tôi cái dropdown bị che trong cài đặt' }
    ])).toBe('Sửa dropdown cài đặt');
  });

  it('skips generic attachment instructions and names attachment-only chats', () => {
    expect(smartSessionTitleFromTurns([
      { role: 'user', content: 'Please inspect the attached image or file.' },
      { role: 'user', content: 'sửa lỗi menu model bị đóng' }
    ])).toBe('Sửa lỗi menu model bị đóng');
    expect(smartSessionTitleFromTurns([
      { role: 'user', content: '', attachments: [{ name: 'login-error.png' }] }
    ])).toBe('Xem login-error.png');
  });
});
