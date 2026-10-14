import { credentialsMatch } from './auth.js';
import { sessionToken, sessionCookie } from './sessions.js';
import { readJson } from './requests.js';

export function loginRoutes(sessions, { username, password, secureCookies, accounts }) {
  let failures = 0, inFlight = 0, registrations = 0, resetAt = Date.now() + 60000;
  async function revoke(req) {
    const token = sessionToken(req);
    await sessions?.revoke(token); await accounts.revoke(token);
  }
  return async (req, path, reply, authorized, user) => {
    if (path === '/api/session' && req.method === 'GET') {
      reply(200, { authenticated: authorized, authRequired: !!password || !!user, accountType: user ? 'registered' : password && authorized ? 'owner' : 'local', user: user ? { id: user.id, username: user.username, name: user.name } : password && authorized ? { username, name: username } : null }); return true;
    }
    if (path === '/api/logout' && req.method === 'POST') {
      await revoke(req);
      reply(200, { ok: true }, undefined, { 'Set-Cookie': sessionCookie('', 0, secureCookies) }); return true;
    }
    if (!['/api/login', '/api/register'].includes(path) || req.method !== 'POST') return false;
    if (Date.now() >= resetAt) { failures = 0; registrations = 0; resetAt = Date.now() + 60000; }
    if (path === '/api/register') {
      if (registrations >= 10) { reply(429, { error: 'Muitos cadastros. Aguarde um minuto.' }, undefined, { 'Retry-After': '60' }); return true; }
      registrations++;
      const body = await readJson(req, 4096);
      const registered = await accounts.register(body);
      await revoke(req);
      const token = await accounts.createSession(registered, 86400);
      reply(201, { ok: true }, undefined, { 'Set-Cookie': sessionCookie(token, 86400, secureCookies) }); return true;
    }
    if (failures + inFlight >= 30) { reply(429, { error: 'Muitas tentativas. Aguarde um minuto.' }, undefined, { 'Retry-After': '60' }); return true; }
    const body = await readJson(req, 4096);
    if (typeof body?.password !== 'string' || body.password.length > 1000 || typeof body?.username !== 'string' || body.username.length > 200) { failures++; reply(401, { error: 'Usuário ou senha incorretos.' }); return true; }
    const owner = password && credentialsMatch(body.username, body.password, username, password);
    let registered = null;
    inFlight++;
    try { registered = owner ? null : await accounts.authenticate(body.username, body.password); }
    finally { inFlight--; }
    if (!owner && !registered) { failures++; reply(401, { error: 'Usuário ou senha incorretos.' }); return true; }
    const seconds = body.remember === true ? 30 * 86400 : 86400;
    await revoke(req);
    const token = registered ? await accounts.createSession(registered, seconds) : await sessions.create(seconds);
    reply(200, { ok: true }, undefined, { 'Set-Cookie': sessionCookie(token, seconds, secureCookies) }); return true;
  };
}
