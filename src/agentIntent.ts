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
  'làm',
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

export function requiresWorkspaceMutation(prompt: unknown): boolean {
  const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt ?? '');
  const normalized = text.toLocaleLowerCase('vi');
  return mutationVerbs.some((verb) => normalized.includes(verb));
}
