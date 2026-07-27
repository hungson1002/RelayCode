import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

export interface AgentSkill {
  name: string;
  description: string;
  path: string;
  source: 'workspace' | 'user';
  content?: string;
}

const MAX_SKILLS = 200;
const MAX_SKILL_BYTES = 120_000;

export function parseSkillDocument(content: string, filePath: string, source: AgentSkill['source']): AgentSkill {
  const frontmatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  const fields = parseFrontmatterFields(frontmatter?.[1] ?? '');
  const fallbackName = basename(resolve(filePath, '..'));
  const body = frontmatter ? content.slice(frontmatter[0].length).trim() : content.trim();
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const firstParagraph = body
    .split(/\r?\n\s*\r?\n/)
    .map((item) => item.replace(/^#+\s*/gm, '').trim())
    .find(Boolean);
  return {
    name: normalizeName(fields.get('name') || fallbackName),
    description: (fields.get('description') || firstParagraph || heading || 'Agent skill').slice(0, 280),
    path: filePath,
    source,
    content
  };
}

export async function discoverSkills(workspaceRoot?: string): Promise<AgentSkill[]> {
  const roots: Array<{ path: string; source: AgentSkill['source'] }> = [
    { path: join(homedir(), '.agents', 'skills'), source: 'user' },
    { path: join(homedir(), '.codex', 'skills'), source: 'user' },
    { path: join(homedir(), '.codex', 'plugins', 'cache'), source: 'user' }
  ];
  if (workspaceRoot) {
    roots.unshift(
      { path: join(workspaceRoot, '.agents', 'skills'), source: 'workspace' },
      { path: join(workspaceRoot, '.codex', 'skills'), source: 'workspace' }
    );
  }

  const found: AgentSkill[] = [];
  for (const root of roots) {
    for (const filePath of await findSkillFiles(root.path, root.path.endsWith(join('plugins', 'cache')) ? 8 : 4)) {
      if (found.length >= MAX_SKILLS) break;
      try {
        const info = await stat(filePath);
        if (info.size > MAX_SKILL_BYTES) continue;
        found.push(parseSkillDocument(await readFile(filePath, 'utf8'), filePath, root.source));
      } catch {
        // A skill may be removed while discovery is running.
      }
    }
  }

  const unique = new Map<string, AgentSkill>();
  for (const skill of found) {
    const key = skill.name.toLowerCase();
    if (!unique.has(key)) unique.set(key, skill);
  }
  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function selectedSkills(prompt: string, skills: AgentSkill[]): AgentSkill[] {
  const names = [...prompt.matchAll(/(?:^|\s)\$([A-Za-z0-9][\w.:-]*)/g)].map((match) => match[1]?.toLowerCase());
  return [...new Set(names)]
    .flatMap((name) => skills.filter((skill) => skill.name.toLowerCase() === name));
}

export function skillCatalog(skills: AgentSkill[]): string {
  if (!skills.length) return '';
  return [
    'Available skills (load a skill only when the user explicitly mentions `$name`):',
    ...skills.map((skill) => `- $${skill.name}: ${skill.description}`)
  ].join('\n');
}

export function skillInstructions(prompt: string, skills: AgentSkill[]): string {
  return skillInstructionsFor(selectedSkills(prompt, skills));
}

export function skillInstructionsFor(selected: AgentSkill[]): string {
  if (!selected.length) return '';
  return [
    'The following skill contents are supplied by the IDE host. They are already loaded and do not need to exist inside the current workspace. Follow them directly; never search the workspace for these SKILL.md files or claim that only their names are available. If a selected skill references another relative file, use the read_skill_file tool with that skill name and relative path before following the reference.',
    ...selected.map((skill) =>
      `<skill name="${skill.name}" source="${skill.source}" path="${skill.path}">\n${skill.content ?? ''}\n</skill>`
    )
  ].join('\n\n');
}

async function findSkillFiles(root: string, depth: number): Promise<string[]> {
  if (depth < 0) return [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const direct = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === 'skill.md');
  if (direct) return [join(root, direct.name)];
  const nested: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') && depth < 4) continue;
    nested.push(...await findSkillFiles(join(root, entry.name), depth - 1));
  }
  return nested;
}

function normalizeName(value: string): string {
  return value.trim().replace(/^\$/, '').replace(/\s+/g, '-').replace(/[^\w.:-]/g, '').slice(0, 80) || 'skill';
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatterFields(source: string): Map<string, string> {
  const fields = new Map<string, string>();
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index]?.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/);
    if (!match?.[1]) continue;
    const key = match[1].toLowerCase();
    const rawValue = match[2] ?? '';
    if (rawValue === '|' || rawValue === '>') {
      const block: string[] = [];
      while (index + 1 < lines.length && /^(?:\s+|$)/.test(lines[index + 1] ?? '')) {
        index++;
        block.push((lines[index] ?? '').replace(/^\s+/, ''));
      }
      fields.set(key, rawValue === '>' ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').trim());
    } else {
      fields.set(key, unquote(rawValue));
    }
  }
  return fields;
}
