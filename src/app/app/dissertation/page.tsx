import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dissertation" };

// Institutions differ, so the default outline is a starting point the scholar
// can rename, reorder, or replace entirely — not an assumption.
const DEFAULT_CHAPTERS = [
  "Chapter 1 — Introduction",
  "Chapter 2 — Literature Review",
  "Chapter 3 — Methodology",
  "Chapter 4 — Results",
  "Chapter 5 — Discussion",
  "References",
  "Appendices",
];

const STATUS: [string, string, string][] = [
  ["not_started", "Not started", "var(--muted)"],
  ["drafting", "Drafting", "var(--current)"],
  ["in_review", "In review", "var(--review)"],
  ["revising", "Revising", "var(--gold)"],
  ["complete", "Complete", "var(--seaglass)"],
];

export default async function Dissertation() {
  const user = (await currentUser())!;
  if (!can(user, "dissertation")) {
    return (
      <>
        <h1>Dissertation</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            The dissertation workspace arrives with the Doctoral tier — chapters, milestones,
            committee deadlines, and the connection between your claims and where they appear.
          </p>
        </div>
      </>
    );
  }

  const diss = await one<any>(
    `SELECT * FROM dissertations WHERE owner_id=$1 ORDER BY created_at LIMIT 1`, [user.id]);

  const [chapters, documents, claims] = diss ? await Promise.all([
    q<any>(`SELECT c.*, d.word_count, d.title AS doc_title FROM dissertation_chapters c
              LEFT JOIN documents d ON d.id = c.document_id
             WHERE c.dissertation_id=$1 ORDER BY c.position, c.id`, [diss.id]),
    q<any>(`SELECT id, title, word_count FROM documents WHERE owner_id=$1
             ORDER BY updated_at DESC`, [user.id]),
    q<any>(`SELECT c.id, c.text, c.chapter,
                   (SELECT count(*) FROM claim_evidence e WHERE e.claim_id=c.id) AS ev
              FROM claims c WHERE c.owner_id=$1`, [user.id]),
  ]) : [[], [], []];

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (!can(me, "dissertation")) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const row = await one<{ id: number }>(
      `INSERT INTO dissertations (owner_id, title, degree, institution, program, chair)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, title.slice(0, 400), String(formData.get("degree") ?? "PhD"),
       String(formData.get("institution") ?? "").slice(0, 200),
       String(formData.get("program") ?? "").slice(0, 200),
       String(formData.get("chair") ?? "").slice(0, 200)]);
    if (row) {
      for (const [i, t] of DEFAULT_CHAPTERS.entries()) {
        await q(`INSERT INTO dissertation_chapters (dissertation_id, owner_id, position, title)
                 VALUES ($1,$2,$3,$4)`, [row.id, me.id, i, t]);
      }
    }
    await logEvent("dissertation", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/dissertation");
  }

  async function saveFrame(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const did = Number(formData.get("dissertationId"));
    await q(
      `UPDATE dissertations SET problem=$1, purpose=$2, framework=$3, methodology=$4,
              committee=$5, proposal_status=$6, defense_on=$7, updated_at=now()
        WHERE id=$8 AND owner_id=$9`,
      [String(formData.get("problem") ?? "").slice(0, 8000),
       String(formData.get("purpose") ?? "").slice(0, 8000),
       String(formData.get("framework") ?? "").slice(0, 8000),
       String(formData.get("methodology") ?? "").slice(0, 8000),
       String(formData.get("committee") ?? "").slice(0, 2000),
       String(formData.get("proposal_status") ?? "drafting"),
       String(formData.get("defense_on") ?? "") || null, did, me.id]);
    revalidatePath("/app/dissertation");
  }

  async function saveChapter(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const cid = Number(formData.get("chapterId"));
    const docRaw = String(formData.get("document_id") ?? "");
    await q(
      `UPDATE dissertation_chapters SET title=$1, status=$2, target_words=$3, document_id=$4,
              due_on=$5, notes=$6, updated_at=now() WHERE id=$7 AND owner_id=$8`,
      [String(formData.get("title") ?? "").slice(0, 300),
       String(formData.get("status") ?? "not_started"),
       Number(formData.get("target_words") ?? 0) || 0,
       docRaw ? Number(docRaw) : null,
       String(formData.get("due_on") ?? "") || null,
       String(formData.get("notes") ?? "").slice(0, 4000), cid, me.id]);
    revalidatePath("/app/dissertation");
  }

  if (!diss) {
    return (
      <>
        <p className="eyebrow">Author</p>
        <h1>Dissertation</h1>
        <p style={{ color: "var(--muted)", maxWidth: 640 }}>
          Set up your dissertation and we&rsquo;ll create a starting outline. Institutions
          differ, so rename, reorder, or replace any of it.
        </p>
        <form action={create} className="card" style={{ maxWidth: 640, marginTop: 24 }}>
          <div className="field"><label htmlFor="title">Working title</label>
            <input id="title" name="title" required /></div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 140px" }}>
              <label htmlFor="degree">Degree</label>
              <select id="degree" name="degree">
                {["PhD", "PsyD", "EdD", "MD-PhD", "JD-PhD", "Masters"].map((d) =>
                  <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: "2 1 200px" }}>
              <label htmlFor="institution">Institution</label>
              <input id="institution" name="institution" /></div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label htmlFor="program">Program</label><input id="program" name="program" /></div>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label htmlFor="chair">Chair</label><input id="chair" name="chair" /></div>
          </div>
          <button className="btn btn-primary">Create dissertation workspace</button>
        </form>
      </>
    );
  }

  const totalWords = chapters.reduce((n: number, c: any) => n + Number(c.word_count ?? 0), 0);
  const target = chapters.reduce((n: number, c: any) => n + Number(c.target_words ?? 0), 0);
  const complete = chapters.filter((c: any) => c.status === "complete").length;
  const unsupported = claims.filter((c: any) => Number(c.ev) === 0).length;

  return (
    <>
      <p className="eyebrow">{diss.degree} · {diss.institution || "—"}</p>
      <h1 style={{ marginBottom: 4 }}>{diss.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {[diss.program, diss.chair && `Chair: ${diss.chair}`].filter(Boolean).join(" · ")}
      </p>

      <div className="grid grid-3" style={{ margin: "24px 0" }}>
        {[["Chapters complete", `${complete}/${chapters.length}`, "var(--seaglass)"],
          ["Words written", totalWords.toLocaleString(), "var(--current)"],
          ["Target", target ? target.toLocaleString() : "—", "var(--muted)"],
          ["Proposal", diss.proposal_status.replace(/_/g, " "), "var(--gold)"],
          ["Unsupported claims", String(unsupported), unsupported ? "var(--coral)" : "var(--muted)"],
          ["Defense", diss.defense_on ? new Date(diss.defense_on).toLocaleDateString() : "—", "var(--review)"],
        ].map(([l, v, c]) => (
          <div key={l as string} className="card" style={{ padding: 18 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: c as string }}>{v}</div>
            <div style={{ color: "var(--muted)", fontSize: ".88rem" }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div>
          <h2 style={{ fontSize: "1.1rem" }}>Chapters</h2>
          {chapters.map((c: any) => {
            const st = STATUS.find(([v]) => v === c.status) ?? STATUS[0];
            return (
              <details key={c.id} className="card" style={{ marginBottom: 10,
                       borderLeft: `3px solid ${st[2]}` }}>
                <summary style={{ cursor: "pointer" }}>
                  <strong>{c.title}</strong>{" "}
                  <span className="pill" style={{ color: st[2] }}>{st[1]}</span>{" "}
                  {c.word_count ? <span className="pill">{c.word_count} words</span> : null}
                  {c.due_on && (
                    <span className="pill" style={{ marginLeft: 6 }}>
                      due {new Date(c.due_on).toLocaleDateString(undefined,
                        { month: "short", day: "numeric" })}
                    </span>
                  )}
                </summary>
                <form action={saveChapter} style={{ marginTop: 14 }}>
                  <input type="hidden" name="chapterId" value={c.id} />
                  <div className="field"><label htmlFor={`t${c.id}`}>Title</label>
                    <input id={`t${c.id}`} name="title" defaultValue={c.title} /></div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div className="field" style={{ flex: "1 1 150px" }}>
                      <label htmlFor={`s${c.id}`}>Status</label>
                      <select id={`s${c.id}`} name="status" defaultValue={c.status}>
                        {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="field" style={{ flex: "1 1 120px" }}>
                      <label htmlFor={`w${c.id}`}>Target words</label>
                      <input id={`w${c.id}`} name="target_words" type="number"
                             defaultValue={c.target_words || ""} />
                    </div>
                    <div className="field" style={{ flex: "1 1 150px" }}>
                      <label htmlFor={`d${c.id}`}>Due</label>
                      <input id={`d${c.id}`} name="due_on" type="date"
                             defaultValue={c.due_on ? String(c.due_on).slice(0, 10) : ""} />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`doc${c.id}`}>Linked document</label>
                    <select id={`doc${c.id}`} name="document_id" defaultValue={c.document_id ?? ""}>
                      <option value="">— none —</option>
                      {documents.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.title.slice(0, 60)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field"><label htmlFor={`n${c.id}`}>Notes</label>
                    <textarea id={`n${c.id}`} name="notes" rows={2} defaultValue={c.notes} /></div>
                  <button className="btn btn-secondary">Save chapter</button>
                  {c.document_id && (
                    <Link href={`/app/studio/${c.document_id}`} style={{ marginLeft: 14 }}>
                      Open in studio →
                    </Link>
                  )}
                </form>
              </details>
            );
          })}
        </div>

        <form action={saveFrame} className="card">
          <h2 style={{ fontSize: "1.1rem" }}>The frame</h2>
          <input type="hidden" name="dissertationId" value={diss.id} />
          <div className="field"><label htmlFor="problem">Research problem</label>
            <textarea id="problem" name="problem" rows={3} defaultValue={diss.problem} /></div>
          <div className="field"><label htmlFor="purpose">Purpose</label>
            <textarea id="purpose" name="purpose" rows={3} defaultValue={diss.purpose} /></div>
          <div className="field"><label htmlFor="framework">Theoretical framework</label>
            <textarea id="framework" name="framework" rows={3} defaultValue={diss.framework} /></div>
          <div className="field"><label htmlFor="methodology">Methodology</label>
            <textarea id="methodology" name="methodology" rows={3} defaultValue={diss.methodology} /></div>
          <div className="field"><label htmlFor="committee">Committee</label>
            <textarea id="committee" name="committee" rows={2} defaultValue={diss.committee}
                      placeholder="One per line" /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 170px" }}>
              <label htmlFor="proposal_status">Proposal</label>
              <select id="proposal_status" name="proposal_status" defaultValue={diss.proposal_status}>
                {["drafting", "submitted", "approved", "irb_pending", "irb_approved"].map((s) =>
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="defense_on">Defense date</label>
              <input id="defense_on" name="defense_on" type="date"
                     defaultValue={diss.defense_on ? String(diss.defense_on).slice(0, 10) : ""} />
            </div>
          </div>
          <button className="btn btn-primary">Save</button>
          <p style={{ marginTop: 14, marginBottom: 0 }}>
            <Link href="/app/defense">Prepare for defense →</Link>
          </p>
        </form>
      </div>
    </>
  );
}
