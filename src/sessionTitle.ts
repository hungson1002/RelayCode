const ACRONYMS = new Map([
  ['api', 'API'], ['css', 'CSS'], ['html', 'HTML'], ['http', 'HTTP'],
  ['javascript', 'JavaScript'], ['js', 'JS'], ['json', 'JSON'], ['jsx', 'JSX'],
  ['sql', 'SQL'], ['typescript', 'TypeScript'], ['ts', 'TS'], ['tsx', 'TSX'],
  ['ui', 'UI'], ['url', 'URL'], ['ux', 'UX'], ['9router', '9Router'],
  ['harnes', 'Harness'], ['harness', 'Harness']
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
  return value.replace(/\b(api|css|html|http|javascript|js|json|jsx|sql|typescript|ts|tsx|ui|url|ux|9router|harnes|harness)\b/gi,
    (word) => ACRONYMS.get(word.toLowerCase()) ?? word);
}

function compactTitle(value: string): string {
  const title = value.trim();
  if (title.length <= MAX_TITLE_LENGTH) return title;
  const clipped = title.slice(0, MAX_TITLE_LENGTH);
  const boundary = clipped.lastIndexOf(' ');
  return `${(boundary >= 30 ? clipped.slice(0, boundary) : clipped).trim()}…`;
}

function focusedRequestTitle(prompt: string): string {
  const source = prompt.replace(/\s+/g, ' ').trim();
  const requestsChange = /(?:^|\s)(?:sửa|fix|thêm|add|đổi|change|cải thiện|improve|cho hiện|hiển thị|làm\s+.+?\s+bớt)\b/iu.test(source);
  if (!requestsChange) return '';
  const topics: string[] = [];
  if (/(?:đặt|tạo|sinh)\s*tên|tên\s+(?:chat|lịch sử|cuộc trò chuyện)|history\s+title/iu.test(source)) topics.push('tên lịch sử');
  if (/model/iu.test(source) && /(?:lọc|filter|check|kiểm tra|chạy được|hoạt động)/iu.test(source)) topics.push('bộ lọc model');
  if (/dropdown/iu.test(source) && /(?:cài đặt|settings|bị che|popup|đè|lên|z-index)/iu.test(source)) {
    topics.push(/(?:cài đặt|settings)/iu.test(source) ? 'dropdown cài đặt' : 'vị trí dropdown');
  }
  if (/(?:^|\s)link(?:\s|$)|liên kết/iu.test(source)) topics.push('link');
  if (/(?:markdown|table|bảng)/iu.test(source) && /(?:đang chạy|stream|hiện|render)/iu.test(source)) topics.push('Markdown khi chạy');
  if (/(?:giật|nhấp nháy|jitter)/iu.test(source)) topics.push('hiển thị bị giật');
  const uniqueTopics = [...new Set(topics)].slice(0, 2);
  if (!uniqueTopics.length) return '';
  const action = /(?:đặt|tạo|sinh)\s*tên/iu.test(source) && !/(?:sửa|fix)/iu.test(source) ? 'Cải thiện' : 'Sửa';
  return `${action} ${uniqueTopics.join(' và ')}`;
}

export function smartSessionTitle(prompt: string): string {
  const originalTitle = firstSentence(prompt);
  if (!originalTitle) return NEW_CHAT_TITLE;
  const focusedTitle = focusedRequestTitle(prompt);
  if (focusedTitle) return compactTitle(normalizeAcronyms(focusedTitle));

  // Keep short social messages recognizable instead of turning them into a
  // generic title. This is what makes entries such as “Xin chào” or “Broooo”
  // look natural in history while substantive prompts get summarized below.
  const greetingOnly = /^(?:(?:xin\s+)?chào(?:\s+bạn)?|hello|hi|hey|yo|bro+)[,.!?;:\s-]*$/iu;
  if (greetingOnly.test(originalTitle)) {
    return compactTitle(capitalizeFirst(normalizeAcronyms(originalTitle.replace(/[.!?]+$/g, '').trim())));
  }

  let title = originalTitle
    .replace(/^(?:trước hết|đầu tiên)[,;:\s-]*/iu, '')
    .replace(/^(sửa|fix|thêm|add|đổi|change|tạo|create|làm|make)\s+cho\s+(?:tôi|mình|me)\s+/iu, '$1 ')
    .replace(/^(sửa|fix|thêm|add|đổi|change|tạo|create|làm|make)\s+(?:(?:lại|vậy|cái)\s+)+/iu, '$1 ');
  const questionLead = /^(có\s+cách\s+nào(?:\s+để)?|làm\s+sao(?:\s+để)?|how\s+(?:can|do)\s+i)\s+/iu.test(title);

  const conversationalPrefix = /^(?:(?:xin\s+)?chào(?:\s+bạn)?|hello|hi|hey|nhé|này|ờ|à|bạn\s+ơi|xin\s+hỏi|cho\s+(?:tôi|mình)\s+hỏi)[,.!?;:\s-]*|^(?:(?:bạn\s+)?có\s+thể\s+|bạn\s+|hãy\s+|vui\s+lòng\s+|làm\s+ơn\s+|tôi\s+muốn\s+|mình\s+muốn\s+|giúp\s+(?:tôi|mình)\s+|cho\s+(?:tôi|mình)\s+)/iu;
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

  const topicQuestion = /^(?:(?:có\s+)?biết(?:\s+về)?|(?:có\s+)?thông\s+tin\s+(?:gì\s+)?về|do\s+you\s+know(?:\s+about)?|tell\s+me\s+about|what\s+(?:is|'s)|who\s+is|vậy\s+còn|còn)\s+/iu;
  if (topicQuestion.test(title)) {
    title = title.replace(topicQuestion, '').trim();
    title = title.replace(/^(?:tool|repo(?:sitory)?|project|dự\s+án|thư\s+viện|library|package)\s+/iu, '').trim();
  }

  if (/dropdown/iu.test(title) && /(?:bị che|đè|để lên|lên cái|z-index|popup)/iu.test(title)) {
    title = /^(?:sửa|fix)/iu.test(title) ? 'Sửa vị trí dropdown' : 'Vị trí dropdown';
  }

  // Question lead-ins are useful to the user but make noisy titles. Turn
  // them into the same compact “Cách …” style used by ChatGPT-like history.
  if (questionLead) {
    title = title.replace(/^(có\s+cách\s+nào(?:\s+để)?|làm\s+sao(?:\s+để)?|how\s+(?:can|do)\s+i)\s*/iu, '');
    title = /^(?:how\s|what\s|why\s|when\s)/iu.test(originalTitle) ? `How to ${title}` : `Cách ${title}`;
  }

  title = capitalizeFirst(normalizeAcronyms(title));
  return compactTitle(title);
}

export interface SessionTitleTurn {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Array<{ name: string }>;
}

function isWeakTitlePrompt(prompt: string): boolean {
  const value = firstSentence(prompt).trim();
  if (!value) return true;
  if (/^\/(?:browser|terminal|plugins|hooks|schedule|status|summary|review|diff|mcp|settings|logs|export)$/i.test(value)) return true;
  if (/^(?:(?:xin\s+)?chào(?:\s+bạn)?|hello|hi|hey|yo|bro+)[,.!?;:\s-]*$/iu.test(value)) return true;
  if (/^(?:please\s+)?inspect\s+the\s+attached\s+(?:image|file)|^(?:hãy\s+)?(?:xem|kiểm\s+tra)\s+(?:ảnh|tệp)\s+đính\s+kèm/iu.test(value)) return true;
  return value.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).length < 2;
}

function isActionRequest(prompt: string): boolean {
  return /(?:^|\s)(?:sửa|fix|thêm|add|đổi|change|tạo|create|xây dựng|build|tích hợp|integrate|cải thiện|improve|cho hiện|hiển thị|đóng gói|package|cài|install|xóa|remove)\b/iu.test(firstSentence(prompt));
}

export function smartSessionTitleFromTurns(turns: SessionTitleTurn[]): string {
  const userTurns = turns.filter((turn) => turn.role === 'user');
  const recentAction = [...userTurns].reverse().find((turn) => !isWeakTitlePrompt(turn.content) && isActionRequest(turn.content));
  if (recentAction) return smartSessionTitle(recentAction.content);
  const substantive = userTurns.find((turn) => !isWeakTitlePrompt(turn.content));
  if (substantive) return smartSessionTitle(substantive.content);

  const attachment = userTurns.flatMap((turn) => turn.attachments ?? [])[0];
  if (attachment?.name) return compactTitle(`Xem ${attachment.name}`);

  const first = userTurns.find((turn) => turn.content.trim())?.content ?? '';
  const slash = first.trim().match(/^\/([a-z-]+)/i)?.[1];
  if (slash) return compactTitle(capitalizeFirst(slash.replace(/-/g, ' ')));
  return smartSessionTitle(first);
}
