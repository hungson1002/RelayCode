import { spawn, type ChildProcess } from 'node:child_process';
import { isAbsolute } from 'node:path';

export interface ShellCommandRequest {
  command: string;
  cwd: string;
  timeoutMs: number;
}

export interface ShellOutputEvent {
  chunk: string;
  stream: 'stdout' | 'stderr';
  elapsedMs: number;
}

export interface ShellInvocation {
  executable: string;
  args: string[];
  detached: boolean;
  shellName: string;
}

const MAX_CAPTURED_OUTPUT = 30_000;

export function shellRuntimeInstruction(workspaceRoot: string): string {
  if (process.platform === 'win32') {
    return [
      'Runtime environment: Windows using Windows PowerShell (powershell.exe), not Bash.',
      `Workspace and default working directory: ${workspaceRoot}.`,
      'All run_command and run_tests commands must use PowerShell syntax.',
      'Do not use Bash-only forms such as mkdir -p, rm -rf, cp, mv, touch, export, VAR=value command, heredocs, /dev/null, or &&.',
      'Use the file tools for creating, moving and deleting workspace files. For directories use New-Item -ItemType Directory -Force; separate commands with ; and explicitly inspect native exit codes when needed.'
    ].join('\n');
  }
  return [
    `Runtime environment: ${process.platform} using a POSIX shell.`,
    `Workspace and default working directory: ${workspaceRoot}.`,
    'All run_command and run_tests commands must use POSIX shell syntax. Do not use PowerShell cmdlets or Windows drive paths.',
    'Prefer the file tools for creating, moving and deleting workspace files.'
  ].join('\n');
}

export function validateShellCompatibility(command: string): string | undefined {
  const value = command.trim();
  if (!value) return 'Command cannot be empty.';
  if (/\b(?:read-host|pause|sudo)\b/i.test(value)
    || /\b(?:npm|pnpm|yarn|docker)\s+login\b/i.test(value)
    || /\bgh\s+auth\s+login\b/i.test(value)) {
    return 'Interactive commands are not supported by the Agent terminal. Use a non-interactive flag/API flow or ask the user to complete authentication outside the run.';
  }
  if (process.platform === 'win32') {
    const incompatibilities: Array<[RegExp, string]> = [
      [/(?:^|[;&|]\s*)mkdir\s+-p\b/i, 'mkdir -p is Bash syntax. Use New-Item -ItemType Directory -Force -Path <path>.'],
      [/(?:^|[;&|]\s*)rm\s+-[a-z]*r[a-z]*f?\b/i, 'rm -rf is Bash syntax. Use a scoped PowerShell file operation or the delete_file tool.'],
      [/(?:^|[;&|]\s*)(?:cp|mv|touch)\b/i, 'cp, mv and touch are Bash-style commands here. Use Copy-Item/Move-Item/New-Item or the workspace file tools.'],
      [/(?:^|[;&|]\s*)export\s+[A-Za-z_][A-Za-z0-9_]*=/i, 'export is Bash syntax. In PowerShell use $env:NAME = value.'],
      [/(?:^|[;&|]\s*)[A-Za-z_][A-Za-z0-9_]*=[^;\r\n]+\s+\S+/i, 'Inline NAME=value command syntax is not supported by PowerShell. Set $env:NAME first.'],
      [/<<\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?/i, 'Bash heredoc syntax is not supported by PowerShell. Use a here-string or write_file.'],
      [/(?:^|\s)\/dev\/null(?:\s|$)/i, '/dev/null does not exist on Windows. Use $null.'],
      [/&&|\|\|/, 'Windows PowerShell 5.1 does not support && or ||. Use PowerShell conditionals or separate checked commands.']
    ];
    return incompatibilities.find(([pattern]) => pattern.test(value))?.[1];
  }
  if (/\b(?:New-Item|Remove-Item|Copy-Item|Move-Item|Get-ChildItem|Test-Path)\b|\$env:/i.test(value)) {
    return 'This command uses PowerShell syntax, but the current runtime uses a POSIX shell.';
  }
  return undefined;
}

export function buildShellInvocation(command: string): ShellInvocation {
  if (process.platform === 'win32') {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$ProgressPreference = 'SilentlyContinue'",
      '$global:LASTEXITCODE = 0',
      '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
      '$OutputEncoding = [Console]::OutputEncoding',
      'try {',
      '  & {',
      command,
      '  }',
      '  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
      '} catch {',
      '  [Console]::Error.WriteLine(($_ | Out-String))',
      '  exit 1',
      '}'
    ].join('\n');
    return {
      executable: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      detached: false,
      shellName: 'Windows PowerShell'
    };
  }
  const configuredShell = process.env.SHELL;
  const executable = configuredShell && isAbsolute(configuredShell) ? configuredShell : '/bin/bash';
  return {
    executable,
    args: ['-lc', `set -e\nset -o pipefail\n${command}`],
    detached: true,
    shellName: executable
  };
}

export function runShellCommand(
  request: ShellCommandRequest,
  onOutput?: (event: ShellOutputEvent) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const compatibilityError = validateShellCompatibility(request.command);
    if (compatibilityError) {
      reject(new Error(`Shell syntax mismatch: ${compatibilityError}`));
      return;
    }
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('Command was stopped.'));
      return;
    }
    const invocation = buildShellInvocation(request.command);
    const started = Date.now();
    const child = spawn(invocation.executable, invocation.args, {
      cwd: request.cwd,
      env: { ...process.env, CI: process.env.CI || '1', NO_COLOR: process.env.NO_COLOR || '1' },
      windowsHide: true,
      detached: invocation.detached,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let stopFallback: NodeJS.Timeout | undefined;
    let stoppingError: Error | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (stopFallback) clearTimeout(stopFallback);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolvePromise(`${stdout}\n${stderr}`.trim().slice(-MAX_CAPTURED_OUTPUT) || 'Command completed.');
    };
    const stopTree = (error: Error) => {
      if (settled || stoppingError) return;
      stoppingError = error;
      terminateProcessTree(child);
      stopFallback = setTimeout(() => finish(error), 2_000);
    };
    const abort = () => stopTree(signal?.reason instanceof Error ? signal.reason : new Error('Command was stopped.'));
    const emit = (stream: 'stdout' | 'stderr', data: Buffer) => {
      const chunk = data.toString('utf8');
      if (stream === 'stdout') stdout = (stdout + chunk).slice(-MAX_CAPTURED_OUTPUT);
      else stderr = (stderr + chunk).slice(-MAX_CAPTURED_OUTPUT);
      onOutput?.({ chunk, stream, elapsedMs: Date.now() - started });
    };
    child.stdout.on('data', (data: Buffer) => emit('stdout', data));
    child.stderr.on('data', (data: Buffer) => emit('stderr', data));
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (stoppingError) finish(stoppingError);
      else if (code === 0) finish();
      else finish(new Error(`${stderr || stdout || `Command exited with code ${code}`}`.trim().slice(-MAX_CAPTURED_OUTPUT)));
    });
    signal?.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(() => {
      stopTree(new Error(`Command exceeded the ${Math.ceil(request.timeoutMs / 1_000)} second timeout.`));
    }, request.timeoutMs);
  });
}

function terminateProcessTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => child.kill());
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}
