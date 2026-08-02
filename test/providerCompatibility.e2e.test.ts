import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RouterClient } from '../src/routerClient';

describe('OpenAI-compatible provider over a real HTTP server', () => {
  let server: Server;
  let endpoint = '';

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.method === 'GET' && request.url === '/v1/models') {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ data: [{ id: 'json-model' }, { id: 'array-sse-model' }] }));
        return;
      }
      if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
        response.statusCode = 404;
        response.end();
        return;
      }
      let raw = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => { raw += chunk; });
      request.on('end', () => {
        const body = JSON.parse(raw) as { model?: string };
        if (body.model === 'json-model') {
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'JSON trả lời được' }] } }] }));
          return;
        }
        response.setHeader('content-type', 'text/event-stream');
        response.write('data: {"choices":[{"delta":{"content":[{"type":"text","text":"SSE "}]}}]}\n\n');
        setTimeout(() => {
          response.write('data: {"choices":[{"delta":{"content":[{"type":"text","text":"trả lời được"}]},"finish_reason":"stop"}]}\n\n');
          response.end('data: [DONE]\n\n');
        }, 8);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Không lấy được cổng test provider.');
    endpoint = `http://127.0.0.1:${address.port}/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('lists models and receives both complete JSON and array-based SSE answers', async () => {
    const client = new RouterClient({ endpoint, apiKey: 'test-key' });
    await expect(client.listModels()).resolves.toHaveLength(2);

    const jsonChunks: string[] = [];
    await client.streamChat('json-model', [{ role: 'user', content: 'test' }], (chunk) => jsonChunks.push(chunk));
    expect(jsonChunks.length).toBeGreaterThan(1);
    expect(jsonChunks.join('')).toBe('JSON trả lời được');

    const sseChunks: string[] = [];
    await client.streamChat('array-sse-model', [{ role: 'user', content: 'test' }], (chunk) => sseChunks.push(chunk));
    expect(sseChunks.join('')).toBe('SSE trả lời được');
  });
});
