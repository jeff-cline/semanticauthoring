import { NextResponse } from "next/server";
import { one, q, logEvent } from "@/lib/db";
import { discover, exchangeCode, verifyIdToken } from "@/lib/oidc";
import { createSession, hashPassword } from "@/lib/auth";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
  const sp = new URL(req.url).searchParams;
  const fail = (why: string) => NextResponse.redirect(`${base}/login?error=${why}`);

  if (sp.get("error")) return fail("sso_denied");
  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return fail("sso_bad_request");

  // State is single-use: consume it immediately so a replay cannot succeed.
  const st = await one<any>(
    `DELETE FROM oidc_states WHERE state=$1 AND expires_at > now() RETURNING *`, [state])
    .catch(() => null);
  if (!st) return fail("sso_expired");

  const inst = await one<any>(`SELECT * FROM institutions WHERE id=$1`, [st.institution_id]);
  if (!inst?.oidc_enabled) return fail("sso_unknown");

  const doc = await discover(inst.oidc_issuer);
  if (!doc) return fail("sso_discovery");

  const tok = await exchangeCode({
    tokenEndpoint: doc.token_endpoint, code, redirectUri: `${base}/sso/callback`,
    clientId: inst.oidc_client_id, clientSecret: inst.oidc_client_secret,
    codeVerifier: st.code_verifier,
  });
  if (!tok.id_token) return fail("sso_token");

  const claims = await verifyIdToken(tok.id_token, {
    issuer: inst.oidc_issuer, clientId: inst.oidc_client_id,
    nonce: st.nonce, jwksUri: doc.jwks_uri,
  });
  if (!claims) return fail("sso_invalid_token");

  const email = String(claims.email ?? "").toLowerCase().trim();
  if (!email) return fail("sso_no_email");

  // If the institution restricts by domain, enforce it.
  const domains = String(inst.email_domains || "").split(",")
    .map((d: string) => d.trim().toLowerCase()).filter(Boolean);
  if (domains.length && !domains.some((d: string) => email.endsWith(`@${d}`))) {
    return fail("sso_domain");
  }

  // Match on the stable subject first, then fall back to email.
  let user = await one<any>(
    `SELECT id FROM users WHERE sso_issuer=$1 AND sso_subject=$2`,
    [inst.oidc_issuer, claims.sub]);
  if (!user) user = await one<any>(`SELECT id FROM users WHERE lower(email)=$1`, [email]);

  if (user) {
    await q(
      `UPDATE users SET sso_issuer=$1, sso_subject=$2, institution_id=$3,
              name = CASE WHEN name = '' THEN $4 ELSE name END,
              must_change_password = FALSE, updated_at = now()
        WHERE id=$5`,
      [inst.oidc_issuer, claims.sub, inst.id,
       String(claims.name ?? "").slice(0, 200), user.id]);
  } else {
    if (!inst.auto_join) return fail("sso_no_account");
    // SSO accounts get an unusable random password: they authenticate through
    // the institution, never with a local credential.
    user = await one<any>(
      `INSERT INTO users (email, name, password_hash, role, tier, must_change_password,
                          institution_id, sso_issuer, sso_subject)
       VALUES ($1,$2,$3,'scholar',$4,FALSE,$5,$6,$7) RETURNING id`,
      [email, String(claims.name ?? "").slice(0, 200),
       await hashPassword(randomBytes(32).toString("hex")),
       inst.default_tier, inst.id, inst.oidc_issuer, claims.sub]);
    if (!user) return fail("sso_create");
  }

  await q(
    `INSERT INTO institution_members (institution_id, user_id, role)
     VALUES ($1,$2,'scholar') ON CONFLICT (institution_id, user_id) DO NOTHING`,
    [inst.id, user.id]).catch(() => {});

  await q(`UPDATE users SET last_login_at=now() WHERE id=$1`, [user.id]);
  await logEvent("user", "sso_login", { actorId: user.id, entityId: user.id, detail: inst.slug });
  await createSession(user.id);

  return NextResponse.redirect(`${base}${st.redirect_to || "/app"}`);
}
