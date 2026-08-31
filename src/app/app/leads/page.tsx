import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads CRM" };

const STATUSES = ["new", "contacted", "qualified", "converted", "archived"];

export default async function Leads(
  { searchParams }: { searchParams: Promise<{ status?: string }> },
) {
  const user = (await currentUser())!;
  if (user.role !== "god") redirect("/app");     // platform CRM is God-only

  const { status } = await searchParams;
  const filter = status && STATUSES.includes(status) ? status : null;

  const rows = await q<any>(
    filter
      ? `SELECT * FROM leads WHERE status=$1 ORDER BY created_at DESC LIMIT 500`
      : `SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`,
    filter ? [filter] : [],
  );

  const counts = await q<any>(`SELECT status, count(*) n FROM leads GROUP BY status`);
  const byStatus: Record<string, number> =
    Object.fromEntries(counts.map((c: any) => [c.status, Number(c.n)]));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  async function setStatus(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (me.role !== "god") return;
    const id = Number(formData.get("id"));
    const s = String(formData.get("status"));
    if (!STATUSES.includes(s)) return;
    await q(`UPDATE leads SET status=$1, updated_at=now() WHERE id=$2`, [s, id]);
    await logEvent("lead", `status:${s}`, { actorId: me.id, entityId: id });
    revalidatePath("/app/leads");
  }

  async function addNote(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (me.role !== "god") return;
    const id = Number(formData.get("id"));
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    await one(`INSERT INTO lead_notes (lead_id, author_id, body) VALUES ($1,$2,$3)`,
      [id, me.id, body.slice(0, 4000)]);
    revalidatePath("/app/leads");
  }

  const notes = await q<any>(`SELECT * FROM lead_notes ORDER BY created_at DESC LIMIT 500`);

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>Leads CRM</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0 24px" }}>
        <a href="/app/leads" className="pill" style={{ textDecoration: "none" }}>
          all ({total})
        </a>
        {STATUSES.map((s) => (
          <a key={s} href={`/app/leads?status=${s}`} className="pill" style={{ textDecoration: "none" }}>
            {s} ({byStatus[s] ?? 0})
          </a>
        ))}
      </div>

      {rows.length === 0 && <p style={{ color: "var(--muted)" }}>No leads yet.</p>}

      {rows.map((l: any) => (
        <details key={l.id} className="card" style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{l.name}</strong> — {l.email}{" "}
            <span className="pill">{l.status}</span>{" "}
            {l.forwarded_to_core && <span className="pill">in Core</span>}
            <span style={{ color: "var(--muted)", fontSize: ".84rem", marginLeft: 8 }}>
              {new Date(l.created_at).toLocaleString()}
            </span>
          </summary>
          <div style={{ marginTop: 14 }}>
            {l.interest && <p style={{ margin: "4px 0" }}><strong>Stage:</strong> {l.interest}</p>}
            {l.message && <p style={{ margin: "4px 0", color: "var(--muted)" }}>{l.message}</p>}
            <p style={{ color: "var(--muted)", fontSize: ".85rem" }}>
              Page {l.source_page || "—"} · Referrer {l.referrer || "direct"}
            </p>

            <form action={setStatus} style={{ display: "flex", gap: 8, alignItems: "flex-end", margin: "14px 0" }}>
              <input type="hidden" name="id" value={l.id} />
              <div className="field" style={{ marginBottom: 0, maxWidth: 190 }}>
                <label htmlFor={`st${l.id}`}>Status</label>
                <select id={`st${l.id}`} name="status" defaultValue={l.status}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <button className="btn btn-secondary" style={{ padding: "10px 18px" }}>Update</button>
            </form>

            {notes.filter((n: any) => n.lead_id === l.id).map((n: any) => (
              <p key={n.id} style={{ borderLeft: "2px solid var(--line)", paddingLeft: 12,
                                     color: "var(--muted)", fontSize: ".92rem" }}>
                {n.body}
                <br /><span style={{ fontSize: ".78rem" }}>{new Date(n.created_at).toLocaleString()}</span>
              </p>
            ))}

            <form action={addNote} style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={l.id} />
              <div className="field">
                <label htmlFor={`n${l.id}`}>Add a note</label>
                <textarea id={`n${l.id}`} name="body" rows={2} />
              </div>
              <button className="btn btn-secondary" style={{ padding: "8px 16px" }}>Save note</button>
            </form>
          </div>
        </details>
      ))}
    </>
  );
}
