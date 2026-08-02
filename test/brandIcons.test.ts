import { describe, expect, it } from 'vitest';
import { BRAND_ICONS, brandKeyFor } from '../src/brandIcons';

describe('brand icon registry', () => {
  it('identifies the model vendor before the routing provider', () => {
    expect(brandKeyFor('kr/auto', '9router')).toBe('kiro');
    expect(brandKeyFor('kr/auto-thinking', '9router')).toBe('kiro');
    expect(brandKeyFor('ag/auto', '9router')).toBe('antigravity');
    expect(brandKeyFor('claude-sonnet-4-6', 'cockpit')).toBe('claude');
    expect(brandKeyFor('gemini-3.1-pro', '9router')).toBe('gemini');
    expect(brandKeyFor('gpt-5.4', '9router')).toBe('openai');
    expect(brandKeyFor('deepseek-v3.2', 'openai-compatible')).toBe('deepseek');
    expect(brandKeyFor('opencode/big-pickle', 'opencode')).toBe('opencode');
  });

  it('contains branded MCP and local-provider assets', () => {
    for (const key of ['notion', 'linear', 'sentry', 'figma', 'google', 'mcp', '9router', 'cockpit', 'opencode', 'kiro', 'antigravity', 'kimi', 'zhipu', 'minimax', 'nvidia']) {
      expect(BRAND_ICONS[key]).toBeTruthy();
    }
  });
});
