import { describe, expect, it } from 'vitest';
import { quotaExhaustionForModel, type QuotaSnapshot } from '../src/nineRouterQuota';
import type { ProviderProfile, TelemetryRecord } from '../src/providerProfiles';
import { renderTelemetryDashboard } from '../src/webview/telemetryDashboard';

const webview = { cspSource: 'vscode-webview://test' } as never;

function quota(): QuotaSnapshot {
  return {
    status: 'ready',
    origin: 'http://localhost:20128',
    fetchedAt: Date.now(),
    accounts: [
      {
        id: 'account-antigravity',
        provider: 'antigravity',
        name: 'Antigravity account',
        email: 'user@example.com',
        plan: 'Antigravity',
        active: true,
        quotas: [
          {
            id: 'gemini-3.5-flash-high',
            name: 'Gemini 3.5 Flash (High)',
            used: 250,
            total: 1000,
            remaining: 750,
            remainingPercentage: 75,
            resetAt: new Date(Date.now() + 3_600_000).toISOString(),
            unlimited: false
          }
        ]
      },
      {
        id: 'account-codex',
        provider: 'codex',
        name: 'Codex account',
        active: true,
        quotas: [
          {
            id: 'session',
            name: 'Session',
            used: 98,
            total: 100,
            remaining: 2,
            remainingPercentage: 2,
            unlimited: false
          }
        ]
      }
    ]
  };
}

function record(): TelemetryRecord {
  return {
    id: 'metric-1',
    timestamp: 1_700_000_000_000,
    profileId: 'profile-1',
    profileName: '9Router chính',
    provider: '9router',
    model: 'kr/claude-sonnet-4.5',
    inputTokens: 750,
    outputTokens: 250,
    totalTokens: 1000,
    latencyMs: 1200,
    estimated: false
  };
}

describe('telemetry dashboard', () => {
  it('renders real account quotas and model/account/provider filters', () => {
    const html = renderTelemetryDashboard(webview, [record()], quota(), 'nonce');

    expect(html).toContain('Gemini 3.5 Flash (High)');
    expect(html).toContain('user@example.com');
    expect(html).toContain('75%');
    expect(html).toContain('Session');
    expect(html).toContain('2%');
    expect(html).toContain('<progress class="quota-gauge critical" max="100" value="2"');
    expect(html).toContain('id="provider"');
    expect(html).toContain('id="account"');
    expect(html).toContain('id="model"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="quotaTab"');
    expect(html).toContain('id="activityTab"');
    expect(html).toContain('id="activityPanel"');
    expect(html).toContain('Token usage by model');
    expect(html).toContain('Token usage <b>1 model</b>');
    expect(html).toContain('Quota &amp; limits <b>2 hạn mức</b>');
    expect(html).toContain('quota-heading');
    expect(html).toContain('activity-heading');
    expect(html).toContain('*::-webkit-scrollbar-track,*::-webkit-scrollbar-track-piece,*::-webkit-scrollbar-corner{border:0;background:transparent');
    expect(html).toContain('*::-webkit-scrollbar-button:single-button:vertical:decrement');
    expect(html).not.toContain('scrollbar-width:none');
    expect(html).toContain('vscode.setState');
    expect(html).toContain('grid-template-areas:"model token" "model latency"');
    expect(html).toContain('.request-head span:nth-child(3),.request-head span:nth-child(4){text-align:right}');
  });

  it('shows a secure login action instead of inventing quota data', () => {
    const html = renderTelemetryDashboard(webview, [], {
      status: 'auth-required',
      origin: 'http://localhost:20128',
      accounts: [],
      message: 'Cần đăng nhập.'
    }, 'nonce');

    expect(html).toContain('Cần đăng nhập 9Router');
    expect(html).toContain('id="quotaLogin"');
    expect(html).toContain('id="dashboardDialog"');
    expect(html).toContain("type:'loginQuota',password:dialogInput.value");
    expect(html).toContain("type:'clearConfirmed'");
    expect(html).not.toContain('data-account=');
  });

  it('shows only the active non-9Router provider and derives its real rate-limit percentage', () => {
    const profile: ProviderProfile = {
      id: 'cockpit-main',
      name: 'Cockpit local',
      kind: 'cockpit',
      endpoint: 'http://127.0.0.1:1455/v1'
    };
    const cockpitRecord: TelemetryRecord = {
      ...record(),
      profileId: profile.id,
      profileName: profile.name,
      provider: 'cockpit',
      model: 'claude-sonnet',
      rateLimit: { tokensLimit: '1000', tokensRemaining: '640', reset: '60' }
    };
    const html = renderTelemetryDashboard(webview, [record(), cockpitRecord], quota(), 'nonce', profile);

    expect(html).toContain('Model activity');
    expect(html).toContain('Cockpit Tools');
    expect(html).toContain('64% còn lại');
    expect(html).toContain('<progress class="quota-gauge healthy" max="100" value="64"');
    expect(html).not.toContain('style="width:64%');
    expect(html).toContain('class="metric-icon"');
    expect(html).not.toContain('Gemini 3.5 Flash (High)');
    expect(html).not.toContain('/providers/');
  });

  it('renders the entire dashboard chrome in English when English is selected', () => {
    const html = renderTelemetryDashboard(webview, [record()], quota(), 'nonce', undefined, 'en');

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Account quotas from 9Router');
    expect(html).toContain('Delete data');
    expect(html).toContain('Refresh');
    expect(html).toContain('All providers');
    expect(html).toContain('Remaining quota');
    expect(html).not.toMatch(/Tài khoản|Hạn mức|Bộ lọc|Tất cả|Xóa dữ liệu|Làm mới|Đang bật|Chưa có/);
    expect(html.replaceAll('9Router chính', '')).not.toMatch(/[ăâêôơưĂÂÊÔƠƯđĐáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/);
  });

  it('detects when every active account has exhausted the selected model', () => {
    const exhausted: QuotaSnapshot = {
      status: 'ready',
      origin: 'http://localhost:20128',
      accounts: ['one', 'two'].map((id) => ({
        id,
        provider: 'antigravity',
        name: id,
        active: true,
        quotas: [{
          id: 'claude-opus-4-6-thinking',
          name: 'Claude Opus 4.6 (Thinking)',
          used: 1000,
          total: 1000,
          remaining: 0,
          remainingPercentage: 0,
          unlimited: false
        }]
      }))
    };

    expect(quotaExhaustionForModel(exhausted, 'ag/claude-opus-4-6-thinking')).toEqual({ accountCount: 2, resetAt: undefined });
    exhausted.accounts[1]!.quotas[0]!.remaining = 10;
    expect(quotaExhaustionForModel(exhausted, 'ag/claude-opus-4-6-thinking')).toBeUndefined();
  });
});
