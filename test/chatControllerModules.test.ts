import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAT_VIEW_CONTROLLER } from '../src/webview/chatViewController';

const moduleNames = [
  'core',
  'dialogs',
  'streaming',
  'models',
  'markdown',
  'activity',
  'panels',
  'transcript',
  'commandActions',
  'composer',
  'events',
  'hostLifecycle',
  'hostModels',
  'hostInteraction',
  'hostChanges',
  'hostTurns'
] as const;

describe('chat controller modules', () => {
  it('keeps the controller entrypoint as an ordered module composition', () => {
    const entrypoint = readFileSync(resolve('src/webview/chatViewController.ts'), 'utf8');
    let previous = -1;
    for (const name of moduleNames) {
      const index = entrypoint.indexOf(`./controller/${name}`);
      expect(index, `${name} is imported`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(entrypoint).not.toContain('acquireVsCodeApi');
    expect(entrypoint.split(/\r?\n/).length).toBeLessThan(60);
  });

  it('keeps every controller domain below the monolith threshold', () => {
    for (const name of moduleNames) {
      const source = readFileSync(resolve(`src/webview/controller/${name}.ts`), 'utf8');
      expect(source.split(/\r?\n/).length, `${name}.ts line count`).toBeLessThan(750);
    }
  });

  it('assembles one syntactically valid browser script', () => {
    expect(() => new Function(CHAT_VIEW_CONTROLLER)).not.toThrow();
    expect(CHAT_VIEW_CONTROLLER).toContain('const vscode = acquireVsCodeApi();');
    expect(CHAT_VIEW_CONTROLLER).toContain("window.addEventListener('message', ({ data }) =>");
    expect(CHAT_VIEW_CONTROLLER.trimEnd()).toMatch(/requestBootstrap\(\);$/);
  });
});
