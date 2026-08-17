import { describe, expect, it } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { WorkspaceSandbox, pathIsInside } from '../src/workspaceSandbox';

describe('WorkspaceSandbox', () => {
  const root = resolve('test-workspace');

  it('accepts workspace paths and rejects traversal', () => {
    const sandbox = new WorkspaceSandbox(root);

    expect(sandbox.resolvePath('src/index.ts')).toBe(join(root, 'src', 'index.ts'));
    expect(() => sandbox.resolvePath('../outside.txt')).toThrow('ngoài workspace');
  });

  it('does not confuse similarly prefixed sibling directories with descendants', () => {
    const sibling = `${root}-backup`;

    expect(pathIsInside(root, join(root, 'src'))).toBe(true);
    expect(pathIsInside(root, sibling)).toBe(false);
    expect(new WorkspaceSandbox(root).contains(join(dirname(root), 'outside.txt'))).toBe(false);
  });
});
