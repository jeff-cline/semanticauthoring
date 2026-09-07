import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { sweepDeadlines } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

const KIND_COLOR: Record<string, string> = {
  citation: "var(--current)", retraction: "var(--coral)", deadline: "var(--gold)",
  review: "var(--review)", advising: "var(--seaglass)", milestone: "var(--gold)",
  group: "var(--midnight)", system: "var(--muted)",
};

export default async function Notifications() {
  const user = (await currentUser())!;

  // Sweeping on view keeps deadlines current without a background job.
  await sweepDeadlines(user.id).catch(() => 0);

  const [items, prefs] = await Promise.all([
    q<any>(`SELECT * FROM notifications WHERE owner_id=$1
             ORDER BY read_at NULLS FIRST, created_at DESC LIMIT 200`, [user.id]),
    one<any>(`SELECT * FROM notification_prefs WHERE owner_id=$1`, [user.id]),
  ]);

  async function markAll() {
    "use server";
    const me = (await currentUser())!;
    await q(`UPDATE notifications SET read_at=now() WHERE owner_id=$1 AND read_at IS NULL`,
      [me.id]);
    revalidatePath("/app/notifications");
  }

  async function savePrefs(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await q(
      `INSERT INTO notification_prefs (owner_id, citations, deadlines, reviews, advising,
                                       groups, email_digest)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (owner_id) DO UPDATE SET citations=EXCLUDED.citations,
         deadlines=EXCLUDED.deadlines, reviews=EXCLUDED.reviews, advising=EXCLUDED.advising,
         groups=EXCLUDED.groups, email_digest=EXCLUDED.email_digest, updated_at=now()`,
      [me.id, formData.get("citations") === "on", formData.get("deadlines") === "on",
       formData.get("reviews") === "on", formData.get("advising") === "on",
       formData.get("groups") === "on", String(formData.get("email_digest") ?? "weekly")]);
    revalidatePath("/app/notifications");
  }

  const unread = items.filter((i: any) => !i.read_at);

  return (
    <>
      <p className="eyebrow">Your workspace</p>
      <h1>Notifications</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Deadlines, citations, reviews, and advising. Deliberately not a feed — nothing here
        is designed to bring you back.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "20px 0" }}>
        <span className="pill">{unread.length} unread</span>
        {unread.length > 0 && (
          <form action={markAll}>
            <button className="btn btn-secondary" style={{ padding: "6px 14px" }}>
              Mark all read
            </button>
          </form>
        )}
      </div>

      {items.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing to report.</p>}

      {items.map((n: any) => (
        <div key={n.id} className="card" style={{ marginBottom: 8, padding: 14,
             opacity: n.read_at ? .6 : 1,
             borderLeft: `3px solid ${KIND_COLOR[n.kind] ?? "var(--line)"}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="pill" style={{ color: KIND_COLOR[n.kind] }}>{n.kind}</span>
            <strong style={{ fontSize: ".95rem" }}>
              {n.href ? <Link href={n.href} style={{ color: "inherit" }}>{n.title}</Link> : n.title}
            </strong>
            <span style={{ color: "var(--muted)", fontSize: ".78rem", marginLeft: "auto" }}>
              {new Date(n.created_at).toLocaleString()}
            </span>
          </div>
          {n.body && !n.body.includes(":") && (
            <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>{n.body}</p>
          )}
        </div>
      ))}

      <form action={savePrefs} className="card" style={{ marginTop: 26, maxWidth: 620 }}>
        <h2 style={{ fontSize: "1.05rem" }}>What you want to hear about</h2>
        {[["citations", "New citations to work you track", prefs?.citations ?? true],
          ["deadlines", "Deadlines within a week", prefs?.deadlines ?? true],
          ["reviews", "Review activity", prefs?.reviews ?? true],
          ["advising", "Advising invitations and changes", prefs?.advising ?? true],
          ["groups", "Group activity", prefs?.groups ?? true]].map(([n, l, v]) => (
          <label key={n as string} style={{ display: "flex", gap: 10, alignItems: "center",
                                            fontWeight: 400, marginBottom: 10 }}>
            <input type="checkbox" name={n as string} defaultChecked={Boolean(v)}
                   style={{ width: "auto" }} />
            {l}
          </label>
        ))}
        <div className="field" style={{ maxWidth: 200, marginTop: 14 }}>
          <label htmlFor="email_digest">Email digest</label>
          <select id="email_digest" name="email_digest" defaultValue={prefs?.email_digest ?? "weekly"}>
            <option value="off">Off</option><option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <button className="btn btn-primary">Save</button>
      </form>
    </>
  );
}
