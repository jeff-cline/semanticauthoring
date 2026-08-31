import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { can } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscribers" };

export default async function Subscribers() {
  const user = (await currentUser())!;
  const allowed = can(user, "subscribers");

  const rows = allowed
    ? await q<any>(
        `SELECT * FROM subscribers WHERE scholar_id=$1 ORDER BY created_at DESC LIMIT 500`,
        [user.id])
    : [];

  const confirmed = rows.filter((r: any) => r.status === "confirmed").length;
  const pending = rows.filter((r: any) => r.status === "pending").length;

  if (!allowed) {
    return (
      <>
        <h1>Subscribers</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Subscribers arrive with the Scholar tier, alongside public publishing — readers
            can follow your work and be notified when you publish.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="eyebrow">Your audience</p>
      <h1>Subscribers</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Readers who asked to be notified when you publish. Every one confirmed their address
        first, and every notification carries a one-click unsubscribe. These are yours —
        exportable, and never visible to another scholar.
      </p>

      <div style={{ display: "flex", gap: 30, margin: "24px 0 28px" }}>
        <div><div style={{ fontFamily: "var(--serif)", fontSize: "2.2rem", color: "var(--coral)" }}>{confirmed}</div>
          <div style={{ color: "var(--muted)", fontSize: ".9rem" }}>confirmed</div></div>
        <div><div style={{ fontFamily: "var(--serif)", fontSize: "2.2rem", color: "var(--muted)" }}>{pending}</div>
          <div style={{ color: "var(--muted)", fontSize: ".9rem" }}>awaiting confirmation</div></div>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          No subscribers yet. The public subscribe form arrives with scholar profiles.
        </p>
      ) : (
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Source</th><th>Joined</th></tr></thead>
          <tbody>
            {rows.map((s: any) => (
              <tr key={s.id}>
                <td>{s.name || "—"}</td>
                <td>{s.email}</td>
                <td><span className="pill">{s.status}</span></td>
                <td style={{ color: "var(--muted)" }}>{s.source}</td>
                <td style={{ color: "var(--muted)", fontSize: ".86rem" }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
