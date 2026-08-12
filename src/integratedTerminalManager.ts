import * as vscode from 'vscode';

const MAX_OUTPUT = 30_000;

export class IntegratedTerminalManager implements vscode.Disposable {
  private terminal: vscode.Terminal | undefined;
  private output = '';
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly onOutput: (output: string, chunk: string) => void) {
    this.disposables.push(
      vscode.window.onDidStartTerminalShellExecution((event) => {
        if (event.terminal !== this.terminal) return;
        void this.capture(event.execution);
      }),
      vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === this.terminal) this.terminal = undefined;
      })
    );
  }

  public open(): vscode.Terminal {
    if (!this.terminal) {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri;
      this.terminal = vscode.window.createTerminal({ name: 'RelayCode', cwd, iconPath: new vscode.ThemeIcon('terminal') });
    }
    this.terminal.show(false);
    return this.terminal;
  }

  public async run(command: string): Promise<void> {
    const terminal = this.open();
    if (terminal.shellIntegration) {
      terminal.shellIntegration.executeCommand(command);
      return;
    }
    terminal.sendText(command, true);
    void vscode.window.showInformationMessage('Đã gửi lệnh vào Terminal. Shell integration chưa sẵn sàng nên Agent chưa thể đọc output của lệnh này.');
  }

  public value(): string {
    return this.output;
  }

  public clear(): void {
    this.output = '';
    this.onOutput('', '');
  }

  public dispose(): void {
    this.terminal?.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }

  private async capture(execution: vscode.TerminalShellExecution): Promise<void> {
    try {
      for await (const chunk of execution.read()) {
        this.output = `${this.output}${chunk}`.slice(-MAX_OUTPUT);
        this.onOutput(this.output, chunk);
      }
    } catch {
      // Some shells expose execution events but do not permit reading output.
    }
  }
}
