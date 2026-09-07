import Link from "next/link";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";
import { reviewAssignmentEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Peer review" };

const RECS: Record<string, [string, string]> = {
  accept: ["Accept", "var(--current)"],
  minor_revisions: ["Minor revisions", "var(--seaglass)"],
  major_revisions: ["Major revisions", "var(--gold)"],
  reject: ["Reject", "var(--coral)"],
  unsure: ["Unsure", "var(--muted)"],
};

export default async function PeerReview() {
  const user = (await currentUser())!;
  if (!can(user, "pipeline")) {
    return (
      <>
        <h1>Peer review</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Peer review management arrives with the Doctoral tier — invite reviewers, track
            their status, and collect recommendations in one place.
          </p>
        </div>
      </>
    );
  }

  const [rounds, documents, submissions] = await Promise.all([
    q<any>(`SELECT r.*,
              (SELECT count(*)::int FROM review_assignments a WHERE a.round_id=r.id) AS invited,
              (SELECT count(*)::int FROM review_assignments a WHERE a.round_id=r.id
                 AND a.status='submitted') AS returned
             FROM review_rounds r WHERE r.owner_id=$1 ORDER BY r.created_at DESC`, [user.id]),
    q<any>(`SELECT id, title FROM documents WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
    q<any>(`SELECT id, title FROM submissions WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
  ]);

  async function createRound(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (!can(me, "pipeline")) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const docId = String(formData.get("document_id") ?? "");
    const subId = String(formData.get("submission_id") ?? "");
    const row = await one<{ id: number }>(
      `INSERT INTO review_rounds (owner_id, document_id, submission_id, title, round_number,
                                  blinding, due_on, brief)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [me.id, docId ? Number(docId) : null, subId ? Number(subId) : null, title.slice(0, 300),
       Number(formData.get("round_number") ?? 1) || 1,
       String(formData.get("blinding") ?? "single"),
       String(formData.get("due_on") ?? "") || null,
       String(formData.get("brief") ?? "").slice(0, 4000)]);
    await logEvent("review_round", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/peer-review");
  }

  return (
    <>
      <p className="eyebrow">Review</p>
      <h1>Peer review</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Run a review round on your own manuscript: invite reviewers, see who has accepted,
        declined, or returned, and collect recommendations without chasing email threads.
      </p>

      <details className="card" style={{ margin: "22px 0", maxWidth: 760 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Open a review round</summary>
        <form action={createRound} style={{ marginTop: 16 }}>
          <div className="field"><label htmlFor="title">Manuscript title</label>
            <input id="title" name="title" required /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {documents.length > 0 && (
              <div className="field" style={{ flex: "2 1 220px" }}>
                <label htmlFor="document_id">Document</label>
                <select id="document_id" name="document_id" defaultValue="">
                  <option value="">— none —</option>
                  {documents.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.title.slice(0, 60)}</option>
                  ))}
                </select>
              </div>
            )}
            {submissions.length > 0 && (
              <div className="field" style={{ flex: "2 1 220px" }}>
                <label htmlFor="submission_id">Pipeline entry</label>
                <select id="submission_id" name="submission_id" defaultValue="">
                  <option value="">— none —</option>
                  {submissions.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.title.slice(0, 60)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "0 1 110px" }}>
              <label htmlFor="round_number">Round</label>
              <input id="round_number" name="round_number" type="number" min={1} defaultValue={1} />
            </div>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="blinding">Blinding</label>
              <select id="blinding" name="blinding" defaultValue="single">
                <option value="open">Open — reviewers see the author</option>
                <option value="single">Single blind — reviewers named to you only</option>
                <option value="double">Double blind — author hidden from reviewers</option>
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="due_on">Reviews due</label>
              <input id="due_on" name="due_on" type="date" />
            </div>
          </div>
          <div className="field"><label htmlFor="brief">Brief for reviewers</label>
            <textarea id="brief" name="brief" rows={3}
                      placeholder="What kind of feedback would help most?" /></div>
          <button className="btn btn-primary">Open round</button>
        </form>
      </details>

      {rounds.length === 0 && <p style={{ color: "var(--muted)" }}>No review rounds yet.</p>}

      {rounds.map((r: any) => (
        <div key={r.id} className="card stage stage-review" style={{ marginBottom: 12,
             maxWidth: 900 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <strong style={{ fontSize: "1.02rem" }}>
              <Link href={`/app/peer-review/${r.id}`} style={{ color: "inherit" }}>{r.title}</Link>
            </strong>
            <span className="pill">round {r.round_number}</span>
            <span className="pill">{r.blinding.replace("_", " ")} blind</span>
            <span className="pill">{r.returned}/{r.invited} returned</span>
            {r.due_on && (
              <span className="pill" style={{ color: "var(--gold)" }}>
                due {new Date(r.due_on).toLocaleDateString(undefined,
                  { month: "short", day: "numeric" })}
              </span>
            )}
            <Link href={`/app/peer-review/${r.id}`} style={{ marginLeft: "auto",
                  fontSize: ".88rem" }}>manage →</Link>
          </div>
        </div>
      ))}
    </>
  );
}
