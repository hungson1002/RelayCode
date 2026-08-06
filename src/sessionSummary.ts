export interface SessionSummaryTurn {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

const GREETING_ONLY = /^(?:(?:xin\s+)?chào(?:\s+bạn)?|hello|hi|hey|alo)[.!?,\s-]*$/iu;
const ERROR_TEXT = /\b(?:error|failed|failure|request failed|lỗi|thất bại|không thành công|chưa hoàn thành)\b/i;

function compactText(value: string, max = 360): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function meaningfulUserTurns(turns: SessionSummaryTurn[]): SessionSummaryTurn[] {
  return turns.filter((turn) => turn.role === 'user' && compactText(turn.content) && !GREETING_ONLY.test(turn.content.trim()));
}

export function buildSessionSummary(turns: SessionSummaryTurn[], changedFiles: string[] = []): string {
  const users = meaningfulUserTurns(turns);
  const goal = compactText(users[0]?.content || turns.find((turn) => turn.role === 'user')?.content || 'Chưa ghi nhận mục tiêu.');
  const latestRequest = compactText(users.at(-1)?.content || goal);
  const errors = turns
    .filter((turn) => turn.error || (turn.role === 'assistant' && ERROR_TEXT.test(turn.content)))
    .map((turn) => compactText(turn.content, 220))
    .filter(Boolean)
    .slice(-3);
  const uniqueFiles = [...new Set(changedFiles.map((file) => file.trim()).filter(Boolean))].slice(-12);

  return [
    'Session summary',
    `Goal: ${goal}`,
    `Changed files: ${uniqueFiles.length ? uniqueFiles.join(', ') : 'None recorded.'}`,
    `Open issues: ${errors.length ? errors.join(' | ') : 'None recorded.'}`,
    `Next step: Continue from the latest request: ${latestRequest}`
  ].join('\n');
}

export function sessionSummaryForPrompt(summary: string): string {
  return summary.trim() ? `<session-summary>\n${summary.trim()}\n</session-summary>` : '';
}

export function sessionSummaryForDisplay(summary: string, language: 'vi' | 'en' = 'en'): string {
  if (language === 'en') return summary;
  return summary
    .replace(/^Session summary$/m, 'Tóm tắt phiên')
    .replace(/^Goal:/gm, 'Mục tiêu:')
    .replace(/^Changed files:/gm, 'File đã đổi:')
    .replace(/^Open issues:/gm, 'Vấn đề còn lại:')
    .replace(/^Next step:/gm, 'Bước tiếp theo:')
    .replace(/None recorded\./g, 'Chưa ghi nhận.')
    .replace(/^Continue from the latest request:/gm, 'Tiếp tục từ yêu cầu gần nhất:');
}
