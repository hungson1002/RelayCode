import { spawn, execFile } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { StreamCallbacks } from './types';
import { buildContainerArgs } from './sandboxArgs';

const execFileAsync = promisify(execFile);

export type SandboxMode = 'direct' | 'preferred' | 'required';
export type ContainerRuntime = 'docker' | 'podman';

export interface SandboxOptions {
  mode: SandboxMode;
  image: string;
  memory: string;
  cpus: number;
  network: boolean;
}

export interface SandboxSession {
  root: string;
  runtime: ContainerRuntime;
  dispose(): Promise<void>;
  run(command: string, toolName: string, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<string>;
}

export interface SandboxStatus {
  runtime?: ContainerRuntime;
  installed: boolean;
  running: boolean;
  message: string;
}

export class SandboxRuntime {
  public constructor(private readonly storageRoot: string, private readonly output: vscode.OutputChannel) {}

  public async detect(): Promise<ContainerRuntime | undefined> {
    const status = await this.status();
    return status.running ? status.runtime : undefined;
  }

  public async status(): Promise<SandboxStatus> {
    for (const runtime of ['docker', 'podman'] as const) {
      try {
        await execFileAsync(runtime, ['--version'], { windowsHide: true, timeout: 5_000 });
      } catch { continue; }
      try {
        await execFileAsync(runtime, ['info', '--format', '{{.ServerVersion}}'], { windowsHide: true, timeout: 7_000 });
        return { runtime, installed: true, running: true, message: `${runtime} đang chạy` };
      } catch {
        return { runtime, installed: true, running: false, message: `${runtime} đã cài nhưng engine chưa chạy` };
      }
    }
    return { installed: false, running: false, message: 'Chưa cài Docker hoặc Podman' };
  }

  public async create(workspaceRoot: string, options: SandboxOptions, onProgress: (message: string) => void): Promise<SandboxSession | undefined> {
    if (options.mode === 'direct') return undefined;
    const status = await this.status();
    const runtime = status.running ? status.runtime : undefined;
    if (!runtime) {
      if (options.mode === 'required') throw new Error(`Sandbox bắt buộc: ${status.message}.`);
      return undefined;
    }
    const root = join(this.storageRoot, 'sandboxes', `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    onProgress(`Đang tạo sandbox bằng ${runtime}`);
    await mkdir(root, { recursive: true });
    await cp(workspaceRoot, root, {
      recursive: true,
      force: true,
      filter: (source) => !isExcluded(source, workspaceRoot)
    });
    this.output.appendLine(`[sandbox] prepared ${root} with ${runtime}`);
    return {
      root,
      runtime,
      run: (command, toolName, callbacks, signal) => this.run(runtime, root, options, command, toolName, callbacks, signal),
      dispose: async () => {
        await rm(root, { recursive: true, force: true });
        this.output.appendLine(`[sandbox] removed ${root}`);
      }
    };
  }

  private run(runtime: ContainerRuntime, root: string, options: SandboxOptions, command: string, toolName: string, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = buildContainerArgs(root, options, command);
      const started = Date.now();
      this.output.appendLine(`[sandbox:${runtime}] ${command}`);
      const child = spawn(runtime, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeout: NodeJS.Timeout;
      const abort = () => {
        child.kill();
        finish(new Error('Đã dừng lệnh trong sandbox.'));
      };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve(`${stdout}\n${stderr}`.trim().slice(-30_000) || 'Sandbox command completed.');
      };
      const emit = (stream: 'stdout' | 'stderr', data: Buffer) => {
        const chunk = data.toString();
        if (stream === 'stdout') stdout = (stdout + chunk).slice(-30_000);
        else stderr = (stderr + chunk).slice(-30_000);
        this.output.append(chunk);
        callbacks.onToolOutput?.({ tool: toolName, command, chunk, stream, elapsedMs: Date.now() - started });
      };
      child.stdout.on('data', (data: Buffer) => emit('stdout', data));
      child.stderr.on('data', (data: Buffer) => emit('stderr', data));
      child.on('error', (error) => finish(error));
      child.on('close', (code) => code === 0 ? finish() : finish(new Error((stderr || stdout || `Sandbox exited with code ${code}`).trim())));
      signal?.addEventListener('abort', abort, { once: true });
      timeout = setTimeout(() => {
        child.kill();
        finish(new Error('Lệnh sandbox quá thời gian 120 giây.'));
      }, 120_000);
    });
  }
}

function isExcluded(source: string, workspaceRoot: string): boolean {
  if (source === workspaceRoot) return false;
  const relative = source.slice(workspaceRoot.length).replace(/^[\\/]+/, '').replace(/\\/g, '/');
  return relative.split('/').some((part) => ['.git', 'node_modules', 'dist', 'out', '.next', 'coverage'].includes(part));
}
