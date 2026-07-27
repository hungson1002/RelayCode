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
});
