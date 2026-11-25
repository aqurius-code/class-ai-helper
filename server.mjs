import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { watchFile } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const host = '127.0.0.1';
const port = Number(process.env.CLASS_HELPER_PORT || 8787);
const origin = `http://${host}:${port}`;
const pagesOrigin = 'https://aqurius-code.github.io';
const pagesUrl = pagesOrigin + '/class-ai-helper/';
const keyPath = process.env.CLASS_HELPER_KEY_FILE;
const savedKey = keyPath ? await readFile(keyPath).catch(() => null) : null;
const activeRequests = new Set();
let disconnected = false;

async function isConnected() {
  if (disconnected) return false;
  if (!keyPath) return true;
  const current = await readFile(keyPath).catch(() => null);
  if (current && savedKey?.equals(current)) return true;
  disconnected = true;
  for (const controller of activeRequests) controller.abort();
  return false;
}

if (keyPath) watchFile(keyPath, { interval: 500, persistent: false }, async () => { if (!(await isConnected())) server.close(); });
const key = process.env.OPENAI_API_KEY?.trim();
const html = await readFile(new URL('./index.html', import.meta.url));
const maxBody = 8 * 1024 * 1024;

function reply(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function errorResponse(response, status, message) {
  reply(response, status, { error: { message } });
}

export const server = createServer(async (request, response) => {
  if (request.headers.host !== `${host}:${port}`) {
    return errorResponse(response, 403, 'Open this app using its loopback address.');
  }
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY'
    });
    return response.end(html);
  }
  const fromPages = request.headers.origin === pagesOrigin;
  if (request.url === '/api/chat' && fromPages) {
    response.setHeader('Access-Control-Allow-Origin', pagesOrigin);
    response.setHeader('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'POST');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.setHeader('Access-Control-Allow-Private-Network', 'true');
      response.writeHead(204);
      return response.end();
    }
  }
  if (request.method !== 'POST' || request.url !== '/api/chat') {
    return errorResponse(response, 404, 'Not found.');
  }
  if ((!fromPages && request.headers.origin !== origin) ||
      request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return errorResponse(response, 403, 'Requests must come from the local app.');
  }
  if (!key || !(await isConnected())) return errorResponse(response, 503, 'OpenAI API 연결이 해제됐습니다. 로컬 실행 아이콘에서 키를 설정하세요.');

  let payload;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > maxBody) {
        errorResponse(response, 413, 'The request is too large.');
        return;
      }
      chunks.push(chunk);
    }
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return errorResponse(response, 400, 'Invalid JSON request.');
  }

  const { messages, json, stream, maxTokens, temp } = payload || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > 200 ||
      !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096 ||
      typeof temp !== 'number' || temp < 0 || temp > 2) {
    return errorResponse(response, 400, 'Invalid chat request.');
  }

  const controller = new AbortController();
  activeRequests.add(controller);
  response.on('close', () => {
    activeRequests.delete(controller);
    controller.abort();
  });
  if (!(await isConnected())) return errorResponse(response, 503, 'OpenAI API 연결이 해제됐습니다.');
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages,
        temperature: temp,
        max_completion_tokens: maxTokens,
        stream: stream === true,
        store: false,
        ...(json === true && { response_format: { type: 'json_object' } })
      }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(90000)])
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      const messagesByStatus = {
        401: 'OpenAI API key authentication failed.',
        403: 'This key cannot access the requested OpenAI model.',
        429: 'Check your OpenAI API balance, usage limits or request rate.'
      };
      return errorResponse(response, upstream.status, messagesByStatus[upstream.status] ||
        `OpenAI API request failed (HTTP ${upstream.status}).`);
    }
    response.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store'
    });
    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch {
    if (!response.headersSent && !response.destroyed) errorResponse(response, 502, 'Could not complete the OpenAI request.');
  }
}).listen(port, host, () => {
  console.log(`Class AI Helper: ${origin}`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    spawn('explorer.exe', [pagesUrl], { stdio: 'ignore', windowsHide: true })
      .on('error', () => console.log(`Open ${origin} in your browser.`));
  }
});
