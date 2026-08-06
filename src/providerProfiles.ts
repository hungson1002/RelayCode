import * as vscode from 'vscode';
import type { ProviderKind } from './provider';
import type { RequestMetrics } from './types';

const PROFILES_STATE = 'nineRouter.providerProfiles';
const ACTIVE_PROFILE_STATE = 'nineRouter.activeProfileId';
const PROFILE_KEY_PREFIX = 'nineRouter.profileKey.';
const EXPLICITLY_CLEARED_KEY = '__relaycode_key_explicitly_cleared__';
const TELEMETRY_STATE = 'nineRouter.telemetry';
const OPENCODE_ZEN_ENDPOINT = 'https://opencode.ai/zen/v1';
const LEGACY_OPENCODE_ENDPOINTS = new Set([
  'https://console.opencode.ai/inference/openai/v1'
]);
const LEGACY_SHARED_ENDPOINT_HOSTS = new Set(['kiraai.vn']);
const PROVIDER_KINDS: ProviderKind[] = ['omniroute', '9router', 'cockpit', 'opencode', 'openai', 'anthropic', 'openai-compatible', 'ollama', 'lm-studio'];

const DEFAULT_PROVIDER_ENDPOINTS: Record<ProviderKind, string> = {
  omniroute: 'http://127.0.0.1:20128/v1',
  '9router': 'http://127.0.0.1:20128/v1',
  cockpit: 'http://127.0.0.1:1455/v1',
  opencode: OPENCODE_ZEN_ENDPOINT,
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  'openai-compatible': '',
  ollama: 'http://localhost:11434/v1',
  'lm-studio': 'http://localhost:1234/v1'
};

export interface ProviderProfile {
  id: string;
  name: string;
  kind: ProviderKind;
  endpoint: string;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
}

export interface TelemetryRecord extends RequestMetrics {
  id: string;
  timestamp: number;
  profileId: string;
  profileName: string;
  provider: ProviderKind;
  model: string;
  cost?: number;
}

export class ProviderProfileStore {
  private readonly keyCache = new Map<string, string>();

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async ensure(legacyKind: ProviderKind, legacyEndpoint: string): Promise<ProviderProfile> {
    let profiles = this.list();
    if (!profiles.length) {
      const endpoint = migrateEndpoint(legacyKind, legacyEndpoint);
      profiles = [{ id: `profile-${Date.now()}`, name: providerLabel(legacyKind), kind: legacyKind, endpoint }];
      await this.context.globalState.update(PROFILES_STATE, profiles);
      await this.context.globalState.update(ACTIVE_PROFILE_STATE, profiles[0]!.id);
    } else {
      const migrated = profiles.map((profile) => {
        const endpoint = migrateEndpoint(profile.kind, profile.endpoint);
        return endpoint === profile.endpoint ? profile : { ...profile, endpoint };
      });
      if (migrated.some((profile, index) => profile !== profiles[index])) {
        profiles = migrated;
        await this.context.globalState.update(PROFILES_STATE, profiles);
      }
    }
    return this.active() ?? profiles[0]!;
  }

  public list(): ProviderProfile[] {
    return this.context.globalState.get<ProviderProfile[]>(PROFILES_STATE, []);
  }

  public active(): ProviderProfile | undefined {
    const profiles = this.list();
    const id = this.context.globalState.get<string>(ACTIVE_PROFILE_STATE, '');
    return profiles.find((item) => item.id === id) ?? profiles[0];
  }

  public async save(profile: ProviderProfile, apiKey?: string): Promise<ProviderProfile> {
    const normalized: ProviderProfile = {
      ...profile,
      id: profile.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: profile.name.trim() || providerLabel(profile.kind),
      endpoint: profile.endpoint.trim(),
      inputPricePerMillion: positive(profile.inputPricePerMillion),
      outputPricePerMillion: positive(profile.outputPricePerMillion)
    };
    const profiles = this.list();
    const index = profiles.findIndex((item) => item.id === normalized.id);
    const existing = index >= 0 ? profiles[index] : undefined;
    if (existing && existing.kind !== normalized.kind) {
      // Migrate a pre-1.0.16 profile key to the provider it belonged to before
      // changing the profile kind. This prevents an OpenAI key, for example,
      // from being reused as an Anthropic key.
      const legacyProfileKey = await this.context.secrets.get(`${PROFILE_KEY_PREFIX}${normalized.id}`);
      const previousScopedKey = this.scopedKey(normalized.id, existing.kind);
      if (legacyProfileKey !== undefined && await this.context.secrets.get(previousScopedKey) === undefined) {
        await this.context.secrets.store(previousScopedKey, legacyProfileKey);
      }
      if (legacyProfileKey !== undefined) await this.context.secrets.delete(`${PROFILE_KEY_PREFIX}${normalized.id}`);
    }
    if (index >= 0) profiles[index] = normalized;
    else profiles.push(normalized);
    await this.context.globalState.update(PROFILES_STATE, profiles);
    await this.context.globalState.update(ACTIVE_PROFILE_STATE, normalized.id);
    if (apiKey !== undefined) {
      const key = this.scopedKey(normalized.id, normalized.kind);
      if (apiKey.trim()) {
        const value = apiKey.trim();
        await this.context.secrets.store(key, value);
        this.keyCache.set(key, value);
      } else {
        await this.context.secrets.store(key, EXPLICITLY_CLEARED_KEY);
        this.keyCache.delete(key);
      }
    }
    return normalized;
  }

  public async activate(id: string): Promise<ProviderProfile> {
    const profile = this.list().find((item) => item.id === id);
    if (!profile) throw new Error('Không tìm thấy provider profile.');
    await this.context.globalState.update(ACTIVE_PROFILE_STATE, id);
    return profile;
  }

  public async remove(id: string): Promise<ProviderProfile> {
    const wasActive = this.active()?.id === id;
    const remaining = this.list().filter((item) => item.id !== id);
    if (!remaining.length) throw new Error('Cần giữ lại ít nhất một provider profile.');
    await this.context.globalState.update(PROFILES_STATE, remaining);
    await this.context.secrets.delete(`${PROFILE_KEY_PREFIX}${id}`);
    await Promise.all(PROVIDER_KINDS.map((kind) => this.context.secrets.delete(this.scopedKey(id, kind))));
    PROVIDER_KINDS.forEach((kind) => this.keyCache.delete(this.scopedKey(id, kind)));
    const next = remaining[0]!;
    if (wasActive) await this.context.globalState.update(ACTIVE_PROFILE_STATE, next.id);
    return this.active() ?? next;
  }

  public async apiKey(profile: ProviderProfile): Promise<string> {
    return this.apiKeyFor(profile.id, profile.kind);
  }

  public async apiKeyFor(profileId: string, kind: ProviderKind): Promise<string> {
    const scopedKey = this.scopedKey(profileId, kind);
    const scoped = await this.context.secrets.get(scopedKey);
    if (scoped !== undefined) {
      if (scoped === EXPLICITLY_CLEARED_KEY) {
        this.keyCache.delete(scopedKey);
        return '';
      }
      this.keyCache.set(scopedKey, scoped);
      return scoped;
    }
    const cached = this.keyCache.get(scopedKey);
    if (cached !== undefined) return cached;
    const oldProfileKey = profileId ? await this.context.secrets.get(`${PROFILE_KEY_PREFIX}${profileId}`) : undefined;
    if (oldProfileKey !== undefined) {
      await this.context.secrets.store(this.scopedKey(profileId, kind), oldProfileKey);
      await this.context.secrets.delete(`${PROFILE_KEY_PREFIX}${profileId}`);
      if (oldProfileKey !== EXPLICITLY_CLEARED_KEY) this.keyCache.set(scopedKey, oldProfileKey);
      return oldProfileKey === EXPLICITLY_CLEARED_KEY ? '' : oldProfileKey;
    }
    const legacy = kind === '9router' ? 'nineRouter.apiKey' : `nineRouter.apiKey.${kind}`;
    const value = (await this.context.secrets.get(legacy)) ?? '';
    if (profileId && value) {
      await this.context.secrets.store(scopedKey, value);
      this.keyCache.set(scopedKey, value);
    }
    return value;
  }

  private scopedKey(profileId: string, kind: ProviderKind): string {
    return `${PROFILE_KEY_PREFIX}${profileId}.${kind}`;
  }
}

function migrateEndpoint(kind: ProviderKind, endpoint: string): string {
  const trimmed = endpoint.trim();
  if (kind === 'opencode' && LEGACY_OPENCODE_ENDPOINTS.has(trimmed.replace(/\/+$/, ''))) return OPENCODE_ZEN_ENDPOINT;
  if (!isLegacySharedEndpoint(trimmed)) return endpoint;
  return DEFAULT_PROVIDER_ENDPOINTS[kind];
}

function isLegacySharedEndpoint(endpoint: string): boolean {
  try {
    const hostname = new URL(endpoint).hostname.toLowerCase();
    return [...LEGACY_SHARED_ENDPOINT_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export class TelemetryStore {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public list(): TelemetryRecord[] {
    return this.context.globalState.get<TelemetryRecord[]>(TELEMETRY_STATE, []);
  }

  public async record(profile: ProviderProfile, model: string, metrics: RequestMetrics): Promise<TelemetryRecord> {
    const cost = profile.inputPricePerMillion !== undefined && profile.outputPricePerMillion !== undefined
      ? (metrics.inputTokens / 1_000_000) * profile.inputPricePerMillion + (metrics.outputTokens / 1_000_000) * profile.outputPricePerMillion
      : undefined;
    const record: TelemetryRecord = {
      ...metrics,
      id: `metric-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      profileId: profile.id,
      profileName: profile.name,
      provider: profile.kind,
      model,
      cost
    };
    await this.context.globalState.update(TELEMETRY_STATE, [record, ...this.list()].slice(0, 300));
    return record;
  }

  public async clear(): Promise<void> {
    await this.context.globalState.update(TELEMETRY_STATE, []);
  }
}

function providerLabel(kind: ProviderKind): string {
  return kind === 'omniroute' ? 'OmniRoute' : kind === 'cockpit' ? 'Cockpit Tools' : kind === 'opencode' ? 'OpenCode' : kind === 'anthropic' ? 'Anthropic Claude' : kind === 'lm-studio' ? 'LM Studio' : kind === 'openai-compatible' ? 'OpenAI-compatible' : kind === 'openai' ? 'OpenAI' : kind === 'ollama' ? 'Ollama' : '9Router';
}

function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
