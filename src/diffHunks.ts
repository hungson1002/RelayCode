export interface DiffHunk {
  id: number;
  originalStart: number;
  originalCount: number;
  updatedStart: number;
  updatedCount: number;
  before: string[];
  after: string[];
}

type Op = { type: 'equal' | 'delete' | 'insert'; line: string };

export function createDiffHunks(original: Uint8Array, updated: Uint8Array): DiffHunk[] {
  const before = lines(original);
  const after = lines(updated);
  const ops = diff(before, after);
  const hunks: DiffHunk[] = [];
  let originalLine = 0;
  let updatedLine = 0;
  let cursor = 0;
  while (cursor < ops.length) {
    const op = ops[cursor]!;
    if (op.type === 'equal') {
      originalLine++;
      updatedLine++;
      cursor++;
      continue;
    }
    const originalStart = originalLine;
    const updatedStart = updatedLine;
    const removed: string[] = [];
    const added: string[] = [];
    while (cursor < ops.length && ops[cursor]!.type !== 'equal') {
      const current = ops[cursor]!;
      if (current.type === 'delete') {
        removed.push(current.line);
        originalLine++;
      } else {
        added.push(current.line);
        updatedLine++;
      }
      cursor++;
    }
    hunks.push({
      id: hunks.length,
      originalStart,
      originalCount: removed.length,
      updatedStart,
      updatedCount: added.length,
      before: removed,
      after: added
    });
  }
  return hunks;
}

export function applyForward(original: Uint8Array, hunk: DiffHunk): Uint8Array {
  const content = lines(original);
  content.splice(hunk.originalStart, hunk.originalCount, ...hunk.after);
  return encode(content, original);
}

export function applyReverse(updated: Uint8Array, hunk: DiffHunk): Uint8Array {
  const content = lines(updated);
  content.splice(hunk.updatedStart, hunk.updatedCount, ...hunk.before);
  return encode(content, updated);
}

function diff(before: string[], after: string[]): Op[] {
  if (before.length * after.length > 2_000_000) {
    return [
      ...before.map((line): Op => ({ type: 'delete', line })),
      ...after.map((line): Op => ({ type: 'insert', line }))
    ];
  }
  const table = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
  for (let left = before.length - 1; left >= 0; left--) {
    for (let right = after.length - 1; right >= 0; right--) {
      table[left]![right] = before[left] === after[right]
        ? table[left + 1]![right + 1]! + 1
        : Math.max(table[left + 1]![right]!, table[left]![right + 1]!);
    }
  }
  const ops: Op[] = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      ops.push({ type: 'equal', line: before[left]! });
      left++;
      right++;
    } else if (table[left + 1]![right]! >= table[left]![right + 1]!) {
      ops.push({ type: 'delete', line: before[left++]! });
    } else {
      ops.push({ type: 'insert', line: after[right++]! });
    }
  }
  while (left < before.length) ops.push({ type: 'delete', line: before[left++]! });
  while (right < after.length) ops.push({ type: 'insert', line: after[right++]! });
  return ops;
}

function lines(value: Uint8Array): string[] {
  if (!value.byteLength) return [];
  return new TextDecoder().decode(value).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
}

function encode(value: string[], reference: Uint8Array): Uint8Array {
  const source = new TextDecoder().decode(reference);
  const trailing = source.endsWith('\n');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return new TextEncoder().encode(value.join(eol) + (trailing && value.length ? eol : ''));
}
