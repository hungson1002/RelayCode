import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

const MAX_INSTRUCTION_CHARS = 80_000;

export interface ProjectInstruction {
  path: string;
  content: string;
  scope: 'user' | 'workspace';
}

export async function loadProjectInstructions(workspaceRoot?: string, activeFilePath?: string): Promise<ProjectInstruction[]> {
  const candidates: Array<{ path: string; scope: ProjectInstruction['scope'] }> = [
    { path: join(homedir(), '.codex', 'AGENTS.md'), scope: 'user' }
  ];
  if (workspaceRoot) {
    candidates.push({ path: join(workspaceRoot, '.agents', 'AGENTS.md'), scope: 'workspace' });
    const scoped = activeFilePath
      ? nearestInstructionCandidates(workspaceRoot, activeFilePath)
      : [join(workspaceRoot, 'AGENTS.md')];
    candidates.push(...scoped.map((path) => ({ path, scope: 'workspace' as const })));
  }
  const instructions: ProjectInstruction[] = [];
  for (const candidate of candidates.filter((item, index, all) => all.findIndex((other) => other.path === item.path) === index)) {
    try {
      const content = (await readFile(candidate.path, 'utf8')).trim();
      if (content) instructions.push({ ...candidate, content: content.slice(0, MAX_INSTRUCTION_CHARS) });
    } catch {
      // Optional instruction files are expected to be absent in many projects.
    }
  }
  return instructions;
}

export function formatProjectInstructions(instructions: ProjectInstruction[]): string {
  return instructions.map((item) =>
    `<project-instructions path="${item.path}" scope="${item.scope}">\n${item.content}\n</project-instructions>`
  ).join('\n\n');
}

export function nearestInstructionCandidates(workspaceRoot: string, filePath: string): string[] {
  const root = resolve(workspaceRoot);
  let current = resolve(dirname(filePath));
  const candidates: string[] = [];
  while (current === root || current.startsWith(`${root}${sep}`)) {
    candidates.unshift(join(current, 'AGENTS.md'));
    if (current === root) break;
    current = dirname(current);
  }
  return candidates;
}
