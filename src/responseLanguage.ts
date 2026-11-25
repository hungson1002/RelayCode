export type ResponseLanguage = 'vi' | 'en' | 'same';

const VIETNAMESE_WORDS = [
  'tôi', 'bạn', 'mình', 'chúng', 'không', 'với', 'sao', 'hãy', 'giúp', 'làm', 'sửa',
  'cho', 'này', 'của', 'và', 'được', 'một', 'như', 'nào', 'có', 'đang', 'trong', 'bằng',
  'tiếng', 'xin', 'chào', 'về', 'thế'
];

const ENGLISH_STRONG_WORDS = [
  'the', 'and', 'you', 'please', 'what', 'how', 'can', 'help', 'explain',
  'why', 'is', 'are', 'does', 'with', 'for', 'this', 'that', 'from',
  'my', 'thanks', 'thank', 'hello', 'show', 'make', 'write', 'should', 'could', 'would'
];

const ENGLISH_SOFT_WORDS = [
  'do', 'in', 'on', 'to', 'a', 'an', 'me', 'hi', 'fix', 'create', 'remove',
  'add', 'update', 'change', 'run', 'check'
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
  const englishStrong = wordCount(text, ENGLISH_STRONG_WORDS);
  const englishSoft = wordCount(text, ENGLISH_SOFT_WORDS);
  const english = englishStrong + englishSoft;
  const hasVietnameseDiacritics = /[ăâđêôơưĂÂĐÊÔƠƯà-ỹÀ-Ỹ]/u.test(text);
  const hasNonLatinScript = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0e00-\u0e7f]/u.test(text);

  if (hasVietnameseDiacritics || vietnamese >= 2 || (vietnamese >= 1 && english === 0)) return 'vi';
  if (hasNonLatinScript) return 'same';
  if (englishStrong >= 2 || (englishStrong >= 1 && english >= 2)) return 'en';
  if (englishStrong >= 1 && text.split(/\s+/).length <= 4) return 'en';
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
