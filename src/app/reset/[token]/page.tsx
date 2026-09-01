import Link from "next/link";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { one, q, logEvent } from "@/lib/db";
import { hashPassword, passwordProblem, createSession } from "@/lib/auth";
import { Mark } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password", robots: { index: false } };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export default async function Reset(
  { params, searchParams }:
  { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> },
) {
  const { token } = await params;
  const { error } = await searchParams;

  const row = await one<any>(
    `SELECT r.id, r.user_id, u.email FROM password_resets r JOIN users u ON u.id = r.user_id
      WHERE r.token_hash=$1 AND r.used_at IS NULL AND r.expires_at > now()`,
    [sha(token)]).catch(() => null);

  async function submit(formData: FormData) {
    "use server";
    const t = String(formData.get("token") ?? "");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    const r = await one<any>(
      `SELECT id, user_id FROM password_resets
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()`, [sha(t)]);
    if (!r) redirect(`/reset/${t}?error=expired`);
    if (next !== confirm) redirect(`/reset/${t}?error=match`);
    if (passwordProblem(next)) redirect(`/reset/${t}?error=weak`);

    await q(`UPDATE users SET password_hash=$1, must_change_password=FALSE, updated_at=now()
              WHERE id=$2`, [await hashPassword(next), r.user_id]);
    await q(`UPDATE password_resets SET used_at=now() WHERE id=$1`, [r.id]);
    // Every other session is invalidated — a reset should log out anyone else.
    await q(`DELETE FROM sessions WHERE user_id=$1`, [r.user_id]);
    await logEvent("user", "password_reset_completed", { actorId: r.user_id, entityId: r.user_id });

    await createSession(r.user_id);
    redirect("/app");
  }

  const messages: Record<string, string> = {
    match: "The two passwords didn't match.",
    weak: "Use at least 12 characters with upper case, lower case, and a number.",
    expired: "That link has expired or was already used.",
  };

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

        {!row ? (
          <div className="card">
            <h1 style={{ fontSize: "1.35rem" }}>This link isn&rsquo;t valid.</h1>
            <p style={{ color: "var(--muted)" }}>
              Reset links work once and expire after an hour.
            </p>
            <p style={{ marginBottom: 0 }}>
              <Link href="/forgot">Request a new one →</Link>
            </p>
          </div>
        ) : (
          <form action={submit} className="card">
            <input type="hidden" name="token" value={token} />
            <h1 style={{ fontSize: "1.35rem" }}>Choose a new password</h1>
            <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>for {row.email}</p>
            {error && <p className="error">{messages[error] ?? "Please try again."}</p>}
            <div className="field">
              <label htmlFor="next">New password</label>
              <input id="next" name="next" type="password" required autoComplete="new-password" />
              <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
                At least 12 characters, with upper case, lower case, and a number.
              </p>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }}>
              Set password and sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
