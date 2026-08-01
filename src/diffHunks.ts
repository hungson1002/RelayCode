export interface DiffHunk {
  id: number;
  originalStart: number;
  originalCount: number;
  updatedStart: number;
  updatedCount: number;
  before: string[];
  after: string[];
  originalTrailingNewline?: boolean;
  updatedTrailingNewline?: boolean;
  originalEol?: '\n' | '\r\n';
  updatedEol?: '\n' | '\r\n';
}

type Op = { type: 'equal' | 'delete' | 'insert'; line: string };

export interface LineChangeStats {
  added: number;
  removed: number;
}

export function countLineChanges(original: Uint8Array, updated: Uint8Array): LineChangeStats {
  const before = lines(original);
  const after = lines(updated);
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix
    && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix++;
  const beforeLength = before.length - prefix - suffix;
  const afterLength = after.length - prefix - suffix;
  if (!beforeLength) return { added: afterLength, removed: 0 };
  if (!afterLength) return { added: 0, removed: beforeLength };
  const distance = shortestEditDistance(
    before.slice(prefix, prefix + beforeLength),
    after.slice(prefix, prefix + afterLength)
  );
  const delta = afterLength - beforeLength;
  return {
    added: (distance + delta) / 2,
    removed: (distance - delta) / 2
  };
}

export function createDiffHunks(original: Uint8Array, updated: Uint8Array): DiffHunk[] {
  const originalText = new TextDecoder().decode(original);
  const updatedText = new TextDecoder().decode(updated);
  const originalTrailingNewline = originalText.endsWith('\n');
  const updatedTrailingNewline = updatedText.endsWith('\n');
  const originalEol = originalText.includes('\r\n') ? '\r\n' : '\n';
  const updatedEol = updatedText.includes('\r\n') ? '\r\n' : '\n';
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
      after: added,
      originalTrailingNewline,
      updatedTrailingNewline,
      originalEol,
      updatedEol
    });
  }
  if (!hunks.length && (
    originalTrailingNewline !== updatedTrailingNewline
    || originalEol !== updatedEol
  )) {
    hunks.push({
      id: 0,
      originalStart: before.length,
      originalCount: 0,
      updatedStart: after.length,
      updatedCount: 0,
      before: [],
      after: [],
      originalTrailingNewline,
      updatedTrailingNewline,
      originalEol,
      updatedEol
    });
  }
  return hunks;
}

export function applyForward(original: Uint8Array, hunk: DiffHunk): Uint8Array {
  const content = lines(original);
  content.splice(hunk.originalStart, hunk.originalCount, ...hunk.after);
  return encode(content, original, hunk.updatedTrailingNewline, hunk.updatedEol);
}

export function applyReverse(updated: Uint8Array, hunk: DiffHunk): Uint8Array {
  const content = lines(updated);
  content.splice(hunk.updatedStart, hunk.updatedCount, ...hunk.before);
  return encode(content, updated, hunk.originalTrailingNewline, hunk.originalEol);
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

function shortestEditDistance(before: string[], after: string[]): number {
  const maximum = before.length + after.length;
  const offset = maximum + 1;
  const furthest = new Int32Array((maximum * 2) + 3);
  furthest.fill(-1);
  furthest[offset + 1] = 0;
  for (let distance = 0; distance <= maximum; distance++) {
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const index = offset + diagonal;
      let x = diagonal === -distance
        || (diagonal !== distance && furthest[index - 1]! < furthest[index + 1]!)
        ? furthest[index + 1]!
        : furthest[index - 1]! + 1;
      let y = x - diagonal;
      while (x < before.length && y < after.length && before[x] === after[y]) {
        x++;
        y++;
      }
      furthest[index] = x;
      if (x >= before.length && y >= after.length) return distance;
    }
  }
  return maximum;
}

function lines(value: Uint8Array): string[] {
  if (!value.byteLength) return [];
  return new TextDecoder().decode(value).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
}

function encode(
  value: string[],
  reference: Uint8Array,
  trailingOverride?: boolean,
  eolOverride?: '\n' | '\r\n'
): Uint8Array {
  const source = new TextDecoder().decode(reference);
  const trailing = trailingOverride ?? source.endsWith('\n');
  const eol = eolOverride ?? (source.includes('\r\n') ? '\r\n' : '\n');
  return new TextEncoder().encode(value.join(eol) + (trailing && value.length ? eol : ''));
}
