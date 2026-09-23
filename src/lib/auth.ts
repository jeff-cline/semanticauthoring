import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
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
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-z]/.test(pw)) return "Include at least one lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Include at least one uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Include at least one number.";
  return null;
}

// ── sessions ─────────────────────────────────────────────────────────────────

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface SessionUser {
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
    `SELECT u.id, u.email, u.name, u.role, u.tier, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id
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
  };
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
  };
}

export const isGod = (u: SessionUser | null) => u?.role === "god";
