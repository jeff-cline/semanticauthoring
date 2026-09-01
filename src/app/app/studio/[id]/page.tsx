import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Writing" };

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default async function Document({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const doc = await one<any>(`SELECT * FROM documents WHERE id=$1 AND owner_id=$2`,
    [Number(id), user.id]);
  if (!doc) notFound();

  const [versions, sources, annotations, questions] = await Promise.all([
    q<any>(`SELECT id, word_count, note, created_at FROM document_versions
             WHERE document_id=$1 ORDER BY created_at DESC LIMIT 20`, [doc.id]),
    q<any>(`SELECT id, title, authors, year FROM sources WHERE owner_id=$1
             ORDER BY updated_at DESC LIMIT 40`, [user.id]),
    q<any>(`SELECT a.id, a.quote, a.says, a.evidence, a.page, s.title AS source_title
              FROM annotations a JOIN sources s ON s.id=a.source_id
             WHERE a.owner_id=$1 ORDER BY a.created_at DESC LIMIT 40`, [user.id]),
    q<any>(`SELECT id, text FROM questions WHERE owner_id=$1 AND status IN ('active','refining','emerging')
             ORDER BY updated_at DESC LIMIT 20`, [user.id]),
  ]);

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const did = Number(formData.get("id"));
    const owned = await one<any>(`SELECT body FROM documents WHERE id=$1 AND owner_id=$2`, [did, me.id]);
    if (!owned) return;
    const body = String(formData.get("body") ?? "");

    // Preserve the previous text before overwriting (spec §13).
    if (owned.body && owned.body !== body) {
      await q(`INSERT INTO document_versions (document_id, body, word_count, note)
               SELECT id, body, word_count, 'Autosaved before revision' FROM documents WHERE id=$1`,
        [did]);
    }
    await q(`UPDATE documents SET body=$1, word_count=$2, title=$3, status=$4, updated_at=now()
              WHERE id=$5`,
      [body, words(body), String(formData.get("title") ?? doc.title).slice(0, 300),
       String(formData.get("status") ?? "draft"), did]);
    await logEvent("document", "saved", { actorId: me.id, entityId: did });
    revalidatePath(`/app/studio/${did}`);
  }

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/studio">← Studio</Link></p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 26,
                    alignItems: "start" }}>
        <form action={save}>
          <h1 className="hp">{doc.title || "Untitled document"}</h1>
          <input type="hidden" name="id" value={doc.id} />
          <div className="field">
            <label htmlFor="title" className="hp">Title</label>
            <input id="title" name="title" defaultValue={doc.title}
                   style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", border: 0,
                            padding: "6px 0", background: "transparent" }} />
          </div>
          <div className="field">
            <label htmlFor="body" className="hp">Your writing</label>
            <textarea id="body" name="body" rows={26} defaultValue={doc.body}
                      style={{ fontFamily: "var(--serif)", fontSize: "1.05rem", lineHeight: 1.75,
                               padding: "22px 24px" }}
                      placeholder="Begin." />
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <select name="status" defaultValue={doc.status} style={{ width: "auto" }}>
              <option value="draft">draft</option><option value="in_review">in review</option>
              <option value="revising">revising</option><option value="final">final</option>
            </select>
            <button className="btn btn-primary">Save</button>
            <span style={{ color: "var(--muted)", fontSize: ".86rem" }}>
              {doc.word_count} words · {versions.length} earlier version{versions.length === 1 ? "" : "s"}
            </span>
          </div>
        </form>

        <aside>
          {questions.length > 0 && (
            <div className="card stage stage-synthesize" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: ".95rem" }}>Your questions</h3>
              {questions.map((x: any) => (
                <p key={x.id} style={{ fontSize: ".88rem", color: "var(--muted)", margin: "6px 0" }}>
                  {x.text}
                </p>
              ))}
            </div>
          )}

          {annotations.length > 0 && (
            <div className="card stage stage-read" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: ".95rem" }}>Recent annotations</h3>
              {annotations.slice(0, 8).map((a: any) => (
                <div key={a.id} style={{ marginBottom: 12 }}>
                  {a.evidence && <span className="pill">{a.evidence}</span>}
                  <p style={{ fontSize: ".86rem", margin: "4px 0 2px", fontStyle: a.quote ? "italic" : "normal" }}>
                    {(a.quote || a.says).slice(0, 160)}
                  </p>
                  <p style={{ fontSize: ".76rem", color: "var(--muted)", margin: 0 }}>
                    {a.source_title}{a.page ? ` · p. ${a.page}` : ""}
                  </p>
                </div>
              ))}
              <Link href="/app/library" style={{ fontSize: ".86rem" }}>All sources →</Link>
            </div>
          )}

          {sources.length > 0 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: ".95rem" }}>Library</h3>
              {sources.slice(0, 10).map((s: any) => (
                <p key={s.id} style={{ fontSize: ".85rem", margin: "5px 0" }}>
                  <Link href={`/app/library/${s.id}`}>{s.title}</Link>
                  <span style={{ color: "var(--muted)" }}>
                    {s.authors ? ` — ${s.authors}` : ""}{s.year ? ` (${s.year})` : ""}
                  </span>
                </p>
              ))}
            </div>
          )}

          {versions.length > 0 && (
            <details className="card">
              <summary style={{ cursor: "pointer", fontSize: ".95rem", fontWeight: 600 }}>
                Version history
              </summary>
              {versions.map((v: any) => (
                <p key={v.id} style={{ fontSize: ".82rem", color: "var(--muted)", margin: "8px 0" }}>
                  {new Date(v.created_at).toLocaleString()} — {v.word_count} words
                </p>
              ))}
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
