import "server-only";
import { createHash, randomBytes, createVerify, createPublicKey } from "node:crypto";

// ── OpenID Connect ───────────────────────────────────────────────────────────
//
// Authorization Code flow with PKCE, against whatever IdP an institution runs.
// The ID token's signature is verified against the issuer's published JWKS, the
// nonce is checked, and the issuer and audience must match. An unverified ID
// token is an assertion by whoever sent it, not by the institution.
//
// SAML is deliberately absent: it requires XML canonicalisation and signature
// validation, and a half-correct implementation of that is a security hole
// rather than a feature. Entra, Okta, Google Workspace, and Keycloak all speak
// OIDC.

export interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

const cache = new Map<string, { at: number; doc: Discovery }>();

export async function discover(issuer: string): Promise<Discovery | null> {
  const base = issuer.replace(/\/$/, "");
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < 3600_000) return hit.doc;
  try {
    const res = await fetch(`${base}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const doc = (await res.json()) as Discovery;
    if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) return null;
    cache.set(base, { at: Date.now(), doc });
    return doc;
  } catch {
    return null;
  }
}

export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

const b64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Verify an ID token's signature against the issuer's JWKS. */
async function verifySignature(token: string, jwksUri: string): Promise<boolean> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return false;
  let header: any;
  try { header = JSON.parse(b64u(h).toString("utf8")); } catch { return false; }

  const alg = String(header.alg ?? "");
  // Only asymmetric RSA/EC signatures. "none" and HMAC are refused outright:
  // accepting them would let anyone mint a token.
  const map: Record<string, string> = {
    RS256: "RSA-SHA256", RS384: "RSA-SHA384", RS512: "RSA-SHA512",
    ES256: "sha256", ES384: "sha384", ES512: "sha512",
    PS256: "RSA-SHA256", PS384: "RSA-SHA384", PS512: "RSA-SHA512",
  };
  if (!map[alg]) return false;

  let keys: any[];
  try {
    const res = await fetch(jwksUri, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    keys = (await res.json())?.keys ?? [];
  } catch { return false; }

  const candidates = header.kid ? keys.filter((k) => k.kid === header.kid) : keys;
  const data = `${h}.${p}`;
  const sig = b64u(s);

  for (const jwk of candidates) {
    try {
      const key = createPublicKey({ key: jwk, format: "jwk" });
      const v = createVerify(map[alg].startsWith("RSA") || map[alg].startsWith("sha")
        ? map[alg].replace("RSA-", "") : map[alg]);
      v.update(data);
      v.end();
      const opts: any = { key };
      if (alg.startsWith("PS")) opts.padding = 1; // RSA_PKCS1_PSS_PADDING handled below
      const ok = alg.startsWith("ES")
        ? v.verify({ key, dsaEncoding: "ieee-p1363" }, sig)
        : alg.startsWith("PS")
          ? v.verify({ key, padding: 6, saltLength: 32 } as any, sig)
          : v.verify(key, sig);
      if (ok) return true;
    } catch { /* try the next key */ }
  }
  return false;
}

export interface Claims {
  sub: string; iss: string; aud: string | string[]; exp: number; nonce?: string;
  email?: string; email_verified?: boolean; name?: string;
  given_name?: string; family_name?: string;
}

/** Verify signature, issuer, audience, expiry, and nonce. All must pass. */
export async function verifyIdToken(
  token: string, opts: { issuer: string; clientId: string; nonce: string; jwksUri: string },
): Promise<Claims | null> {
  if (!(await verifySignature(token, opts.jwksUri))) return null;

  let c: Claims;
  try { c = JSON.parse(b64u(token.split(".")[1]).toString("utf8")); } catch { return null; }

  const iss = String(c.iss ?? "").replace(/\/$/, "");
  if (iss !== opts.issuer.replace(/\/$/, "")) return null;

  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(opts.clientId)) return null;

  if (!c.exp || c.exp * 1000 < Date.now()) return null;
  if (opts.nonce && c.nonce !== opts.nonce) return null;
  if (!c.sub) return null;

  return c;
}

export async function exchangeCode(opts: {
  tokenEndpoint: string; code: string; redirectUri: string;
  clientId: string; clientSecret: string; codeVerifier: string;
}): Promise<{ id_token?: string; access_token?: string; error?: string }> {
  try {
    const res = await fetch(opts.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: opts.code,
        redirect_uri: opts.redirectUri,
        client_id: opts.clientId,
        client_secret: opts.clientSecret,
        code_verifier: opts.codeVerifier,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { error: j.error_description ?? j.error ?? `http ${res.status}` };
    return j;
  } catch (e) {
    return { error: String((e as Error).message).slice(0, 200) };
  }
}
