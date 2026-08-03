import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manager = readFileSync(resolve('src/routerProcessManager.ts'), 'utf8');
const provider = readFileSync(resolve('src/chatViewProvider.ts'), 'utf8');

describe('9Router background lifecycle', () => {
  it('starts a detached background process that survives extension disposal', () => {
    expect(manager).toContain('detached: true');
    expect(manager).toContain('child.unref()');
    expect(manager).toContain('9Router is intentionally detached');
    const disposeBody = manager.match(/public dispose\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? '';
    expect(disposeBody).not.toContain('.kill(');
  });

  it('uses a lightweight health endpoint and avoids duplicate starts on occupied ports', () => {
    expect(manager).toContain('/api/auth/status');
    expect(manager).toContain('isPortListening');
    expect(manager).toContain('isAvailableWithRetry(healthUrl, 3)');
  });

  it('bounds install and executable checks so the connection action cannot spin forever', () => {
    expect(manager).toContain('8_000');
    expect(manager).toContain('120_000');
    expect(manager).toContain('Cài ${packageName} quá thời gian chờ');
  });

  it('requires repeated monitor failures before marking the provider offline', () => {
    expect(provider).toContain('this.connectionFailureCount++');
    expect(provider).toContain('if (this.connectionFailureCount < 3) return');
    expect(provider).toContain("if (provider === '9router')");
    expect(provider).toContain('this.routerProcess.isRunning(this.endpoint)');
  });
});
