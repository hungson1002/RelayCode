import { describe, expect, it } from 'vitest';
import { selectVisibleChanges } from '../src/changeReviewState';

describe('change review state', () => {
  const changes: Array<readonly [string, { sessionId?: string; path: string }]> = [
    ['a', { sessionId: 'session-a', path: 'a.ts' }],
    ['b', { sessionId: 'session-b', path: 'b.ts' }],
    ['legacy', { path: 'legacy.ts' }]
  ];

  it('does not expose recovered changes in a blank conversation', () => {
    expect(selectVisibleChanges(changes, false, undefined)).toEqual([]);
  });

  it('shows only changes owned by the opened conversation', () => {
    expect(selectVisibleChanges(changes, true, 'session-a').map(([id]) => id)).toEqual(['a']);
    expect(selectVisibleChanges(changes, true, 'session-b').map(([id]) => id)).toEqual(['b']);
  });

  it('can expose all entries only when no session filter is requested', () => {
    expect(selectVisibleChanges(changes, true, undefined).map(([id]) => id)).toEqual(['a', 'b', 'legacy']);
  });

});
