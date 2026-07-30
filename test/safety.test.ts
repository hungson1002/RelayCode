import { describe, expect, it } from 'vitest';
import { validateCommandPolicy } from '../src/safetyPolicy';
import { applyForward, applyReverse, countLineChanges, createDiffHunks } from '../src/diffHunks';

const encode = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder().decode(value);

describe('Agent safety policy', () => {
  it('blocks destructive commands even without a user deny list', () => {
    expect(validateCommandPolicy('git reset --hard HEAD', { allow: [], deny: [] })).toContain('phá hủy');
    expect(validateCommandPolicy('Remove-Item C:\\work -Recurse -Force', { allow: [], deny: [] })).toContain('phá hủy');
    expect(validateCommandPolicy('Remove-Item C:\\work -Force -Recurse', { allow: [], deny: [] })).toContain('phá hủy');
    expect(validateCommandPolicy('Remove-Item C:\\work -Recurse', { allow: [], deny: [] })).toContain('phá hủy');
    expect(validateCommandPolicy('rm -fr ./work', { allow: [], deny: [] })).toContain('phá hủy');
    expect(validateCommandPolicy('cmd /c rd C:\\work /s', { allow: [], deny: [] })).toContain('phá hủy');
    expect(validateCommandPolicy('powershell -EncodedCommand ZABhAG4AZwBlAHIA', { allow: [], deny: [] })).toContain('phá hủy');
  });

  it('enforces allow and deny lists', () => {
    expect(validateCommandPolicy('npm test', { allow: ['npm'], deny: [] })).toBeUndefined();
    expect(validateCommandPolicy('curl example.com', { allow: ['npm'], deny: [] })).toContain('allow list');
    expect(validateCommandPolicy('npm-malicious test', { allow: ['npm'], deny: [] })).toContain('allow list');
    expect(validateCommandPolicy("npm test; Invoke-WebRequest 'https://example.com'", { allow: ['npm'], deny: [] })).toContain('allow list');
    expect(validateCommandPolicy("npm test\nInvoke-WebRequest 'https://example.com'", { allow: ['npm'], deny: [] })).toContain('allow list');
    expect(validateCommandPolicy('npm publish', { allow: [], deny: ['npm publish'] })).toContain('deny list');
  });
});

describe('Diff hunks', () => {
  it('counts insertions and deletions using an actual edit script', () => {
    expect(countLineChanges(encode('two\nthree\n'), encode('one\ntwo\nthree\n'))).toEqual({ added: 1, removed: 0 });
    expect(countLineChanges(encode('one\ntwo\nthree\n'), encode('one\nthree\n'))).toEqual({ added: 0, removed: 1 });
    expect(countLineChanges(encode('one\ntwo\n'), encode('one\nTWO\n'))).toEqual({ added: 1, removed: 1 });
  });

  it('does not count a trailing newline as a changed content line', () => {
    expect(countLineChanges(encode('one'), encode('one\n'))).toEqual({ added: 0, removed: 0 });
  });

  it('counts a small insertion accurately in files beyond the hunk LCS threshold', () => {
    const lines = Array.from({ length: 1_600 }, (_, index) => `line ${index}`);
    expect(countLineChanges(
      encode(`${lines.join('\n')}\n`),
      encode(`inserted\n${lines.join('\n')}\n`)
    )).toEqual({ added: 1, removed: 0 });
  });

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
