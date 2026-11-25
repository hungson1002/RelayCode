import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatSessionAsMarkdown, SessionStore, type PersistedSessionRecord } from '../src/sessionStore';

function createMemoryMemento() {
  const map = new Map<string, unknown>();
  return {
    get<T>(key: string, defaultValue: T): T {
      return map.has(key) ? (map.get(key) as T) : defaultValue;
    },
    async update(key: string, value: unknown): Promise<void> {
      map.set(key, value);
    }
  };
}

describe('SessionStore', () => {
  it('persists full session transcripts to disk, sorts pinned first and migrates legacy state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'relaycode-sessions-'));
    try {
      const state = createMemoryMemento();
      await state.update('nineRouter.chatSessions', [
        {
          id: 'legacy-1',
          title: 'Legacy Chat',
          updatedAt: 100,
          mode: 'chat',
          model: 'm1',
          turns: [{ role: 'user', content: 'old question', timestamp: 100 }]
        }
      ]);
      const store = new SessionStore<PersistedSessionRecord>(dir, state, 'nineRouter.chatSessions');

      // Reads legacy entry before migration
      expect((await store.load('legacy-1'))?.title).toBe('Legacy Chat');

      // Saves new sessions onto disk
      await store.save({
        id: 'disk-1',
        title: 'Build Video Player',
        updatedAt: 200,
        mode: 'agent',
        model: 'gpt-5',
        turns: [
          { role: 'user', content: 'Add inline video player', timestamp: 199 },
          { role: 'assistant', content: 'Done.', timestamp: 200 }
        ]
      });
      await store.save({
        id: 'disk-2',
        title: 'Pinned Audit',
        updatedAt: 150,
        mode: 'agent',
        model: 'gpt-5',
        pinned: true,
        turns: [{ role: 'user', content: 'Audit project', timestamp: 150 }]
      });

      const rawDisk = await readFile(join(dir, 'sessions', 'disk-1.json'), 'utf8');
      expect(JSON.parse(rawDisk).title).toBe('Build Video Player');

      const index = store.listIndex();
      expect(index.map((item) => item.id)).toEqual(['disk-2', 'disk-1', 'legacy-1']);
      expect(index[0]?.pinned).toBe(true);

      await store.updateMetadata('disk-1', (s) => ({ ...s, title: 'Renamed Player', manualTitle: true }));
      expect((await store.load('disk-1'))?.title).toBe('Renamed Player');

      await store.delete('disk-2');
      expect(store.listIndex().map((item) => item.id)).toEqual(['disk-1', 'legacy-1']);

      const md = formatSessionAsMarkdown((await store.load('disk-1'))!);
      expect(md).toContain('# Renamed Player');
      expect(md).toContain('## User');
      expect(md).toContain('Add inline video player');
      expect(md).toContain('## RelayCode');

      await store.deleteAll();
      expect(store.listIndex()).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
