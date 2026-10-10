import { credentialsMatch } from './auth.js';
import { sessionToken, sessionCookie } from './sessions.js';
import { readJson } from './requests.js';

export function loginRoutes(sessions, { username, password, secureCookies }) {
  let failures = 0, resetAt = Date.now() + 60000;
  return async (req, path, reply, authorized) => {
    if (path === '/api/session' && req.method === 'GET') {
      reply(200, { authenticated: authorized, authRequired: !!password }); return true;
    }
    if (path === '/api/logout' && req.method === 'POST') {
      await sessions?.revoke(sessionToken(req));
      reply(200, { ok: true }, undefined, { 'Set-Cookie': sessionCookie('', 0, secureCookies) }); return true;
    }
    if (path !== '/api/login' || req.method !== 'POST') return false;
    if (Date.now() >= resetAt) { failures = 0; resetAt = Date.now() + 60000; }
    if (failures >= 30) { reply(429, { error: 'Muitas tentativas. Aguarde um minuto.' }, undefined, { 'Retry-After': '60' }); return true; }
    const body = await readJson(req, 4096);
    if (password && !credentialsMatch(body?.username, body?.password, username, password)) {
      failures++; reply(401, { error: 'Usuário ou senha incorretos.' }); return true;
    }
    const seconds = body?.remember === true ? 30 * 86400 : 86400;
    await sessions?.revoke(sessionToken(req));
    const token = sessions ? await sessions.create(seconds) : '';
    reply(200, { ok: true }, undefined, { 'Set-Cookie': sessionCookie(token, seconds, secureCookies) }); return true;
  };
}
