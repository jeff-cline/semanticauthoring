import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { one, q } from "./db";

// Personal access tokens for programmatic access (the MCP server).
// The plaintext is shown once; only a SHA-256 hash is stored, so a database
// read cannot be replayed as a token.

export const TOKEN_PREFIX = "sa_pat_";

export function mintToken(): { plain: string; hash: string; prefix: string } {
  const secret = randomBytes(24).toString("base64url");
  const plain = `${TOKEN_PREFIX}${secret}`;
  return {
    plain,
    hash: createHash("sha256").update(plain).digest("hex"),
    prefix: plain.slice(0, TOKEN_PREFIX.length + 6),
  };
}

export interface TokenUser { id: number; email: string; name: string; tier: string; scopes: string[] }

/** Resolve a bearer token to its owner. Returns null for anything invalid. */
export async function userFromRequest(req: Request): Promise<TokenUser | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) return null;
  const hash = createHash("sha256").update(m[1].trim()).digest("hex");

  const row = await one<any>(
    `SELECT t.id, t.scopes, u.id AS user_id, u.email, u.name, u.tier
       FROM access_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.revoked_at IS NULL`, [hash]).catch(() => null);
  if (!row) return null;

  q(`UPDATE access_tokens SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => {});
  return {
    id: row.user_id, email: row.email, name: row.name, tier: row.tier,
    scopes: String(row.scopes || "read").split(",").map((s: string) => s.trim()),
  };
}

export const canWrite = (u: TokenUser | null) => Boolean(u?.scopes.includes("write"));
