export interface ParsedContextMentions {
  selection: boolean;
  files: string[];
  folders: string[];
  problems: boolean;
  terminal: boolean;
  gitDiff: boolean;
}

function valuesAfter(prompt: string, name: 'file' | 'folder', limit: number): string[] {
  const pattern = new RegExp(`@${name}:(?:"([^"]+)"|'([^']+)'|([^\\s,]+))`, 'gi');
  return [...prompt.matchAll(pattern)]
    .slice(0, limit)
    .map((match) => (match[1] || match[2] || match[3] || '').trim())
    .filter(Boolean);
}

export function parseContextMentions(prompt: string): ParsedContextMentions {
  return {
    selection: /@selection\b/i.test(prompt),
    files: valuesAfter(prompt, 'file', 8),
    folders: valuesAfter(prompt, 'folder', 3),
    problems: /@problems\b/i.test(prompt),
    terminal: /@terminal\b/i.test(prompt),
    gitDiff: /@git-diff\b/i.test(prompt)
  };
}
