import type * as vscode from 'vscode';

const SESSION_KEY_PREFIX = 'relayCode.9routerQuotaSession.';

export interface QuotaItem {
  id: string;
  name: string;
  used?: number;
  total?: number;
  remaining?: number;
  remainingPercentage?: number;
  resetAt?: string;
  unlimited: boolean;
}

export interface QuotaAccount {
  id: string;
  provider: string;
  name: string;
  email?: string;
  plan?: string;
  active: boolean;
  status?: string;
  error?: string;
  quotas: QuotaItem[];
}

export interface QuotaSnapshot {
  status: 'loading' | 'ready' | 'auth-required' | 'unavailable';
  origin: string;
  accounts: QuotaAccount[];
  fetchedAt?: number;
  message?: string;
}

export interface ModelQuotaExhaustion {
  accountCount: number;
  resetAt?: string;
}

/** Returns a result only when every active account reports this model at zero. */
export function quotaExhaustionForModel(snapshot: QuotaSnapshot, model: string): ModelQuotaExhaustion | undefined {
  if (snapshot.status !== 'ready') return undefined;
  const activeAccounts = snapshot.accounts.filter((account) => account.active);
  if (!activeAccounts.length) return undefined;
  const matches = activeAccounts.map((account) => account.quotas.find((quota) => quotaMatchesModel(quota, model)));
  if (matches.some((quota) => !quota)) return undefined;
  const reported = matches as QuotaItem[];
  if (reported.some((quota) => quota.unlimited || !quotaIsExhausted(quota))) return undefined;
  const resetAt = reported
    .map((quota) => quota.resetAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  return { accountCount: activeAccounts.length, resetAt };
}

interface AuthStatus {
  requireLogin?: boolean;
  authMode?: string;
  hasPassword?: boolean;
}

interface ConnectionResponse {
  connections?: RouterConnection[];
}

interface RouterConnection {
  id: string;
  provider?: string;
  name?: string;
  email?: string | null;
  displayName?: string;
  isActive?: boolean;
  testStatus?: string;
  lastError?: string;
}

interface UsageResponse {
  plan?: string;
  message?: string;
  quotas?: Record<string, {
    used?: number;
    total?: number;
    remaining?: number;
    remainingPercentage?: number;
    resetAt?: string | null;
    unlimited?: boolean;
    displayName?: string;
  }>;
}

export class NineRouterQuotaService {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public loading(endpoint: string): QuotaSnapshot {
    return { status: 'loading', origin: originOf(endpoint), accounts: [] };
  }

  public async load(endpoint: string): Promise<QuotaSnapshot> {
    const origin = originOf(endpoint);
    try {
      const auth = await this.request<AuthStatus>(origin, '/api/auth/status');
      let cookie = await this.context.secrets.get(this.sessionKey(origin));
      let connections = await this.tryConnections(origin, cookie);

      if (!connections && auth.requireLogin) {
        if (auth.authMode === 'oidc') {
          return {
            status: 'auth-required',
            origin,
            accounts: [],
            message: '9Router đang dùng đăng nhập OIDC. Hãy đăng nhập trong trang quản lý rồi thử lại.'
          };
        }
        if (!auth.hasPassword) {
          cookie = await this.login(origin, '123456');
          connections = await this.tryConnections(origin, cookie);
        }
      }

      if (!connections) {
        return {
          status: 'auth-required',
          origin,
          accounts: [],
          message: 'Cần đăng nhập quản trị 9Router để đọc hạn mức của từng tài khoản.'
        };
      }

      const accounts = await mapWithConcurrency(connections, 4, async (connection) => {
        try {
          const usage = await this.request<UsageResponse>(origin, `/api/usage/${encodeURIComponent(connection.id)}`, cookie);
          return normalizeAccount(connection, usage);
        } catch (error) {
          return normalizeAccount(connection, undefined, errorText(error));
        }
      });

      return {
        status: 'ready',
        origin,
        accounts,
        fetchedAt: Date.now()
      };
    } catch (error) {
      return {
        status: 'unavailable',
        origin,
        accounts: [],
        message: `Không đọc được hạn mức từ 9Router: ${errorText(error)}`
      };
    }
  }

  public async loginWithPassword(endpoint: string, password: string): Promise<QuotaSnapshot> {
    const origin = originOf(endpoint);
    await this.login(origin, password);
    return this.load(endpoint);
  }

  private async login(origin: string, password: string): Promise<string> {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(12_000)
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    if (!cookie) throw new Error('9Router không trả session đăng nhập.');
    await this.context.secrets.store(this.sessionKey(origin), cookie);
    return cookie;
  }

  private async tryConnections(origin: string, cookie?: string): Promise<RouterConnection[] | undefined> {
    try {
      const result = await this.request<ConnectionResponse>(origin, '/api/providers/client?pageSize=500', cookie);
      return Array.isArray(result.connections) ? result.connections : [];
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        await this.context.secrets.delete(this.sessionKey(origin));
        return undefined;
      }
      throw error;
    }
  }

  private async request<T>(origin: string, path: string, cookie?: string): Promise<T> {
    const response = await fetch(`${origin}${path}`, {
      headers: cookie ? { Cookie: cookie } : undefined,
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new HttpError(response.status, body || `HTTP ${response.status}`);
    }
    return await response.json() as T;
  }

  private sessionKey(origin: string): string {
    return `${SESSION_KEY_PREFIX}${Buffer.from(origin).toString('base64url')}`;
  }
}

function normalizeAccount(connection: RouterConnection, usage?: UsageResponse, requestError?: string): QuotaAccount {
  const quotas = Object.entries(usage?.quotas ?? {}).map(([id, quota]) => {
    const total = finite(quota.total);
    const used = finite(quota.used);
    const remaining = finite(quota.remaining) ?? (total !== undefined && used !== undefined ? Math.max(0, total - used) : undefined);
    const remainingPercentage = finite(quota.remainingPercentage)
      ?? (total !== undefined && total > 0 && remaining !== undefined ? (remaining / total) * 100 : undefined);
    return {
      id,
      name: quota.displayName?.trim() || humanize(id),
      used,
      total,
      remaining,
      remainingPercentage: remainingPercentage === undefined ? undefined : clamp(remainingPercentage),
      resetAt: quota.resetAt ?? undefined,
      unlimited: quota.unlimited === true
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: connection.id,
    provider: connection.provider || 'unknown',
    name: connection.displayName?.trim() || connection.name?.trim() || connection.email?.trim() || 'Tài khoản',
    email: connection.email?.trim() || undefined,
    plan: usage?.plan,
    active: connection.isActive !== false,
    status: connection.testStatus,
    error: readableAccountError(requestError || usage?.message || connection.lastError),
    quotas
  };
}

function originOf(endpoint: string): string {
  try {
    return new URL(endpoint).origin;
  } catch {
    return endpoint.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  }
}

function humanize(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function quotaMatchesModel(quota: QuotaItem, model: string): boolean {
  const expected = canonicalModel(model);
  return [quota.id, quota.name].some((value) => {
    const candidate = canonicalModel(value);
    return Boolean(candidate && expected && (candidate === expected || candidate.includes(expected) || expected.includes(candidate)));
  });
}

function canonicalModel(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[a-z0-9_-]+\//, '')
    .replace(/\b(agent|reasoning)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function quotaIsExhausted(quota: QuotaItem): boolean {
  if (quota.remaining !== undefined) return quota.remaining <= 0;
  if (quota.remainingPercentage !== undefined) return quota.remainingPercentage <= 0;
  return quota.total !== undefined && quota.used !== undefined && quota.used >= quota.total;
}

function finite(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function errorText(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 403) return 'Không có quyền đọc hạn mức của tài khoản này. Hãy đăng nhập lại tài khoản upstream trong 9Router.';
    if (error.status === 401) return 'Phiên quản trị 9Router đã hết hạn. Hãy đăng nhập lại để xem hạn mức.';
    return `API hạn mức trả về HTTP ${error.status}.`;
  }
  return error instanceof Error ? error.message : String(error);
}

function readableAccountError(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/\b403\b|forbidden|invalid bearer|invalid token/i.test(value)) {
    return 'Tài khoản không còn quyền truy cập hạn mức. Hãy đăng nhập lại tài khoản này trong 9Router.';
  }
  if (/\b401\b|unauthorized/i.test(value)) {
    return 'Phiên đăng nhập đã hết hạn. Hãy xác thực lại tài khoản trong 9Router.';
  }
  return value.replace(/\s+/g, ' ').slice(0, 240);
}

class HttpError extends Error {
  public constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await work(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}
