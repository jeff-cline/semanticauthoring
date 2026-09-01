import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Capture" };

const KINDS = ["idea", "quote", "question", "reflection", "insight"];

export default async function Capture() {
  const user = (await currentUser())!;
  const rows = await q<any>(
    `SELECT * FROM captures WHERE owner_id=$1 ORDER BY processed, created_at DESC LIMIT 200`,
    [user.id]);

  async function capture(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    const kind = String(formData.get("kind") ?? "idea");
    const row = await one<{ id: number }>(
      `INSERT INTO captures (owner_id, body, kind) VALUES ($1,$2,$3) RETURNING id`,
      [me.id, body.slice(0, 8000), kind]);

    // A captured question can become a tracked question immediately.
    if (kind === "question" && formData.get("promote")) {
      const qr = await one<{ id: number }>(
        `INSERT INTO questions (owner_id, text, status, origin)
         VALUES ($1,$2,'emerging','a conversation') RETURNING id`, [me.id, body.slice(0, 2000)]);
      if (qr) {
        await q(`INSERT INTO question_versions (question_id, text, status, note)
                 VALUES ($1,$2,'emerging','Captured')`, [qr.id, body.slice(0, 2000)]);
        await q(`UPDATE captures SET processed=TRUE, updated_at=now() WHERE id=$1`, [row?.id]);
      }
    }
    await logEvent("capture", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/capture");
  }

  async function toggle(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    await q(`UPDATE captures SET processed = NOT processed, updated_at=now()
              WHERE id=$1 AND owner_id=$2`, [id, me.id]);
    revalidatePath("/app/capture");
  }

  const open = rows.filter((r: any) => !r.processed);
  const done = rows.filter((r: any) => r.processed);

  return (
    <>
      <p className="eyebrow">Capture thought</p>
      <h1>Get it down before it goes.</h1>
      <p style={{ color: "var(--muted)", maxWidth: 620 }}>
        An idea, a quote, a question, a reflection. Connect it later — the point is that it
        takes seconds now.
      </p>

      <form action={capture} className="card" style={{ margin: "24px 0 34px", maxWidth: 720 }}>
        <div className="field">
          <label htmlFor="body" className="hp">What are you thinking?</label>
          <textarea id="body" name="body" rows={3} required autoFocus
                    placeholder="What are you thinking?" />
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 190 }}>
            <label htmlFor="kind">Kind</label>
            <select id="kind" name="kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                          color: "var(--muted)", fontSize: ".9rem", marginBottom: 12 }}>
            <input type="checkbox" name="promote" style={{ width: "auto" }} />
            If it&rsquo;s a question, track it
          </label>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }}>Capture</button>
        </div>
      </form>

      <h2 style={{ fontSize: "1.15rem" }}>Inbox ({open.length})</h2>
      {open.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing waiting.</p>}
      {open.map((c: any) => (
        <div key={c.id} className="card" style={{ marginBottom: 10, padding: 16, maxWidth: 860 }}>
          <span className="pill">{c.kind}</span>
          <p style={{ margin: "8px 0" }}>{c.body}</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>
              {new Date(c.created_at).toLocaleString()}
            </span>
            <form action={toggle} style={{ marginLeft: "auto" }}>
              <input type="hidden" name="id" value={c.id} />
              <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: ".85rem" }}>
                Mark processed
              </button>
            </form>
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <details style={{ marginTop: 26 }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
            Processed ({done.length})
          </summary>
          {done.map((c: any) => (
            <div key={c.id} className="card" style={{ marginTop: 10, padding: 14, opacity: .72 }}>
              <span className="pill">{c.kind}</span>
              <p style={{ margin: "6px 0 0", fontSize: ".93rem" }}>{c.body}</p>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
