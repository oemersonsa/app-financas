import { randomBytes, createHash } from 'node:crypto';
const hash = token => createHash('sha256').update(token).digest('hex');
export const COOKIE = 'meu_bolso_session';
export function sessionToken(req) {
  const value = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
export function sessionCookie(token, seconds, secure) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
}
export async function createSessions(client, version) {
  await client.execute('CREATE TABLE IF NOT EXISTS financas_sessions(token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, credential_version TEXT NOT NULL)');
  return {
    async valid(token) {
      if (!token) return false;
      const result = await client.execute({ sql: 'SELECT 1 FROM financas_sessions WHERE token_hash=? AND expires_at>? AND credential_version=?', args: [hash(token), Date.now(), version] });
      return result.rows.length > 0;
    },
    async create(seconds) {
      const token = randomBytes(32).toString('hex');
      await client.batch([
        { sql: 'DELETE FROM financas_sessions WHERE expires_at<=? OR credential_version<>?', args: [Date.now(), version] },
        { sql: 'INSERT INTO financas_sessions VALUES(?,?,?)', args: [hash(token), Date.now() + seconds * 1000, version] },
      ], 'write');
      return token;
    },
    async revoke(token) {
      if (token) await client.execute({ sql: 'DELETE FROM financas_sessions WHERE token_hash=?', args: [hash(token)] });
    },
  };
}
