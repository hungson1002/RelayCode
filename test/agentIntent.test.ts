import { describe, expect, it } from 'vitest';
import { requiresWorkspaceMutation } from '../src/agentIntent';

describe('requiresWorkspaceMutation', () => {
  it('detects Vietnamese implementation requests', () => {
    expect(requiresWorkspaceMutation('Tạo cho tôi một landing page bằng HTML CSS thuần')).toBe(true);
    expect(requiresWorkspaceMutation('Sửa file hiện tại và thêm CSS')).toBe(true);
  });

  it('detects English implementation requests', () => {
    expect(requiresWorkspaceMutation('Build a landing page and create index.html')).toBe(true);
  });

  it('does not treat an explanation as a mutation', () => {
    expect(requiresWorkspaceMutation('Giải thích project này hoạt động như thế nào')).toBe(false);
  });

  it('does not mistake praise or acknowledgement for an edit request', () => {
    expect(requiresWorkspaceMutation('làm tốt lắm')).toBe(false);
    expect(requiresWorkspaceMutation('Cảm ơn bạn')).toBe(false);
    expect(requiresWorkspaceMutation('Được rồi.')).toBe(false);
  });

  it('respects requests that explicitly prohibit workspace edits', () => {
    expect(requiresWorkspaceMutation('Đừng sửa file, chỉ giải thích lỗi cho tôi')).toBe(false);
    expect(requiresWorkspaceMutation('Chỉ kiểm tra code, chưa cần chỉnh gì')).toBe(false);
  });

  it('still detects explicit requests that use the Vietnamese verb làm', () => {
    expect(requiresWorkspaceMutation('Làm cho tôi giao diện gọn hơn')).toBe(true);
    expect(requiresWorkspaceMutation('Hãy làm UI giống Codex')).toBe(true);
  });

  it('keeps table and prose presentation requests inside chat', () => {
    expect(requiresWorkspaceMutation('Thử vẽ bảng phân tích lọ 3 lần 1 tuần với 3 lần 1 ngày')).toBe(false);
    expect(requiresWorkspaceMutation('Viết thử mô tả trong chat cho tôi')).toBe(false);
    expect(requiresWorkspaceMutation('Render a Markdown table here')).toBe(false);
  });

  it('still mutates when a presentation request names a workspace target', () => {
    expect(requiresWorkspaceMutation('Vẽ bảng trong giao diện hiện tại')).toBe(true);
    expect(requiresWorkspaceMutation('Viết mô tả vào file README')).toBe(true);
  });
});
