import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publication pipeline" };

const STAGES: [string, string, string][] = [
  ["idea", "Idea", "var(--muted)"],
  ["draft", "Draft", "var(--midnight)"],
  ["internal_review", "Internal review", "var(--review)"],
  ["citation_audit", "Citation audit", "var(--seaglass)"],
  ["ready", "Ready", "var(--current)"],
  ["submitted", "Submitted", "var(--current)"],
  ["under_review", "Under review", "var(--review)"],
  ["revise_resubmit", "Revise & resubmit", "var(--gold)"],
  ["accepted", "Accepted", "var(--seaglass)"],
  ["published", "Published", "var(--coral)"],
  ["declined", "Declined", "var(--muted)"],
];

export default async function Pipeline() {
  const user = (await currentUser())!;
  if (!can(user, "pipeline")) {
    return (
      <>
        <h1>Publication pipeline</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            The publication pipeline arrives with the Doctoral tier — target journals,
            submission dates, reviewer feedback, and revision deadlines in one place.
          </p>
        </div>
      </>
    );
  }

  const [rows, documents] = await Promise.all([
    q<any>(`SELECT s.*, d.title AS doc_title FROM submissions s
              LEFT JOIN documents d ON d.id = s.document_id
             WHERE s.owner_id=$1 ORDER BY s.updated_at DESC`, [user.id]),
    q<any>(`SELECT id, title, word_count FROM documents WHERE owner_id=$1
             ORDER BY updated_at DESC`, [user.id]),
  ]);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (!can(me, "pipeline")) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const docId = String(formData.get("documentId") ?? "");
    const row = await one<{ id: number }>(
      `INSERT INTO submissions (owner_id, document_id, title, venue, stage, coauthors)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, docId ? Number(docId) : null, title.slice(0, 400),
       String(formData.get("venue") ?? "").slice(0, 300),
       String(formData.get("stage") ?? "idea"),
       String(formData.get("coauthors") ?? "").slice(0, 500)]);
    await logEvent("submission", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/pipeline");
  }

  async function update(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    await q(
      `UPDATE submissions SET stage=$1, venue=$2, word_limit=$3, guidelines=$4,
              submitted_on=$5, decision_on=$6, revision_due=$7, reviewer_notes=$8,
              doi=$9, url=$10, updated_at=now() WHERE id=$11 AND owner_id=$12`,
      [String(formData.get("stage") ?? "idea"), String(formData.get("venue") ?? "").slice(0, 300),
       Number(formData.get("word_limit") ?? 0) || 0,
       String(formData.get("guidelines") ?? "").slice(0, 4000),
       String(formData.get("submitted_on") ?? "") || null,
       String(formData.get("decision_on") ?? "") || null,
       String(formData.get("revision_due") ?? "") || null,
       String(formData.get("reviewer_notes") ?? "").slice(0, 8000),
       String(formData.get("doi") ?? "").slice(0, 200),
       String(formData.get("url") ?? "").slice(0, 600), id, me.id]);
    await logEvent("submission", String(formData.get("stage")), { actorId: me.id, entityId: id });
    revalidatePath("/app/pipeline");
  }

  const due = rows.filter((r: any) => r.revision_due &&
    new Date(r.revision_due).getTime() > Date.now() - 864e5);

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Publication pipeline</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        Where every manuscript stands, from idea to published. Nothing is ever submitted
        anywhere on your behalf — this tracks what you do, it does not act for you.
      </p>

      {due.length > 0 && (
        <div className="card stage stage-review" style={{ margin: "20px 0" }}>
          <h2 style={{ fontSize: "1.02rem" }}>Revision deadlines</h2>
          {due.map((r: any) => (
            <p key={r.id} style={{ margin: "4px 0", fontSize: ".93rem" }}>
              <strong>{new Date(r.revision_due).toLocaleDateString()}</strong> — {r.title}
              {r.venue && <span style={{ color: "var(--muted)" }}> · {r.venue}</span>}
            </p>
          ))}
        </div>
      )}

      <form action={create} className="card" style={{ margin: "20px 0 28px", maxWidth: 760 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Track a manuscript</h2>
        <div className="field"><label htmlFor="title">Title</label>
          <input id="title" name="title" required /></div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "2 1 220px" }}>
            <label htmlFor="venue">Target journal or repository</label>
            <input id="venue" name="venue" /></div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="stage">Stage</label>
            <select id="stage" name="stage">
              {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {documents.length > 0 && (
          <div className="field">
            <label htmlFor="documentId">Linked document</label>
            <select id="documentId" name="documentId" defaultValue="">
              <option value="">— none —</option>
              {documents.map((d: any) => (
                <option key={d.id} value={d.id}>{d.title.slice(0, 70)} ({d.word_count}w)</option>
              ))}
            </select>
          </div>
        )}
        <div className="field"><label htmlFor="coauthors">Co-authors</label>
          <input id="coauthors" name="coauthors" /></div>
        <button className="btn btn-primary">Add to pipeline</button>
      </form>

      {rows.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing in the pipeline.</p>}

      {rows.map((r: any) => {
        const st = STAGES.find(([v]) => v === r.stage) ?? STAGES[0];
        return (
          <details key={r.id} className="card" style={{ marginBottom: 10, maxWidth: 900,
                   borderLeft: `3px solid ${st[2]}` }}>
            <summary style={{ cursor: "pointer" }}>
              <strong>{r.title}</strong>{" "}
              <span className="pill" style={{ color: st[2] }}>{st[1]}</span>{" "}
              {r.venue && <span className="pill">{r.venue}</span>}
              {r.coauthors && (
                <span style={{ color: "var(--muted)", fontSize: ".84rem", marginLeft: 8 }}>
                  with {r.coauthors}
                </span>
              )}
            </summary>
            <form action={update} style={{ marginTop: 14 }}>
              <input type="hidden" name="id" value={r.id} />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 170px" }}>
                  <label htmlFor={`st${r.id}`}>Stage</label>
                  <select id={`st${r.id}`} name="stage" defaultValue={r.stage}>
                    {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: "2 1 200px" }}>
                  <label htmlFor={`v${r.id}`}>Venue</label>
                  <input id={`v${r.id}`} name="venue" defaultValue={r.venue} />
                </div>
                <div className="field" style={{ flex: "1 1 130px" }}>
                  <label htmlFor={`wl${r.id}`}>Word limit</label>
                  <input id={`wl${r.id}`} name="word_limit" type="number"
                         defaultValue={r.word_limit || ""} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[["submitted_on", "Submitted"], ["decision_on", "Decision"],
                  ["revision_due", "Revision due"]].map(([n, l]) => (
                  <div key={n} className="field" style={{ flex: "1 1 150px" }}>
                    <label htmlFor={`${n}${r.id}`}>{l}</label>
                    <input id={`${n}${r.id}`} name={n} type="date"
                           defaultValue={r[n] ? String(r[n]).slice(0, 10) : ""} />
                  </div>
                ))}
              </div>
              <div className="field"><label htmlFor={`g${r.id}`}>Submission guidelines</label>
                <textarea id={`g${r.id}`} name="guidelines" rows={2} defaultValue={r.guidelines} /></div>
              <div className="field"><label htmlFor={`rn${r.id}`}>Reviewer feedback</label>
                <textarea id={`rn${r.id}`} name="reviewer_notes" rows={4}
                          defaultValue={r.reviewer_notes} /></div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 180px" }}>
                  <label htmlFor={`doi${r.id}`}>DOI</label>
                  <input id={`doi${r.id}`} name="doi" defaultValue={r.doi} />
                </div>
                <div className="field" style={{ flex: "1 1 220px" }}>
                  <label htmlFor={`u${r.id}`}>Published URL</label>
                  <input id={`u${r.id}`} name="url" defaultValue={r.url} />
                </div>
              </div>
              <button className="btn btn-secondary">Save</button>
              {r.document_id && (
                <Link href={`/app/studio/${r.document_id}`} style={{ marginLeft: 14 }}>
                  Open document →
                </Link>
              )}
            </form>
          </details>
        );
      })}
    </>
  );
}
