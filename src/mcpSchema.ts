import Ajv from 'ajv';
import { createHash } from 'node:crypto';

type JsonObject = Record<string, unknown>;

function safeToolName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'tool';
}

export function exposedToolName(serverId: string, serverName: string, toolName: string): string {
  const source = `mcp__${safeToolName(serverName)}__${safeToolName(toolName)}`;
  const suffix = createHash('sha256').update(`${serverId}\0${toolName}`).digest('hex').slice(0, 8);
  return `${source.slice(0, 54)}_${suffix}`;
}

export interface McpSchemaNormalization {
  schema: JsonObject;
  warnings: string[];
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function decodePointerPart(value: string): string {
  return value.replace(/~1/g, '/').replace(/~0/g, '~');
}

function localReference(root: JsonObject, reference: string): unknown {
  if (reference === '#') return root;
  if (!reference.startsWith('#/')) return undefined;
  let current: unknown = root;
  for (const rawPart of reference.slice(2).split('/')) {
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[decodePointerPart(rawPart)];
  }
  return current;
}

function cycleFallback(value: unknown): JsonObject {
  if (!isObject(value)) return {};
  const description = typeof value.description === 'string' ? value.description : undefined;
  if (value.type === 'array') return { type: 'array', items: {}, ...(description ? { description } : {}) };
  if (value.type === 'object' || isObject(value.properties)) {
    return { type: 'object', additionalProperties: true, ...(description ? { description } : {}) };
  }
  if (typeof value.type === 'string') return { type: value.type, ...(description ? { description } : {}) };
  return description ? { description } : {};
}

function mergeReferencedSchema(base: JsonObject, siblings: JsonObject): JsonObject {
  if (Object.keys(siblings).length === 0) return base;
  return { ...base, ...siblings };
}

function normalizeNode(
  value: unknown,
  root: JsonObject,
  activeReferences: Set<string>,
  warnings: string[],
  budget: { remaining: number }
): unknown {
  budget.remaining -= 1;
  if (budget.remaining < 0) {
    warnings.push('MCP schema was too large and was safely truncated.');
    return cycleFallback(value);
  }
  // JSON Schema allows boolean schemas. Preserve them because keywords such as
  // `additionalProperties` require an actual boolean in provider tool schemas.
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => normalizeNode(item, root, activeReferences, warnings, budget));
  if (!isObject(value)) return value;

  if (typeof value.$ref === 'string') {
    const reference = value.$ref;
    const siblingSource = Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$ref'));
    const siblings = normalizeNode(siblingSource, root, activeReferences, warnings, budget) as JsonObject;
    const target = localReference(root, reference);
    if (target === undefined) {
      warnings.push(`Unresolved schema reference: ${reference}`);
      return mergeReferencedSchema({}, siblings);
    }
    if (activeReferences.has(reference)) {
      warnings.push(`Recursive schema reference was relaxed: ${reference}`);
      return mergeReferencedSchema(cycleFallback(target), siblings);
    }
    const nextReferences = new Set(activeReferences);
    nextReferences.add(reference);
    const resolved = normalizeNode(target, root, nextReferences, warnings, budget);
    return mergeReferencedSchema(isObject(resolved) ? resolved : {}, siblings);
  }

  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === '$defs' || key === 'definitions' || key === '$schema' || key === '$id') continue;
    result[key] = normalizeNode(child, root, activeReferences, warnings, budget);
  }
  return result;
}

/**
 * Converts MCP JSON Schema into a self-contained schema accepted by the
 * OpenAI-compatible and Anthropic tool APIs. Local definitions are inlined,
 * recursive references are safely relaxed, and malformed roots cannot disable
 * every tool exposed by an MCP server.
 */
export function normalizeMcpSchema(value: unknown, ensureObjectRoot = false): McpSchemaNormalization {
  const warnings: string[] = [];
  const root = isObject(value) ? value : {};
  const normalized = normalizeNode(root, root, new Set(), warnings, { remaining: 10_000 });
  let schema = isObject(normalized) ? normalized : {};

  if (ensureObjectRoot) {
    if (!schema.type && isObject(schema.properties)) schema = { ...schema, type: 'object' };
    if (schema.type !== 'object') {
      warnings.push('MCP input schema did not have an object root and was relaxed.');
      schema = { type: 'object', properties: {}, additionalProperties: true };
    } else {
      if (!isObject(schema.properties)) schema = { ...schema, properties: {} };
      if (!Array.isArray(schema.required)) schema = { ...schema, required: [] };
    }
  }

  return { schema, warnings: [...new Set(warnings)] };
}

export function normalizeMcpInputSchema(value: unknown): JsonObject {
  return normalizeMcpSchema(value, true).schema;
}

/**
 * The MCP SDK eagerly compiles every outputSchema during tools/list. A single
 * server tool with an incomplete or foreign $ref would otherwise make the
 * entire server look disconnected. Valid schemas keep normal AJV validation;
 * only an irrecoverably invalid schema falls back to accepting the server
 * response so unrelated tools remain usable.
 */
export class ResilientMcpJsonSchemaValidator {
  private readonly ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });

  public getValidator<T>(schema: unknown): (input: unknown) =>
    | { valid: true; data: T; errorMessage: undefined }
    | { valid: false; data: undefined; errorMessage: string } {
    try {
      const validate = this.ajv.compile(normalizeMcpSchema(schema).schema);
      return (input: unknown) => validate(input)
        ? { valid: true, data: input as T, errorMessage: undefined }
        : {
            valid: false,
            data: undefined,
            errorMessage: this.ajv.errorsText(validate.errors, { separator: '; ' })
          };
    } catch {
      return (input: unknown) => ({ valid: true, data: input as T, errorMessage: undefined });
    }
  }
}
