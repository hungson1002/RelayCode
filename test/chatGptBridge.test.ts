import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
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

vi.mock('../src/commandRuntime', () => ({
  runShellCommand: vi.fn(async () => 'command completed'),
  validateShellCommandSyntax: vi.fn(async () => undefined)
}));

vi.mock('../src/workspaceSnapshot', () => ({
  captureWorkspaceSnapshot: vi.fn(async () => new Map()),
  diffWorkspaceSnapshots: vi.fn(() => [])
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
import { runShellCommand, validateShellCommandSyntax } from '../src/commandRuntime';

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
      expect(listed.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
        'list_pending_changes',
        'workspace_command_status',
        'list_workspace_commands'
      ]));
    } finally {
      await client.close().catch(() => undefined);
      await bridge.stop();
    }
  });

  it('recovers a command task after reload and does not run an identical retry again', async () => {
    let releaseApproval!: (allow: boolean) => void;
    const requestApproval = vi.fn(() => new Promise<boolean>((resolve) => { releaseApproval = resolve; }));
    const firstBridge = createBridge(vi.fn(), { requestApproval });
    const firstServer = (firstBridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [firstClientTransport, firstServerTransport] = InMemoryTransport.createLinkedPair();
    const firstClient = new Client({ name: 'relaycode-task-start-test', version: '1.0.0' });
    await firstServer.connect(firstServerTransport);
    await firstClient.connect(firstClientTransport);

    const started = await firstClient.callTool({
      name: 'start_workspace_command',
      arguments: { command: 'npm run build' }
    });
    const taskId = (started.structuredContent as { data: { taskId: string } }).data.taskId;
    expect(mocks.state.get('nineRouter.chatGptBridge.commandTasks')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: taskId, state: 'waiting_for_approval' })
    ]));

    const recoveredBridge = createBridge();
    const recoveredServer = (recoveredBridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [recoveredClientTransport, recoveredServerTransport] = InMemoryTransport.createLinkedPair();
    const recoveredClient = new Client({ name: 'relaycode-task-recovery-test', version: '1.0.0' });
    await recoveredServer.connect(recoveredServerTransport);
    await recoveredClient.connect(recoveredClientTransport);

    const status = await recoveredClient.callTool({ name: 'workspace_command_status', arguments: { taskId } });
    expect(status.structuredContent).toMatchObject({
      ok: true,
      data: { taskId, status: 'interrupted', error: expect.stringContaining('was not restarted') }
    });
    const retried = await recoveredClient.callTool({
      name: 'start_workspace_command',
      arguments: { command: 'npm run build' }
    });
    expect(retried.structuredContent).toMatchObject({ ok: true, data: { taskId, status: 'interrupted', reused: true } });
    expect(runShellCommand).not.toHaveBeenCalled();

    releaseApproval(false);
    await vi.waitFor(() => expect(mocks.state.get('nineRouter.chatGptBridge.commandTasks')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: taskId, state: 'failed' })
    ])));
    await firstClient.close();
    await firstServer.close();
    await recoveredClient.close();
    await recoveredServer.close();
  });

  it('returns a completed command instead of rerunning it unless a fresh run is explicit', async () => {
    const bridge = createBridge();
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-command-dedup-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const first = await client.callTool({ name: 'run_workspace_command', arguments: { command: 'npm run build' } });
    const firstTaskId = (first.structuredContent as { data: { taskId: string } }).data.taskId;
    await vi.waitFor(() => expect(mocks.state.get('nineRouter.chatGptBridge.commandTasks')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstTaskId, state: 'completed' })
    ])));

    const retried = await client.callTool({ name: 'run_workspace_command', arguments: { command: 'npm run build' } });
    expect(retried.structuredContent).toMatchObject({ ok: true, data: { taskId: firstTaskId, status: 'completed', reused: true } });
    expect(runShellCommand).toHaveBeenCalledTimes(1);

    const explicitFreshRun = await client.callTool({
      name: 'run_workspace_command',
      arguments: { command: 'npm run build', forceNewRun: true }
    });
    const secondTaskId = (explicitFreshRun.structuredContent as { data: { taskId: string } }).data.taskId;
    expect(secondTaskId).not.toBe(firstTaskId);
    await vi.waitFor(() => {
      expect(runShellCommand).toHaveBeenCalledTimes(2);
      expect(mocks.state.get('nineRouter.chatGptBridge.commandTasks')).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: secondTaskId, state: 'completed' })
      ]));
    });

    await client.close();
    await server.close();
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

  it('treats a repeated patch as successful when its replacement is already present', async () => {
    const path = 'chatgpt-patch-retry.txt';
    const fsPath = resolve(process.cwd(), path);
    mocks.files.set(fsPath, new TextEncoder().encode('const result = 1;\r\nnext();\r\n'));
    const requestApproval = vi.fn(async () => true);
    const registerChange = vi.fn();
    const bridge = createBridge(vi.fn(), { requestApproval, registerChange });
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-patch-retry-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const arguments_ = { path, oldText: 'const result = 1;\nnext();', newText: 'const result = 2;\nnext();' };
    const result = await client.callTool({
      name: 'apply_workspace_patch',
      arguments: arguments_
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: true, data: { path, review: 'pending' } });
    expect(mocks.files.get(fsPath)).toEqual(new TextEncoder().encode('const result = 2;\r\nnext();\r\n'));

    const repeated = await client.callTool({ name: 'apply_workspace_patch', arguments: arguments_ });
    expect(repeated.isError).not.toBe(true);
    expect(repeated.structuredContent).toMatchObject({ ok: true, data: { path, alreadyApplied: true, added: 0, removed: 0 } });
    expect(requestApproval).toHaveBeenCalledOnce();
    expect(registerChange).toHaveBeenCalledOnce();
    expect(vi.mocked((await import('vscode')).workspace.fs.writeFile)).toHaveBeenCalledOnce();

    await client.close();
    await server.close();
  });

  it('explains a stale patch context without changing the workspace file', async () => {
    const path = 'chatgpt-patch-stale.txt';
    const fsPath = resolve(process.cwd(), path);
    mocks.files.set(fsPath, new TextEncoder().encode('const result = 3;\n'));
    const onActivity = vi.fn();
    const requestApproval = vi.fn(async () => true);
    const bridge = createBridge(onActivity, { requestApproval });
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-patch-stale-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: 'apply_workspace_patch',
      arguments: { path, oldText: 'const result = 1;', newText: 'const result = 2;' }
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: { path, status: 'stale_context', patchApplied: false, noEditMade: true, requiresFreshRead: true, repeated: false }
    });
    const repeated = await client.callTool({
      name: 'apply_workspace_patch',
      arguments: { path, oldText: 'const result = 1;', newText: 'const result = 2;' }
    });
    expect(repeated.structuredContent).toMatchObject({
      ok: true,
      data: { status: 'stale_context', noEditMade: true, repeated: true }
    });
    expect(onActivity).toHaveBeenCalledOnce();
    expect(requestApproval).not.toHaveBeenCalled();
    expect(mocks.files.get(fsPath)).toEqual(new TextEncoder().encode('const result = 3;\n'));
    expect(vi.mocked((await import('vscode')).workspace.fs.writeFile)).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });

  it('rejects invalid shell syntax before creating a task or asking for approval', async () => {
    vi.mocked(validateShellCommandSyntax).mockResolvedValue('Windows PowerShell syntax error: Missing expression after in.');
    const onActivity = vi.fn();
    const requestApproval = vi.fn(async () => true);
    const bridge = createBridge(onActivity, { requestApproval });
    const server = (bridge as unknown as { createMcpServer(): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }).createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'relaycode-invalid-command-test', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const arguments_ = { command: 'foreach ( in ()) { Write-Output "bad" }' };
    const result = await client.callTool({ name: 'run_workspace_command', arguments: arguments_ });
    const repeated = await client.callTool({ name: 'run_workspace_command', arguments: arguments_ });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: true, data: { status: 'invalid', started: false, repeated: false } });
    expect(repeated.structuredContent).toMatchObject({ ok: true, data: { status: 'invalid', started: false, repeated: true } });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(runShellCommand).not.toHaveBeenCalled();
    expect(mocks.state.get('nineRouter.chatGptBridge.commandTasks')).toBeUndefined();
    expect(onActivity).toHaveBeenCalledOnce();

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
