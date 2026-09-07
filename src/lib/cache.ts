import "server-only";
import { createHash } from "node:crypto";
import { q, one } from "./db";

// Cache third-party responses. These indexes are free and generous, which is
// exactly why we should not hammer them — and repeat lookups get faster.

export async function cached<T>(
  provider: string, key: string, ttlSeconds: number, fetcher: () => Promise<T>,
): Promise<T> {
  const cacheKey = `${provider}:${createHash("sha1").update(key).digest("hex")}`;

  const hit = await one<any>(
    `SELECT payload FROM api_cache WHERE cache_key=$1 AND expires_at > now()`, [cacheKey])
    .catch(() => null);
  if (hit) {
    try { return JSON.parse(hit.payload) as T; } catch { /* fall through and refetch */ }
  }

  const fresh = await fetcher();
  await q(
    `INSERT INTO api_cache (cache_key, provider, payload, expires_at)
     VALUES ($1,$2,$3, now() + ($4 || ' seconds')::interval)
     ON CONFLICT (cache_key) DO UPDATE
       SET payload=EXCLUDED.payload, expires_at=EXCLUDED.expires_at`,
    [cacheKey, provider, JSON.stringify(fresh), String(ttlSeconds)],
  ).catch(() => {});

  return fresh;
}

/** Drop expired rows. Called opportunistically; cheap enough to run inline. */
export async function pruneCache() {
  await q(`DELETE FROM api_cache WHERE expires_at < now() - interval '1 day'`).catch(() => {});
}
