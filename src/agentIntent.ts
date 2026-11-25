const englishMutationVerbs = [
  'create',
  'build',
  'implement',
  'add',
  'edit',
  'modify',
  'update',
  'fix',
  'delete',
  'remove',
  'rename',
  'generate',
  'draw',
  'render',
  'scaffold',
  'write',
  'refactor'
];

const vietnameseMutationVerbs = [
  'tạo',
  'xây dựng',
  'viết',
  'thêm',
  'sửa',
  'chỉnh',
  'cập nhật',
  'xóa',
  'xoá',
  'đổi tên',
  'triển khai',
  'thiết kế',
  'vẽ',
  'cải thiện'
];

const mutationVerbPattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${[...englishMutationVerbs, ...vietnameseMutationVerbs].join('|')})(?![\\p{L}\\p{N}_])`,
  'iu'
);

const nonMutationIdioms = [
  /\b(?:cấu\s+tạo|khởi\s+tạo|tạo\s+thành)\b/giu,
  /(?<![\p{L}\p{N}_])(?:cho\s+biết|biết|tìm\s+hiểu|xem|nói|hỏi|đọc|giải\s+thích)\s+thêm(?![\p{L}\p{N}_])/giu,
  /(?<![\p{L}\p{N}_])(?:không|chưa|chẳng)\s+(?:tạo|làm|xây\s+dựng|viết|thêm|sửa|chỉnh|cập\s+nhật|xóa|xoá|đổi\s+tên|triển\s+khai|thiết\s+kế)(?:\s+gì)?(?![\p{L}\p{N}_])/giu
];

const conversationalAcknowledgements = [
  /^(?:cảm ơn|cám ơn|thanks?|thank you)\b/i,
  /^(?:làm )?(?:tốt|hay|đẹp|xuất sắc|tuyệt vời)(?: lắm| rất nhiều)?[.! ]*$/i,
  /^(?:ok|okay|ổn rồi|được rồi|chuẩn rồi|good job|well done)[.! ]*$/i
];

const explicitNonMutationRequests = [
  /(?:^|\s)(?:đừng|không cần|chưa cần|không được|không)\s+(?:tạo|làm|xây dựng|viết|thêm|sửa|chỉnh|cập nhật|xóa|xoá|đổi tên|triển khai|thiết kế)(?:\s+(?:gì|file|code|mã|tệp))?(?:\s|[,.!?]|$)/iu,
  /(?:^|\s)(?:do not|don't|never|without)\s+(?:create|build|implement|add|edit|modify|update|fix|delete|remove|rename|write|change|touch)(?:\s|[,.!?]|$)/i,
  /(?:^|\s)(?:read[- ]only|chỉ đọc)(?:\s|[,.!?]|$)/iu,
  /^(?:chỉ\s+)?(?:hỏi|giải thích|phân tích|kiểm tra|xem|review|nhận xét|đọc|rà soát)\b/iu
];

const readOnlyLeadIn = /^(?:(?:hãy|giúp\s+(?:tôi|mình)|vui\s+lòng|please|can\s+you|could\s+you)\s+)?(?:đọc|xem|kiểm\s+tra|phân\s+tích|giải\s+thích|review|nhận\s+xét|rà\s+soát|tìm\s+hiểu|liệt\s+kê|read|explain|inspect|analyze|analyse|check|describe|summarize|summarise|list|find|search|show|what|why|how|where|who|when|which|tell\s+me)\b/iu;

const explicitChatOutputRequests = [
  /\b(?:trong|ngay trong|tại)\s+(?:khung\s+)?chat\b/i,
  /\b(?:here|in (?:the )?chat|in this conversation)\b/i
];

const presentationOnlyRequests = [
  /^(?:hãy\s+)?(?:thử\s+)?(?:vẽ|hiển thị|trình bày)\s+(?:cho\s+(?:tôi|mình)\s+)?(?:thử\s+)?(?:một\s+)?bảng(?:\s+markdown)?\b/i,
  /^(?:hãy\s+)?(?:thử\s+)?(?:viết|soạn)\s+(?:cho\s+(?:tôi|mình)\s+)?(?:thử\s+)?(?:một\s+)?(?:mô tả|đoạn văn|câu trả lời|nội dung)\b/i,
  /^(?:please\s+)?(?:try\s+)?(?:draw|show|render|present)\s+(?:me\s+)?(?:an?\s+)?(?:markdown\s+)?table\b/i,
  /^(?:please\s+)?(?:try\s+)?(?:write|draft)\s+(?:me\s+)?(?:an?\s+)?(?:description|paragraph|answer|response)\b/i
];

const explicitWorkspaceTarget = /\b(?:file|tệp|workspace|dự án|project|source|mã nguồn|giao diện|ui|component|database|cơ sở dữ liệu|html|css|javascript|typescript|readme)\b/i;

const explicitVietnameseMakeRequest = /^(?:hãy\s+)?làm\s+(?!(?:tốt|hay|đẹp|xuất sắc|tuyệt vời)(?:\s+lắm)?[.! ]*$)(?:cho\s+(?:tôi|mình)\s+)?\S+/i;

/**
 * Extracts only the user's natural-language request from an enriched prompt,
 * stripping injected IDE context blocks (<file>, <selection>, <git-diff>, etc.)
 * so code identifiers or file contents cannot trigger false-positive intents.
 */
export function extractUserPromptText(prompt: unknown): string {
  let raw = '';
  if (typeof prompt === 'string') {
    raw = prompt;
  } else if (Array.isArray(prompt)) {
    raw = prompt
      .filter((part): part is { type?: string; text?: string } => Boolean(part && typeof part === 'object'))
      .map((part) => (part.type === 'text' && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  } else if (prompt && typeof prompt === 'object' && typeof (prompt as { text?: unknown }).text === 'string') {
    raw = (prompt as { text: string }).text;
  } else {
    raw = JSON.stringify(prompt ?? '');
  }

  return raw
    .replace(/<(?:file|selection|folder|problems|terminal|git-diff|context|attachment)\b[^>]*>[\s\S]*?<\/(?:file|selection|folder|problems|terminal|git-diff|context|attachment)>/gi, ' ')
    .replace(/(?:^|\n)Active file:[^\n]*/g, ' ')
    .replace(/(?:^|\n)File context not found:[^\n]*/g, ' ')
    .replace(/(?:^|\n)Attached (?:file|image)s?:[\s\S]*$/i, ' ')
    .replace(/(?:^|\n)Trước khi dùng tool, hãy nêu kế hoạch ngắn 2-5 bước rồi mới thực hiện\./g, ' ')
    .trim();
}

export function requiresWorkspaceMutation(prompt: unknown): boolean {
  const text = extractUserPromptText(prompt);
  const normalized = text.trim().toLocaleLowerCase('vi');
  if (!normalized || conversationalAcknowledgements.some((pattern) => pattern.test(normalized))) return false;

  // Strip benign non-mutation idioms ("cấu tạo", "biết thêm", "không sửa gì")
  // before deciding whether an explicit mutation verb was requested.
  let sanitized = normalized;
  for (const idiom of nonMutationIdioms) sanitized = sanitized.replace(idiom, ' ');

  if (explicitChatOutputRequests.some((pattern) => pattern.test(normalized))) return false;
  if (!explicitWorkspaceTarget.test(normalized)
    && presentationOnlyRequests.some((pattern) => pattern.test(normalized))) return false;

  // Explicit prohibitions ("đừng sửa", "chưa cần chỉnh", "do not edit", "read-only")
  // always win over everything else.
  if (explicitNonMutationRequests.slice(0, 3).some((pattern) => pattern.test(normalized))) return false;

  const hasMutationVerb = explicitVietnameseMakeRequest.test(sanitized) || mutationVerbPattern.test(sanitized);

  // If the request begins with a read/explain/review lead-in ("đọc...", "giải thích...",
  // "explain...", "check...") AND does not explicitly ask for a mutation afterwards,
  // treat it as read-only.
  if (explicitNonMutationRequests[3]!.test(normalized) || readOnlyLeadIn.test(normalized)) {
    // A prompt starting with "chỉ ..." ("only explain/check/read") is always read-only.
    if (/^chỉ\s+/iu.test(normalized)) return false;
    return hasMutationVerb;
  }

  return hasMutationVerb;
}

const explicitGitWorkflowPattern = /\b(?:git|commit|push|pull|rebase|stash|stage|unstage|cherry-pick|merge)\b/i;
const gitTermsToStrip = /\b(?:git(?:\s+add)?|commit|push|pull|status|diff|branch|merge|stash|stage|unstage|tag|rebase|cherry-pick)\b/gi;
const codeActionPattern = /\b(?:create|build|implement|add|edit|modify|update|fix|delete|remove|rename|generate|write|test|lint|typecheck|refactor|install|run|change|style|design|component|badge|button|page)\b/i;

/** True when the request is about version control, not changing project code. */
export function isGitOnlyRequest(prompt: unknown): boolean {
  const text = extractUserPromptText(prompt);
  const normalized = text.trim().toLocaleLowerCase('vi');
  if (!normalized || !explicitGitWorkflowPattern.test(normalized)) return false;
  const withoutGitTerms = normalized.replace(gitTermsToStrip, ' ');
  return !codeActionPattern.test(withoutGitTerms)
    && !/(?<![\p{L}\p{N}_])(?:tạo|xây dựng|triển khai|sửa|chỉnh|cập nhật|xóa|xoá|đổi tên|viết|thêm|cài đặt|cải thiện)(?![\p{L}\p{N}_])/iu.test(withoutGitTerms);
}
