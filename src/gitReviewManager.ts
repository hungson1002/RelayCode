import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { relative, resolve, sep } from 'node:path';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export type GitReviewScope = 'uncommitted' | 'unstaged' | 'staged' | 'branch' | 'commit';

export interface GitReviewSelection {
  root: string;
  scope: GitReviewScope;
  reference?: string;
}

export interface GitReviewResult extends GitReviewSelection {
  title: string;
  diff: string;
  files: string[];
}

export class GitReviewManager {
  public async choosePullRequest(): Promise<GitReviewResult | undefined> {
    const repositories = await this.repositories();
    const root = repositories[0];
    if (!root) {
      void vscode.window.showWarningMessage('Workspace hiện tại không phải Git repository.');
      return undefined;
    }
    let rows: Array<{ number: number; title: string; headRefName?: string }>;
    try {
      rows = JSON.parse(await this.executable(root, 'gh', ['pr', 'list', '--limit', '50', '--json', 'number,title,headRefName'])) as typeof rows;
    } catch (error) {
      void vscode.window.showErrorMessage(`Không đọc được pull request bằng GitHub CLI: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
    const selected = await vscode.window.showQuickPick(rows.map((item) => ({ label: `#${item.number} ${item.title}`, description: item.headRefName, item })), {
      title: 'GitHub pull requests', placeHolder: 'Chọn PR cần review'
    });
    if (!selected) return undefined;
    const diff = await this.executable(root, 'gh', ['pr', 'diff', String(selected.item.number)]);
    const files = [...diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((match) => match[2] || match[1]).filter(Boolean) as string[];
    return { root, scope: 'branch', reference: `PR #${selected.item.number}`, title: `PR #${selected.item.number}: ${selected.item.title}`, diff, files: [...new Set(files)] };
  }

  public async choose(): Promise<GitReviewSelection | undefined> {
    const repositories = await this.repositories();
    if (!repositories.length) {
      void vscode.window.showWarningMessage('Workspace hiện tại không phải Git repository.');
      return undefined;
    }
    const root = repositories.length === 1
      ? repositories[0]!
      : (await vscode.window.showQuickPick(repositories.map((path) => ({ label: vscode.workspace.asRelativePath(path) || path, description: path, path })), {
          title: 'Review Git repository', placeHolder: 'Chọn repository cần review'
        }))?.path;
    if (!root) return undefined;
    const scopeItem = await vscode.window.showQuickPick([
      { label: 'Uncommitted changes', description: 'Staged, unstaged và file chưa được Git theo dõi', scope: 'uncommitted' as const },
      { label: 'Unstaged changes', description: 'Các thay đổi chưa stage và file untracked', scope: 'unstaged' as const },
      { label: 'Staged changes', description: 'Các thay đổi chuẩn bị commit', scope: 'staged' as const },
      { label: 'Compare with branch', description: 'Diff từ merge-base của một branch đến HEAD', scope: 'branch' as const },
      { label: 'Review a commit', description: 'Diff của một commit cụ thể', scope: 'commit' as const }
    ], { title: 'Review scope', placeHolder: 'Chọn phạm vi review' });
    if (!scopeItem) return undefined;
    let reference: string | undefined;
    if (scopeItem.scope === 'branch') {
      const branches = (await this.git(root, ['branch', '--format=%(refname:short)'])).split(/\r?\n/).filter(Boolean);
      reference = await vscode.window.showQuickPick(branches, { title: 'Base branch', placeHolder: 'Chọn branch để so sánh' });
    } else if (scopeItem.scope === 'commit') {
      const commits = (await this.git(root, ['log', '-n', '40', '--pretty=format:%h%x09%s'])).split(/\r?\n/).filter(Boolean);
      const picked = await vscode.window.showQuickPick(commits, { title: 'Commit', placeHolder: 'Chọn commit cần review' });
      reference = picked?.split('\t')[0];
    }
    if ((scopeItem.scope === 'branch' || scopeItem.scope === 'commit') && !reference) return undefined;
    return { root, scope: scopeItem.scope, reference };
  }

  public async load(selection: GitReviewSelection): Promise<GitReviewResult> {
    const { root, scope, reference } = selection;
    let diff = '';
    if (scope === 'staged') diff = await this.git(root, ['diff', '--cached', '--no-ext-diff', '--binary']);
    if (scope === 'unstaged') diff = await this.unstaged(root);
    if (scope === 'uncommitted') {
      const staged = await this.git(root, ['diff', '--cached', '--no-ext-diff', '--binary']);
      diff = [staged, await this.unstaged(root)].filter(Boolean).join('\n');
    }
    if (scope === 'branch') {
      const base = (await this.git(root, ['merge-base', reference!, 'HEAD'])).trim();
      diff = await this.git(root, ['diff', '--no-ext-diff', '--binary', `${base}..HEAD`]);
    }
    if (scope === 'commit') diff = await this.git(root, ['show', '--format=', '--no-ext-diff', '--binary', reference!]);
    const files = [...diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((match) => match[2] || match[1]).filter(Boolean) as string[];
    const title = scope === 'branch' ? `HEAD so với ${reference}` : scope === 'commit' ? `Commit ${reference}` : scope === 'staged' ? 'Staged changes' : scope === 'unstaged' ? 'Unstaged changes' : 'Uncommitted changes';
    return { ...selection, title, diff, files: [...new Set(files)] };
  }

  public async openDiff(result: GitReviewResult): Promise<void> {
    const document = await vscode.workspace.openTextDocument({ language: 'diff', content: result.diff || '# Không có thay đổi trong phạm vi đã chọn.\n' });
    await vscode.window.showTextDocument(document, { preview: true });
  }

  public reviewPrompt(result: GitReviewResult): string {
    const clipped = result.diff.slice(0, 180_000);
    return [
      `Review Git diff: ${result.title}.`,
      'Chỉ báo cáo lỗi thực tế, regression, vấn đề bảo mật hoặc thiếu test quan trọng. Ưu tiên theo mức độ nghiêm trọng và dẫn file/dòng từ diff. Không sửa file.',
      '',
      '```diff',
      clipped || '# No changes',
      '```',
      result.diff.length > clipped.length ? '\nDiff đã được cắt bớt vì quá lớn; hãy nêu giới hạn này.' : ''
    ].join('\n');
  }

  private async repositories(): Promise<string[]> {
    const roots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
    const discovered = await Promise.all(roots.map(async (root) => {
      try { return (await this.git(root, ['rev-parse', '--show-toplevel'])).trim(); } catch { return ''; }
    }));
    return [...new Set(discovered.filter(Boolean).map((path) => resolve(path)))];
  }

  private async unstaged(root: string): Promise<string> {
    const tracked = await this.git(root, ['diff', '--no-ext-diff', '--binary']);
    const status = await this.git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const untracked = status.split('\0').filter((entry) => entry.startsWith('?? ')).map((entry) => entry.slice(3));
    const additions: string[] = [];
    for (const path of untracked) {
      const absolute = resolve(root, path);
      const inside = relative(resolve(root), absolute);
      if (inside === '..' || inside.startsWith(`..${sep}`) || resolve(inside) === inside) continue;
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absolute));
        if (bytes.includes(0) || bytes.byteLength > 2_000_000) continue;
        const text = Buffer.from(bytes).toString('utf8');
        additions.push(`diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${text.split(/\r?\n/).length} @@\n${text.split(/\r?\n/).map((line) => `+${line}`).join('\n')}`);
      } catch { /* File may disappear while status is being read. */ }
    }
    return [tracked, ...additions].filter(Boolean).join('\n');
  }

  private async git(cwd: string, args: string[]): Promise<string> {
    return this.executable(cwd, 'git', ['-c', 'core.quotepath=false', ...args]);
  }

  private async executable(cwd: string, executable: string, args: string[]): Promise<string> {
    const result = await execFileAsync(executable, args, { cwd, windowsHide: true, maxBuffer: 24 * 1024 * 1024, encoding: 'utf8' });
    return result.stdout;
  }
}
