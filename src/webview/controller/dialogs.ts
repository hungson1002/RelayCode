export const CHAT_CONTROLLER_DIALOGS = String.raw`
function requestFullAccessDialog() {
  renderUiDialog({
    id: 'local-full-access',
    title: uiCopy('Bật Full access?', 'Enable Full access?'),
    message: uiCopy('Agent có thể sửa file và chạy lệnh mà không hỏi lại.', 'Agent can edit files and run commands without asking again.'),
    detail: uiCopy('Chỉ bật khi bạn tin tưởng model và workspace hiện tại.', 'Only enable this when you trust the model and the current workspace.'),
    tone: 'warning',
    icon: 'shieldWarning',
    actions: [
      { id: 'cancel', label: uiCopy('Giữ chế độ hỏi', 'Keep asking'), kind: 'secondary' },
      { id: 'confirm', label: 'Full access', kind: 'danger' }
    ],
    onAction: (action) => {
      if (action === 'confirm') vscode.postMessage({ type: 'setPermissionMode', mode: 'full' });
    }
  });
}
`;
