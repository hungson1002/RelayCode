import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const mocks = vi.hoisted(() => ({
  state: new Map<string, unknown>(),
  secrets: new Map<string, string>(),
  files: new Map<string, Uint8Array>(),
  diagnostics: vi.fn(() => []),
  update: vi.fn(async (key: string, value: unknown) => { mocks.state.set(key, value); })
}));

vi.mock('vscode', () => ({
  workspace: {
    isTrusted: true,
    workspaceFolders: [{ uri: { fsPath: process.cwd() } }],
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, fallback: unknown) => key === 'chatGptBridge.port' ? 43129 : fallback),
      update: vi.fn(async () => undefined)
    })),
    findFiles: vi.fn(async () => []),
    asRelativePath: vi.fn((value: string) => value),
    fs: {
      readFile: vi.fn(async (uri: { fsPath: string }) => {
        const value = mocks.files.get(uri.fsPath);
        if (!value) throw new Error('File not found');
        return value;
      }),
      writeFile: vi.fn(async (uri: { fsPath: string }, value: Uint8Array) => { mocks.files.set(uri.fsPath, value); }),
      createDirectory: vi.fn(async () => undefined),
      delete: vi.fn(async (uri: { fsPath: string }) => { mocks.files.delete(uri.fsPath); }),
      stat: vi.fn(async (uri: { fsPath: string }) => {
        if (!mocks.files.has(uri.fsPath)) throw new Error('File not found');
        return { type: 1, size: mocks.files.get(uri.fsPath)?.byteLength ?? 0 };
      })
    }
  },
  languages: { getDiagnostics: mocks.diagnostics },
  DiagnosticSeverity: { 0: 'Error', 1: 'Warning', 2: 'Information', 3: 'Hint' },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn()
  },
  env: {
    clipboard: { writeText: vi.fn() },
    openExternal: vi.fn()
  },
  Uri: {
    file: vi.fn((fsPath: string) => ({ fsPath })),
    parse: vi.fn((value: string) => ({ value }))
  }
}));

import { ChatGptBridge } from '../src/chatGptBridge';

describe('ChatGPT Web MCP bridge', () => {
  beforeEach(() => {
    mocks.state.clear();
    mocks.secrets.clear();
    mocks.files.clear();
    vi.clearAllMocks();
  });

  it('publishes focused workspace tools with safe MCP annotations', async () => {
    const bridge = createBridge();
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'sync_chat_session',
      'workspace_status',
      'read_workspace_file',
      'search_workspace',
      'write_workspace_file',
      'apply_workspace_patch',
      'delete_workspace_file',
      'run_workspace_command'
    ]));
    const read = listed.tools.find((tool) => tool.name === 'read_workspace_file');
    const write = listed.tools.find((tool) => tool.name === 'write_workspace_file');
    expect(read?.annotations?.readOnlyHint).toBe(true);
    expect(write?.annotations?.readOnlyHint).toBe(false);
    expect(write?.annotations?.destructiveHint).toBe(true);

    await client.close();
    await server.close();
  });

  it('serves model-readable structured workspace status and records activity', async () => {
    const onActivity = vi.fn();
    const bridge = createBridge(onActivity);
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'workspace_status', arguments: {} });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: true });
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ tool: 'workspace_status', ok: true }));
    expect(mocks.update).toHaveBeenCalled();

    await client.close();
    await server.close();
  });

  it('completes MCP discovery through the real loopback Streamable HTTP transport', async () => {
    const bridge = createBridge();
    const status = await bridge.start();
    const client = new Client({ name: 'relaycode-http-test', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(status.url!)));
      const listed = await client.listTools();
      expect(listed.tools).toHaveLength(12);
      expect(listed.tools.some((tool) => tool.name === 'list_pending_changes')).toBe(true);
    } finally {
      await client.close().catch(() => undefined);
      await bridge.stop();
    }
  });

  it('syncs an explicitly supplied ChatGPT transcript into RelayCode history', async () => {
    const syncChatSession = vi.fn(async () => ({
      sessionId: 'relaycode-chatgpt-web:abc123',
      title: 'Kiểm tra đồng bộ chat',
      messageCount: 2
    }));
    const bridge = createBridge(vi.fn(), { syncChatSession });
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-sync-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'sync_chat_session',
      arguments: {
        conversationId: 'chat-sync-test',
        title: 'Kiểm tra đồng bộ chat',
        messages: [
          { role: 'user', content: 'Đồng bộ chat này.' },
          { role: 'assistant', content: 'Được.' }
        ]
      }
    });
    expect(result.isError).not.toBe(true);
    expect(syncChatSession).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'chat-sync-test',
      messages: expect.arrayContaining([expect.objectContaining({ role: 'user' })])
    }));
    expect(result.structuredContent).toMatchObject({ ok: true, data: { messageCount: 2 } });

    await client.close();
    await server.close();
  });

  it('routes a ChatGPT file write into the RelayCode review callback', async () => {
    const registerChange = vi.fn();
    const requestApproval = vi.fn(async () => true);
    const bridge = createBridge(vi.fn(), { registerChange, requestApproval });
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-write-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'write_workspace_file', arguments: { path: 'chatgpt-test.txt', content: 'hello\n' } });
    expect(result.isError).not.toBe(true);
    expect(requestApproval).toHaveBeenCalledOnce();
    expect(registerChange).toHaveBeenCalledWith(expect.objectContaining({ existed: false, added: 1, removed: 0 }));
    expect(result.structuredContent).toMatchObject({ ok: true, data: { review: 'pending' } });

    await client.close();
    await server.close();
  });
});

function createBridge(
  onActivity = vi.fn(),
  overrides: Partial<{
    requestApproval: () => Promise<boolean>;
    registerChange: (change: unknown) => void;
    syncChatSession: (transcript: unknown) => Promise<{ sessionId: string; title: string; messageCount: number }>;
  }> = {}
): ChatGptBridge {
  const context = {
    extension: { packageJSON: { version: '1.3.0' } },
    workspaceState: {
      get: vi.fn((key: string, fallback: unknown) => mocks.state.get(key) ?? fallback),
      update: mocks.update
    },
    secrets: {
      get: vi.fn(async (key: string) => mocks.secrets.get(key)),
      store: vi.fn(async (key: string, value: string) => { mocks.secrets.set(key, value); })
    }
  };
  return new ChatGptBridge(context as never, {
    requestApproval: overrides.requestApproval ?? vi.fn(async () => true),
    registerChange: overrides.registerChange ?? vi.fn(),
    pendingChanges: vi.fn(() => []),
    syncChatSession: overrides.syncChatSession ?? vi.fn(async () => ({
      sessionId: 'relaycode-chatgpt-web:test',
      title: 'ChatGPT Web',
      messageCount: 0
    })),
    onActivity,
    openActivityTimeline: vi.fn(async () => undefined)
  });
}
