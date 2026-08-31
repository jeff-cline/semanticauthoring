import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question tracker" };

const STATUSES = ["emerging", "active", "refining", "answered", "parked", "retired"];
const ORIGINS = ["unprompted", "a reading", "an annotation", "a conversation", "a research gap", "a life experience"];

export default async function Questions() {
  const user = (await currentUser())!;

  const rows = await q<any>(
    `SELECT q.*, (SELECT count(*) FROM question_versions v WHERE v.question_id = q.id) AS versions
       FROM questions q WHERE q.owner_id = $1 ORDER BY
         CASE q.status WHEN 'active' THEN 0 WHEN 'refining' THEN 1 WHEN 'emerging' THEN 2
                       WHEN 'answered' THEN 3 WHEN 'parked' THEN 4 ELSE 5 END, q.updated_at DESC`,
    [user.id],
  );

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;
    const row = await one<{ id: number }>(
      `INSERT INTO questions (owner_id, text, status, origin, discipline)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [me.id, text.slice(0, 2000), String(formData.get("status") ?? "emerging"),
       String(formData.get("origin") ?? "unprompted"), String(formData.get("discipline") ?? "").slice(0, 120)],
    );
    // First version recorded immediately — questions are versioned, never overwritten.
    if (row) {
      await q(`INSERT INTO question_versions (question_id, text, status, note)
               VALUES ($1,$2,$3,'Created')`,
        [row.id, text.slice(0, 2000), String(formData.get("status") ?? "emerging")]);
      await logEvent("question", "created", { actorId: me.id, entityId: row.id });
    }
    revalidatePath("/app/questions");
  }

  async function revise(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    const text = String(formData.get("text") ?? "").trim();
    const status = String(formData.get("status") ?? "");
    const owned = await one(`SELECT id FROM questions WHERE id=$1 AND owner_id=$2`, [id, me.id]);
    if (!owned || !text) return;
    // Preserve the prior phrasing before changing anything.
    await q(`INSERT INTO question_versions (question_id, text, status, note)
             SELECT id, text, status, 'Revised' FROM questions WHERE id = $1`, [id]);
    await q(`UPDATE questions SET text=$1, status=$2, updated_at=now() WHERE id=$3`,
      [text.slice(0, 2000), status, id]);
    await logEvent("question", "revised", { actorId: me.id, entityId: id });
    revalidatePath("/app/questions");
  }

  const active = rows.filter((r) => !["parked", "retired"].includes(r.status));
  const bank = rows.filter((r) => ["parked", "retired"].includes(r.status));

  return (
    <>
      <p className="eyebrow">Synthesize</p>
      <h1>Question tracker</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Questions are versioned, never overwritten. How a question changed over years is
        itself scholarly evidence — and the original phrasing is often the revealing one.
      </p>

      <form action={create} className="card" style={{ margin: "26px 0 34px", maxWidth: 720 }}>
        <div className="field">
          <label htmlFor="text">A new question</label>
          <textarea id="text" name="text" rows={2} required
                    placeholder="What am I actually trying to find out?" />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue="emerging">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 170px" }}>
            <label htmlFor="origin">Where did it come from?</label>
            <select id="origin" name="origin">{ORIGINS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="discipline">Discipline</label>
            <input id="discipline" name="discipline" />
          </div>
        </div>
        <button className="btn btn-primary">Add question</button>
      </form>

      <h2 style={{ fontSize: "1.2rem" }}>Active ({active.length})</h2>
      {active.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing yet.</p>}
      {active.map((r) => <QuestionCard key={r.id} r={r} action={revise} />)}

      {bank.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.2rem", marginTop: 40 }}>Future bank ({bank.length})</h2>
          <p style={{ color: "var(--muted)", marginTop: -8 }}>
            Parked, not deleted. Most good questions arrive at the wrong moment.
          </p>
          {bank.map((r) => <QuestionCard key={r.id} r={r} action={revise} />)}
        </>
      )}
    </>
  );
}

function QuestionCard({ r, action }: { r: any; action: (fd: FormData) => Promise<void> }) {
  return (
    <details className="card" style={{ marginBottom: 12, maxWidth: 860 }}>
      <summary style={{ cursor: "pointer" }}>
        <strong>{r.text}</strong>
        <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span className="pill">{r.status}</span>
          {r.discipline && <span className="pill">{r.discipline}</span>}
          <span className="pill">from {r.origin}</span>
          <span className="pill">{r.versions} version{Number(r.versions) === 1 ? "" : "s"}</span>
          <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>
            since {new Date(r.created_at).toLocaleDateString()}
          </span>
        </div>
      </summary>
      <form action={action} style={{ marginTop: 18 }}>
        <input type="hidden" name="id" value={r.id} />
        <div className="field">
          <label htmlFor={`t${r.id}`}>Revise the question</label>
          <textarea id={`t${r.id}`} name="text" rows={2} defaultValue={r.text} />
        </div>
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor={`s${r.id}`}>Status</label>
          <select id={`s${r.id}`} name="status" defaultValue={r.status}>
            {["emerging","active","refining","answered","parked","retired"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary">Save revision</button>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 0 }}>
          The previous wording is preserved.
        </p>
      </form>
    </details>
  );
}
