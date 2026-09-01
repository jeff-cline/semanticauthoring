import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim" };

const RELATIONS: [string, string, string][] = [
  ["supports", "Supports", "var(--current)"],
  ["contradicts", "Contradicts", "var(--coral)"],
  ["qualifies", "Qualifies", "var(--gold)"],
  ["replicates", "Replicates", "var(--current)"],
  ["fails_to_replicate", "Fails to replicate", "var(--coral)"],
  ["provides_context", "Provides context", "var(--review)"],
  ["cites", "Cites", "var(--muted)"],
];

export default async function ClaimDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const claim = await one<any>(
    `SELECT c.*, qq.text AS question_text FROM claims c
       LEFT JOIN questions qq ON qq.id = c.question_id
      WHERE c.id=$1 AND c.owner_id=$2`, [Number(id), user.id]);
  if (!claim) notFound();

  const [evidence, sources, annotations] = await Promise.all([
    q<any>(`SELECT e.*, s.title AS source_title, s.authors, s.year, s.doi
              FROM claim_evidence e LEFT JOIN sources s ON s.id = e.source_id
             WHERE e.claim_id=$1 ORDER BY e.created_at`, [claim.id]),
    q<any>(`SELECT id, title, authors, year FROM sources WHERE owner_id=$1
             ORDER BY updated_at DESC LIMIT 100`, [user.id]),
    q<any>(`SELECT a.id, a.quote, a.says, s.title AS source_title
              FROM annotations a JOIN sources s ON s.id=a.source_id
             WHERE a.owner_id=$1 ORDER BY a.created_at DESC LIMIT 60`, [user.id]),
  ]);

  async function addEvidence(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const cid = Number(formData.get("claimId"));
    const owned = await one(`SELECT id FROM claims WHERE id=$1 AND owner_id=$2`, [cid, me.id]);
    if (!owned) return;
    const sid = String(formData.get("sourceId") ?? "");
    const aid = String(formData.get("annotationId") ?? "");
    if (!sid && !aid) return;
    const row = await one<{ id: number }>(
      `INSERT INTO claim_evidence (claim_id, owner_id, source_id, annotation_id, relation,
                                   location, note, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [cid, me.id, sid ? Number(sid) : null, aid ? Number(aid) : null,
       String(formData.get("relation") ?? "supports"),
       String(formData.get("location") ?? "").slice(0, 120),
       String(formData.get("note") ?? "").slice(0, 4000),
       String(formData.get("confidence") ?? "stated")]);
    await q(`UPDATE claims SET last_reviewed_at=now(), updated_at=now() WHERE id=$1`, [cid]);
    await logEvent("claim_evidence", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath(`/app/claims/${cid}`);
  }

  async function removeEvidence(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const eid = Number(formData.get("evidenceId"));
    await q(`DELETE FROM claim_evidence WHERE id=$1 AND owner_id=$2`, [eid, me.id]);
    revalidatePath(`/app/claims/${formData.get("claimId")}`);
  }

  const byRel = (r: string) => evidence.filter((e: any) => e.relation === r);

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/claims">← Claim ledger</Link></p>
      <p className="eyebrow">Claim</p>
      <h1 style={{ fontSize: "1.7rem" }}>{claim.text}</h1>
      <p style={{ color: "var(--muted)" }}>
        {claim.question_text && <>Serving: {claim.question_text}</>}
        {claim.chapter && ` · ${claim.chapter}`}
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 26 }}>
        <form action={addEvidence} className="card">
          <h2 style={{ fontSize: "1.05rem" }}>Attach evidence</h2>
          <input type="hidden" name="claimId" value={claim.id} />
          <div className="field">
            <label htmlFor="relation">How does it relate?</label>
            <select id="relation" name="relation">
              {RELATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {sources.length > 0 && (
            <div className="field">
              <label htmlFor="sourceId">Source</label>
              <select id="sourceId" name="sourceId" defaultValue="">
                <option value="">— none —</option>
                {sources.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.title.slice(0, 70)}{s.year ? ` (${s.year})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {annotations.length > 0 && (
            <div className="field">
              <label htmlFor="annotationId">Or a specific annotation</label>
              <select id="annotationId" name="annotationId" defaultValue="">
                <option value="">— none —</option>
                {annotations.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {(a.quote || a.says).slice(0, 60)} — {a.source_title.slice(0, 30)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 130px" }}>
              <label htmlFor="location">Where in the source?</label>
              <input id="location" name="location" placeholder="p. 214" />
            </div>
            <div className="field" style={{ flex: "1 1 150px" }}>
              <label htmlFor="confidence">How certain?</label>
              <select id="confidence" name="confidence">
                <option value="stated">stated outright</option>
                <option value="inferred">inferred</option>
                <option value="uncertain">uncertain</option>
              </select>
            </div>
          </div>
          <div className="field"><label htmlFor="note">Your note</label>
            <textarea id="note" name="note" rows={3} /></div>
          <button className="btn btn-primary">Attach</button>
          <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 12, marginBottom: 0 }}>
            Every piece of evidence points at a real source you have read. Nothing is
            auto-generated.
          </p>
        </form>

        <div>
          <h2 style={{ fontSize: "1.05rem" }}>
            Evidence ({evidence.length})
          </h2>
          {evidence.length === 0 && (
            <p style={{ color: "var(--muted)" }}>
              Nothing attached. An unsupported claim is the most common thing a committee
              asks about.
            </p>
          )}
          {RELATIONS.map(([rel, label, color]) => {
            const items = byRel(rel);
            if (!items.length) return null;
            return (
              <div key={rel} style={{ marginBottom: 18 }}>
                <p className="eyebrow" style={{ color }}>{label} ({items.length})</p>
                {items.map((e: any) => (
                  <div key={e.id} className="card" style={{ marginBottom: 8, padding: 14,
                       borderLeft: `3px solid ${color}` }}>
                    <strong style={{ fontSize: ".95rem" }}>
                      {e.source_id ? (
                        <Link href={`/app/library/${e.source_id}`}>{e.source_title}</Link>
                      ) : "From an annotation"}
                    </strong>
                    <div style={{ color: "var(--muted)", fontSize: ".86rem" }}>
                      {[e.authors, e.year, e.location].filter(Boolean).join(" · ")}
                      {e.doi && ` · DOI ${e.doi}`}
                    </div>
                    {e.note && <p style={{ margin: "6px 0 0", fontSize: ".92rem" }}>{e.note}</p>}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <span className="pill">{e.confidence}</span>
                      {e.generated_by_ai && <span className="pill">AI-extracted</span>}
                      <form action={removeEvidence} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="evidenceId" value={e.id} />
                        <input type="hidden" name="claimId" value={claim.id} />
                        <button className="btn btn-secondary"
                                style={{ padding: "3px 10px", fontSize: ".78rem" }}>Remove</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
