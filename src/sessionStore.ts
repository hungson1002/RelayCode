import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SessionStoreMemento {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

export interface PersistedSessionIndexEntry {
  id: string;
  title: string;
  updatedAt: number;
  mode: string;
  model: string;
  kind?: 'chatgpt-web';
  aiTitled?: boolean;
  manualTitle?: boolean;
  pinned?: boolean;
  preview?: string;
  turnCount?: number;
}

export interface PersistedSessionRecord<TTurn = { role: string; content: string; timestamp?: number }> {
  id: string;
  title: string;
  updatedAt: number;
  mode: string;
  model: string;
  turns: TTurn[];
  activeSkills?: string[];
  summary?: string;
  kind?: 'chatgpt-web';
  aiTitled?: boolean;
  manualTitle?: boolean;
  pinned?: boolean;
}

const SESSION_INDEX_STATE = 'nineRouter.chatSessionIndex';
const MAX_DISK_SESSIONS = 200;

function safeSessionFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'session';
}

function derivePreview(turns: Array<{ role: string; content: string }>): string {
  for (let index = turns.length - 1; index >= 0; index--) {
    const text = String(turns[index]?.content || '').replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 120);
  }
  return '';
}

export class SessionStore<TSession extends PersistedSessionRecord> {
  private readonly sessionsDir: string;

  public constructor(
    private readonly storageDir: string,
    private readonly globalState: SessionStoreMemento,
    private readonly legacyStateKey: string
  ) {
    this.sessionsDir = join(storageDir, 'sessions');
  }

  private sessionPath(id: string): string {
    return join(this.sessionsDir, `${safeSessionFileName(id)}.json`);
  }

  public listIndex(): PersistedSessionIndexEntry[] {
    const indexed = this.globalState.get<PersistedSessionIndexEntry[]>(SESSION_INDEX_STATE, []);
    const legacy = this.globalState.get<TSession[]>(this.legacyStateKey, []);
    const merged = new Map<string, PersistedSessionIndexEntry>();
    for (const item of legacy) {
      merged.set(item.id, {
        id: item.id,
        title: item.title,
        updatedAt: item.updatedAt,
        mode: item.mode,
        model: item.model,
        kind: item.kind,
        aiTitled: item.aiTitled,
        manualTitle: item.manualTitle,
        pinned: item.pinned,
        preview: derivePreview(item.turns ?? []),
        turnCount: item.turns?.length ?? 0
      });
    }
    for (const entry of indexed) {
      merged.set(entry.id, entry);
    }
    return [...merged.values()].sort((left, right) => {
      const pinDiff = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
      return pinDiff !== 0 ? pinDiff : right.updatedAt - left.updatedAt;
    });
  }

  public async load(id: string): Promise<TSession | undefined> {
    try {
      const raw = await readFile(this.sessionPath(id), 'utf8');
      const parsed = JSON.parse(raw) as TSession;
      if (parsed && parsed.id === id) return parsed;
    } catch {
      // Fall back to legacy globalState entry when not yet migrated to disk.
    }
    const legacy = this.globalState.get<TSession[]>(this.legacyStateKey, []);
    return legacy.find((item) => item.id === id);
  }

  public async save(session: TSession): Promise<void> {
    try {
      await mkdir(this.sessionsDir, { recursive: true });
      await writeFile(this.sessionPath(session.id), JSON.stringify(session), 'utf8');
    } catch {
      // Disk storage is best-effort in read-only or mocked test environments.
    }
    const nextEntry: PersistedSessionIndexEntry = {
      id: session.id,
      title: session.title,
      updatedAt: session.updatedAt,
      mode: session.mode,
      model: session.model,
      ...(session.kind ? { kind: session.kind } : {}),
      ...(session.aiTitled ? { aiTitled: true } : {}),
      ...(session.manualTitle ? { manualTitle: true } : {}),
      ...(session.pinned ? { pinned: true } : {}),
      preview: derivePreview(session.turns ?? []),
      turnCount: session.turns?.length ?? 0
    };
    const existingIndex = this.listIndex().filter((item) => item.id !== session.id);
    const trimmedIndex = [nextEntry, ...existingIndex]
      .sort((left, right) => {
        const pinDiff = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
        return pinDiff !== 0 ? pinDiff : right.updatedAt - left.updatedAt;
      })
      .slice(0, MAX_DISK_SESSIONS);
    await this.globalState.update(SESSION_INDEX_STATE, trimmedIndex);
    // Keep top 20 recent sessions mirrored in legacy state for backward compatibility.
    const legacy = this.globalState.get<TSession[]>(this.legacyStateKey, []);
    await this.globalState.update(
      this.legacyStateKey,
      [session, ...legacy.filter((item) => item.id !== session.id)].slice(0, 20)
    );
  }

  public async updateMetadata(
    id: string,
    updater: (session: TSession) => TSession | undefined
  ): Promise<TSession | undefined> {
    const existing = await this.load(id);
    if (!existing) return undefined;
    const updated = updater(existing);
    if (!updated) return undefined;
    await this.save(updated);
    return updated;
  }

  public async delete(id: string): Promise<void> {
    await rm(this.sessionPath(id), { force: true }).catch(() => undefined);
    const nextIndex = this.listIndex().filter((item) => item.id !== id);
    await this.globalState.update(SESSION_INDEX_STATE, nextIndex);
    const legacy = this.globalState.get<TSession[]>(this.legacyStateKey, []);
    await this.globalState.update(this.legacyStateKey, legacy.filter((item) => item.id !== id));
  }

  public async deleteAll(): Promise<void> {
    const allIds = this.listIndex().map((item) => item.id);
    await Promise.all(allIds.map((id) => rm(this.sessionPath(id), { force: true }).catch(() => undefined)));
    await this.globalState.update(SESSION_INDEX_STATE, []);
    await this.globalState.update(this.legacyStateKey, []);
  }
}

export function formatSessionAsMarkdown(session: PersistedSessionRecord): string {
  const header = [
    `# ${session.title || 'RelayCode Conversation'}`,
    '',
    `- **Mode:** ${session.mode}`,
    session.model ? `- **Model:** \`${session.model}\`` : '',
    `- **Updated:** ${new Date(session.updatedAt).toLocaleString()}`,
    '',
    '---',
    ''
  ].filter((line, index, arr) => line !== '' || arr[index - 1] !== '').join('\n');

  const body = (session.turns ?? []).map((turn) => {
    const roleLabel = turn.role === 'user' ? '## User' : '## RelayCode';
    const timeLabel = turn.timestamp ? ` _(${new Date(turn.timestamp).toLocaleTimeString()})_` : '';
    return `${roleLabel}${timeLabel}\n\n${turn.content || ''}`;
  }).join('\n\n---\n\n');

  return `${header}${body}\n`;
}
