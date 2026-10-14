import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const empty = JSON.stringify({ version: 5, transactions: [], customCategories: [] });
const problem = (status, message) => Object.assign(new Error(message), { status });
async function encode(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function matches(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [, salt, key] = encoded.split('$');
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, 'hex'));
}
export async function createAccounts(client, reservedUsername) {
  await client.batch([
    'CREATE TABLE IF NOT EXISTS financas_users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS financas_user_sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES financas_users(id), expires_at INTEGER NOT NULL, password_version TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS financas_user_state(user_id TEXT PRIMARY KEY REFERENCES financas_users(id), revision INTEGER NOT NULL, document TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS financas_user_backups(user_id TEXT NOT NULL REFERENCES financas_users(id), revision INTEGER NOT NULL, document TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,revision))',
  ], 'write');
  // Also derive a key for unknown usernames to avoid a cheap user-existence probe.
  const dummy = await encode(randomBytes(32).toString('hex'));
  return {
    async register(body) {
      const username = normalize(body?.username), name = typeof body?.name === 'string' ? body.name.trim() : '';
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw problem(400, 'Use de 3 a 40 letras, números, pontos, traços ou sublinhados no usuário.');
      if (name.length < 2 || name.length > 100) throw problem(400, 'Informe seu nome, de 2 a 100 caracteres.');
      if (typeof body?.password !== 'string' || body.password.length < 10 || body.password.length > 128) throw problem(400, 'A senha precisa ter de 10 a 128 caracteres.');
      if (username === normalize(reservedUsername)) throw problem(409, 'Esse usuário já está em uso.');
      const passwordHash = await encode(body.password), id = randomUUID();
      const tx = await client.transaction('write');
      try {
        if ((await tx.execute({ sql: 'SELECT 1 FROM financas_users WHERE username=?', args: [username] })).rows.length) throw problem(409, 'Esse usuário já está em uso.');
        await tx.execute({ sql: 'INSERT INTO financas_users(id,username,name,password_hash) VALUES(?,?,?,?)', args: [id, username, name, passwordHash] });
        await tx.execute({ sql: 'INSERT INTO financas_user_state VALUES(?,0,?)', args: [id, empty] });
        await tx.commit();
        return { id, username, name, passwordHash };
      } catch (error) { await tx.rollback(); throw error; }
      finally { tx.close(); }
    },
    async authenticate(username, password) {
      const { rows } = await client.execute({ sql: 'SELECT id,username,name,password_hash FROM financas_users WHERE username=?', args: [normalize(username)] });
      const user = rows[0];
      const valid = await matches(password, user?.password_hash || dummy);
      return user && valid ? { id: user.id, username: user.username, name: user.name, passwordHash: user.password_hash } : null;
    },
    async createSession(user, seconds) {
      const token = randomBytes(32).toString('hex');
      await client.batch([
        { sql: 'DELETE FROM financas_user_sessions WHERE expires_at<=?', args: [Date.now()] },
        { sql: 'INSERT INTO financas_user_sessions VALUES(?,?,?,?)', args: [tokenHash(token), user.id, Date.now() + seconds * 1000, user.passwordHash] },
      ], 'write');
      return token;
    },
    async resolve(token) {
      if (!token) return null;
      const { rows } = await client.execute({ sql: 'SELECT u.id,u.username,u.name FROM financas_user_sessions s JOIN financas_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND s.password_version=u.password_hash', args: [tokenHash(token), Date.now()] });
      return rows[0] ? { id: rows[0].id, username: rows[0].username, name: rows[0].name } : null;
    },
    async revoke(token) {
      if (token) await client.execute({ sql: 'DELETE FROM financas_user_sessions WHERE token_hash=?', args: [tokenHash(token)] });
    },
  };
}
