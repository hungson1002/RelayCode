import * as vscode from 'vscode';
import type { OAuthClientProvider, OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens
} from '@modelcontextprotocol/sdk/shared/auth.js';

const OAUTH_PREFIX = 'nineRouter.mcpOAuth.';

interface StoredClientInformation {
  redirectUrl: string;
  value: OAuthClientInformationMixed;
}

export class McpOAuthProvider implements OAuthClientProvider {
  public readonly clientMetadataUrl = undefined;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly serverId: string,
    private readonly callbackUrl: string,
    private readonly oauthState: string,
    private readonly onRedirect: (url: URL) => Promise<void>
  ) {}

  public get redirectUrl(): string {
    return this.callbackUrl;
  }

  public get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'Lối AI Coding Agent',
      redirect_uris: [this.callbackUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    };
  }

  public state(): string {
    return this.oauthState;
  }

  public async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const saved = await this.read<StoredClientInformation>('client');
    return saved?.redirectUrl === this.callbackUrl ? saved.value : undefined;
  }

  public saveClientInformation(value: OAuthClientInformationMixed): Promise<void> {
    return this.write('client', { redirectUrl: this.callbackUrl, value });
  }

  public tokens(): Promise<OAuthTokens | undefined> {
    return this.read<OAuthTokens>('tokens');
  }

  public saveTokens(tokens: OAuthTokens): Promise<void> {
    return this.write('tokens', tokens);
  }

  public redirectToAuthorization(url: URL): Promise<void> {
    return this.onRedirect(url);
  }

  public async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.context.secrets.store(this.key('verifier'), codeVerifier);
  }

  public async codeVerifier(): Promise<string> {
    const verifier = await this.context.secrets.get(this.key('verifier'));
    if (!verifier) throw new Error('Không tìm thấy mã xác minh OAuth. Hãy đăng nhập lại.');
    return verifier;
  }

  public saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    return this.write('discovery', state);
  }

  public discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return this.read<OAuthDiscoveryState>('discovery');
  }

  public async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): Promise<void> {
    if (scope === 'all') {
      await Promise.all(['client', 'tokens', 'verifier', 'discovery'].map((part) => this.context.secrets.delete(this.key(part))));
      return;
    }
    await this.context.secrets.delete(this.key(scope));
  }

  private key(part: string): string {
    return `${OAUTH_PREFIX}${this.serverId}.${part}`;
  }

  private async read<T>(part: string): Promise<T | undefined> {
    const raw = await this.context.secrets.get(this.key(part));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.context.secrets.delete(this.key(part));
      return undefined;
    }
  }

  private async write(part: string, value: unknown): Promise<void> {
    await this.context.secrets.store(this.key(part), JSON.stringify(value));
  }
}

export async function hasMcpOAuthTokens(context: vscode.ExtensionContext, serverId: string): Promise<boolean> {
  return Boolean(await context.secrets.get(`${OAUTH_PREFIX}${serverId}.tokens`));
}

export async function clearMcpOAuth(context: vscode.ExtensionContext, serverId: string): Promise<void> {
  await Promise.all(['client', 'tokens', 'verifier', 'discovery'].map((part) => context.secrets.delete(`${OAUTH_PREFIX}${serverId}.${part}`)));
}
