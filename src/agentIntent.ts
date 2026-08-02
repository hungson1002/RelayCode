const mutationVerbs = [
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
  'vẽ'
];

const conversationalAcknowledgements = [
  /^(?:cảm ơn|cám ơn|thanks?|thank you)\b/i,
  /^(?:làm )?(?:tốt|hay|đẹp|xuất sắc|tuyệt vời)(?: lắm| rất nhiều)?[.! ]*$/i,
  /^(?:ok|okay|ổn rồi|được rồi|chuẩn rồi|good job|well done)[.! ]*$/i
];

const explicitNonMutationRequests = [
  /(?:^|\s)(?:đừng|không cần|chưa cần)\s+(?:tạo|làm|xây dựng|viết|thêm|sửa|chỉnh|cập nhật|xóa|xoá|đổi tên|triển khai|thiết kế)(?:\s|[,.!?]|$)/i,
  /^(?:chỉ\s+)?(?:hỏi|giải thích|phân tích|kiểm tra|xem|review|nhận xét)\b/i
];

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

export function requiresWorkspaceMutation(prompt: unknown): boolean {
  const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt ?? '');
  const normalized = text.trim().toLocaleLowerCase('vi');
  if (!normalized
    || conversationalAcknowledgements.some((pattern) => pattern.test(normalized))
    || explicitNonMutationRequests.some((pattern) => pattern.test(normalized))) return false;
  if (explicitChatOutputRequests.some((pattern) => pattern.test(normalized))) return false;
  if (!explicitWorkspaceTarget.test(normalized)
    && presentationOnlyRequests.some((pattern) => pattern.test(normalized))) return false;
  return explicitVietnameseMakeRequest.test(normalized)
    || mutationVerbs.some((verb) => normalized.includes(verb));
}
