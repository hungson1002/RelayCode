import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve('src/chatGptTunnelSetup.ts'), 'utf8');
const bridgeSource = readFileSync(resolve('src/chatGptBridge.ts'), 'utf8');
const providerSource = readFileSync(resolve('src/chatViewProvider.ts'), 'utf8');

describe('ChatGPT Web setup wizard', () => {
  it('keeps the runtime key in Secret Storage and validates official downloads', () => {
    expect(source).toContain("API_KEY_SECRET = 'nineRouter.chatGptBridge.runtimeApiKey'");
    expect(source).toContain('this.context.secrets.store(API_KEY_SECRET, apiKey)');
    expect(source).toContain("createHash('sha256')");
    expect(source).toContain("item.name === 'SHA256SUMS.txt'");
    expect(source).not.toContain('globalState.update(API_KEY_SECRET');
  });

  it('configures, validates and runs the official tunnel client without exposing the key in command arguments', () => {
    expect(source).toContain("'sample_mcp_remote_no_auth'");
    expect(source).toContain("'--mcp-server-url', localMcpUrl");
    expect(source).toContain("['doctor', '--profile', PROFILE, '--explain']");
    expect(source).toContain("CONTROL_PLANE_API_KEY: apiKey");
    expect(source).toContain("spawn(binary, ['run', '--profile', PROFILE]");
    expect(source).not.toContain("'--runtime-api-key', apiKey");
  });

  it('turns /chatgpt into setup on first use and a compact status menu afterwards', () => {
    expect(bridgeSource).toContain('if (!this.tunnelSetup.status().configured)');
    expect(bridgeSource).toContain('await this.configureTunnel(current.url!)');
    expect(bridgeSource).toContain("label: '$(link-external) Hoàn tất trên ChatGPT'");
    expect(bridgeSource).toContain("label: '$(sync) Kết nối lại'");
    expect(bridgeSource).toContain("label: '$(history) Mở timeline ChatGPT Web'");
    expect(bridgeSource).toContain('await this.callbacks.openActivityTimeline()');
    expect(bridgeSource).not.toContain('private async showActivity()');
  });

  it('keeps the final ChatGPT step visible as an exact field-by-field checklist', () => {
    expect(source).toContain("'Tunnel đã kết nối · Còn 1 bước trong ChatGPT'");
    expect(source).toContain("'1. Mở Plugin → nhấn dấu + → Plugin mới.'");
    expect(source).toContain("'3. Kết nối: chọn Tunnel.'");
    expect(source).toContain("'5. Xác thực: Không có tính năng xác thực.'");
    expect(source).toContain("'6. Tích “Tôi hiểu và muốn tiếp tục” → bấm Tạo.'");
    expect(source).toContain("'Sao chép checklist'");
    expect(source).not.toContain('ChatGPT đã sẵn sàng nhận project này');
  });

  it('creates a dedicated chat-history timeline only after ChatGPT calls a workspace tool', () => {
    expect(providerSource).toContain("const CHATGPT_WEB_SESSION_ID = 'relaycode-chatgpt-web'");
    expect(providerSource).toContain('private async recordChatGptWebActivity(activity: ChatGptBridgeActivity)');
    expect(providerSource).toContain("kind: 'chatgpt-web'");
    expect(providerSource).toContain("title: kind === 'chatgpt-web' ? 'ChatGPT Web'");
    expect(providerSource).toContain("type: 'chatGptWebActivity', activity");
    expect(providerSource).not.toContain("message: `**ChatGPT Web · ${activity.tool}**");
  });

  it('serializes concurrent activity writes and associates ChatGPT file changes with its timeline', () => {
    expect(providerSource).toContain('private chatGptActivityWrite: Promise<void> = Promise.resolve()');
    expect(providerSource).toContain('.then(() => this.recordChatGptWebActivity(activity))');
    expect(providerSource).toContain('registerChange(change, false, undefined, undefined, CHATGPT_WEB_SESSION_ID)');
    expect(providerSource).toContain("sessionId === CHATGPT_WEB_SESSION_ID ? 'chatgpt-web'");
    const recordActivityBody = providerSource.slice(
      providerSource.indexOf('private async recordChatGptWebActivity'),
      providerSource.indexOf('private async runScheduledTask')
    );
    expect(recordActivityBody).not.toContain('postChangesState()');
  });
});
