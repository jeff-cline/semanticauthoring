import Link from "next/link";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import { headers } from "next/headers";
import { one, q, logEvent } from "@/lib/db";
import { passwordResetEmail } from "@/lib/email";
import { coreConfigured } from "@/lib/core";
import { Mark } from "@/components/Brand";
import { rateLimited } from "@/lib/validate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset your password", robots: { index: false } };

export default async function Forgot(
  { searchParams }: { searchParams: Promise<{ sent?: string }> },
) {
  const { sent } = await searchParams;

  async function request(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const h = await headers();
    const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // Rate limit by IP so this can't be used to enumerate accounts or spam.
    if (rateLimited(`forgot:${ip}`, 5, 900_000)) redirect("/forgot?sent=1");

    const user = await one<any>(`SELECT id, email, name FROM users WHERE lower(email)=$1`, [email]);

    // Always report the same outcome, whether or not the account exists —
    // otherwise this page becomes a way to discover who has an account.
    if (user) {
      const token = randomBytes(32).toString("hex");
      const hash = createHash("sha256").update(token).digest("hex");
      await q(`UPDATE password_resets SET used_at = now()
                WHERE user_id=$1 AND used_at IS NULL`, [user.id]).catch(() => {});
      await q(
        `INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
         VALUES ($1,$2, now() + interval '1 hour', $3)`, [user.id, hash, ip]);
      const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
      passwordResetEmail(user.email, user.name || "", `${base}/reset/${token}`).catch(() => {});
      await logEvent("user", "password_reset_requested", { entityId: user.id });
    }
    redirect("/forgot?sent=1");
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center",
                   background: "var(--midnight)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ textAlign: "center", color: "#fff", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Mark size={48} />
          </div>
          <div style={{ fontFamily: "var(--serif)", letterSpacing: ".14em",
                        textTransform: "uppercase" }}>Semantic Authoring</div>
        </div>

        {sent ? (
          <div className="card" role="status">
            <h1 style={{ fontSize: "1.35rem" }}>Check your email.</h1>
            <p style={{ color: "var(--muted)" }}>
              If an account exists for that address, a reset link is on its way. The link works
              once and expires in an hour.
            </p>
            {!coreConfigured() && (
              <p className="error" style={{ fontSize: ".9rem" }}>
                Note for administrators: outbound email is not configured yet, so the message
                cannot actually be delivered. Issue a Core API key with the
                <code> email:send </code> scope to enable it.
              </p>
            )}
            <p style={{ marginBottom: 0 }}><Link href="/login">← Back to sign in</Link></p>
          </div>
        ) : (
          <form action={request} className="card">
            <h1 style={{ fontSize: "1.35rem" }}>Reset your password</h1>
            <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
              Enter your email and we&rsquo;ll send you a link to choose a new one.
            </p>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="username" />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }}>Send reset link</button>
            <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
              <Link href="/login" style={{ fontSize: ".9rem" }}>← Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
