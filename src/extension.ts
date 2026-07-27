import * as vscode from 'vscode';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ChatViewProvider(context);
  context.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('nineRouter.openChat', () => {
      void vscode.commands.executeCommand('workbench.view.extension.nineRouter');
    }),
    vscode.commands.registerCommand('nineRouter.configure', () => provider.configure()),
    vscode.commands.registerCommand('nineRouter.newThread', () => provider.newThread()),
    vscode.commands.registerCommand('nineRouter.openDashboard', () => provider.openDashboard()),
    vscode.commands.registerCommand('nineRouter.showLogs', () => provider.showLogs())
  );
}

export function deactivate(): void {}
