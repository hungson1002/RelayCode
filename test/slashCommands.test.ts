import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAT_VIEW_CONTROLLER } from '../src/webview/chatViewController';

const providerSource = readFileSync(join(process.cwd(), 'src', 'chatViewProvider.ts'), 'utf8');

const visibleCommands = [
  '/goal',
  '/new',
  '/compact',
  '/summary',
  '/skills',
  '/model',
  '/plan',
  '/review',
  '/diff',
  '/ide-context',
  '/init',
  '/status',
  '/diagnostics',
  '/mcp',
  '/settings',
  '/logs',
  '/export'
] as const;

describe('slash command catalog', () => {
  it('keeps every visible command connected to a real handler', () => {
    for (const command of visibleCommands) {
      expect(CHAT_VIEW_CONTROLLER, `${command} is missing from the composer`).toContain(`['${command}'`);
      expect(providerSource, `${command} has no provider handler`).toContain(`'${command}'`);
    }
  });

  it('supports the persistent goal control forms documented by Codex', () => {
    expect(providerSource).toContain("pause|resume|clear|edit");
    expect(providerSource).toContain("type: 'editGoalComposer'");
    expect(CHAT_VIEW_CONTROLLER).toContain("data.type === 'editGoalComposer'");
  });
});
