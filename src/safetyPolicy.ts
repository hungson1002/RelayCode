export function validateCommandPolicy(command: string, policy: { allow: string[]; deny: string[] }): string | undefined {
  const normalized = command.trim().replace(/^&\s*/, '').toLowerCase();
  const builtInDangerous = [
    /\bremove-item\b[^\r\n]*-recurse\b/i,
    /\b(?:rm|rmdir)\b[^\r\n]*(?:\s-[a-z]*r[a-z]*\b|\s\/s\b)/i,
    /\b(?:del|erase|rd)\b[^\r\n]*\s\/s\b/i,
    /\bgit\s+(?:reset\s+--hard|clean\s+(?:-[a-z]*f|--force))/i,
    /\bgit\s+(?:checkout|restore)\s+--?\s*\.\s*$/i,
    /\b(?:format-volume|format\.com|diskpart|shutdown|restart-computer)\b/i,
    /\b(?:powershell|pwsh)\b[^\r\n]*-(?:encodedcommand|enc)\b/i
  ];
  if (builtInDangerous.some((pattern) => pattern.test(command))) return 'Lệnh phá hủy bị chặn bởi hàng rào an toàn.';
  if (policy.deny.some((item) => item.trim() && normalized.includes(item.trim().toLowerCase()))) return 'Lệnh khớp command deny list.';
  if (policy.allow.length) {
    const prefixes = policy.allow.map((item) => item.trim().toLowerCase()).filter(Boolean);
    const segments = normalized.split(/(?:\r?\n|;|&&|\|\||(?<!\|)\|(?!\|))/).map((item) => item.trim().replace(/^&\s*/, '')).filter(Boolean);
    if (!segments.length || segments.some((segment) => !prefixes.some((prefix) => segment === prefix || segment.startsWith(`${prefix} `)))) {
      return 'Lệnh không nằm trong command allow list.';
    }
  }
  return undefined;
}
