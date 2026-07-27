import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { ProviderKind } from './provider';
import { normalizeEndpoint } from './routerClient';

const execFileAsync = promisify(execFile);

export interface LocalRuntimeStatus {
  kind: 'ollama' | 'lm-studio';
  installed: boolean;
  serverRunning: boolean;
  models: string[];
  message: string;
}

export class LocalRuntimeManager {
  public async inspect(kind: ProviderKind, endpoint: string): Promise<LocalRuntimeStatus | undefined> {
    if (kind !== 'ollama' && kind !== 'lm-studio') return undefined;
    const command = kind === 'ollama' ? 'ollama' : 'lms';
    const installed = await commandWorks(command, ['--help']);
    let models: string[] = [];
    let serverRunning = false;
    try {
      const response = await fetch(`${normalizeEndpoint(endpoint)}/models`, { signal: AbortSignal.timeout(3_000) });
      if (response.ok) {
        serverRunning = true;
        const body = (await response.json()) as { data?: Array<{ id?: string }> };
        models = (body.data ?? []).flatMap((item) => item.id ? [item.id] : []);
      }
    } catch { /* Server is not running. */ }
    const label = kind === 'ollama' ? 'Ollama' : 'LM Studio';
    const message = !installed
      ? `${label} chưa được cài hoặc CLI chưa có trong PATH.`
      : !serverRunning
        ? `${label} đã cài nhưng API server chưa chạy.`
        : !models.length
          ? `${label} đang chạy nhưng chưa có model sẵn sàng.`
          : `${label} sẵn sàng · ${models.length} model.`;
    return { kind, installed, serverRunning, models, message };
  }

  public async setup(kind: ProviderKind, endpoint: string, onProgress: (message: string) => void): Promise<LocalRuntimeStatus | undefined> {
    if (kind !== 'ollama' && kind !== 'lm-studio') return undefined;
    let status = await this.inspect(kind, endpoint);
    if (!status) return undefined;
    const label = kind === 'ollama' ? 'Ollama' : 'LM Studio';
    if (!status.installed) {
      const install = await vscode.window.showInformationMessage(`${label} chưa có trên máy. Mở trang cài đặt chính thức?`, { modal: true }, 'Mở trang cài đặt');
      if (install === 'Mở trang cài đặt') await vscode.env.openExternal(vscode.Uri.parse(kind === 'ollama' ? 'https://ollama.com/download' : 'https://lmstudio.ai/download'));
      return status;
    }

    if (!status.serverRunning) {
      onProgress(`Đang khởi động ${label} local server…`);
      if (kind === 'ollama') {
        const child = spawn('ollama', ['serve'], { detached: true, windowsHide: true, stdio: 'ignore' });
        child.unref();
      } else {
        await execFileAsync('lms', ['server', 'start'], { windowsHide: true, timeout: 30_000 }).catch(() => undefined);
      }
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        status = await this.inspect(kind, endpoint);
        if (status?.serverRunning) break;
      }
    }

    status = await this.inspect(kind, endpoint);
    if (status?.serverRunning && !status.models.length) {
      const model = await vscode.window.showInputBox({
        title: `Tải model cho ${label}`,
        prompt: kind === 'ollama' ? 'Tên model trên Ollama Library' : 'Model ID trên LM Studio Hub',
        placeHolder: kind === 'ollama' ? 'Ví dụ: qwen2.5-coder:7b' : 'Ví dụ: openai/gpt-oss-20b',
        ignoreFocusOut: true
      });
      if (model?.trim()) {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Đang tải ${model.trim()}`, cancellable: false }, async () => {
          onProgress(`Đang tải ${model.trim()}…`);
          if (kind === 'ollama') await execFileAsync('ollama', ['pull', model.trim()], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
          else {
            await execFileAsync('lms', ['get', model.trim()], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
            await execFileAsync('lms', ['load', model.trim()], { windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
          }
        });
      }
    }
    return this.inspect(kind, endpoint);
  }
}

async function commandWorks(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args, { windowsHide: true, timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
