import { describe, expect, it } from 'vitest';
import { renderMcpOAuthResult } from '../src/webview/mcpOAuthResult';

describe('MCP OAuth result page', () => {
  it('renders the successful handoff in Vietnamese', () => {
    const html = renderMcpOAuthResult({
      language: 'vi',
      ok: true,
      serverName: 'Notion'
    });

    expect(html).toContain('<html lang="vi">');
    expect(html).toContain('Đã kết nối.');
    expect(html).toContain('Notion</span> đã sẵn sàng');
    expect(html).toContain('Đóng tab này');
    expect(html).toContain('class="bridge"');
    expect(html).toContain('role="img" aria-label="Notion"');
    expect(html).not.toContain('<div class="endpoint service" title="Notion">N</div>');
    expect(html).toContain('history.replaceState(null,"","/relaycode/connected")');
  });

  it('renders the successful handoff entirely in English', () => {
    const html = renderMcpOAuthResult({
      language: 'en',
      ok: true,
      serverName: 'Linear'
    });

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('You’re connected.');
    expect(html).toContain('Linear</span> is ready');
    expect(html).toContain('Close this tab');
    expect(html).not.toContain('Đã kết nối');
    expect(html).not.toContain('Quay lại');
  });

  it('gives localized recovery guidance and escapes provider names', () => {
    const html = renderMcpOAuthResult({
      language: 'en',
      ok: false,
      serverName: '<Unsafe MCP>',
      reason: 'cancelled'
    });

    expect(html).toContain('Connection not completed.');
    expect(html).toContain('&lt;Unsafe MCP&gt;');
    expect(html).not.toContain('<Unsafe MCP>');
    expect(html).toContain('/relaycode/failed');
  });
});
