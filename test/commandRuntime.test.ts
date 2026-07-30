import { describe, expect, it } from 'vitest';
import { buildShellInvocation, runShellCommand, shellRuntimeInstruction, validateShellCompatibility } from '../src/commandRuntime';

describe('command runtime', () => {
  it('describes the actual shell and workspace to the Agent', () => {
    const instruction = shellRuntimeInstruction(process.cwd());
    expect(instruction).toContain(process.cwd());
    expect(instruction).toContain(process.platform === 'win32' ? 'PowerShell' : 'POSIX');
  });

  it('builds a non-interactive invocation with strict error handling', () => {
    const invocation = buildShellInvocation('echo ok');
    expect(invocation.args.join(' ')).toContain(process.platform === 'win32' ? '-EncodedCommand' : '-lc');
    if (process.platform === 'win32') {
      const encoded = invocation.args.at(-1)!;
      expect(Buffer.from(encoded, 'base64').toString('utf16le')).toContain("$ErrorActionPreference = 'Stop'");
    }
  });

  it.runIf(process.platform === 'win32')('rejects Bash syntax before starting PowerShell', () => {
    expect(validateShellCompatibility('mkdir -p src/components')).toContain('New-Item');
    expect(validateShellCompatibility('npm test && npm run build')).toContain('does not support');
  });

  it('rejects commands that require interactive input', () => {
    expect(validateShellCompatibility('npm login')).toContain('Interactive');
  });

  it('runs a successful command and captures its output', async () => {
    const command = process.platform === 'win32' ? "Write-Output 'relaycode-ok'" : "printf 'relaycode-ok'";
    await expect(runShellCommand({ command, cwd: process.cwd(), timeoutMs: 10_000 })).resolves.toContain('relaycode-ok');
  });

  it.runIf(process.platform === 'win32')('does not report a PowerShell non-terminating error as success', async () => {
    await expect(runShellCommand({
      command: "Get-Item 'Z:\\relaycode-definitely-missing'; Write-Output 'must-not-succeed'",
      cwd: process.cwd(),
      timeoutMs: 10_000
    })).rejects.toThrow(/Cannot find drive|does not exist/i);
  });

  it('waits for a stopped process to exit before rejecting', async () => {
    const controller = new AbortController();
    const command = process.platform === 'win32' ? 'Start-Sleep -Seconds 30' : 'sleep 30';
    const started = Date.now();
    const run = runShellCommand({ command, cwd: process.cwd(), timeoutMs: 60_000 }, undefined, controller.signal);
    setTimeout(() => controller.abort(new Error('test stop')), 150);
    await expect(run).rejects.toThrow('test stop');
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
