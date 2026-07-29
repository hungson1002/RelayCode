import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      dispose: vi.fn()
    })
  }
}));

import { RouterProcessManager } from '../src/routerProcessManager';

const servers: Server[] = [];

async function listen(healthy: boolean): Promise<{ server: Server; endpoint: string }> {
  const server = createServer((request, response) => {
    if (request.url === '/api/auth/status') {
      response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: healthy }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fake gateway did not bind to a TCP port.');
  return { server, endpoint: `http://127.0.0.1:${address.port}/v1` };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.close();
    await once(server, 'close');
  }));
});

describe('external 9Router lifecycle E2E', () => {
  it('reuses a healthy gateway that was started outside RelayCode', async () => {
    const { endpoint } = await listen(true);
    const manager = new RouterProcessManager();

    await expect(manager.inspect(endpoint)).resolves.toMatchObject({
      state: 'ready',
      owner: 'external',
      healthy: true,
      portListening: true,
      canStop: false
    });
    await expect(manager.ensureRunning(endpoint, 'command-that-must-not-run', () => undefined))
      .resolves.toBe(endpoint.replace(/\/v1$/, '/dashboard'));
    expect(manager.canStop()).toBe(false);
    manager.dispose();
  });

  it('distinguishes a stale occupied port from an offline gateway', async () => {
    const { server, endpoint } = await listen(false);
    const manager = new RouterProcessManager();

    await expect(manager.inspect(endpoint)).resolves.toMatchObject({
      state: 'stale',
      owner: 'external',
      healthy: false,
      portListening: true
    });
    server.close();
    await once(server, 'close');
    servers.splice(servers.indexOf(server), 1);
    await expect(manager.inspect(endpoint)).resolves.toMatchObject({
      state: 'offline',
      owner: 'none',
      healthy: false,
      portListening: false
    });
    manager.dispose();
  });
});
