import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { one, q } from "@/lib/db";
import { discover, pkce } from "@/lib/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start institutional sign-in: /sso/<institution-slug> */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = process.env.SITE_URL ?? "https://semanticauthoring.org";

  const inst = await one<any>(
    `SELECT * FROM institutions WHERE slug=$1 AND oidc_enabled=TRUE`, [slug]).catch(() => null);
  if (!inst) return NextResponse.redirect(`${base}/login?error=sso_unknown`);

  const doc = await discover(inst.oidc_issuer);
  if (!doc) return NextResponse.redirect(`${base}/login?error=sso_discovery`);

  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const { verifier, challenge } = pkce();

  await q(
    `INSERT INTO oidc_states (state, nonce, code_verifier, institution_id, expires_at)
     VALUES ($1,$2,$3,$4, now() + interval '10 minutes')`,
    [state, nonce, verifier, inst.id]);

  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", inst.oidc_client_id);
  url.searchParams.set("redirect_uri", `${base}/sso/callback`);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url.toString());
}
