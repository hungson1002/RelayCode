export type ResponseLanguage = 'vi' | 'en' | 'same';

const VIETNAMESE_WORDS = [
  'tôi', 'bạn', 'mình', 'chúng', 'không', 'với', 'sao', 'hãy', 'giúp', 'làm', 'sửa',
  'cho', 'này', 'của', 'và', 'được', 'một', 'như', 'nào', 'có', 'đang', 'trong', 'bằng',
  'tiếng', 'xin', 'chào', 'về', 'thế', 'này'
];

const ENGLISH_WORDS = [
  'the', 'and', 'you', 'please', 'what', 'how', 'can', 'help', 'fix', 'create', 'explain',
  'why', 'is', 'are', 'does', 'do', 'with', 'for', 'this', 'that', 'from', 'in', 'on',
  'to', 'a', 'an', 'my', 'me', 'thanks', 'thank', 'hello', 'hi', 'show', 'make', 'remove',
  'add', 'update', 'change', 'write', 'run', 'check'
];

function wordCount(text: string, words: string[]): number {
  const tokens = new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return words.reduce((count, word) => count + (tokens.has(word) ? 1 : 0), 0);
}

/**
 * Detect the language a model response should use from the latest user turn.
 * `same` intentionally leaves less common languages to the model instead of
 * incorrectly forcing them into the UI's Vietnamese/English setting.
 */
export function detectResponseLanguage(prompt: string, fallback: 'vi' | 'en' = 'vi'): ResponseLanguage {
  const text = prompt.trim();
  if (!text) return fallback;

  const vietnamese = wordCount(text, VIETNAMESE_WORDS);
  const english = wordCount(text, ENGLISH_WORDS);
  const hasVietnameseDiacritics = /[ăâđêôơưĂÂĐÊÔƠƯà-ỹÀ-Ỹ]/u.test(text);

  if (hasVietnameseDiacritics || vietnamese >= 2 || (vietnamese >= 1 && english === 0)) return 'vi';
  if (english >= 1) return 'en';
  return 'same';
}

export function responseLanguageInstruction(language: ResponseLanguage): string {
  if (language === 'vi') {
    return 'Trả lời hoàn toàn bằng tiếng Việt. Giữ nguyên code, đường dẫn, tên file, lệnh và các giá trị kỹ thuật; không dịch chúng. Không dùng emoji hoặc icon trang trí.';
  }
  if (language === 'en') {
    return 'Answer entirely in English. Keep code, paths, file names, commands, and technical values unchanged. Do not translate them. Do not use decorative emoji or icons.';
  }
  return 'Reply in the same natural language as the user’s latest message. Detect that language from the message itself and do not translate unless asked. Keep code, paths, file names, commands, and technical values unchanged. Do not use decorative emoji or icons.';
}
