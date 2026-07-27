import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { normalizeEndpoint } from './routerClient';

export type RouterLaunchProgress = 'checking' | 'installing' | 'starting' | 'waiting' | 'ready' | 'stopped';

type LaunchCommand = {
  executable: string;
  prefixArgs: string[];
};

export class RouterProcessManager implements vscode.Disposable {
  private process: ChildProcessWithoutNullStreams | undefined;
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
    return this.isAvailable(this.dashboardUrl(endpoint));
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
    const script = `$pids=(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; foreach($pidValue in $pids){$p=Get-CimInstance Win32_Process -Filter \"ProcessId=$pidValue\"; if($p.CommandLine -match '9router|node_modules\\\\9router\\\\cli\\.js'){Stop-Process -Id $pidValue -Force -ErrorAction Stop}}`;
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
    onProgress('checking');
    if (await this.isAvailable(dashboardUrl)) {
      onProgress('ready');
      return dashboardUrl;
    }

    if (this.process && this.process.exitCode === null) {
      onProgress('waiting');
      await this.waitUntilReady(dashboardUrl, this.process);
      onProgress('ready');
      return dashboardUrl;
    }

    onProgress('starting');
    this.recentErrors = [];
    const launch = this.resolveCommand(command);
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const args = [
      ...launch.prefixArgs,
      '--port',
      port,
      '--host',
      '127.0.0.1',
      '--no-browser',
      '--skip-update'
    ];

    this.output.appendLine(`Starting 9Router on ${url.origin}`);
    this.process = spawn(launch.executable, args, {
      cwd: process.cwd(),
      env: { ...process.env, BROWSER: 'none' },
      windowsHide: true
    });
    const child = this.process;
    child.stdout.on('data', (chunk: Buffer) => this.output.append(chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      this.output.append(text);
      this.recentErrors.push(text.trim());
      this.recentErrors = this.recentErrors.slice(-4);
    });
    child.once('error', (error) => {
      this.recentErrors.push(error.message);
    });
    child.once('exit', () => {
      if (this.process === child) this.process = undefined;
    });

    onProgress('waiting');
    await this.waitUntilReady(dashboardUrl, child);
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

  private async waitUntilReady(url: string, child: ChildProcessWithoutNullStreams): Promise<void> {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (await this.isAvailable(url)) return;
      if (child.exitCode !== null) {
        const details = this.recentErrors.filter(Boolean).join(' ').slice(-500);
        throw new Error(details || `9Router đã dừng với mã ${child.exitCode}.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    throw new Error('9Router chưa sẵn sàng sau 45 giây. Mở Output > 9Router Runtime để xem chi tiết.');
  }

  private async isAvailable(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      return response.ok || response.status === 302 || response.status === 307;
    } catch {
      return false;
    }
  }

  public dispose(): void {
    this.process?.kill();
    this.process = undefined;
    this.output.dispose();
  }
}
