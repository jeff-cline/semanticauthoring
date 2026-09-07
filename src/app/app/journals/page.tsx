import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { findJournals } from "@/lib/literature";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal discovery" };

export default async function Journals(
  { searchParams }: { searchParams: Promise<{ q?: string }> },
) {
  const user = (await currentUser())!;
  const { q: term } = await searchParams;

  const [venues, shortlist, submissions] = await Promise.all([
    term ? findJournals(term).catch(() => []) : Promise.resolve([]),
    q<any>(`SELECT * FROM journal_shortlist WHERE owner_id=$1 ORDER BY created_at DESC`, [user.id]),
    q<any>(`SELECT id, title FROM submissions WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
  ]);

  const have = new Set(shortlist.map((s: any) => s.provider_id || s.name));

  async function add(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await q(
      `INSERT INTO journal_shortlist (owner_id, submission_id, name, publisher, issn,
                                      provider_id, is_oa, works_count, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [me.id, String(formData.get("submission_id") ?? "") ? Number(formData.get("submission_id")) : null,
       String(formData.get("name")).slice(0, 300), String(formData.get("publisher") ?? "").slice(0, 200),
       String(formData.get("issn") ?? "").slice(0, 40), String(formData.get("provider_id") ?? ""),
       formData.get("is_oa") === "true" ? true : formData.get("is_oa") === "false" ? false : null,
       Number(formData.get("works_count") ?? 0) || null,
       String(formData.get("url") ?? "").slice(0, 400)]);
    await logEvent("journal", "shortlisted", { actorId: me.id });
    revalidatePath("/app/journals");
  }

  async function update(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    if (formData.get("remove")) {
      await q(`DELETE FROM journal_shortlist WHERE id=$1 AND owner_id=$2`, [id, me.id]);
    } else {
      await q(`UPDATE journal_shortlist SET status=$1, note=$2, submission_id=$3, updated_at=now()
                WHERE id=$4 AND owner_id=$5`,
        [String(formData.get("status") ?? "considering"),
         String(formData.get("note") ?? "").slice(0, 2000),
         String(formData.get("submission_id") ?? "") ? Number(formData.get("submission_id")) : null,
         id, me.id]);
    }
    revalidatePath("/app/journals");
  }

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Journal discovery</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Find venues by looking at where work like yours is actually published, then keep a
        shortlist against a manuscript.
      </p>

      <div className="card" style={{ maxWidth: 800, margin: "18px 0",
           borderLeft: "3px solid var(--gold)" }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}>
          <strong>No impact factors, acceptance rates, or indexing claims.</strong>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          Those figures are either proprietary or not verifiable from public data, and the one
          thing worse than not having them is inventing them. What you get instead is
          countable: how many works matching your topic appeared in each venue, whether
          OpenAlex records it as open access, and its total size. Check scope and predatory
          status at the publisher and with your librarian before submitting.
        </p>
      </div>

      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0" }}>
        <input name="q" defaultValue={term ?? ""} style={{ maxWidth: 400 }}
               placeholder="Describe the manuscript's topic" />
        <button className="btn btn-primary">Find venues</button>
      </form>

      {venues.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.15rem" }}>
            Where this work appears ({venues.length})
          </h2>
          {venues.map((v) => (
            <div key={v.id || v.name} className="card" style={{ marginBottom: 10, maxWidth: 900 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                <strong style={{ flex: "1 1 260px" }}>{v.name}</strong>
                <span className="pill">{v.matchedWorks} matching works</span>
                {v.isOa === true && (
                  <span className="pill" style={{ color: "var(--current)" }}>open access</span>
                )}
                {v.isOa === false && <span className="pill">subscription</span>}
                {v.worksCount && <span className="pill">{v.worksCount.toLocaleString()} total</span>}
              </div>
              <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: "6px 0" }}>
                {[v.publisher, v.issn && `ISSN ${v.issn}`].filter(Boolean).join(" · ") || "—"}
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {v.url && <a href={v.url} target="_blank" rel="noopener noreferrer"
                             style={{ fontSize: ".88rem" }}>Journal site ↗</a>}
                {have.has(v.id || v.name) ? (
                  <span className="pill" style={{ marginLeft: "auto" }}>shortlisted</span>
                ) : (
                  <form action={add} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="name" value={v.name} />
                    <input type="hidden" name="publisher" value={v.publisher} />
                    <input type="hidden" name="issn" value={v.issn} />
                    <input type="hidden" name="provider_id" value={v.id} />
                    <input type="hidden" name="is_oa" value={String(v.isOa)} />
                    <input type="hidden" name="works_count" value={String(v.worksCount ?? "")} />
                    <input type="hidden" name="url" value={v.url} />
                    <button className="btn btn-secondary"
                            style={{ padding: "6px 14px", fontSize: ".85rem" }}>Shortlist</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      <h2 style={{ fontSize: "1.15rem", marginTop: 30 }}>Shortlist ({shortlist.length})</h2>
      {shortlist.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing shortlisted.</p>}
      {shortlist.map((s: any) => (
        <details key={s.id} className="card" style={{ marginBottom: 10, maxWidth: 900 }}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{s.name}</strong> <span className="pill">{s.status}</span>{" "}
            {s.is_oa && <span className="pill" style={{ color: "var(--current)" }}>OA</span>}
          </summary>
          <form action={update} style={{ marginTop: 12, display: "flex", gap: 12,
                                         flexWrap: "wrap", alignItems: "flex-end" }}>
            <input type="hidden" name="id" value={s.id} />
            <div className="field" style={{ marginBottom: 0, flex: "0 1 170px" }}>
              <label htmlFor={`s${s.id}`}>Status</label>
              <select id={`s${s.id}`} name="status" defaultValue={s.status}>
                {["considering", "target", "submitted", "rejected", "ruled out"].map((x) =>
                  <option key={x}>{x}</option>)}
              </select>
            </div>
            {submissions.length > 0 && (
              <div className="field" style={{ marginBottom: 0, flex: "1 1 180px" }}>
                <label htmlFor={`m${s.id}`}>For manuscript</label>
                <select id={`m${s.id}`} name="submission_id" defaultValue={s.submission_id ?? ""}>
                  <option value="">— none —</option>
                  {submissions.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.title.slice(0, 50)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field" style={{ marginBottom: 0, flex: "2 1 220px" }}>
              <label htmlFor={`n${s.id}`}>Note</label>
              <input id={`n${s.id}`} name="note" defaultValue={s.note} />
            </div>
            <button className="btn btn-secondary" style={{ padding: "10px 16px" }}>Save</button>
            <button className="btn btn-secondary" name="remove" value="1"
                    style={{ padding: "10px 16px" }}>Remove</button>
          </form>
        </details>
      ))}
    </>
  );
}
