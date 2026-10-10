import { createClient } from '@libsql/client';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const empty = { version: 5, transactions: [], customCategories: [] };
export async function openStore({ url, authToken, file = 'data/meu-bolso.sqlite3' } = {}) {
  const local = !url || url.startsWith('file:');
  if (!url) {
    await mkdir(dirname(resolve(file)), { recursive: true });
    url = pathToFileURL(resolve(file)).href;
  }
  const client = createClient({ url, authToken });
  try {
    await client.batch([
      'CREATE TABLE IF NOT EXISTS financas_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, document TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS financas_backups (revision INTEGER PRIMARY KEY, document TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      { sql: 'INSERT OR IGNORE INTO financas_state VALUES(1,0,?)', args: [JSON.stringify(empty)] },
    ], 'write');
    // Compatibilidade com o banco local da versão Python. Nunca lê tabelas do dashboard remoto.
    if (local && (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='state'")).rows.length) {
      await client.execute('UPDATE financas_state SET revision=(SELECT revision FROM state WHERE id=1), document=(SELECT document FROM state WHERE id=1) WHERE id=1 AND revision=0 AND EXISTS(SELECT 1 FROM state WHERE id=1)');
    }
  } catch (error) { client.close(); throw error; }
  return {
    client,
    async read() {
      const { rows } = await client.execute('SELECT revision,document FROM financas_state WHERE id=1');
      return { revision: Number(rows[0].revision), data: JSON.parse(rows[0].document) };
    },
    async save(data, expected) {
      const tx = await client.transaction('write');
      try {
        const { rows } = await tx.execute('SELECT revision,document FROM financas_state WHERE id=1');
        const revision = Number(rows[0].revision);
        if (revision !== expected) { await tx.rollback(); return null; }
        const document = JSON.stringify(data);
        await tx.execute({ sql: 'INSERT OR IGNORE INTO financas_backups(revision,document) VALUES(?,?)', args: [revision, rows[0].document] });
        await tx.execute({ sql: 'INSERT INTO financas_backups(revision,document) VALUES(?,?)', args: [revision + 1, document] });
        await tx.execute({ sql: 'UPDATE financas_state SET revision=?,document=? WHERE id=1', args: [revision + 1, document] });
        await tx.execute('DELETE FROM financas_backups WHERE revision NOT IN (SELECT revision FROM financas_backups ORDER BY revision DESC LIMIT 30)');
        await tx.commit();
        return revision + 1;
      } catch (error) { await tx.rollback(); throw error; }
      finally { tx.close(); }
    },
    close() { client.close(); },
  };
}
