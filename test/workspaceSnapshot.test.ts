import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  FileType: { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 },
  Uri: {
    file: (fsPath: string) => ({ fsPath, path: fsPath.replace(/\\/g, '/'), scheme: 'file' })
  },
  RelativePattern: class {
    public constructor(public readonly base: unknown, public readonly pattern: string) {}
  },
  workspace: {
    findFiles: vi.fn(async () => []),
    fs: {
      stat: vi.fn(async (uri: { fsPath: string }) => {
        const { statSync } = await import('node:fs');
        const stat = statSync(uri.fsPath);
        return { type: stat.isDirectory() ? 2 : 1, size: stat.size, mtime: stat.mtimeMs };
      }),
      readFile: vi.fn(async (uri: { fsPath: string }) => {
        const { readFileSync } = await import('node:fs');
        return new Uint8Array(readFileSync(uri.fsPath));
      })
    }
  }
}));

import { captureWorkspaceSnapshot, diffWorkspaceSnapshots, type FileSnapshot } from '../src/workspaceSnapshot';

const encode = (value: string) => new TextEncoder().encode(value);

describe('workspaceSnapshot', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    while (createdDirs.length) {
      const dir = createdDirs.pop()!;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempWorkspace(): string {
    const dir = mkdtempSync(join(tmpdir(), 'relaycode-snap-'));
    createdDirs.push(dir);
    return dir;
  }

  it('never reports false deletions when a file missing from the after snapshot still exists on disk', () => {
    const dir = makeTempWorkspace();
    const untouchedFile = join(dir, 'src-existing.ts');
    writeFileSync(untouchedFile, 'export const ok = true;\n', 'utf8');

    const before: FileSnapshot = new Map([
      [untouchedFile, { bytes: encode('export const ok = true;\n'), existed: true }]
    ]);
    const after: FileSnapshot = new Map();

    expect(diffWorkspaceSnapshots(before, after)).toEqual([]);
  });

  it('reports real deletions when a file is actually removed from disk', () => {
    const dir = makeTempWorkspace();
    const deletedFile = join(dir, 'removed.ts');
    writeFileSync(deletedFile, 'line1\nline2\n', 'utf8');
    const before: FileSnapshot = new Map([
      [deletedFile, { bytes: encode('line1\nline2\n'), existed: true }]
    ]);
    unlinkSync(deletedFile);

    const changes = diffWorkspaceSnapshots(before, new Map());
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ path: deletedFile, existed: true, added: 0, removed: 2 });
  });

  it('ignores EOL-only churn (CRLF vs LF) and handles Windows path case differences without fake add/delete pairs', () => {
    const dir = makeTempWorkspace();
    const filePath = join(dir, 'Sample.ts');
    writeFileSync(filePath, 'one\r\ntwo\r\n', 'utf8');

    const before: FileSnapshot = new Map([
      [filePath, { bytes: encode('one\ntwo\n'), existed: true }]
    ]);
    const after: FileSnapshot = new Map([
      [process.platform === 'win32' ? filePath.toLowerCase() : filePath, { bytes: encode('one\r\ntwo\r\n'), existed: true }]
    ]);

    expect(diffWorkspaceSnapshots(before, after)).toEqual([]);
  });

  it('excludes heavy directories even when passed via includePaths and detects actual edits', async () => {
    const dir = makeTempWorkspace();
    mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
    const ignored = join(dir, 'node_modules', 'pkg', 'index.js');
    const tracked = join(dir, 'app.ts');
    writeFileSync(ignored, 'module.exports = 1;\n', 'utf8');
    writeFileSync(tracked, 'const a = 1;\n', 'utf8');

    const before = await captureWorkspaceSnapshot(dir, [tracked, ignored]);
    writeFileSync(ignored, 'module.exports = 2;\n', 'utf8');
    writeFileSync(tracked, 'const a = 1;\nconst b = 2;\n', 'utf8');
    const after = await captureWorkspaceSnapshot(dir, [tracked, ignored]);

    const changes = diffWorkspaceSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ path: tracked, added: 1, removed: 0 });
  });

  it('skips transient unreadable files instead of fabricating deletions', async () => {
    const dir = makeTempWorkspace();
    const locked = join(dir, 'locked.ts');
    writeFileSync(locked, 'export const locked = 1;\n', 'utf8');
    const vscode = await import('vscode');

    const before = await captureWorkspaceSnapshot(dir, [locked]);
    vi.mocked(vscode.workspace.fs.readFile).mockRejectedValueOnce(new Error('EBUSY: resource busy or locked'));
    const after = await captureWorkspaceSnapshot(dir, [locked]);

    expect(diffWorkspaceSnapshots(before, after)).toEqual([]);
  });
});
