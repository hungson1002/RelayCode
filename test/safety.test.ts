import { describe, expect, it } from 'vitest';
import { validateCommandPolicy } from '../src/safetyPolicy';
import { applyForward, applyReverse, createDiffHunks } from '../src/diffHunks';
import { buildContainerArgs } from '../src/sandboxArgs';

const encode = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder().decode(value);

describe('Agent safety policy', () => {
  it('blocks destructive commands even without a user deny list', () => {
    expect(validateCommandPolicy('git reset --hard HEAD', { allow: [], deny: [] })).toContain('phá hủy');
    expect(validateCommandPolicy('Remove-Item C:\\work -Recurse -Force', { allow: [], deny: [] })).toContain('phá hủy');
  });

  it('enforces allow and deny lists', () => {
    expect(validateCommandPolicy('npm test', { allow: ['npm'], deny: [] })).toBeUndefined();
    expect(validateCommandPolicy('curl example.com', { allow: ['npm'], deny: [] })).toContain('allow list');
    expect(validateCommandPolicy('npm publish', { allow: [], deny: ['npm publish'] })).toContain('deny list');
  });
});

describe('Sandbox command construction', () => {
  it('disables network and drops capabilities by default', () => {
    const args = buildContainerArgs('C:\\work', { image: 'node:22-bookworm', memory: '1g', cpus: 2, network: false }, 'npm test');
    expect(args).toContain('none');
    expect(args).toContain('ALL');
    expect(args).toContain('node:22-bookworm');
    expect(args.at(-1)).toBe('npm test');
  });
});

describe('Diff hunks', () => {
  it('accepts and undoes an individual hunk', () => {
    const original = encode('one\ntwo\nthree\n');
    const updated = encode('one\nTWO\nthree\nfour\n');
    const hunks = createDiffHunks(original, updated);
    expect(hunks).toHaveLength(2);
    expect(decode(applyForward(original, hunks[0]!))).toBe('one\nTWO\nthree\n');
    expect(decode(applyReverse(updated, hunks[1]!))).toBe('one\nTWO\nthree\n');
  });

  it('preserves CRLF line endings when applying a hunk', () => {
    const original = encode('one\r\ntwo\r\n');
    const updated = encode('one\r\nTWO\r\n');
    expect(decode(applyForward(original, createDiffHunks(original, updated)[0]!))).toBe('one\r\nTWO\r\n');
  });
});
