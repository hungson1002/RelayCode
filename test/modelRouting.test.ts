import { describe, expect, it } from 'vitest';
import { chooseModelForMode, rankedModelsForMode } from '../src/modelRouting';
import type { RouterModel } from '../src/types';

const models: RouterModel[] = [
  { id: 'fast-mini', name: 'Fast Mini', capabilities: { tools: true, vision: false, reasoning: false } },
  { id: 'reasoning-pro', name: 'Reasoning Pro', capabilities: { tools: true, vision: false, reasoning: true } },
  { id: 'chat-only', name: 'Chat Only', capabilities: { tools: false, vision: false, reasoning: false } }
];

describe('model routing', () => {
  it('prefers fast models for Chat and reasoning models for Agent', () => {
    expect(chooseModelForMode('chat', '', models)).toBe('fast-mini');
    expect(chooseModelForMode('agent', '', models)).toBe('reasoning-pro');
    expect(chooseModelForMode('plan', '', models)).toBe('reasoning-pro');
  });

  it('keeps the explicit model and configured fallback order', () => {
    expect(rankedModelsForMode('agent', 'fast-mini', models, ['reasoning-pro'])).toEqual([
      'fast-mini', 'reasoning-pro'
    ]);
  });

  it('does not route Agent work to a model without tools', () => {
    expect(rankedModelsForMode('agent', 'chat-only', models)).toEqual(['reasoning-pro', 'fast-mini']);
  });
});
