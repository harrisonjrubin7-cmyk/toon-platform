import pg from "pg";

export type Queryable = {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
};

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export const db: Queryable = {
  query: (text, params) => getPool().query(text, params as unknown[]),
};

/** Runs fn inside a transaction on a dedicated client. */
export async function withTx<T>(fn: (tx: Queryable) => Promise<T>, source: Queryable | pg.Pool = getPool()): Promise<T> {
  const client = "connect" in source ? await (source as pg.Pool).connect() : null;
  const q: Queryable = client ?? source;
  await q.query("begin");
  try {
    const result = await fn(q);
    await q.query("commit");
    return result;
  } catch (e) {
    await q.query("rollback");
    throw e;
  } finally {
    client?.release();
  }
}
