import * as vscode from 'vscode';
import { runShellCommand } from './commandRuntime';

type HookStage = 'beforeAgent' | 'afterAgent';

interface HookConfiguration {
  beforeAgent?: string[];
  afterAgent?: string[];
}

export class HookManager {
  public async run(
    stage: HookStage,
    workspaceRoot: string,
    requestApproval: (description: string) => Promise<boolean>,
    onOutput: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const configuration = await this.load(workspaceRoot);
    const commands = configuration[stage]?.filter((command) => typeof command === 'string' && command.trim()).slice(0, 10) ?? [];
    for (const command of commands) {
      if (!await requestApproval(`Hook ${stage} muốn chạy: ${command}`)) continue;
      await runShellCommand({ command, cwd: workspaceRoot, timeoutMs: 120_000 }, (event) => onOutput(event.chunk), signal);
    }
  }

  private async load(workspaceRoot: string): Promise<HookConfiguration> {
    const uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.relaycode', 'hooks.json');
    let bytes: Uint8Array;
    try {
      bytes = await vscode.workspace.fs.readFile(uri);
    } catch {
      return {};
    }
    if (bytes.byteLength > 100_000) throw new Error('.relaycode/hooks.json lớn hơn 100 KB.');
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); }
    catch (error) { throw new Error(`Không đọc được .relaycode/hooks.json: ${error instanceof Error ? error.message : String(error)}`); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('.relaycode/hooks.json phải là một object JSON.');
    const record = value as Record<string, unknown>;
    return {
      beforeAgent: this.commands(record.beforeAgent),
      afterAgent: this.commands(record.afterAgent)
    };
  }

  private commands(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('Mỗi hook phải là một mảng command string.');
    return value;
  }
}
