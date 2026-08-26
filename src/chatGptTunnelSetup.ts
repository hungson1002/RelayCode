import * as vscode from 'vscode';
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TUNNEL_ID_STATE = 'nineRouter.chatGptBridge.tunnelId';
const CLIENT_PATH_STATE = 'nineRouter.chatGptBridge.clientPath';
const API_KEY_SECRET = 'nineRouter.chatGptBridge.runtimeApiKey';
const PROFILE = 'relaycode-workspace';
const RELEASE_API = 'https://api.github.com/repos/openai/tunnel-client/releases/latest';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ReleaseResponse {
  tag_name: string;
  assets: ReleaseAsset[];
}

export interface ChatGptTunnelStatus {
  configured: boolean;
  running: boolean;
  tunnelId?: string;
}

export class ChatGptTunnelSetup implements vscode.Disposable {
  private runtime: ChildProcessWithoutNullStreams | undefined;

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public status(): ChatGptTunnelStatus {
    const tunnelId = this.context.globalState.get<string>(TUNNEL_ID_STATE);
    return { configured: Boolean(tunnelId), running: Boolean(this.runtime && this.runtime.exitCode === null), tunnelId };
  }

  public async configure(localMcpUrl: string): Promise<boolean> {
    const tunnelId = await this.askTunnelId();
    if (!tunnelId) return false;
    const apiKey = await this.askApiKey();
    if (!apiKey) return false;

    const clientPath = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'RelayCode · Đang chuẩn bị kết nối ChatGPT',
      cancellable: false
    }, async (progress) => {
      progress.report({ message: 'Đang cài tunnel-client chính thức…' });
      const binary = await this.ensureClient();
      progress.report({ message: 'Đang tạo cấu hình bảo mật…' });
      await this.initializeProfile(binary, tunnelId, localMcpUrl, apiKey);
      progress.report({ message: 'Đang kiểm tra tunnel…' });
      await this.doctor(binary, apiKey);
      return binary;
    });

    await this.context.globalState.update(TUNNEL_ID_STATE, tunnelId);
    await this.context.globalState.update(CLIENT_PATH_STATE, clientPath);
    await this.context.secrets.store(API_KEY_SECRET, apiKey);
    await this.startRuntime(clientPath, apiKey);
    await vscode.env.clipboard.writeText(tunnelId);
    await this.showCompletionGuide();
    return true;
  }

  public async resume(localMcpUrl: string): Promise<boolean> {
    if (this.status().running) return true;
    const tunnelId = this.context.globalState.get<string>(TUNNEL_ID_STATE);
    const apiKey = await this.context.secrets.get(API_KEY_SECRET);
    const storedClient = this.context.globalState.get<string>(CLIENT_PATH_STATE);
    if (!tunnelId || !apiKey || !storedClient) return false;
    try {
      await access(storedClient);
      await this.initializeProfile(storedClient, tunnelId, localMcpUrl, apiKey);
      await this.startRuntime(storedClient, apiKey);
      return true;
    } catch {
      return false;
    }
  }

  public async reconnect(localMcpUrl: string): Promise<boolean> {
    this.stopRuntime();
    if (await this.resume(localMcpUrl)) return true;
    return this.configure(localMcpUrl);
  }

  public async forget(): Promise<void> {
    this.stopRuntime();
    await this.context.globalState.update(TUNNEL_ID_STATE, undefined);
    await this.context.globalState.update(CLIENT_PATH_STATE, undefined);
    await this.context.secrets.delete(API_KEY_SECRET);
  }

  public async openChatGpt(): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse('https://chatgpt.com/plugins'));
  }

  public async showCompletionGuide(): Promise<void> {
    const tunnelId = this.context.globalState.get<string>(TUNNEL_ID_STATE);
    if (!tunnelId) return;
    const guide = this.completionGuide(tunnelId);
    const picked = await vscode.window.showInformationMessage(
      'Tunnel đã kết nối · Còn 1 bước trong ChatGPT',
      { modal: true, detail: guide },
      'Mở trang Plugin',
      'Sao chép checklist'
    );
    if (picked === 'Sao chép checklist') {
      await vscode.env.clipboard.writeText(guide);
      const open = await vscode.window.showInformationMessage('Đã sao chép hướng dẫn hoàn tất.', 'Mở trang Plugin');
      if (open) await this.openChatGpt();
      return;
    }
    if (picked === 'Mở trang Plugin') {
      await vscode.env.clipboard.writeText(tunnelId);
      await this.openChatGpt();
    }
  }

  public dispose(): void {
    this.stopRuntime();
  }

  private async askTunnelId(): Promise<string | undefined> {
    await vscode.env.openExternal(vscode.Uri.parse('https://platform.openai.com/settings/organization/tunnels'));
    const current = this.context.globalState.get<string>(TUNNEL_ID_STATE, '');
    return vscode.window.showInputBox({
      title: 'Kết nối ChatGPT · Bước 1/2',
      prompt: 'Tạo tunnel trong trang vừa mở rồi dán Tunnel ID vào đây.',
      placeHolder: 'tunnel_…',
      value: current,
      ignoreFocusOut: true,
      validateInput: (value) => /^tunnel_[A-Za-z0-9_-]{8,}$/.test(value.trim()) ? undefined : 'Tunnel ID phải bắt đầu bằng tunnel_.'
    }).then((value) => value?.trim());
  }

  private completionGuide(tunnelId: string): string {
    return [
      'Tunnel đang chạy. Tunnel ID đã được sao chép.',
      '',
      'Trong ChatGPT:',
      '1. Mở Plugin → nhấn dấu + → Plugin mới.',
      '2. Tên: RelayCode Workspace.',
      '3. Kết nối: chọn Tunnel.',
      `4. Chọn tunnel khớp ${tunnelId}.`,
      '5. Xác thực: Không có tính năng xác thực.',
      '6. Tích “Tôi hiểu và muốn tiếp tục” → bấm Tạo.',
      '7. Mở chat mới, bật RelayCode Workspace rồi yêu cầu kiểm tra workspace.',
      '',
      'Nếu ChatGPT báo “Chưa có tunnel”, hãy gắn tunnel với đúng ChatGPT workspace trong OpenAI Platform rồi mở lại form Plugin.'
    ].join('\n');
  }

  private async askApiKey(): Promise<string | undefined> {
    const existing = await this.context.secrets.get(API_KEY_SECRET);
    if (!existing) await vscode.env.openExternal(vscode.Uri.parse('https://platform.openai.com/settings/organization/api-keys'));
    return vscode.window.showInputBox({
      title: 'Kết nối ChatGPT · Bước 2/2',
      prompt: existing ? 'API key đã lưu an toàn. Để nguyên để tiếp tục hoặc nhập key mới.' : 'Tạo Runtime API key trong trang vừa mở rồi dán vào đây.',
      placeHolder: existing ? 'Đã lưu API key' : 'sk-…',
      password: true,
      ignoreFocusOut: true,
      value: existing || '',
      validateInput: (value) => value.trim().length >= 12 ? undefined : 'Nhập Runtime API key hợp lệ.'
    }).then((value) => value?.trim());
  }

  private async ensureClient(): Promise<string> {
    const stored = this.context.globalState.get<string>(CLIENT_PATH_STATE);
    if (stored) {
      try { await access(stored); return stored; } catch { /* reinstall */ }
    }
    const releaseResponse = await fetch(RELEASE_API, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'RelayCode' } });
    if (!releaseResponse.ok) throw new Error(`Không tải được tunnel-client (HTTP ${releaseResponse.status}).`);
    const release = await releaseResponse.json() as ReleaseResponse;
    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux';
    const architecture = process.arch === 'arm64' ? 'arm64' : 'amd64';
    const asset = release.assets.find((item) => item.name.startsWith('tunnel-client-v') && item.name.endsWith(`-${platform}-${architecture}.zip`));
    const checksumAsset = release.assets.find((item) => item.name === 'SHA256SUMS.txt');
    if (!asset || !checksumAsset) throw new Error(`Không có tunnel-client cho ${platform}-${architecture}.`);

    const installDirectory = join(this.context.globalStorageUri.fsPath, 'tunnel-client', release.tag_name);
    await mkdir(installDirectory, { recursive: true });
    const archivePath = join(installDirectory, asset.name);
    const [archive, checksums] = await Promise.all([this.download(asset.browser_download_url), this.download(checksumAsset.browser_download_url)]);
    const expected = new TextDecoder().decode(checksums).split(/\r?\n/).find((line) => line.trim().endsWith(asset.name))?.trim().split(/\s+/)[0];
    const actual = createHash('sha256').update(archive).digest('hex');
    if (!expected || expected.toLowerCase() !== actual) throw new Error('Checksum tunnel-client không khớp; đã dừng cài đặt.');
    await writeFile(archivePath, archive);
    try {
      await execFileAsync('tar', ['-xf', archivePath.replace(/\\/g, '/'), '-C', installDirectory.replace(/\\/g, '/')], { windowsHide: true });
    } catch (tarError) {
      if (process.platform !== 'win32') {
        throw tarError;
      }
    }
    const executableName = process.platform === 'win32' ? 'tunnel-client.exe' : 'tunnel-client';
    let binary = await this.findFile(installDirectory, executableName);
    if (!binary && process.platform === 'win32') {
      try {
        await execFileAsync('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${installDirectory.replace(/'/g, "''")}' -Force`
        ], { windowsHide: true });
        binary = await this.findFile(installDirectory, executableName);
      } catch {
        // Bỏ qua lỗi powershell để ném lỗi "Không tìm thấy" ở dưới
      }
    }
    if (!binary) throw new Error(`Không tìm thấy ${executableName} sau khi giải nén.`);
    if (process.platform !== 'win32') await execFileAsync('chmod', ['+x', binary], { windowsHide: true });
    return binary;
  }

  private async initializeProfile(binary: string, tunnelId: string, localMcpUrl: string, apiKey: string): Promise<void> {
    await execFileAsync(binary, [
      'init', '--sample', 'sample_mcp_remote_no_auth', '--profile', PROFILE, '--force',
      '--tunnel-id', tunnelId, '--mcp-server-url', localMcpUrl, '--health-listen-addr', '127.0.0.1:0'
    ], { env: { ...process.env, CONTROL_PLANE_API_KEY: apiKey }, windowsHide: true, timeout: 30_000 });
  }

  private async doctor(binary: string, apiKey: string): Promise<void> {
    await execFileAsync(binary, ['doctor', '--profile', PROFILE, '--explain'], {
      env: { ...process.env, CONTROL_PLANE_API_KEY: apiKey }, windowsHide: true, timeout: 45_000
    });
  }

  private async startRuntime(binary: string, apiKey: string): Promise<void> {
    this.stopRuntime();
    const child = spawn(binary, ['run', '--profile', PROFILE], {
      env: { ...process.env, CONTROL_PLANE_API_KEY: apiKey }, windowsHide: true, stdio: 'pipe'
    });
    let errorOutput = '';
    child.stdout.on('data', () => undefined);
    child.stderr.on('data', (chunk) => { errorOutput = (errorOutput + String(chunk)).slice(-2000); });
    child.on('exit', () => { if (this.runtime === child) this.runtime = undefined; });
    this.runtime = child;
    await new Promise<void>((resolvePromise, reject) => {
      const timer = setTimeout(resolvePromise, 900);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(errorOutput.trim() || `tunnel-client đã dừng với mã ${code ?? 'không xác định'}.`));
      });
    });
  }

  private stopRuntime(): void {
    const current = this.runtime;
    this.runtime = undefined;
    if (current && current.exitCode === null) current.kill();
  }

  private async download(url: string): Promise<Uint8Array> {
    const response = await fetch(url, { headers: { 'user-agent': 'RelayCode' } });
    if (!response.ok) throw new Error(`Tải tunnel-client thất bại (HTTP ${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async findFile(directory: string, name: string): Promise<string | undefined> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isFile() && basename(target).toLowerCase() === name.toLowerCase()) return target;
      if (entry.isDirectory()) {
        const nested = await this.findFile(target, name);
        if (nested) return nested;
      }
    }
    return undefined;
  }
}
