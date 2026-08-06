import { describe, expect, it } from 'vitest';
import { buildSessionSummary, sessionSummaryForDisplay, sessionSummaryForPrompt } from '../src/sessionSummary';

describe('session summary', () => {
  it('skips a greeting and preserves goal, files, issues and next step', () => {
    const summary = buildSessionSummary([
      { role: 'user', content: 'Xin chào' },
      { role: 'assistant', content: 'Xin chào!' },
      { role: 'user', content: 'Thêm web search cho RelayCode' },
      { role: 'assistant', content: 'Request failed: provider unavailable', error: true }
    ], ['src/webSearch.ts', 'src/chatViewProvider.ts']);

    expect(summary).toContain('Goal: Thêm web search cho RelayCode');
    expect(summary).toContain('Changed files: src/webSearch.ts, src/chatViewProvider.ts');
    expect(summary).toContain('Open issues: Request failed: provider unavailable');
    expect(summary).toContain('Next step: Continue from the latest request: Thêm web search cho RelayCode');
  });

  it('wraps only non-empty summaries for model context', () => {
    expect(sessionSummaryForPrompt('')).toBe('');
    expect(sessionSummaryForPrompt('Session summary')).toContain('<session-summary>');
  });

  it('localizes the visible summary without changing its model structure', () => {
    expect(sessionSummaryForDisplay('Session summary\nGoal: Build it\nChanged files: None recorded.', 'vi')).toBe(
      'Tóm tắt phiên\nMục tiêu: Build it\nFile đã đổi: Chưa ghi nhận.'
    );
    expect(sessionSummaryForDisplay('Session summary', 'en')).toBe('Session summary');
  });
});
