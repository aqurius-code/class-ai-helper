import { createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
const response = (message, status) => Response.json({error: {message}}, {
  status, headers: {'Cache-Control': 'no-store'}
});

export async function POST(request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  const password = process.env.DEMO_PASSWORD;
  if (!key || !password) return response('발표용 AI 연결이 설정되지 않았습니다.', 503);

  const supplied = request.headers.get('x-demo-password');
  if (!supplied || !timingSafeEqual(digest(supplied), digest(password))) {
    return response('발표용 비밀번호를 확인하세요.', 401);
  }

  let body;
  try { body = await request.json(); }
  catch { return response('요청을 읽지 못했습니다.', 400); }
  const {messages, json, stream, maxTokens, temp} = body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > 200 ||
      !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096 ||
      typeof temp !== 'number' || temp < 0 || temp > 2) {
    return response('요청 형식이 올바르지 않습니다.', 400);
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: 'gpt-4.1-mini', messages, temperature: temp, max_completion_tokens: maxTokens,
        stream: stream === true, store: false,
        ...(json === true && {response_format: {type: 'json_object'}})
      }),
      signal: AbortSignal.timeout(55000)
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return response(`OpenAI 요청에 실패했습니다 (HTTP ${upstream.status}).`, 502);
    }
    return new Response(upstream.body, {headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store'
    }});
  } catch {
    return response('OpenAI에 연결하지 못했습니다.', 502);
  }
}
