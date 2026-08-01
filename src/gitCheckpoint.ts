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
  scope?: string;
  indexHash?: string;
  tracked: string[];
  untracked: string[];
  untrackedContents?: Record<string, string>;
}

export class GitCheckpointManager {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public list(): GitCheckpoint[] {
    return this.context.workspaceState.get<GitCheckpoint[]>(CHECKPOINTS_STATE, []);
  }

  public async create(workspaceRoot: string): Promise<GitCheckpoint | undefined> {
    try {
      const root = (await git(workspaceRoot, ['rev-parse', '--show-toplevel'])).trim();
      const scope = relative(root, resolve(workspaceRoot)) || '.';
      if (scope === '..' || scope.startsWith(`..${sep}`)) return undefined;
      let hash = (await git(root, ['stash', 'create', `Loi Agent checkpoint ${new Date().toISOString()}`])).trim();
      if (!hash) hash = (await git(root, ['rev-parse', 'HEAD'])).trim();
      const tracked = splitZero(await git(root, ['ls-files', '-z', '--', scope]));
      const untracked = splitZero(await git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', scope]));
      const untrackedContents: Record<string, string> = {};
      let capturedBytes = 0;
      for (const path of untracked) {
        try {
          const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(resolve(root, path)));
          if (bytes.byteLength > 4_000_000 || capturedBytes + bytes.byteLength > 32_000_000) continue;
          capturedBytes += bytes.byteLength;
          untrackedContents[path] = Buffer.from(bytes).toString('base64');
        } catch {
          // A transient or unreadable untracked file remains outside the snapshot.
        }
      }
      let indexHash: string | undefined;
      try {
        indexHash = (await git(root, ['rev-parse', `${hash}^2`])).trim() || undefined;
      } catch {
        // A clean checkpoint that falls back to HEAD has no stash index parent.
      }
      const checkpoint: GitCheckpoint = {
        id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        hash,
        root,
        createdAt: Date.now(),
        scope,
        indexHash,
        tracked,
        untracked,
        untrackedContents
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
    const scope = checkpoint.scope ?? '.';
    const currentTracked = splitZero(await git(checkpoint.root, ['ls-files', '-z', '--', scope]));
    const currentUntracked = splitZero(await git(checkpoint.root, ['ls-files', '--others', '--exclude-standard', '-z', '--', scope]));
    const initial = new Set([...checkpoint.tracked, ...checkpoint.untracked]);
    const createdAfter = [...new Set([...currentTracked, ...currentUntracked])].filter((path) => !initial.has(path));

    await git(checkpoint.root, ['checkout', checkpoint.hash, '--', scope]);
    await git(checkpoint.root, ['reset', checkpoint.indexHash ?? checkpoint.hash, '--', scope]);
    for (const [path, encoded] of Object.entries(checkpoint.untrackedContents ?? {})) {
      const absolute = safeCheckpointPath(checkpoint.root, scope, path);
      if (!absolute) continue;
      const parent = vscode.Uri.file(resolve(absolute, '..'));
      await vscode.workspace.fs.createDirectory(parent);
      await vscode.workspace.fs.writeFile(vscode.Uri.file(absolute), Buffer.from(encoded, 'base64'));
    }
    for (const path of createdAfter) {
      const absolute = safeCheckpointPath(checkpoint.root, scope, path);
      if (!absolute) continue;
      await vscode.workspace.fs.delete(vscode.Uri.file(absolute), { recursive: false, useTrash: false }).then(undefined, () => undefined);
    }
    return checkpoint;
  }
}

function safeCheckpointPath(root: string, scope: string, path: string): string | undefined {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`)) return undefined;
  if (scope !== '.' && rel !== scope && !rel.startsWith(`${scope}${sep}`)) return undefined;
  return absolute;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return result.stdout;
}

function splitZero(value: string): string[] {
  return value.split('\0').map((item) => item.trim()).filter(Boolean);
}
