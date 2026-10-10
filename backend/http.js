import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicFiles } from './assets.js';
import { authenticated } from './auth.js';
import { validDocument } from './validation.js';

const root = fileURLToPath(new URL('../frontend/', import.meta.url));
export async function createApplication(store, { password, username = 'usuario' } = {}) {
  const files = await publicFiles(root);
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
      if (!authenticated(req.headers.authorization, username, password)) {
        reply(401, { error: 'Autenticação necessária.' }, undefined, { 'WWW-Authenticate': 'Basic realm="Meu bolso", charset="UTF-8"' }); return;
      }
      if (req.method === 'GET') {
        if (path === '/api/state') { reply(200, await store.read()); return; }
        if (files.has(path)) {
          const file = files.get(path);
          const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript';
          reply(200, await readFile(file), type + '; charset=utf-8'); return;
        }
      } else if (req.method === 'PUT' && path === '/api/state') {
        if (req.headers.origin) {
          let origin;
          try { origin = new URL(req.headers.origin); } catch { reply(403, { error: 'Origem inválida.' }); return; }
          if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) { reply(403, { error: 'Origem inválida.' }); return; }
        }
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') { reply(415, { error: 'Envie JSON.' }); return; }
        let bytes = 0; const chunks = [];
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 10 * 1024 * 1024) { reply(413, { error: 'Arquivo muito grande.' }); return; }
          chunks.push(chunk);
        }
        let payload;
        try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reply(400, { error: 'JSON inválido.' }); return; }
        if (!Number.isSafeInteger(payload?.revision) || payload.revision < 0 || !validDocument(payload.data)) { reply(400, { error: 'Dados inválidos.' }); return; }
        const revision = await store.save(payload.data, payload.revision);
        reply(revision === null ? 409 : 200, revision === null ? { error: 'Os dados mudaram em outra aba ou dispositivo. Atualize antes de salvar.' } : { revision }); return;
      }
      reply(404, { error: 'Não encontrado.' });
    } catch {
      reply(503, { error: 'Não foi possível acessar o banco de dados. Tente novamente.' });
    }
  });
}
