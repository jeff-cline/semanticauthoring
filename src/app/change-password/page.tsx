import { redirect } from "next/navigation";
import { currentUser, hashPassword, verifyPassword, passwordProblem } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { Mark } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Change password", robots: { index: false } };

export default async function ChangePassword(
  { searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> },
) {
  const { error, ok } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login");
  const forced = user.mustChangePassword;

  async function submit(formData: FormData) {
    "use server";
    const me = await currentUser();
    if (!me) redirect("/login");

    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    const row = await one<any>(`SELECT password_hash FROM users WHERE id = $1`, [me.id]);
    if (!row || !(await verifyPassword(current, row.password_hash))) {
      redirect("/change-password?error=current");
    }
    if (next !== confirm) redirect("/change-password?error=match");
    const problem = passwordProblem(next);
    if (problem) redirect("/change-password?error=weak");
    if (next === current) redirect("/change-password?error=same");

    await q(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = now()
        WHERE id = $2`,
      [await hashPassword(next), me.id],
    );
    await logEvent("user", "password_changed", { actorId: me.id, entityId: me.id });
    redirect("/app?ok=password");
  }

  const messages: Record<string, string> = {
    current: "Your current password wasn't correct.",
    match: "The two new passwords didn't match.",
    weak: "Use at least 12 characters with upper case, lower case, and a number.",
    same: "Your new password must be different from the current one.",
  };

  const body = (
    <form action={submit} className="card" style={{ maxWidth: 480 }}>
      {forced && (
        <div style={{ background: "rgba(214,108,89,.1)", border: "1px solid var(--coral)",
                      borderRadius: 9, padding: "14px 16px", marginBottom: 22 }}>
          <strong style={{ color: "var(--coral-ink)" }}>Choose a new password to continue.</strong>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: ".92rem" }}>
            This account is using a temporary password. You can&rsquo;t reach the rest of the
            workspace until it&rsquo;s changed.
          </p>
        </div>
      )}
      {error && <p className="error">{messages[error] ?? "Please try again."}</p>}
      {ok && <p className="success">Password updated.</p>}
      <div className="field">
        <label htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" />
      </div>
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
      <button className="btn btn-primary">Update password</button>
    </form>
  );

  // When forced, render standalone — the app shell is unreachable by design.
  if (forced) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center",
                     background: "var(--midnight)", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div style={{ textAlign: "center", color: "#fff", marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <Mark size={40} />
            </div>
            <div style={{ fontFamily: "var(--serif)", letterSpacing: ".14em",
                          textTransform: "uppercase" }}>Semantic Authoring</div>
          </div>
          {body}
        </div>
      </main>
    );
  }

  return (
    <>
      <h1>Change password</h1>
      {body}
    </>
  );
}
