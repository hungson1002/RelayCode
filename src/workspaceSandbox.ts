import { existsSync, realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

/**
 * A lightweight workspace boundary for file tools and command working
 * directories. This is intentionally process-local protection, not an OS or
 * container security boundary: shell commands still run with the user's OS
 * account after RelayCode's permission checks.
 */
export class WorkspaceSandbox {
  public readonly root: string;

  public constructor(workspaceRoot: string) {
    this.root = resolve(workspaceRoot);
  }

  public resolvePath(input = '.'): string {
    const target = resolve(this.root, input || '.');
    if (!pathIsInside(this.root, target) || !this.realPathIsInside(target)) {
      throw new Error('Đường dẫn nằm ngoài workspace hoặc đi qua symlink/junction không an toàn.');
    }
    return target;
  }

  public contains(input: string): boolean {
    const target = resolve(input);
    return pathIsInside(this.root, target) && this.realPathIsInside(target);
  }

  private realPathIsInside(target: string): boolean {
    if (!existsSync(this.root)) return pathIsInside(this.root, target);
    const realRoot = realpathSync.native(this.root);
    let existing = target;
    while (!existsSync(existing)) {
      const parent = dirname(existing);
      if (parent === existing) return false;
      existing = parent;
    }
    return pathIsInside(realRoot, realpathSync.native(existing));
  }
}

export function pathIsInside(root: string, target: string): boolean {
  const normalizedRoot = normalizePath(root);
  const normalizedTarget = normalizePath(target);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`);
}

function normalizePath(value: string): string {
  const normalized = resolve(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
