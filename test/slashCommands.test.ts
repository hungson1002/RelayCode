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
  '/terminal',
  '/browser',
  '/pr',
  '/schedule',
  '/plugins',
  '/hooks',
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

  it('turns every ordinary slash-menu selection into a sendable command token', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("composerCommand = { key: item.key, label: item.label || item.key }");
    expect(CHAT_VIEW_CONTROLLER).toContain("$('prompt').value = ''");
    expect(CHAT_VIEW_CONTROLLER).toContain('renderComposerTokens()');
    expect(CHAT_VIEW_CONTROLLER).toContain("} else if (item.kind === 'mention') {");
    expect(CHAT_VIEW_CONTROLLER).toContain('replaceComposerTrigger(trigger, item.key)');
    expect(CHAT_VIEW_CONTROLLER).toContain("composerCommand.key === '/browser' && argument");
  });

  it('persists local workspace commands as normal chat turns', () => {
    expect(providerSource).toContain('private async recordLocalCommand(');
    for (const command of ['/terminal', '/browser', '/schedule', '/plugins', '/hooks']) {
      expect(providerSource, `${command} does not record a local command result`).toContain(`recordLocalCommand('${command}'`);
    }
    expect(providerSource).toContain("this.transcript.push({ role: 'user', content: command");
    expect(providerSource).toContain("this.transcript.push({ role: 'assistant', content: result");
    expect(providerSource).toContain('await this.saveSession(mode, model)');
  });

  it('connects Browser to Playwright MCP and preserves the typed task', () => {
    expect(CHAT_VIEW_CONTROLLER).toContain("'Control a real browser with Playwright'");
    expect(providerSource).toContain("'@playwright/mcp@latest'");
    expect(providerSource).toContain("turnContext?.browser");
    expect(providerSource).toContain("must call at least one of these Browser Agent tools");
    expect(providerSource).toContain("Do not claim that you cannot click, scroll, type");
    expect(providerSource).toContain("if (turnContext?.browser && !browserToolUsed)");
    expect(providerSource).toContain("đã từ chối hoặc trả lời mà không dùng Browser Agent");
    expect(providerSource).toContain("prompt: task, mode: 'agent'");
  });
});
