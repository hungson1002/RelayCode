import * as vscode from 'vscode';
import type { ProviderKind } from './provider';
import type { RequestMetrics } from './types';

const PROFILES_STATE = 'nineRouter.providerProfiles';
const ACTIVE_PROFILE_STATE = 'nineRouter.activeProfileId';
const PROFILE_KEY_PREFIX = 'nineRouter.profileKey.';
const TELEMETRY_STATE = 'nineRouter.telemetry';

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
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async ensure(legacyKind: ProviderKind, legacyEndpoint: string): Promise<ProviderProfile> {
    let profiles = this.list();
    if (!profiles.length) {
      profiles = [{ id: `profile-${Date.now()}`, name: providerLabel(legacyKind), kind: legacyKind, endpoint: legacyEndpoint }];
      await this.context.globalState.update(PROFILES_STATE, profiles);
      await this.context.globalState.update(ACTIVE_PROFILE_STATE, profiles[0]!.id);
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
    if (index >= 0) profiles[index] = normalized;
    else profiles.push(normalized);
    await this.context.globalState.update(PROFILES_STATE, profiles);
    await this.context.globalState.update(ACTIVE_PROFILE_STATE, normalized.id);
    if (apiKey !== undefined) {
      if (apiKey.trim()) await this.context.secrets.store(`${PROFILE_KEY_PREFIX}${normalized.id}`, apiKey.trim());
      else await this.context.secrets.delete(`${PROFILE_KEY_PREFIX}${normalized.id}`);
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
    const next = remaining[0]!;
    if (wasActive) await this.context.globalState.update(ACTIVE_PROFILE_STATE, next.id);
    return this.active() ?? next;
  }

  public async apiKey(profile: ProviderProfile): Promise<string> {
    const own = await this.context.secrets.get(`${PROFILE_KEY_PREFIX}${profile.id}`);
    if (own !== undefined) return own;
    const legacy = profile.kind === '9router' ? 'nineRouter.apiKey' : `nineRouter.apiKey.${profile.kind}`;
    return (await this.context.secrets.get(legacy)) ?? '';
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
  return kind === 'anthropic' ? 'Anthropic Claude' : kind === 'lm-studio' ? 'LM Studio' : kind === 'openai-compatible' ? 'OpenAI-compatible' : kind === 'openai' ? 'OpenAI' : kind === 'ollama' ? 'Ollama' : '9Router';
}

function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
