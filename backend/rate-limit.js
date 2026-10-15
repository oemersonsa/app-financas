// Atomic buckets live in Turso so cold starts and parallel instances share limits.
export async function createRateLimiter(client, now = Date.now) {
  await client.execute('CREATE TABLE IF NOT EXISTS financas_auth_limits(bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL)');
  return {
    async take(bucket, limit, period = 60000) {
      const time = now();
      const result = await client.execute({
        sql: `INSERT INTO financas_auth_limits VALUES(?,?,1)
          ON CONFLICT(bucket) DO UPDATE SET
            attempts=CASE WHEN window_start<=? THEN 1 ELSE MIN(attempts+1,?) END,
            window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END
          RETURNING attempts,window_start`,
        args: [bucket, time, time - period, limit + 1, time - period],
      });
      const row = result.rows[0];
      let released = false;
      return {
        allowed: Number(row.attempts) <= limit,
        retryAfter: Math.max(1, Math.ceil((Number(row.window_start) + period - time) / 1000)),
        async release() {
          if (released) return;
          released = true;
          await client.execute({ sql: 'UPDATE financas_auth_limits SET attempts=MAX(0,attempts-1) WHERE bucket=? AND window_start=?', args: [bucket, row.window_start] });
        },
      };
    },
  };
}
