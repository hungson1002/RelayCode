const ACRONYMS = new Map([
  ['api', 'API'], ['css', 'CSS'], ['html', 'HTML'], ['http', 'HTTP'],
  ['javascript', 'JavaScript'], ['js', 'JS'], ['json', 'JSON'], ['jsx', 'JSX'],
  ['sql', 'SQL'], ['typescript', 'TypeScript'], ['ts', 'TS'], ['tsx', 'TSX'],
  ['ui', 'UI'], ['url', 'URL'], ['ux', 'UX']
]);

export function smartSessionTitle(prompt: string): string {
  let title = prompt
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_#>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?:[.!?]\s+|\n)/, 1)[0] ?? '';

  const conversationalPrefix = /^(?:(?:xin\s+)?chào(?:\s+bạn)?|hello|hi|hey)[,.!?;:\s-]*|^(?:(?:bạn\s+)?có\s+thể\s+|bạn\s+|hãy\s+|vui\s+lòng\s+|làm\s+ơn\s+|tôi\s+muốn\s+|mình\s+muốn\s+|giúp\s+(?:tôi|mình)\s+|cho\s+(?:tôi|mình)\s+)/i;
  for (let pass = 0; pass < 4; pass += 1) {
    const concise = title.replace(conversationalPrefix, '').trim();
    if (concise === title) break;
    title = concise;
    if (!title) break;
  }

  if (!title) return 'Cuộc trò chuyện mới';
  title = title.replace(/[.!?]+$/g, '').trim();
  if (!title) return 'Cuộc trò chuyện mới';
  title = title.replace(/\b(api|css|html|http|javascript|js|json|jsx|sql|typescript|ts|tsx|ui|url|ux)\b/gi,
    (word) => ACRONYMS.get(word.toLowerCase()) ?? word);
  title = title.charAt(0).toLocaleUpperCase('vi-VN') + title.slice(1);
  if (title.length <= 52) return title;
  const clipped = title.slice(0, 52);
  const boundary = clipped.lastIndexOf(' ');
  return `${(boundary >= 30 ? clipped.slice(0, boundary) : clipped).trim()}…`;
}
