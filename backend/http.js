import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pwaAssets } from './pwa.js';
import { publicFiles } from './assets.js';
import { createAccounts } from './accounts.js';
import { userStore } from './database.js';
import { credentialVersion } from './auth.js';
import { createSessions, sessionToken } from './sessions.js';
import { loginRoutes } from './login.js';
import { sameOrigin, readJson } from './requests.js';
import { validDocument } from './validation.js';

const root = fileURLToPath(new URL('../frontend/', import.meta.url));
const loginAssets = new Set(['/login.html', '/styles/base.css', '/styles/login.css', '/js/login.js', '/js/theme.js', '/styles/theme.css', ...pwaAssets, '/sw.js']);
export async function createApplication(store, { password, username = 'usuario', secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const files = await publicFiles(root);
  const sessions = password ? await createSessions(store.client, credentialVersion(username, password)) : null;
  const accounts = await createAccounts(store.client, username);
  const login = loginRoutes(sessions, { username, password, secureCookies, accounts });
  return createServer(async (req, res) => {
    const reply = (status, body, type = 'application/json; charset=utf-8', headers = {}) => {
      const content = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': content.length, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', ...headers });
      res.end(content);
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/health') {
        await store.read(); reply(200, { status: 'ok' }); return;
      }
      if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) { reply(403, { error: 'Origem inválida.' }); return; }
      const user = await accounts.resolve(sessionToken(req));
      const authorized = !!user || !sessions || await sessions.valid(sessionToken(req));
      const financialStore = user ? userStore(store.client, user.id) : store;
      if (await login(req, path, reply, authorized, user)) return;
      if (req.method === 'GET' && path === '/login.html' && authorized && (password || user)) { reply(303, {}, undefined, { Location: '/' }); return; }
      if (!authorized && !loginAssets.has(path)) {
        if (path.startsWith('/api/')) reply(401, { error: 'Entre para continuar.' });
        else reply(303, {}, undefined, { Location: '/login.html' });
        return;
      }
      const accountId = user ? user.id : password ? 'owner' : 'local';
      if (path === '/api/state' && ((req.headers['x-meu-bolso-account'] && req.headers['x-meu-bolso-account'] !== accountId) || (user && req.method === 'PUT' && req.headers['x-meu-bolso-account'] !== accountId))) {
        reply(409, { code: 'account_changed', error: 'A conta mudou em outra aba. Recarregue a página antes de continuar.' }); return;
      }
      if (req.method === 'GET') {
        if (path === '/api/state') { reply(200, await financialStore.read()); return; }
        if (files.has(path)) {
          const file = files.get(path);
          const extension = file.slice(file.lastIndexOf('.'));
          const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json; charset=utf-8' };
          reply(200, await readFile(file), types[extension], path === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {}); return;
        }
      } else if (req.method === 'PUT' && path === '/api/state') {
        const payload = await readJson(req);
        if (!Number.isSafeInteger(payload?.revision) || payload.revision < 0 || !validDocument(payload.data)) { reply(400, { error: 'Dados inválidos.' }); return; }
        const revision = await financialStore.save(payload.data, payload.revision);
        reply(revision === null ? 409 : 200, revision === null ? { error: 'Os dados mudaram em outra aba ou dispositivo. Atualize antes de salvar.' } : { revision }); return;
      }
      reply(404, { error: 'Não encontrado.' });
    } catch (error) {
      reply(error.status || 503, { error: error.status ? error.message : 'Não foi possível acessar o banco de dados. Tente novamente.' });
    }
  });
}
