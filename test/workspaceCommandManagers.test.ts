import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const terminal = {
    shellIntegration: undefined,
    show: vi.fn(),
    sendText: vi.fn(),
    dispose: vi.fn()
  };
  return {
    terminal,
    createTerminal: vi.fn(() => terminal),
    showQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    readFile: vi.fn(),
    update: vi.fn()
  };
});

vi.mock('vscode', () => ({
  window: {
    createTerminal: mocks.createTerminal,
    showQuickPick: mocks.showQuickPick,
    showInputBox: mocks.showInputBox,
    showInformationMessage: vi.fn(),
    onDidStartTerminalShellExecution: vi.fn(() => ({ dispose: vi.fn() })),
    onDidCloseTerminal: vi.fn(() => ({ dispose: vi.fn() }))
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: 'C:\\workspace' } }],
    asRelativePath: vi.fn((value: string) => value),
    fs: { readFile: mocks.readFile }
  },
  ThemeIcon: class ThemeIcon { public constructor(public readonly id: string) {} },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath })),
    joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({ fsPath: [base.fsPath, ...parts].join('/') }))
  }
}));

import { GitReviewManager } from '../src/gitReviewManager';
import { HookManager } from '../src/hookManager';
import { IntegratedTerminalManager } from '../src/integratedTerminalManager';
import { ScheduledTaskManager } from '../src/scheduledTaskManager';

describe('workspace command managers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFile.mockResolvedValue(new TextEncoder().encode('{}'));
  });

  it('reuses one RelayCode terminal instead of opening duplicates', () => {
    const manager = new IntegratedTerminalManager(vi.fn());
    manager.open();
    manager.open();
    expect(mocks.createTerminal).toHaveBeenCalledTimes(1);
    expect(mocks.terminal.show).toHaveBeenCalledTimes(2);
    manager.dispose();
  });

  it('creates and persists a scheduled Agent task', async () => {
    mocks.showQuickPick.mockResolvedValueOnce({ action: 'add' });
    mocks.showInputBox
      .mockResolvedValueOnce('Run the tests')
      .mockResolvedValueOnce('30');
    const state: unknown[] = [];
    const context = {
      workspaceState: {
        get: vi.fn(() => state),
        update: mocks.update
      }
    };
    const manager = new ScheduledTaskManager(context as never, vi.fn());
    const result = await manager.manage();
    expect(result).toContain('30');
    expect(result).toContain('Run the tests');
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(state).toHaveLength(1);
    manager.dispose();
  });

  it('builds a bounded PR/review prompt containing the selected diff', () => {
    const prompt = new GitReviewManager().reviewPrompt({
      root: 'C:\\workspace',
      scope: 'branch',
      reference: 'PR #12',
      title: 'PR #12: fix browser history',
      files: ['src/chatViewProvider.ts'],
      diff: 'diff --git a/a.ts b/a.ts\n+fixed'
    });
    expect(prompt).toContain('PR #12: fix browser history');
    expect(prompt).toContain('```diff');
    expect(prompt).toContain('+fixed');
  });

  it('loads an empty hooks file without requesting execution approval', async () => {
    const requestApproval = vi.fn(async () => true);
    await new HookManager().run('beforeAgent', 'C:\\workspace', requestApproval, vi.fn());
    expect(mocks.readFile).toHaveBeenCalledOnce();
    expect(requestApproval).not.toHaveBeenCalled();
  });
});
