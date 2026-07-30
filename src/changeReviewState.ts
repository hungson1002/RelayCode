export interface SessionBoundChange {
  sessionId?: string;
}

export function selectVisibleChanges<T extends SessionBoundChange>(
  entries: ReadonlyArray<readonly [string, T]>,
  visible: boolean,
  sessionId?: string
): Array<[string, T]> {
  if (!visible) return [];
  return entries
    .filter(([, change]) => !sessionId || change.sessionId === sessionId)
    .map(([id, change]) => [id, change]);
}
