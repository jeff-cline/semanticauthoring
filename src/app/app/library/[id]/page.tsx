import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Source" };

const NOTE_KINDS = ["general", "literature", "methodological", "critical", "question", "idea",
  "quotation", "finding", "limitation", "counterargument", "definition", "future_research"];

const EVIDENCE = [
  ["", "— no label —"],
  ["supports", "Supports"],
  ["challenges", "Challenges"],
  ["contradicts", "Contradicts"],
  ["expands", "Expands"],
  ["contextualizes", "Contextualizes"],
];

const EVIDENCE_COLOR: Record<string, string> = {
  supports: "var(--current)", challenges: "var(--gold)",
  contradicts: "var(--coral)", expands: "var(--seaglass)",
  contextualizes: "var(--review)",
};

export default async function SourceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const source = await one<any>(
    `SELECT * FROM sources WHERE id=$1 AND owner_id=$2`, [Number(id), user.id]);
  if (!source) notFound();

  const [annotations, questions, connections] = await Promise.all([
    q<any>(`SELECT * FROM annotations WHERE source_id=$1 ORDER BY created_at DESC`, [source.id]),
    q<any>(`SELECT id, text FROM questions WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
    q<any>(`SELECT c.*, qq.text AS question_text FROM connections c
              JOIN questions qq ON qq.id = c.to_id AND c.to_type='question'
             WHERE c.owner_id=$1 AND c.from_type='source' AND c.from_id=$2`, [user.id, source.id]),
  ]);

  async function annotate(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const sid = Number(formData.get("sourceId"));
    const owned = await one(`SELECT id FROM sources WHERE id=$1 AND owner_id=$2`, [sid, me.id]);
    if (!owned) return;
    const quote = String(formData.get("quote") ?? "").trim();
    const says = String(formData.get("says") ?? "").trim();
    if (!quote && !says) return;
    const row = await one<{ id: number }>(
      `INSERT INTO annotations (owner_id, source_id, page, quote, kind, evidence, says, think, matters, connects, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [me.id, sid, String(formData.get("page") ?? "").slice(0, 40),
       quote.slice(0, 6000), String(formData.get("kind") ?? "general"),
       String(formData.get("evidence") ?? ""), says.slice(0, 4000),
       String(formData.get("think") ?? "").slice(0, 4000),
       String(formData.get("matters") ?? "").slice(0, 4000),
       String(formData.get("connects") ?? "").slice(0, 4000),
       String(formData.get("tags") ?? "").slice(0, 300)],
    );
    await q(`UPDATE sources SET read_status='reading', updated_at=now()
              WHERE id=$1 AND read_status='unread'`, [sid]);
    await logEvent("annotation", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath(`/app/library/${sid}`);
  }

  async function connectToQuestion(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const sid = Number(formData.get("sourceId"));
    const qid = Number(formData.get("questionId"));
    const owned = await one(
      `SELECT 1 FROM sources s JOIN questions qq ON qq.owner_id = s.owner_id
        WHERE s.id=$1 AND qq.id=$2 AND s.owner_id=$3`, [sid, qid, me.id]);
    if (!owned) return;
    await q(`INSERT INTO connections (owner_id, from_type, from_id, to_type, to_id, relation, note)
             VALUES ($1,'source',$2,'question',$3,'speaks_to',$4) ON CONFLICT DO NOTHING`,
      [me.id, sid, qid, String(formData.get("note") ?? "").slice(0, 500)]);
    revalidatePath(`/app/library/${sid}`);
  }

  async function setStatus(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const sid = Number(formData.get("sourceId"));
    const st = String(formData.get("read_status"));
    if (!["unread", "reading", "read"].includes(st)) return;
    await q(`UPDATE sources SET read_status=$1, updated_at=now() WHERE id=$2 AND owner_id=$3`,
      [st, sid, me.id]);
    revalidatePath(`/app/library/${sid}`);
  }

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/library">← Library</Link></p>
      <p className="eyebrow">{source.kind.replace("_", " ")}</p>
      <h1 style={{ marginBottom: 6 }}>{source.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {[source.authors, source.year, source.publication].filter(Boolean).join(" · ")}
        {source.doi && <> · DOI <code>{source.doi}</code></>}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "12px 0 26px" }}>
        {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer" className="pill">Open link ↗</a>}
        {source.file_name && (
          <a href={`/app/library/${source.id}/file`} className="pill" target="_blank" rel="noopener">
            {source.file_name} ↗
          </a>
        )}
        <form action={setStatus} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="sourceId" value={source.id} />
          <select name="read_status" defaultValue={source.read_status} style={{ width: "auto" }}>
            <option value="unread">unread</option><option value="reading">reading</option>
            <option value="read">read</option>
          </select>
          <button className="btn btn-secondary" style={{ padding: "8px 14px" }}>Set</button>
        </form>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div>
          <details className="card" open>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Add an annotation</summary>
            <form action={annotate} style={{ marginTop: 16 }}>
              <input type="hidden" name="sourceId" value={source.id} />
              <div style={{ display: "flex", gap: 12 }}>
                <div className="field" style={{ flex: "0 1 110px" }}>
                  <label htmlFor="page">Page</label><input id="page" name="page" />
                </div>
                <div className="field" style={{ flex: "1 1 auto" }}>
                  <label htmlFor="kind">Note type</label>
                  <select id="kind" name="kind">
                    {NOTE_KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="quote">Quote or highlight</label>
                <textarea id="quote" name="quote" rows={3} />
              </div>
              <div className="field">
                <label htmlFor="evidence">What does it do to your argument?</label>
                <select id="evidence" name="evidence">
                  {EVIDENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="says">What does this source say?</label>
                <textarea id="says" name="says" rows={2} /></div>
              <div className="field"><label htmlFor="think">What do I think?</label>
                <textarea id="think" name="think" rows={2} /></div>
              <div className="field"><label htmlFor="matters">Why does this matter?</label>
                <textarea id="matters" name="matters" rows={2} /></div>
              <div className="field"><label htmlFor="connects">What does this connect to?</label>
                <textarea id="connects" name="connects" rows={2} /></div>
              <div className="field"><label htmlFor="tags">Tags</label><input id="tags" name="tags" /></div>
              <button className="btn btn-primary">Save annotation</button>
            </form>
          </details>

          {questions.length > 0 && (
            <form action={connectToQuestion} className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: "1rem" }}>Which question does this speak to?</h3>
              <input type="hidden" name="sourceId" value={source.id} />
              <div className="field">
                <select name="questionId">
                  {questions.map((x: any) => (
                    <option key={x.id} value={x.id}>{x.text.slice(0, 90)}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label htmlFor="cnote">Note</label><input id="cnote" name="note" /></div>
              <button className="btn btn-secondary">Connect</button>
            </form>
          )}

          {connections.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: "1rem" }}>Speaks to</h3>
              {connections.map((c: any) => (
                <p key={c.id} style={{ color: "var(--current)", fontSize: ".93rem", margin: "6px 0" }}>
                  → {c.question_text}
                  {c.note && <span style={{ color: "var(--muted)" }}> — {c.note}</span>}
                </p>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: "1.15rem" }}>
            {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
          </h2>
          {annotations.length === 0 && (
            <p style={{ color: "var(--muted)" }}>
              Nothing yet. Ninety seconds at the moment of reading saves an afternoon of
              reconstruction later.
            </p>
          )}
          {annotations.map((a: any) => (
            <div key={a.id} className="card" style={{ marginBottom: 12,
                 borderLeft: `3px solid ${EVIDENCE_COLOR[a.evidence] ?? "var(--line)"}` }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span className="pill">{a.kind.replace("_", " ")}</span>
                {a.evidence && (
                  <span className="pill" style={{ color: EVIDENCE_COLOR[a.evidence] }}>{a.evidence}</span>
                )}
                {a.page && <span className="pill">p. {a.page}</span>}
                {a.generated_by_ai && <span className="pill">AI-assisted</span>}
              </div>
              {a.quote && (
                <blockquote style={{ margin: "0 0 10px", paddingLeft: 14,
                                     borderLeft: "2px solid var(--line)", fontStyle: "italic" }}>
                  {a.quote}
                </blockquote>
              )}
              {[["Says", a.says], ["I think", a.think], ["Matters because", a.matters],
                ["Connects to", a.connects]].map(([label, val]) =>
                val ? (
                  <p key={label as string} style={{ fontSize: ".93rem", margin: "6px 0" }}>
                    <strong style={{ color: "var(--muted)", fontSize: ".8rem",
                                     textTransform: "uppercase", letterSpacing: ".06em" }}>
                      {label}
                    </strong><br />{val}
                  </p>
                ) : null)}
              <div style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 8 }}>
                {new Date(a.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
