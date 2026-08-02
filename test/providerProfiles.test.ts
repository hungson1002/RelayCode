import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({}));

import { ProviderProfileStore, type ProviderProfile } from '../src/providerProfiles';

function contextFixture(initialProfiles: ProviderProfile[] = []) {
  const state = new Map<string, unknown>([
    ['nineRouter.providerProfiles', initialProfiles],
    ['nineRouter.activeProfileId', initialProfiles[0]?.id ?? '']
  ]);
  const secrets = new Map<string, string>();
  const context = {
    globalState: {
      get: (key: string, fallback?: unknown) => state.has(key) ? state.get(key) : fallback,
      update: async (key: string, value: unknown) => {
        if (value === undefined) state.delete(key);
        else state.set(key, value);
      }
    },
    secrets: {
      get: async (key: string) => secrets.get(key),
      store: async (key: string, value: string) => { secrets.set(key, value); },
      delete: async (key: string) => { secrets.delete(key); }
    }
  };
  return { context, secrets };
}

describe('ProviderProfileStore API keys', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps a separate secret for every provider when one profile changes kind', async () => {
    const original: ProviderProfile = { id: 'profile-1', name: 'Main', kind: 'openai', endpoint: 'https://api.openai.com/v1' };
    const { context, secrets } = contextFixture([original]);
    secrets.set('nineRouter.profileKey.profile-1', 'sk-openai-legacy');
    const store = new ProviderProfileStore(context as never);

    const anthropic = await store.save({ ...original, kind: 'anthropic', endpoint: 'https://api.anthropic.com/v1' });
    expect(secrets.get('nineRouter.profileKey.profile-1.openai')).toBe('sk-openai-legacy');
    expect(await store.apiKey(anthropic)).toBe('');

    await store.save(anthropic, 'sk-anthropic');
    const openai = await store.save({ ...original });
    expect(await store.apiKey(openai)).toBe('sk-openai-legacy');
    expect(await store.apiKeyFor('profile-1', 'anthropic')).toBe('sk-anthropic');
  });

  it('migrates an existing profile secret and restores it after reload', async () => {
    const profile: ProviderProfile = { id: 'profile-2', name: 'OpenAI', kind: 'openai', endpoint: 'https://api.openai.com/v1' };
    const fixture = contextFixture([profile]);
    fixture.secrets.set('nineRouter.profileKey.profile-2', 'sk-saved');

    const first = new ProviderProfileStore(fixture.context as never);
    expect(await first.apiKey(profile)).toBe('sk-saved');
    expect(fixture.secrets.has('nineRouter.profileKey.profile-2')).toBe(false);

    const afterReload = new ProviderProfileStore(fixture.context as never);
    expect(await afterReload.apiKey(profile)).toBe('sk-saved');
  });

  it('migrates saved OpenCode Console profiles to OpenCode Zen', async () => {
    const profile: ProviderProfile = {
      id: 'opencode-profile',
      name: 'OpenCode',
      kind: 'opencode',
      endpoint: 'https://console.opencode.ai/inference/openai/v1'
    };
    const fixture = contextFixture([profile]);
    const store = new ProviderProfileStore(fixture.context as never);

    const active = await store.ensure('opencode', profile.endpoint);

    expect(active.endpoint).toBe('https://opencode.ai/zen/v1');
    expect(store.list()[0]?.endpoint).toBe('https://opencode.ai/zen/v1');
  });

  it('keeps the last saved key available if SecretStorage briefly returns no value', async () => {
    const profile: ProviderProfile = { id: 'profile-cache', name: 'Cached', kind: 'openai', endpoint: 'https://api.openai.com/v1' };
    const fixture = contextFixture([profile]);
    const store = new ProviderProfileStore(fixture.context as never);

    await store.save(profile, 'sk-stable');
    fixture.secrets.delete('nineRouter.profileKey.profile-cache.openai');

    expect(await store.apiKey(profile)).toBe('sk-stable');
  });
});
