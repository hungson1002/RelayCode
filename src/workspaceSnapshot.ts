import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { countLineChanges } from './diffHunks';

const MAX_SNAPSHOT_FILES = 2500;
const MAX_SNAPSHOT_FILE_BYTES = 2_000_000;
const MAX_SNAPSHOT_BYTES = 32_000_000;
const execFileAsync = promisify(execFile);

export interface SnapshotFile {
  bytes: Uint8Array;
  existed: boolean;
}

export type FileSnapshot = Map<string, SnapshotFile>;

export interface SnapshotChange {
  path: string;
  original: Uint8Array;
  updated: Uint8Array;
  existed: boolean;
  added: number;
  removed: number;
}

export async function captureWorkspaceSnapshot(root: string, includePaths: string[] = []): Promise<FileSnapshot> {
  const normalizedRoot = resolve(root);
  const snapshot: FileSnapshot = new Map();
  const gitPaths = await gitWorkspacePaths(normalizedRoot);
  const paths = new Set<string>();

  if (gitPaths) {
    for (const path of gitPaths) paths.add(resolve(normalizedRoot, path));
  } else {
    const uris = await vscode.workspace.findFiles(
      '**/*',
      '**/{.git,node_modules,dist,out,build,coverage,.next,target,.venv,venv,__pycache__}/**',
      MAX_SNAPSHOT_FILES
    );
    for (const uri of uris) {
      if (isInside(normalizedRoot, uri.fsPath)) paths.add(resolve(uri.fsPath));
    }
  }
  for (const path of includePaths) {
    if (isInside(normalizedRoot, path)) paths.add(resolve(path));
  }

  if (gitPaths && paths.size) {
    const ignored = await gitIgnoredWorkspacePaths(normalizedRoot, [...paths]);
    for (const path of ignored) paths.delete(resolve(normalizedRoot, path));
  }

  let total = 0;
  let visited = 0;
  for (const path of paths) {
    if (visited >= MAX_SNAPSHOT_FILES) break;
    visited++;
    if (!isInside(normalizedRoot, path) || !realPathIsInside(normalizedRoot, path)) continue;

    const uri = vscode.Uri.file(path);
    const existed = existsSync(path);
    if (!existed) {
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        snapshot.set(path, { bytes: new Uint8Array(), existed: false });
        continue;
      }
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > MAX_SNAPSHOT_FILE_BYTES || total + bytes.byteLength > MAX_SNAPSHOT_BYTES) continue;
      total += bytes.byteLength;
      snapshot.set(path, { bytes, existed: true });
    } catch { /* Ignore transient or unreadable files. */ }
  }
  return snapshot;
}

export function diffWorkspaceSnapshots(before: FileSnapshot, after: FileSnapshot): SnapshotChange[] {
  const changes: SnapshotChange[] = [];
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    const original = before.get(path) ?? { bytes: new Uint8Array(), existed: false };
    const updated = after.get(path) ?? { bytes: new Uint8Array(), existed: false };
    if (original.existed === updated.existed && bytesEqual(original.bytes, updated.bytes)) continue;
    changes.push({ path, original: original.bytes, updated: updated.bytes, existed: original.existed, ...countLineChanges(original.bytes, updated.bytes) });
  }
  return changes;
}

async function gitWorkspacePaths(root: string): Promise<Set<string> | undefined> {
  try {
    const { stdout } = await execFileAsync('git', [
      '-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'
    ], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    return new Set(stdout.split('\0').filter(Boolean));
  } catch {
    return undefined;
  }
}

async function gitIgnoredWorkspacePaths(root: string, absolutePaths: string[]): Promise<Set<string>> {
  if (!absolutePaths.length) return new Set();
  return new Promise((resolvePromise) => {
    const child = spawn('git', ['-C', root, 'check-ignore', '--no-index', '-z', '--stdin'], {
      cwd: root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    const output: Buffer[] = [];
    let settled = false;
    const finish = (paths: Set<string>) => {
      if (settled) return;
      settled = true;
      resolvePromise(paths);
    };
    child.on('error', () => finish(new Set()));
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.on('close', () => {
      finish(new Set(Buffer.concat(output).toString('utf8').split('\0').filter(Boolean)));
    });
    const input = absolutePaths.map((path) => relative(root, path).replace(/\\/g, '/') + '\0').join('');
    child.stdin.end(input);
  });
}

function isInside(root: string, target: string): boolean {
  const normalizedRoot = process.platform === 'win32' ? resolve(root).toLowerCase() : resolve(root);
  const normalizedTarget = process.platform === 'win32' ? resolve(target).toLowerCase() : resolve(target);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`);
}

function realPathIsInside(root: string, target: string): boolean {
  if (!existsSync(root)) return isInside(root, target);
  const realRoot = realpathSync.native(root);
  let existing = target;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) return false;
    existing = parent;
  }
  return isInside(realRoot, realpathSync.native(existing));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}
