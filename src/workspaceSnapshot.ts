import * as vscode from 'vscode';
import { execFile, spawn } from 'node:child_process';
import { existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { countLineChanges, isBinaryContent } from './diffHunks';

const MAX_SNAPSHOT_FILES = 2500;
const MAX_SNAPSHOT_FILE_BYTES = 2_000_000;
const MAX_SNAPSHOT_BYTES = 32_000_000;
const execFileAsync = promisify(execFile);

const EXCLUDED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  '.cache',
  '.turbo',
  '.parcel-cache',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.playwright-mcp',
  'old-vsix',
  'bin',
  'obj',
  'vendor',
  'pods',
  '.gradle'
]);

const FIND_FILES_EXCLUDE = '**/{.git,node_modules,dist,out,build,coverage,.next,.nuxt,target,.venv,venv,__pycache__,.cache,.turbo,.parcel-cache,.pytest_cache,.mypy_cache,.ruff_cache,.playwright-mcp,old-vsix,bin,obj,vendor,Pods,.gradle}/**';

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

interface SnapshotMetadata {
  startedAt: number;
  source: 'git' | 'findFiles';
  truncated: boolean;
  skippedKeys: Set<string>;
}

const snapshotMetadata = new WeakMap<FileSnapshot, SnapshotMetadata>();

export async function captureWorkspaceSnapshot(root: string, includePaths: string[] = []): Promise<FileSnapshot> {
  const startedAt = Date.now();
  const normalizedRoot = resolve(root);
  const snapshot: FileSnapshot = new Map();
  const skippedKeys = new Set<string>();
  const gitPaths = await gitWorkspacePaths(normalizedRoot);
  const source: 'git' | 'findFiles' = gitPaths ? 'git' : 'findFiles';

  const includedByKey = new Map<string, string>();
  for (const rawPath of includePaths) {
    const resolved = resolve(rawPath);
    if (!isInside(normalizedRoot, resolved)) continue;
    if (hasExcludedDirectory(relative(normalizedRoot, resolved))) continue;
    const key = pathKey(resolved);
    if (!includedByKey.has(key)) includedByKey.set(key, resolved);
  }

  const discoveredByKey = new Map<string, string>();
  let truncated = false;
  if (gitPaths) {
    for (const relPath of gitPaths) {
      if (hasExcludedDirectory(relPath)) continue;
      const resolved = resolve(normalizedRoot, relPath);
      if (!isInside(normalizedRoot, resolved)) continue;
      const key = pathKey(resolved);
      if (!includedByKey.has(key) && !discoveredByKey.has(key)) discoveredByKey.set(key, resolved);
    }
    if (discoveredByKey.size > MAX_SNAPSHOT_FILES) truncated = true;
  } else {
    const uris = await vscode.workspace.findFiles('**/*', FIND_FILES_EXCLUDE, MAX_SNAPSHOT_FILES + 1);
    if (uris.length > MAX_SNAPSHOT_FILES) truncated = true;
    const sortedUris = uris
      .map((uri) => resolve(uri.fsPath))
      .filter((fsPath) => isInside(normalizedRoot, fsPath) && !hasExcludedDirectory(relative(normalizedRoot, fsPath)))
      .sort((left, right) => pathKey(left).localeCompare(pathKey(right)));
    for (const resolved of sortedUris) {
      const key = pathKey(resolved);
      if (!includedByKey.has(key) && !discoveredByKey.has(key)) discoveredByKey.set(key, resolved);
    }
  }

  // Only check gitignore for newly added includePaths that were NOT already present
  // in gitPaths — never strip paths that were already captured in `before`, and
  // never drop tracked files when git check-ignore --no-index sees them in .gitignore.
  if (gitPaths && includedByKey.size) {
    const gitAbsoluteKeys = new Set<string>();
    for (const relPath of gitPaths) gitAbsoluteKeys.add(pathKey(resolve(normalizedRoot, relPath)));
    const extraIncluded = [...includedByKey.entries()]
      .filter(([key]) => !gitAbsoluteKeys.has(key))
      .map(([, fsPath]) => fsPath);
    if (extraIncluded.length && extraIncluded.length <= 500) {
      const ignored = await gitIgnoredWorkspacePaths(normalizedRoot, extraIncluded);
      for (const relIgnored of ignored) {
        const key = pathKey(resolve(normalizedRoot, relIgnored));
        // Keep the entry in skippedKeys rather than pretending it was deleted!
        if (includedByKey.delete(key)) skippedKeys.add(key);
      }
    }
  }

  // Always inspect includePaths (files from `before`) FIRST so they are never
  // evicted by MAX_SNAPSHOT_FILES, then deterministically inspect discovered paths.
  const orderedDiscovered = [...discoveredByKey.values()].sort((left, right) => pathKey(left).localeCompare(pathKey(right)));
  const candidates: Array<{ path: string; fromInclude: boolean }> = [
    ...[...includedByKey.values()].map((path) => ({ path, fromInclude: true })),
    ...orderedDiscovered.map((path) => ({ path, fromInclude: false }))
  ];

  let total = 0;
  let discoveredVisited = 0;
  for (const { path, fromInclude } of candidates) {
    const key = pathKey(path);
    if (!fromInclude) {
      if (discoveredVisited >= MAX_SNAPSHOT_FILES) {
        truncated = true;
        break;
      }
      discoveredVisited++;
    }
    if (!isInside(normalizedRoot, path) || !realPathIsInside(normalizedRoot, path)) continue;

    const uri = vscode.Uri.file(path);
    let existed = true;
    let fileSize: number | undefined;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type & vscode.FileType.Directory) continue;
      fileSize = stat.size;
    } catch {
      existed = false;
    }

    if (!existed) {
      // Confirm non-existence synchronously before recording existed: false.
      if (existsSync(path)) {
        skippedKeys.add(key);
        continue;
      }
      snapshot.set(path, { bytes: new Uint8Array(), existed: false });
      continue;
    }

    if (fileSize !== undefined && (fileSize > MAX_SNAPSHOT_FILE_BYTES || total + fileSize > MAX_SNAPSHOT_BYTES)) {
      truncated = true;
      skippedKeys.add(key);
      continue;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > MAX_SNAPSHOT_FILE_BYTES || total + bytes.byteLength > MAX_SNAPSHOT_BYTES) {
        truncated = true;
        skippedKeys.add(key);
        continue;
      }
      total += bytes.byteLength;
      snapshot.set(path, { bytes, existed: true });
    } catch {
      // Transient Windows/OneDrive/AV lock or unreadable file: never treat as deleted.
      skippedKeys.add(key);
    }
  }

  snapshotMetadata.set(snapshot, { startedAt, source, truncated, skippedKeys });
  return snapshot;
}

export function diffWorkspaceSnapshots(before: FileSnapshot, after: FileSnapshot): SnapshotChange[] {
  const beforeMeta = snapshotMetadata.get(before);
  const afterMeta = snapshotMetadata.get(after);

  const beforeByKey = new Map<string, { path: string; entry: SnapshotFile }>();
  for (const [path, entry] of before.entries()) beforeByKey.set(pathKey(path), { path, entry });

  const afterByKey = new Map<string, { path: string; entry: SnapshotFile }>();
  for (const [path, entry] of after.entries()) afterByKey.set(pathKey(path), { path, entry });

  const changes: SnapshotChange[] = [];
  for (const key of new Set([...beforeByKey.keys(), ...afterByKey.keys()])) {
    if (beforeMeta?.skippedKeys.has(key) || afterMeta?.skippedKeys.has(key)) continue;

    const beforeRecord = beforeByKey.get(key);
    const afterRecord = afterByKey.get(key);
    const displayPath = afterRecord?.path ?? beforeRecord?.path;
    if (!displayPath) continue;

    // Missing from `after` when present in `before`: only treat as deleted if
    // the file truly no longer exists on disk (never because of snapshot caps/locks).
    if (beforeRecord && !afterRecord) {
      if (!beforeRecord.entry.existed) continue;
      if (existsSync(displayPath)) continue;
    }

    // Missing from `before` when present in `after`: if `before` was truncated or
    // used a different enumerator (git vs findFiles), verify the file was actually
    // modified/created after `before` started rather than pre-existing untouched.
    if (!beforeRecord && afterRecord) {
      if (!afterRecord.entry.existed) continue;
      if (beforeMeta && (beforeMeta.truncated || (afterMeta && beforeMeta.source !== afterMeta.source))) {
        try {
          const stat = statSync(displayPath);
          const latestTouch = Math.max(stat.mtimeMs, stat.ctimeMs);
          if (latestTouch < beforeMeta.startedAt - 1_500) continue;
        } catch {
          continue;
        }
      }
    }

    const original = beforeRecord?.entry ?? { bytes: new Uint8Array(), existed: false };
    const updated = afterRecord?.entry ?? { bytes: new Uint8Array(), existed: false };
    if (original.existed === updated.existed && bytesEqual(original.bytes, updated.bytes)) continue;

    const counts = countLineChanges(original.bytes, updated.bytes);
    // Ignore pure EOL-only byte churn (e.g. CRLF/LF normalization side effects)
    // when neither content lines nor file existence changed.
    if (original.existed && updated.existed && counts.added === 0 && counts.removed === 0
      && !isBinaryContent(original.bytes) && !isBinaryContent(updated.bytes)) {
      continue;
    }

    changes.push({
      path: displayPath,
      original: original.bytes,
      updated: updated.bytes,
      existed: original.existed,
      ...counts
    });
  }
  return changes;
}

function pathKey(value: string): string {
  const normalized = resolve(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function hasExcludedDirectory(relPath: string): boolean {
  const segments = relPath.replace(/\\/g, '/').split('/');
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]?.toLowerCase();
    if (segment && EXCLUDED_DIR_NAMES.has(segment)) return true;
  }
  return false;
}

async function gitWorkspacePaths(root: string): Promise<Set<string> | undefined> {
  try {
    const { stdout } = await execFileAsync('git', [
      '-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'
    ], { windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 15_000 });
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
    child.stdin.on('error', () => undefined);
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
  try {
    if (!existsSync(root)) return isInside(root, target);
    const realRoot = realpathSync.native(root);
    let existing = target;
    while (true) {
      try {
        const stat = lstatSync(existing);
        if (stat.isSymbolicLink()) {
          // Reject dangling or escaping symlinks/junctions immediately.
          if (!existsSync(existing)) return false;
          return isInside(realRoot, realpathSync.native(existing));
        }
        return isInside(realRoot, realpathSync.native(existing));
      } catch {
        const parent = dirname(existing);
        if (parent === existing) return false;
        existing = parent;
      }
    }
  } catch {
    return false;
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}
