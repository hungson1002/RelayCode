import * as vscode from 'vscode';

const STATE = 'nineRouter.scheduledAgentTasks';

export interface ScheduledAgentTask {
  id: string;
  prompt: string;
  intervalMinutes: number;
  enabled: boolean;
  nextRunAt: number;
}

export class ScheduledTaskManager implements vscode.Disposable {
  private readonly timer: NodeJS.Timeout;
  private ticking = false;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly run: (task: ScheduledAgentTask) => Promise<void>
  ) {
    this.timer = setInterval(() => void this.tick().catch((error) => {
      console.error('[RelayCode schedule]', error);
    }), 30_000);
  }

  public async manage(): Promise<string | undefined> {
    const tasks = this.tasks();
    const choice = await vscode.window.showQuickPick([
      { label: 'Add scheduled Agent task', description: 'Tạo tác vụ chạy định kỳ khi VS Code và workspace đang mở', action: 'add' },
      ...tasks.map((task) => ({ label: task.prompt.slice(0, 80), description: `${task.enabled ? 'Enabled' : 'Disabled'} · mỗi ${task.intervalMinutes} phút`, action: task.id }))
    ], { title: 'RelayCode scheduled tasks', placeHolder: tasks.length ? `${tasks.length} task` : 'Chưa có task' });
    if (!choice) return undefined;
    if (choice.action === 'add') {
      const prompt = await vscode.window.showInputBox({ title: 'Scheduled Agent task', prompt: 'Agent sẽ thực hiện yêu cầu này trong workspace', placeHolder: 'Ví dụ: chạy test và báo lỗi mới', validateInput: (value) => value.trim() ? undefined : 'Nhập yêu cầu' });
      if (!prompt) return undefined;
      const intervalText = await vscode.window.showInputBox({
        title: 'Run interval',
        prompt: 'Số phút giữa hai lần chạy (tối thiểu 15)',
        value: '60',
        validateInput: (value) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= 15 && parsed <= 43_200 ? undefined : 'Nhập số từ 15 đến 43200';
        }
      });
      if (!intervalText) return undefined;
      const intervalMinutes = Math.min(43_200, Math.max(15, Math.floor(Number(intervalText))));
      const latestTasks = this.tasks();
      latestTasks.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, prompt: prompt.trim(), intervalMinutes, enabled: true, nextRunAt: Date.now() + intervalMinutes * 60_000 });
      await this.context.workspaceState.update(STATE, latestTasks);
      return `Đã tạo tác vụ định kỳ mỗi ${intervalMinutes} phút: ${prompt.trim()}`;
    }
    const task = tasks.find((item) => item.id === choice.action);
    if (!task) return undefined;
    const action = await vscode.window.showQuickPick([
      { label: 'Run now', action: 'run' },
      { label: task.enabled ? 'Disable' : 'Enable', action: 'toggle' },
      { label: 'Delete', action: 'delete' }
    ], { title: task.prompt });
    if (action?.action === 'run') {
      await this.run(task);
      // The Agent run writes its own complete user/assistant turn to history.
      return undefined;
    }
    const freshTasks = this.tasks();
    const targetIndex = freshTasks.findIndex((item) => item.id === task.id);
    if (targetIndex < 0) return undefined;
    const freshTask = freshTasks[targetIndex]!;
    if (action?.action === 'toggle') freshTask.enabled = !freshTask.enabled;
    if (action?.action === 'delete') freshTasks.splice(targetIndex, 1);
    if (action?.action && action.action !== 'run') await this.context.workspaceState.update(STATE, freshTasks);
    if (action?.action === 'toggle') return `${freshTask.enabled ? 'Đã bật' : 'Đã tắt'} tác vụ định kỳ: ${freshTask.prompt}`;
    if (action?.action === 'delete') return `Đã xóa tác vụ định kỳ: ${freshTask.prompt}`;
    return undefined;
  }

  public dispose(): void {
    clearInterval(this.timer);
  }

  private tasks(): ScheduledAgentTask[] {
    return this.context.workspaceState.get<ScheduledAgentTask[]>(STATE, []).map((task) => ({ ...task }));
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      const tasks = this.tasks();
      const due = tasks
        .filter((task) => task.enabled && task.nextRunAt <= now)
        .sort((left, right) => left.nextRunAt - right.nextRunAt)[0];
      if (!due) return;
      due.nextRunAt = now + due.intervalMinutes * 60_000;
      await this.context.workspaceState.update(STATE, tasks);
      await this.run(due);
    } finally {
      this.ticking = false;
    }
  }
}
