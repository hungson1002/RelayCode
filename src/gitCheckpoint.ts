import { execFile } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);
const CHECKPOINTS_STATE = 'nineRouter.gitCheckpoints';

export interface GitCheckpoint {
  id: string;
  hash: string;
  root: string;
  createdAt: number;
  tracked: string[];
  untracked: string[];
}

export class GitCheckpointManager {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public list(): GitCheckpoint[] {
    return this.context.workspaceState.get<GitCheckpoint[]>(CHECKPOINTS_STATE, []);
  }

  public async create(workspaceRoot: string): Promise<GitCheckpoint | undefined> {
    try {
      const root = (await git(workspaceRoot, ['rev-parse', '--show-toplevel'])).trim();
      let hash = (await git(root, ['stash', 'create', `9Router checkpoint ${new Date().toISOString()}`])).trim();
      if (!hash) hash = (await git(root, ['rev-parse', 'HEAD'])).trim();
      const checkpoint: GitCheckpoint = {
        id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        hash,
        root,
        createdAt: Date.now(),
        tracked: splitZero(await git(root, ['ls-files', '-z'])),
        untracked: splitZero(await git(root, ['ls-files', '--others', '--exclude-standard', '-z']))
      };
      await this.context.workspaceState.update(CHECKPOINTS_STATE, [checkpoint, ...this.list()].slice(0, 20));
      return checkpoint;
    } catch {
      return undefined;
    }
  }

  public async restore(id: string): Promise<GitCheckpoint> {
    const checkpoint = this.list().find((item) => item.id === id);
    if (!checkpoint) throw new Error('Không tìm thấy Git checkpoint này.');
    const currentTracked = splitZero(await git(checkpoint.root, ['ls-files', '-z']));
    const currentUntracked = splitZero(await git(checkpoint.root, ['ls-files', '--others', '--exclude-standard', '-z']));
    const initial = new Set([...checkpoint.tracked, ...checkpoint.untracked]);
    const createdAfter = [...new Set([...currentTracked, ...currentUntracked])].filter((path) => !initial.has(path));

    await git(checkpoint.root, ['reset', checkpoint.hash, '--', '.']);
    await git(checkpoint.root, ['checkout', checkpoint.hash, '--', '.']);
    for (const path of createdAfter) {
      const absolute = resolve(checkpoint.root, path);
      const rel = relative(checkpoint.root, absolute);
      if (rel.startsWith(`..${sep}`) || rel === '..') continue;
      await vscode.workspace.fs.delete(vscode.Uri.file(absolute), { recursive: false, useTrash: false }).then(undefined, () => undefined);
    }
    return checkpoint;
  }
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return result.stdout;
}

function splitZero(value: string): string[] {
  return value.split('\0').map((item) => item.trim()).filter(Boolean);
}
