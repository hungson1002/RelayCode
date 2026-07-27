import { describe, expect, it } from 'vitest';
import { normalizeEndpoint, parseSseData } from '../src/routerClient';

describe('normalizeEndpoint', () => {
  it('removes trailing slashes', () => {
    expect(normalizeEndpoint(' http://localhost:20128/v1/// ')).toBe('http://localhost:20128/v1');
  });

  it('rejects non-http protocols', () => {
    expect(() => normalizeEndpoint('file:///tmp/router')).toThrow(/http/);
  });
});

describe('parseSseData', () => {
  it('reads every data line and ignores comments', () => {
    expect(parseSseData(': keepalive\ndata: {"ok":true}\ndata: [DONE]')).toEqual([
      '{"ok":true}',
      '[DONE]'
    ]);
  });

  it('reads a final event without a blank terminator', () => {
    expect(parseSseData('data: {"choices":[]}')).toEqual(['{"choices":[]}']);
  });
});
