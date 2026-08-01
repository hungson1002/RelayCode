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
  'thiết kế'
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

const explicitVietnameseMakeRequest = /^(?:hãy\s+)?làm\s+(?!(?:tốt|hay|đẹp|xuất sắc|tuyệt vời)(?:\s+lắm)?[.! ]*$)(?:cho\s+(?:tôi|mình)\s+)?\S+/i;

export function requiresWorkspaceMutation(prompt: unknown): boolean {
  const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt ?? '');
  const normalized = text.trim().toLocaleLowerCase('vi');
  if (!normalized
    || conversationalAcknowledgements.some((pattern) => pattern.test(normalized))
    || explicitNonMutationRequests.some((pattern) => pattern.test(normalized))) return false;
  return explicitVietnameseMakeRequest.test(normalized)
    || mutationVerbs.some((verb) => normalized.includes(verb));
}
