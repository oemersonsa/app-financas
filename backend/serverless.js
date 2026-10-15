import { openStore } from './database.js';
import { createRequestHandler } from './http.js';
export const SERVERLESS_PAYLOAD_BYTES = 4 * 1024 * 1024;

// Reuse one initialization promise per warm instance; never listen on a TCP port.
export function createServerlessHandler({ environment = process.env, openDatabase = openStore } = {}) {
  let pending;
  async function initialize() {
    const { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken, FINANCAS_PASSWORD: password, FINANCAS_USER: username = 'usuario' } = environment;
    if (!url?.startsWith('libsql://') || !authToken || !password) {
      throw new Error('Remote database and owner credentials are required.');
    }
    const store = await openDatabase({ url, authToken });
    try {
      return await createRequestHandler(store, { password, username, secureCookies: true, maxStateBytes: SERVERLESS_PAYLOAD_BYTES, maxResponseBytes: SERVERLESS_PAYLOAD_BYTES });
    } catch (error) { store.close(); throw error; }
  }
  return async (req, res) => {
    try {
      if (!pending) pending = initialize().catch(error => { pending = null; throw error; });
      const handler = await pending;
      await handler(req, res);
    } catch {
      if (res.headersSent) { res.end(); return; }
      const body = JSON.stringify({ error: 'Não foi possível iniciar a aplicação. Confira a configuração da hospedagem e tente novamente.' });
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    }
  };
}
