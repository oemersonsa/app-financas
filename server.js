import { resolve } from 'node:path';
import { openStore } from './backend/database.js';
import { createApplication } from './backend/http.js';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const production = process.env.NODE_ENV === 'production';
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const password = process.env.FINANCAS_PASSWORD;
const host = process.env.HOST || '127.0.0.1';
if (production && (!url?.startsWith('libsql://') || !authToken || !password)) {
  throw new Error('Configure TURSO_DATABASE_URL (libsql://), TURSO_AUTH_TOKEN e FINANCAS_PASSWORD para produção.');
}
if (!password && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
  throw new Error('Configure FINANCAS_PASSWORD antes de expor o servidor.');
}
const store = await openStore({ url, authToken, file: resolve(option('--data-dir', 'data'), 'meu-bolso.sqlite3') });
const server = await createApplication(store, { password, username: process.env.FINANCAS_USER || 'usuario' });
server.listen(Number(option('--port', process.env.PORT || 8000)), host, () => {
  console.log(JSON.stringify({ status: 'ready', port: server.address().port, database: url?.startsWith('libsql://') ? 'turso' : 'local' }));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
