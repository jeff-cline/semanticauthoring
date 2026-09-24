import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { MIN_PASSWORD } from "./password-policy";
export { MIN_PASSWORD };
import { redirect } from "next/navigation";
import { q, one, logEvent } from "./db";

const scrypt = promisify(_scrypt) as (
  pw: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = "sa_session";

// How long a session survives WITHOUT activity. The window slides forward on
// every request (see currentUser), so a session you are actually using never
// expires underneath you — only an idle one does.
const SESSION_DAYS = 14;

// The cookie outlives the idle window on purpose: the `sessions` row is the
// authority on whether you are signed in, and it can be revoked server-side.
// A cookie that expired first would sign you out mid-use, because Next only
// permits writing cookies from Server Actions and Route Handlers — never
// during a page render, which is where most session reads happen.
const COOKIE_DAYS = 90;

// ── passwords ────────────────────────────────────────────────────────────────
// scrypt from node:crypto — memory-hard, zero dependencies, no native build.

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== key.length) return false;
  return timingSafeEqual(key, expected);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (!/[a-z]/.test(pw)) return "Include at least one lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Include at least one uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Include at least one number.";
  return null;
}

// ── sessions ─────────────────────────────────────────────────────────────────

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface SessionUser {
  /** Set only while a God account is viewing as this member. */
  impersonatedBy?: { id: number; name: string; email: string } | null;
  id: number;
  email: string;
  name: string;
  role: string;
  tier: string;
  mustChangePassword: boolean;
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`, [
    userId,
    sha(token),
    expires,
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + COOKIE_DAYS * 864e5),
  });
  return token;
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<any>(
    `SELECT u.id, u.email, u.name, u.role, u.tier, u.must_change_password,
            s.impersonator_id,
            imp.name  AS imp_name,
            imp.email AS imp_email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users imp ON imp.id = s.impersonator_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha(token)],
  );
  if (!row) return null;

  // Slide the idle window forward. The WHERE clause means this writes at most
  // once a day rather than on every request, and a failure here must never
  // fail the request — the worst case is the session expires on its original
  // schedule.
  void q(
    `UPDATE sessions
        SET expires_at = now() + ($2 || ' days')::interval, updated_at = now()
      WHERE token_hash = $1
        AND expires_at < now() + ($3 || ' days')::interval`,
    [sha(token), String(SESSION_DAYS), String(SESSION_DAYS - 1)],
  ).catch(() => {});

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tier: row.tier,
    mustChangePassword: row.must_change_password,
    impersonatedBy: row.impersonator_id
      ? { id: row.impersonator_id, name: row.imp_name, email: row.imp_email }
      : null,
  };
}

/**
 * Begin viewing as another member.
 *
 * Repoints the caller's existing session and remembers who they really are.
 *
 * Viewing as another God is allowed. It is not an escalation — the caller
 * already holds every privilege the target does — so the only real question is
 * accountability, and that is answered by the audit entry and by a banner the
 * impersonator cannot dismiss. Blocking it would stop an owner supporting the
 * one other administrator on their own platform.
 */
export async function startImpersonation(godId: number, targetId: number):
  Promise<{ ok: true } | { ok: false; error: string }> {
  if (godId === targetId) return { ok: false, error: "That is your own account." };

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, error: "No active session." };

  const target = await one<any>(`SELECT id, role FROM users WHERE id=$1`, [targetId]);
  if (!target) return { ok: false, error: "No such member." };

  // Only from a session that is not already impersonating, and only by the
  // God who owns it — the WHERE clause is the authorisation.
  const done = await one<{ id: number }>(
    `UPDATE sessions SET user_id=$1, impersonator_id=$2, updated_at=now()
      WHERE token_hash=$3 AND user_id=$2 AND impersonator_id IS NULL
      RETURNING id`,
    [targetId, godId, sha(token)],
  );
  if (!done) return { ok: false, error: "Could not start. Try signing in again." };

  // Record the target's role: viewing as another administrator is the entry
  // anyone reviewing this log will want to find.
  await logEvent("user", "impersonate_start",
    { actorId: godId, entityId: String(targetId), detail: `as ${target.role}` });
  return { ok: true };
}

/** Return to your own account. Always available while impersonating. */
export async function stopImpersonation(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  // Authorisation is the presence of impersonator_id on this very session —
  // never a role check, so a God can always get back out even if the member
  // they are viewing as has no privileges at all.
  const row = await one<{ impersonator_id: number; user_id: number }>(
    `UPDATE sessions SET user_id = impersonator_id, impersonator_id = NULL,
            updated_at = now()
      WHERE token_hash=$1 AND impersonator_id IS NOT NULL
      RETURNING impersonator_id, user_id`,
    [sha(token)],
  ).catch(() => null);
  if (!row) return false;

  await logEvent("user", "impersonate_stop", { actorId: row.impersonator_id });
  return true;
}

/**
 * The session, or a redirect to the login page.
 *
 * Every page under /app is already guarded by its layout, but a Server Action
 * runs WITHOUT that layout. Call sites that wrote `(await currentUser())!`
 * therefore threw a TypeError — surfacing as a 500 and silently discarding
 * whatever the user had typed — whenever a session expired with the tab still
 * open. Redirecting sends them to log in and keeps the failure legible.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q(`DELETE FROM sessions WHERE token_hash = $1`, [sha(token)]);
  jar.delete(SESSION_COOKIE);
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const row = await one<any>(`SELECT * FROM users WHERE lower(email) = lower($1)`, [email]);
  if (!row) return null;
  if (!(await verifyPassword(password, row.password_hash))) {
    await logEvent("user", "login_failed", { entityId: row.id, detail: email });
    return null;
  }
  await q(`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`, [row.id]);
  await createSession(row.id);
  await logEvent("user", "login", { actorId: row.id, entityId: row.id });
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tier: row.tier,
    mustChangePassword: row.must_change_password,
    impersonatedBy: null,
  };
}


export const isGod = (u: SessionUser | null) => u?.role === "god";
