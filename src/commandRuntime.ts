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
const WINDOWS_LOGICAL_CHAIN_NOTICE = 'Windows PowerShell 5.1 does not support && or || natively; RelayCode adapts top-level command chains before execution.';

export function shellRuntimeInstruction(workspaceRoot: string): string {
  if (process.platform === 'win32') {
    return [
      'Runtime environment: Windows using Windows PowerShell (powershell.exe), not Bash.',
      `Workspace and default working directory: ${workspaceRoot}.`,
      'All run_command and run_tests commands must use PowerShell syntax.',
      'Do not use Bash-only forms such as mkdir -p, rm -rf, cp, mv, touch, export, VAR=value command, heredocs or /dev/null.',
      'Top-level && and || between commands are supported and adapted for Windows PowerShell 5.1 while preserving short-circuit behavior. Use PowerShell syntax for all other operations.',
      'Use the file tools for creating, moving and deleting workspace files. For directories use New-Item -ItemType Directory -Force; use ; only when commands should run unconditionally.'
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
      [/(?:^|\s)\/dev\/null(?:\s|$)/i, '/dev/null does not exist on Windows. Use $null.']
    ];
    const incompatibility = incompatibilities.find(([pattern]) => pattern.test(value))?.[1];
    if (incompatibility) return incompatibility;
    if (splitWindowsCommandChain(value)) return WINDOWS_LOGICAL_CHAIN_NOTICE;
    return undefined;
  }
  if (/\b(?:New-Item|Remove-Item|Copy-Item|Move-Item|Get-ChildItem|Test-Path)\b|\$env:/i.test(value)) {
    return 'This command uses PowerShell syntax, but the current runtime uses a POSIX shell.';
  }
  return undefined;
}

type CommandChainOperator = '&&' | '||';
type CommandChainNode =
  | { type: 'command'; command: string }
  | { type: CommandChainOperator; left: CommandChainNode; right: CommandChainNode };

function splitWindowsCommandChain(command: string): { commands: string[]; operators: CommandChainOperator[] } | undefined {
  const commands: string[] = [];
  const operators: CommandChainOperator[] = [];
  let start = 0;
  let quote: "'" | '"' | undefined;
  let hereStringQuote: "'" | '"' | undefined;
  let inComment = false;
  let depth = 0;

  for (let index = 0; index < command.length; index++) {
    const character = command[index]!;
    const next = command[index + 1];

    if (hereStringQuote) {
      if (index === 0 || command[index - 1] === '\n') {
        const lineEnd = command.indexOf('\n', index);
        const line = command.slice(index, lineEnd < 0 ? command.length : lineEnd).trim();
        if (line === `${hereStringQuote}@`) hereStringQuote = undefined;
      }
      continue;
    }
    if (inComment) {
      if (character === '\n') inComment = false;
      continue;
    }
    if (quote) {
      if (character === '`') {
        index++;
      } else if (quote === "'" && character === "'" && next === "'") {
        index++;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === '@' && (next === "'" || next === '"') && (command[index + 2] === '\n' || command[index + 2] === '\r')) {
      hereStringQuote = next;
      index++;
      continue;
    }
    if (character === '`') {
      index++;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '#' && (index === 0 || /\s/.test(command[index - 1]!))) {
      inComment = true;
      continue;
    }
    if (character === '(' || character === '[' || character === '{') depth++;
    else if (character === ')' || character === ']' || character === '}') depth = Math.max(0, depth - 1);

    if (depth === 0 && ((character === '&' && next === '&') || (character === '|' && next === '|'))) {
      const part = command.slice(start, index).trim();
      if (!part) return undefined;
      commands.push(part);
      operators.push(character === '&' ? '&&' : '||');
      index++;
      start = index + 1;
    }
  }

  if (!operators.length) return undefined;
  const lastCommand = command.slice(start).trim();
  if (!lastCommand) return undefined;
  commands.push(lastCommand);
  return { commands, operators };
}

function translateWindowsCommandChain(command: string): string | undefined {
  const chain = splitWindowsCommandChain(command);
  if (!chain) return undefined;

  const values: CommandChainNode[] = [{ type: 'command', command: chain.commands[0]! }];
  const operators: CommandChainOperator[] = [];
  const precedence = (operator: CommandChainOperator) => operator === '&&' ? 2 : 1;
  const reduce = () => {
    const operator = operators.pop()!;
    const right = values.pop()!;
    const left = values.pop()!;
    values.push({ type: operator, left, right });
  };

  for (let index = 0; index < chain.operators.length; index++) {
    const operator = chain.operators[index]!;
    while (operators.length && precedence(operators.at(-1)!) >= precedence(operator)) reduce();
    operators.push(operator);
    values.push({ type: 'command', command: chain.commands[index + 1]! });
  }
  while (operators.length) reduce();

  let variableIndex = 0;
  const indent = (value: string) => value.split('\n').map((line) => `  ${line}`).join('\n');
  const emit = (node: CommandChainNode): { script: string; result: string } => {
    const result = `$__relaycodeChainResult${++variableIndex}`;
    if (node.type === 'command') {
      const commandBody = node.command.split('\n').map((line) => `  ${line}`).join('\n');
      return {
        result,
        script: [
          'try {',
          commandBody,
          `  ${result} = $?`,
          '} catch {',
          '  [Console]::Error.WriteLine(($_ | Out-String))',
          `  ${result} = $false`,
          '}'
        ].join('\n')
      };
    }

    const left = emit(node.left);
    const right = emit(node.right);
    const condition = node.type === '&&' ? left.result : `-not (${left.result})`;
    return {
      result,
      script: [
        left.script,
        `if (${condition}) {`,
        indent(right.script),
        `  ${result} = ${right.result}`,
        '} else {',
        `  ${result} = ${node.type === '&&' ? '$false' : '$true'}`,
        '}'
      ].join('\n')
    };
  };

  const translated = emit(values[0]!);
  return `${translated.script}\nif (${translated.result}) { $global:LASTEXITCODE = 0 } else { $global:LASTEXITCODE = 1 }`;
}

export function buildShellInvocation(command: string): ShellInvocation {
  if (process.platform === 'win32') {
    const windowsCommand = translateWindowsCommandChain(command) ?? command;
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$ProgressPreference = 'SilentlyContinue'",
      '$global:LASTEXITCODE = 0',
      '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
      '$OutputEncoding = [Console]::OutputEncoding',
      'try {',
      '  & {',
      windowsCommand,
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
    const adaptsWindowsChain = process.platform === 'win32'
      && Boolean(splitWindowsCommandChain(request.command))
      && compatibilityError === WINDOWS_LOGICAL_CHAIN_NOTICE;
    if (compatibilityError && !adaptsWindowsChain) {
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
    let killEscalation: NodeJS.Timeout | undefined;
    let stoppingError: Error | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (killEscalation) clearTimeout(killEscalation);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolvePromise(`${stdout}\n${stderr}`.trim().slice(-MAX_CAPTURED_OUTPUT) || 'Command completed.');
    };
    const stopTree = (error: Error) => {
      if (settled || stoppingError) return;
      stoppingError = error;
      killEscalation = terminateProcessTree(child);
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

function terminateProcessTree(child: ChildProcess): NodeJS.Timeout | undefined {
  if (!child.pid) return undefined;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => child.kill());
    killer.on('exit', (code) => {
      if (code !== 0 && child.exitCode === null) child.kill();
    });
    return setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 2_000);
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
  return setTimeout(() => {
    if (child.exitCode !== null) return;
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }, 1_200);
}
