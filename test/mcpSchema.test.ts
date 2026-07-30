import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exposedToolName, normalizeMcpInputSchema, normalizeMcpSchema, ResilientMcpJsonSchemaValidator } from '../src/mcpSchema';

function containsReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsReference);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    key === '$ref' || key === '$defs' || key === 'definitions' || containsReference(child)
  );
}

describe('MCP schema compatibility', () => {
  it('inlines Google Stitch-style $defs references', () => {
    const schema = normalizeMcpInputSchema({
      type: 'object',
      properties: {
        screen: { $ref: '#/$defs/ScreenInstance' }
      },
      required: ['screen'],
      $defs: {
        ScreenInstance: {
          type: 'object',
          properties: { id: { type: 'string' }, title: { type: 'string' } },
          required: ['id']
        }
      }
    });

    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        screen: {
          type: 'object',
          properties: { id: { type: 'string' }, title: { type: 'string' } },
          required: ['id']
        }
      }
    });
    expect(containsReference(schema)).toBe(false);
  });

  it('supports legacy definitions and escaped JSON Pointer names', () => {
    const schema = normalizeMcpInputSchema({
      type: 'object',
      properties: { item: { $ref: '#/definitions/a~1b~0c' } },
      definitions: { 'a/b~c': { type: 'string', enum: ['ok'] } }
    });

    expect(schema).toMatchObject({
      properties: { item: { type: 'string', enum: ['ok'] } }
    });
    expect(containsReference(schema)).toBe(false);
  });

  it('relaxes recursive references without recursing forever', () => {
    const result = normalizeMcpSchema({
      type: 'object',
      properties: { child: { $ref: '#/$defs/Node' } },
      $defs: {
        Node: {
          type: 'object',
          properties: { name: { type: 'string' }, child: { $ref: '#/$defs/Node' } }
        }
      }
    }, true);

    expect(result.warnings.some((warning) => warning.includes('Recursive'))).toBe(true);
    expect(containsReference(result.schema)).toBe(false);
  });

  it('keeps a future MCP usable when a reference is missing or external', () => {
    const missing = normalizeMcpSchema({
      type: 'object',
      properties: {
        screen: { $ref: '#/$defs/ScreenInstance', description: 'A Stitch screen' },
        remote: { $ref: 'https://example.invalid/schema.json#/Remote' }
      }
    }, true);

    expect(missing.schema).toMatchObject({
      type: 'object',
      properties: {
        screen: { description: 'A Stitch screen' },
        remote: {}
      }
    });
    expect(missing.warnings).toHaveLength(2);
  });

  it('forces malformed tool inputs to a provider-compatible object root', () => {
    expect(normalizeMcpInputSchema({ type: 'string' })).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: true
    });
    expect(normalizeMcpInputSchema(undefined)).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: true
    });
  });

  it('does not let an invalid output schema break tools/list', () => {
    const validator = new ResilientMcpJsonSchemaValidator().getValidator<{ anything: string }>({
      type: 'object',
      properties: { screen: { $ref: '#/$defs/ScreenInstance' } }
    });
    expect(validator({ anything: 'returned by MCP' })).toMatchObject({ valid: true });
  });
});

describe('MCP catalog compatibility', () => {
  it('keeps official preset identifiers, endpoints and authentication modes valid', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'mcpManager.ts'), 'utf8');
    for (const endpoint of [
      'https://mcp.notion.com/mcp',
      'https://mcp.linear.app/mcp',
      'https://mcp.sentry.dev/mcp',
      'https://mcp.figma.com/mcp',
      'https://stitch.googleapis.com/mcp'
    ]) expect(source).toContain(endpoint);
    expect(source).toContain("tokenHeader: 'X-Goog-Api-Key'");
  });

  it('generates unique provider-safe names even after the 64 character limit', () => {
    const first = exposedToolName('server-a', 'Same server', `create_${'screen_'.repeat(20)}one`);
    const second = exposedToolName('server-b', 'Same server', `create_${'screen_'.repeat(20)}two`);
    expect(first).toMatch(/^[a-z0-9_]+$/);
    expect(first.length).toBeLessThanOrEqual(64);
    expect(second.length).toBeLessThanOrEqual(64);
    expect(first).not.toBe(second);
  });

  it('finishes first-time OAuth without restoring the stale pending state', () => {
    const managerSource = readFileSync(join(process.cwd(), 'src', 'mcpManager.ts'), 'utf8');
    const providerSource = readFileSync(join(process.cwd(), 'src', 'mcpOAuthProvider.ts'), 'utf8');

    expect(managerSource).toContain('authPending: this.pendingOAuth.has(server.id) && !connection');
    expect(managerSource).toContain('if (this.connections.has(id) || !current || current.state !== state)');
    expect(managerSource).toContain('this.callbackUrl = `http://localhost:${address.port}/relaycode/callback`');
    expect(managerSource).toContain("callback.pathname !== '/relaycode/callback'");
    expect(managerSource).toContain("get<'vi' | 'en'>('language', 'vi')");
    expect(managerSource).toContain('renderMcpOAuthResult({ language, ok, serverName, reason })');
    expect(providerSource).toContain("client_name: 'RelayCode Desktop'");
  });

  it('keeps Figma Desktop setup actionable until its local MCP server responds', () => {
    const managerSource = readFileSync(join(process.cwd(), 'src', 'mcpManager.ts'), 'utf8');

    expect(managerSource).toContain("const FIGMA_DESKTOP_URL = 'http://127.0.0.1:3845/mcp'");
    expect(managerSource).toContain('await this.waitForFigmaDesktop(desktopServer)');
    expect(managerSource).toContain("title: 'Figma Desktop chưa sẵn sàng'");
    expect(managerSource).toContain("{ id: 'retry', label: 'Kiểm tra lại', kind: 'primary' }");
    expect(managerSource).toContain('await this.reconnect(server.id).catch(() => undefined)');
    expect(managerSource).toContain('this.notifyFigmaDesktopConnected(connection.tools.length)');
  });
});
