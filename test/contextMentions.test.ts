import { describe, expect, it } from 'vitest';
import { parseContextMentions } from '../src/contextMentions';

describe('context mentions', () => {
  it('recognizes every context item shown in the @ menu', () => {
    expect(parseContextMentions('@selection @terminal @git-diff @problems')).toMatchObject({
      selection: true,
      terminal: true,
      gitDiff: true,
      problems: true
    });
  });

  it('parses file and folder values including paths with spaces', () => {
    const parsed = parseContextMentions('@file:src/index.ts @file:"docs/My Guide.md" @folder:\'src/web view\'');
    expect(parsed.files).toEqual(['src/index.ts', 'docs/My Guide.md']);
    expect(parsed.folders).toEqual(['src/web view']);
  });

  it('bounds large mention lists before workspace reads', () => {
    const prompt = Array.from({ length: 12 }, (_, index) => `@file:file-${index}.ts`).join(' ');
    expect(parseContextMentions(prompt).files).toHaveLength(8);
  });
});
