export function validateCommandPolicy(command: string, policy: { allow: string[]; deny: string[] }): string | undefined {
  const normalized = command.toLowerCase();
  const builtInDangerous = [
    /(?:^|[;&|]\s*)remove-item\b.*(?:-recurse|-force)/i,
    /\b(?:rm|rmdir)\b.*\s(?:\/s|-r|-rf)\b/i,
    /\bgit\s+(?:reset\s+--hard|clean\s+-[a-z]*f)/i,
    /\b(?:format-volume|diskpart|shutdown|restart-computer)\b/i
  ];
  if (builtInDangerous.some((pattern) => pattern.test(command))) return 'Lệnh phá hủy bị chặn bởi hàng rào an toàn.';
  if (policy.deny.some((item) => item.trim() && normalized.includes(item.trim().toLowerCase()))) return 'Lệnh khớp command deny list.';
  if (policy.allow.length && !policy.allow.some((item) => item.trim() && normalized.startsWith(item.trim().toLowerCase()))) {
    return 'Lệnh không nằm trong command allow list.';
  }
  return undefined;
}
