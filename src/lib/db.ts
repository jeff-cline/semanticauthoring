import "server-only";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __sa_pool: Pool | undefined;
}

export const pool =
  global.__sa_pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") global.__sa_pool = pool;

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params as any[]);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Append-only event log (spec §13). Never throws into the caller's path. */
export async function logEvent(
  entity: string,
  action: string,
  opts: { actorId?: number | null; entityId?: string | number; detail?: string } = {},
) {
  try {
    await q(
      `INSERT INTO event_log (actor_id, entity, entity_id, action, detail) VALUES ($1,$2,$3,$4,$5)`,
      [opts.actorId ?? null, entity, String(opts.entityId ?? ""), action, opts.detail ?? ""],
    );
  } catch {
    /* logging must never break the request */
  }
}
