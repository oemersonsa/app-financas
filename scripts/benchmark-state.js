import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir, platform, arch, cpus } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { openStore } from "../backend/database.js";
import { createApplication } from "../backend/http.js";
import { validDocument } from "../backend/validation.js";

const run = promisify(execFile);
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = value => Number(value.toFixed(3));

function syntheticDocument(count) {
  return { version: 5, customCategories: [{ name: "Alimentação" }],
    transactions: Array.from({ length: count }, (_, i) => {
      const rawDate = `2026-${String(i % 12 + 1).padStart(2, "0")}-${String(i % 28 + 1).padStart(2, "0")}`;
      return { id: `synthetic-transaction-${String(i).padStart(8, "0")}`, description: `Lançamento sintético ${i}`,
        type: i % 10 === 0 ? "income" : "expense", amount: (i % 100000 + 1) / 100,
        rawDate, category: i % 10 === 0 ? "Salário" : "Alimentação", paid: i % 3 !== 0,
        monthKey: rawDate.slice(0, 7), date: rawDate.split('-').reverse().join('/'), timestamp: 1792191600000 + i, recurring: false };
    }),
  };
}

async function worker(file, count, samples) {
  // Refuse to open an existing database, including one supplied accidentally via CLI.
  const reservation = await open(file, 'wx'); await reservation.close();
  const store = await openStore({ file });
  const server = await createApplication(store);
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api/state`;
    const data = syntheticDocument(count), serialization = [], validation = [], saves = [], loads = [];
    let revision = 0, requestBytes = 0, responseBytes = 0;
    // One warm-up write, followed by measured full-document writes of a one-field change.
    for (let i = 0; i <= samples; i++) {
      data.transactions[0].paid = !data.transactions[0].paid;
      let started = performance.now();
      const body = JSON.stringify({ revision, data });
      const serializeMs = performance.now() - started;
      requestBytes = Buffer.byteLength(body);
      started = performance.now();
      if (!validDocument(data)) throw new Error('Invalid synthetic document');
      const validateMs = performance.now() - started;
      started = performance.now();
      const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
      const result = await response.json();
      if (!response.ok) throw new Error(`PUT ${response.status}: ${JSON.stringify(result)}`);
      const saveMs = performance.now() - started;
      revision = result.revision;
      started = performance.now();
      const read = await fetch(url);
      const raw = await read.text();
      if (!read.ok || JSON.parse(raw).data.transactions.length !== count) throw new Error('Read-back mismatch');
      const loadMs = performance.now() - started;
      responseBytes = Buffer.byteLength(raw);
      if (i) { serialization.push(serializeMs); validation.push(validateMs); saves.push(saveMs); loads.push(loadMs); }
    }
    const { rows } = await store.client.execute('SELECT COUNT(*) AS versions, SUM(length(CAST(document AS BLOB))) AS bytes FROM financas_backups');
    const snapshotBytes = Buffer.byteLength(JSON.stringify(data));
    return { count, samples, requestBytes, responseBytes, snapshotBytes,
      serializeMedianMs: round(median(serialization)), validateMedianMs: round(median(validation)),
      saveMedianMs: round(median(saves)), loadMedianMs: round(median(loads)),
      storedBackupVersions: Number(rows[0].versions), storedBackupBytes: Number(rows[0].bytes),
      estimatedThirtyBackupsBytes: snapshotBytes * 30,
      exceedsVercelPayload: Math.max(requestBytes, responseBytes) > 4 * 1024 * 1024,
      idealUploadAt10MbpsMs: round(requestBytes * 8 / 10000) };
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
}

const samples = Number(option('samples', '7'));
if (!Number.isInteger(samples) || samples < 1 || samples > 30) throw new Error('Use --samples=1..30');
if (option('worker-file', null)) {
  const result = await worker(option('worker-file'), Number(option('worker-size')), samples);
  // Let native handles finish closing before the worker exits. Forcing exit can
  // race libSQL's async cleanup on Windows. The parent removes files only after exit.
  process.stdout.write(JSON.stringify(result));
} else {
  const sizes = option('sizes', '100,1000,5000,10000,20000').split(',').map(Number);
  if (!sizes.length || sizes.some(size => !Number.isInteger(size) || size < 1 || size > 50000)) throw new Error('Use --sizes=100,1000,... (1..50000 each)');
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'meu-bolso-benchmark-'));
  const results = [];
  try {
    for (const [index, count] of sizes.entries()) {
      const { stdout } = await run(process.execPath, [fileURLToPath(import.meta.url), `--worker-file=${join(directory, `${index}.sqlite3`)}`, `--worker-size=${count}`, `--samples=${samples}`], { maxBuffer: 1024 * 1024, timeout: 60000 });
      results.push(JSON.parse(stdout));
    }
  } finally {
    if (dirname(resolve(directory)) !== temporaryRoot || !basename(directory).startsWith('meu-bolso-benchmark-')) {
      throw new Error('Refusing to remove a directory outside this benchmark');
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
  const report = { measuredAt: new Date().toISOString(), runtime: process.version, platform: `${platform()} ${arch()}`, cpu: cpus()[0]?.model,
    method: 'Synthetic data; local SQLite; real HTTP GET/PUT; one warm-up; medians. No production database or Turso credentials used. Upload time and 30-backup size are estimates, not remote measurements.', results };
  console.table(results.map(row => ({ records: row.count, 'payload KiB': round(row.requestBytes / 1024),
    'save ms': row.saveMedianMs, 'load ms': row.loadMedianMs, '30 backups MiB (estimate)': round(row.estimatedThirtyBackupsBytes / 1024 / 1024),
    '>4 MiB': row.exceedsVercelPayload })));
  if (option('output', null)) await writeFile(option('output'), JSON.stringify(report, null, 2) + '\n');
}
