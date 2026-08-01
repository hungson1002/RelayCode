import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { connect } from 'node:net';
import * as vscode from 'vscode';
import { normalizeEndpoint } from './routerClient';

export type RouterLaunchProgress = 'checking' | 'installing' | 'starting' | 'waiting' | 'ready' | 'stopped';
export type RouterRuntimeState = 'ready' | 'stale' | 'offline';
export type RouterRuntimeOwner = 'managed' | 'external' | 'none';

export type RouterRuntimeStatus = {
  state: RouterRuntimeState;
  owner: RouterRuntimeOwner;
  healthy: boolean;
  portListening: boolean;
  canStop: boolean;
};

type LaunchCommand = {
  executable: string;
  prefixArgs: string[];
};

export class RouterProcessManager implements vscode.Disposable {
  private process: ChildProcess | undefined;
  private startPromise: Promise<string> | undefined;
  private output = vscode.window.createOutputChannel('9Router Runtime');
  private recentErrors: string[] = [];

  public async isInstalled(command: string): Promise<boolean> {
    const launch = this.resolveCommand(command);
    return new Promise((resolve) => {
      const child = spawn(launch.executable, [...launch.prefixArgs, '--version'], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'ignore']
      });
      child.once('error', () => resolve(false));
      child.once('exit', (code) => resolve(code === 0));
    });
  }

  public async install(command: string, onProgress?: (message: string) => void): Promise<void> {
    const packageManager = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const packageName = command.trim() === '9router' || !command.trim() ? '9router' : command.trim();
    onProgress?.(`Đang cài ${packageName}`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(packageManager, ['install', '--global', packageName], {
        windowsHide: true,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      const errors: string[] = [];
      child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString()));
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(errors.join(' ').trim() || `npm dừng với mã ${code ?? 'unknown'}.`));
      });
    });
  }

  public async isRunning(endpoint: string): Promise<boolean> {
    return this.isAvailable(this.healthUrl(endpoint));
  }

  public async inspect(endpoint: string): Promise<RouterRuntimeStatus> {
    const url = new URL(normalizeEndpoint(endpoint));
    const managed = Boolean(this.process && this.process.exitCode === null);
    const healthy = await this.isAvailable(this.healthUrl(endpoint));
    if (healthy) {
      return {
        state: 'ready',
        owner: managed ? 'managed' : 'external',
        healthy: true,
        portListening: true,
        canStop: managed
      };
    }

    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const portListening = local && Number.isInteger(port) && await this.isPortListening(url.hostname, port);
    return {
      state: portListening ? 'stale' : 'offline',
      owner: managed ? 'managed' : portListening ? 'external' : 'none',
      healthy: false,
      portListening,
      canStop: managed
    };
  }

  public canStop(): boolean {
    return Boolean(this.process && this.process.exitCode === null);
  }

  public async ensureRunning(
    endpoint: string,
    command: string,
    onProgress: (progress: RouterLaunchProgress) => void
  ): Promise<string> {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.start(endpoint, command, onProgress).finally(() => {
      this.startPromise = undefined;
    });
    return this.startPromise;
  }

  public async stop(endpoint?: string): Promise<boolean> {
    if (this.process && this.process.exitCode === null) {
      this.process.kill();
      this.process = undefined;
      if (endpoint) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        if (!(await this.isRunning(endpoint))) return true;
      } else return true;
    }
    this.process = undefined;
    if (!endpoint || process.platform !== 'win32') return false;
    const url = new URL(normalizeEndpoint(endpoint));
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return false;
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
    const script = `$all=@(Get-CimInstance Win32_Process);$listeners=@((Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess|Select-Object -Unique);$roots=@();foreach($listener in $listeners){$current=$all|Where-Object ProcessId -eq $listener|Select-Object -First 1;while($current){if($current.CommandLine -match 'node_modules[\\\\/]9router[\\\\/](cli\\.js|app[\\\\/]custom-server\\.js)'){$roots+=$current.ProcessId;break};$parentId=$current.ParentProcessId;$current=$all|Where-Object ProcessId -eq $parentId|Select-Object -First 1}};$targets=@();foreach($root in ($roots|Select-Object -Unique)){$targets+=$root;$changed=$true;while($changed){$before=$targets.Count;$targets+=@($all|Where-Object {$targets -contains $_.ParentProcessId}|ForEach-Object ProcessId);$targets=@($targets|Select-Object -Unique);$changed=$targets.Count -gt $before}};if($targets.Count){Stop-Process -Id $targets -Force -ErrorAction Stop}`;
    try {
      await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
      await new Promise((resolve) => setTimeout(resolve, 350));
      return !(await this.isRunning(endpoint));
    } catch {
      return false;
    }
  }

  public dashboardUrl(endpoint: string): string {
    const url = new URL(normalizeEndpoint(endpoint));
    return `${url.origin}/dashboard`;
  }

  private async start(
    endpoint: string,
    command: string,
    onProgress: (progress: RouterLaunchProgress) => void
  ): Promise<string> {
    const url = new URL(normalizeEndpoint(endpoint));
    if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
      throw new Error('Chỉ có thể tự khởi động 9Router tại máy cục bộ. Dùng Kết nối thủ công cho server từ xa.');
    }

    const dashboardUrl = this.dashboardUrl(endpoint);
    const healthUrl = this.healthUrl(endpoint);
    onProgress('checking');
    if (await this.isAvailableWithRetry(healthUrl, 3)) {
      onProgress('ready');
      return dashboardUrl;
    }

    if (this.process && this.process.exitCode === null) {
      onProgress('waiting');
      await this.waitUntilReady(healthUrl, this.process);
      onProgress('ready');
      return dashboardUrl;
    }

    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    if (await this.isPortListening(url.hostname, port)) {
      onProgress('waiting');
      if (await this.isAvailableWithRetry(healthUrl, 4)) {
        onProgress('ready');
        return dashboardUrl;
      }
      this.output.appendLine(`9Router owns port ${port} but health is unresponsive. Restarting the stale process.`);
      if (!await this.stop(endpoint)) {
        throw new Error(`Cổng ${port} đang được sử dụng nhưng 9Router không phản hồi. Không thể xác minh tiến trình để khởi động lại an toàn.`);
      }
    }

    onProgress('starting');
    this.recentErrors = [];
    const launch = this.resolveCommand(command);
    const args = [
      ...launch.prefixArgs,
      '--port',
      String(port),
      '--host',
      '127.0.0.1',
      '--no-browser',
      '--skip-update'
    ];

    this.output.appendLine(`Starting 9Router on ${url.origin}`);
    const logDir = join(homedir(), '.relaycode', 'logs');
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, '9router-runtime.log');
    const logFd = openSync(logPath, 'a');
    this.process = spawn(launch.executable, args, {
      cwd: homedir(),
      env: { ...process.env, BROWSER: 'none' },
      windowsHide: true,
      detached: true,
      stdio: ['ignore', logFd, logFd]
    });
    const child = this.process;
    closeSync(logFd);
    this.output.appendLine(`9Router started with PID ${child.pid ?? 'unknown'}. Log: ${logPath}`);
    child.once('error', (error) => {
      this.recentErrors.push(error.message);
    });
    child.once('exit', () => {
      if (this.process === child) this.process = undefined;
    });

    onProgress('waiting');
    try {
      await this.waitUntilReady(healthUrl, child);
    } catch (error) {
      await terminateSpawnedProcess(child);
      if (this.process === child) this.process = undefined;
      throw error;
    }
    child.unref();
    this.output.appendLine(`9Router is ready and detached with PID ${child.pid ?? 'unknown'}.`);
    onProgress('ready');
    return dashboardUrl;
  }

  private resolveCommand(command: string): LaunchCommand {
    const trimmed = command.trim() || '9router';
    if (process.platform === 'win32' && trimmed.toLowerCase() === '9router') {
      const appData = process.env.APPDATA;
      if (appData) {
        const cli = join(appData, 'npm', 'node_modules', '9router', 'cli.js');
        if (existsSync(cli)) {
          const programFilesNode = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'nodejs', 'node.exe');
          return { executable: existsSync(programFilesNode) ? programFilesNode : 'node.exe', prefixArgs: [cli] };
        }
      }
    }
    return { executable: trimmed, prefixArgs: [] };
  }

  private async waitUntilReady(url: string, child?: ChildProcess): Promise<void> {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (await this.isAvailable(url)) return;
      if (child && child.exitCode !== null) {
        const details = this.recentErrors.filter(Boolean).join(' ').slice(-500);
        throw new Error(details || `9Router đã dừng với mã ${child.exitCode}.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    throw new Error('9Router chưa sẵn sàng sau 45 giây. Mở Output > 9Router Runtime để xem chi tiết.');
  }

  private async isAvailable(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      return response.ok || response.status === 302 || response.status === 307;
    } catch {
      return false;
    }
  }

  private async isAvailableWithRetry(url: string, attempts: number): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await this.isAvailable(url)) return true;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 450));
    }
    return false;
  }

  private isPortListening(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = connect({ host, port });
      const finish = (result: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(1_200);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
    });
  }

  private healthUrl(endpoint: string): string {
    const url = new URL(normalizeEndpoint(endpoint));
    return `${url.origin}/api/auth/status`;
  }

  public dispose(): void {
    // 9Router is intentionally detached. Reloading the extension or closing the
    // IDE must not stop the local gateway; only an explicit user action may do so.
    this.process = undefined;
    this.output.dispose();
  }
}

async function terminateSpawnedProcess(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      });
      killer.once('error', () => {
        child.kill();
        resolve();
      });
      killer.once('exit', () => resolve());
      setTimeout(resolve, 2_000);
    });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}
