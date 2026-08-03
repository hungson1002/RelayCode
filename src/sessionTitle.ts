const ACRONYMS = new Map([
  ['api', 'API'], ['css', 'CSS'], ['html', 'HTML'], ['http', 'HTTP'],
  ['javascript', 'JavaScript'], ['js', 'JS'], ['json', 'JSON'], ['jsx', 'JSX'],
  ['sql', 'SQL'], ['typescript', 'TypeScript'], ['ts', 'TS'], ['tsx', 'TSX'],
  ['ui', 'UI'], ['url', 'URL'], ['ux', 'UX']
]);

const MAX_TITLE_LENGTH = 52;
const NEW_CHAT_TITLE = 'Cuộc trò chuyện mới';

function firstSentence(prompt: string): string {
  return prompt
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_#>\[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?:[.!?]\s+|\n)/, 1)[0] ?? '';
}

function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase('vi-VN') + value.slice(1) : value;
}

function normalizeAcronyms(value: string): string {
  return value.replace(/\b(api|css|html|http|javascript|js|json|jsx|sql|typescript|ts|tsx|ui|url|ux)\b/gi,
    (word) => ACRONYMS.get(word.toLowerCase()) ?? word);
}

function compactTitle(value: string): string {
  const title = value.trim();
  if (title.length <= MAX_TITLE_LENGTH) return title;
  const clipped = title.slice(0, MAX_TITLE_LENGTH);
  const boundary = clipped.lastIndexOf(' ');
  return `${(boundary >= 30 ? clipped.slice(0, boundary) : clipped).trim()}…`;
}

export function smartSessionTitle(prompt: string): string {
  const originalTitle = firstSentence(prompt);
  if (!originalTitle) return NEW_CHAT_TITLE;

  // Keep short social messages recognizable instead of turning them into a
  // generic title. This is what makes entries such as “Xin chào” or “Broooo”
  // look natural in history while substantive prompts get summarized below.
  const greetingOnly = /^(?:(?:xin\s+)?chào(?:\s+bạn)?|hello|hi|hey|yo|bro+)[,.!?;:\s-]*$/iu;
  if (greetingOnly.test(originalTitle)) {
    return compactTitle(capitalizeFirst(normalizeAcronyms(originalTitle.replace(/[.!?]+$/g, '').trim())));
  }

  let title = originalTitle;
  const questionLead = /^(có\s+cách\s+nào(?:\s+để)?|làm\s+sao(?:\s+để)?|how\s+(?:can|do)\s+i)\s+/iu.test(title);

  const conversationalPrefix = /^(?:(?:xin\s+)?chào(?:\s+bạn)?|hello|hi|hey)[,.!?;:\s-]*|^(?:(?:bạn\s+)?có\s+thể\s+|bạn\s+|hãy\s+|vui\s+lòng\s+|làm\s+ơn\s+|tôi\s+muốn\s+|mình\s+muốn\s+|giúp\s+(?:tôi|mình)\s+|cho\s+(?:tôi|mình)\s+)/i;
  for (let pass = 0; pass < 4; pass += 1) {
    const concise = title.replace(conversationalPrefix, '').trim();
    if (concise === title) break;
    title = concise;
    if (!title) break;
  }

  // Request politeness at the end is noise for a title, but only remove it
  // after extracting the actual subject so “tạo báo cáo với…” stays intact.
  title = title.replace(/[.!?]+$/g, '').trim();
  for (let pass = 0; pass < 3; pass += 1) {
    const concise = title.replace(/\s+(?:giúp\s+(?:tôi|mình)|được\s+không|không|nhỉ|hả|à|nhé|nha|đi|với|please|thanks?)\s*$/iu, '').trim();
    if (concise === title) break;
    title = concise;
  }
  if (!title) return capitalizeFirst(originalTitle) || NEW_CHAT_TITLE;

  // Question lead-ins are useful to the user but make noisy titles. Turn
  // them into the same compact “Cách …” style used by ChatGPT-like history.
  if (questionLead) {
    title = title.replace(/^(có\s+cách\s+nào(?:\s+để)?|làm\s+sao(?:\s+để)?|how\s+(?:can|do)\s+i)\s*/iu, '');
    title = /^(?:how\s|what\s|why\s|when\s)/iu.test(originalTitle) ? `How to ${title}` : `Cách ${title}`;
  }

  title = capitalizeFirst(normalizeAcronyms(title));
  return compactTitle(title);
}
