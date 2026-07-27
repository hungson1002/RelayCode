import { describe, expect, it } from 'vitest';
import { parseSkillDocument, selectedSkills, skillCatalog, skillInstructions } from '../src/skillRegistry';

describe('skill registry', () => {
  const skill = parseSkillDocument(
    '---\nname: design-frontend\ndescription: Build deliberate interfaces.\n---\n# Design\nUse a restrained visual system.',
    'C:\\repo\\.agents\\skills\\design-frontend\\SKILL.md',
    'workspace'
  );

  it('parses standard SKILL.md frontmatter', () => {
    expect(skill.name).toBe('design-frontend');
    expect(skill.description).toBe('Build deliberate interfaces.');
  });

  it('parses multiline YAML descriptions used by installed Codex skills', () => {
    const multiline = parseSkillDocument(
      '---\nname: frontend-design\ndescription: |\n  Build distinctive interfaces.\n  Avoid templated defaults.\n---\n# Frontend',
      'C:\\skills\\frontend-design\\SKILL.md',
      'user'
    );
    expect(multiline.description).toBe('Build distinctive interfaces.\nAvoid templated defaults.');
  });

  it('selects only explicitly mentioned skills', () => {
    expect(selectedSkills('Use $design-frontend for this task', [skill])).toEqual([skill]);
    expect(selectedSkills('design the frontend', [skill])).toEqual([]);
  });

  it('builds progressive-disclosure catalog and selected instructions', () => {
    expect(skillCatalog([skill])).toContain('$design-frontend');
    expect(skillInstructions('Run $design-frontend', [skill])).toContain('<skill name="design-frontend"');
    expect(skillInstructions('Run $design-frontend', [skill])).toContain('supplied by the IDE host');
    expect(skillInstructions('Run $design-frontend', [skill])).toContain('read_skill_file');
    expect(skillInstructions('No explicit skill', [skill])).toBe('');
  });
});
