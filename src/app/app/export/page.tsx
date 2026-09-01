import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export your work" };

export default async function ExportPage() {
  const user = (await currentUser())!;
  const counts = await one<any>(
    `SELECT
       (SELECT count(*) FROM sources WHERE owner_id=$1) AS sources,
       (SELECT count(*) FROM annotations WHERE owner_id=$1) AS annotations,
       (SELECT count(*) FROM questions WHERE owner_id=$1) AS questions,
       (SELECT count(*) FROM documents WHERE owner_id=$1) AS documents,
       (SELECT count(*) FROM journal_entries WHERE owner_id=$1) AS journal,
       (SELECT count(*) FROM life_experiences WHERE owner_id=$1) AS experiences,
       (SELECT count(*) FROM claims WHERE owner_id=$1) AS claims,
       (SELECT count(*) FROM milestones WHERE owner_id=$1) AS milestones`, [user.id]);

  return (
    <>
      <p className="eyebrow">Your data</p>
      <h1>Export everything</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Your scholarship is yours. Take it whenever you like — a scholar who cannot leave is
        not really a member.
      </p>

      <div className="grid grid-3" style={{ margin: "26px 0" }}>
        {[["Sources", counts?.sources], ["Annotations", counts?.annotations],
          ["Questions", counts?.questions], ["Documents", counts?.documents],
          ["Journal entries", counts?.journal], ["Life experiences", counts?.experiences],
          ["Claims", counts?.claims], ["Milestones", counts?.milestones]].map(([l, n]) => (
          <div key={l as string} className="card" style={{ padding: 18 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: "1.7rem", color: "var(--current)" }}>
              {Number(n ?? 0)}
            </div>
            <div style={{ color: "var(--muted)", fontSize: ".9rem" }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h2 style={{ fontSize: "1.05rem" }}>Complete archive</h2>
          <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
            Everything above as structured JSON, including full version history for questions
            and documents, and the provenance of anything sourced externally.
          </p>
          <a className="btn btn-primary" href="/app/export/archive.json" download>
            Download JSON archive
          </a>
        </div>
        <div className="card">
          <h2 style={{ fontSize: "1.05rem" }}>Bibliography</h2>
          <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
            Your library as BibTeX, for LaTeX, Zotero, or any reference manager.
          </p>
          <a className="btn btn-secondary" href="/app/export/library.bib" download>
            Download BibTeX
          </a>
        </div>
      </div>

      <p style={{ color: "var(--muted)", fontSize: ".88rem", marginTop: 26, maxWidth: 660 }}>
        Uploaded files are not included in the JSON archive — download those individually from
        each source. Ask us any time and we will delete your account and everything in it.
      </p>
    </>
  );
}
