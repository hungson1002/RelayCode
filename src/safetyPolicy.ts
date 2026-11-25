export function validateCommandPolicy(command: string, policy: { allow: string[]; deny: string[] }): string | undefined {
  const normalized = command.trim().replace(/^&\s*/, '').toLowerCase();
  const dequoted = normalized.replace(/['"`]/g, '');
  const builtInDangerous = [
    /\b(?:remove-item|ri|del|erase|rd)\b[^\r\n]*(?:\s-(?:r|recurse)\b|\s-[a-z]*r[a-z]*\b|\s\/s\b)/i,
    /\b(?:rm|rmdir)\b[^\r\n]*(?:\s-[a-z]*r[a-z]*\b|\s\/s\b)/i,
    /\bgit(?:\.exe)?(?:\s+(?:-[Cc]\s+\S+|-c\s+\S+))*\s+(?:reset\s+--hard|clean\s+(?:-[a-z]*f|--force))/i,
    /\bgit(?:\.exe)?(?:\s+(?:-[Cc]\s+\S+|-c\s+\S+))*\s+(?:checkout|restore)(?:\s+--?)?\s+\.(?:\s|$|[;&|])/i,
    /\b(?:format-volume|format\.com|diskpart|shutdown|restart-computer)\b/i,
    /\b(?:powershell|pwsh)(?:\.exe)?\b[^\r\n]*\s-(?:e|ec|en|enc|enco|encod|encode|encoded|encodedc|encodedco|encodedcom|encodedcomm|encodedcomma|encodedcomman|encodedcommand)\b/i,
    /(?:^|[;&|\s])(?:iex|invoke-expression)\b/i
  ];
  if (builtInDangerous.some((pattern) => pattern.test(command) || pattern.test(dequoted))) {
    return 'Lệnh phá hủy bị chặn bởi hàng rào an toàn.';
  }
  if (policy.deny.some((item) => {
    const rule = item.trim().toLowerCase();
    return Boolean(rule) && (normalized.includes(rule) || dequoted.includes(rule));
  })) {
    return 'Lệnh khớp command deny list.';
  }
  if (policy.allow.length) {
    const prefixes = policy.allow.map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (/[$@][({]|`|[<>][(]|(?:^|[^0-9])>>?\s*[^\s&]/.test(command)) {
      return 'Lệnh chứa shell expansion hoặc chuyển hướng tệp không an toàn với command allow list.';
    }
    const segments = normalized
      .split(/(?:\r?\n|;|&&|(?<!&)&(?!&)|\|\||(?<!\|)\|(?!\|))/)
      .map((item) => item.trim().replace(/^&\s*/, ''))
      .filter(Boolean);
    if (!segments.length || segments.some((segment) => !prefixes.some((prefix) => segment === prefix || segment.startsWith(`${prefix} `)))) {
      return 'Lệnh không nằm trong command allow list.';
    }
  }
  return undefined;
}
