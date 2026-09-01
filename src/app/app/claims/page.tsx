import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim ledger" };

export default async function Claims() {
  const user = (await currentUser())!;

  const [claims, questions] = await Promise.all([
    q<any>(
      `SELECT c.*, qq.text AS question_text,
              (SELECT count(*) FROM claim_evidence e WHERE e.claim_id=c.id) AS ev,
              (SELECT count(*) FROM claim_evidence e WHERE e.claim_id=c.id
                 AND e.relation='supports') AS supports,
              (SELECT count(*) FROM claim_evidence e WHERE e.claim_id=c.id
                 AND e.relation IN ('contradicts','fails_to_replicate')) AS against
         FROM claims c LEFT JOIN questions qq ON qq.id = c.question_id
        WHERE c.owner_id=$1 ORDER BY c.updated_at DESC`, [user.id]),
    q<any>(`SELECT id, text FROM questions WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
  ]);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;
    const qid = String(formData.get("questionId") ?? "");
    const row = await one<{ id: number }>(
      `INSERT INTO claims (owner_id, text, question_id, chapter) VALUES ($1,$2,$3,$4) RETURNING id`,
      [me.id, text.slice(0, 2000), qid ? Number(qid) : null,
       String(formData.get("chapter") ?? "").slice(0, 120)]);
    await logEvent("claim", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/claims");
  }

  const unsupported = claims.filter((c: any) => Number(c.ev) === 0);
  const contested = claims.filter((c: any) => Number(c.against) > 0);

  return (
    <>
      <p className="eyebrow">Author</p>
      <h1>Claim ledger</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        Every factual claim you intend to make, with the evidence for and against it. This is
        what turns &ldquo;why do you believe that?&rdquo; from an uncomfortable question into
        one you can answer with sources.
      </p>

      {(unsupported.length > 0 || contested.length > 0) && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "20px 0" }}>
          {unsupported.length > 0 && (
            <div className="card" style={{ borderLeft: "3px solid var(--gold)", flex: "1 1 260px" }}>
              <strong style={{ color: "var(--gold)" }}>{unsupported.length} unsupported</strong>
              <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "4px 0 0" }}>
                Claims with no evidence attached yet.
              </p>
            </div>
          )}
          {contested.length > 0 && (
            <div className="card" style={{ borderLeft: "3px solid var(--coral)", flex: "1 1 260px" }}>
              <strong style={{ color: "var(--coral)" }}>{contested.length} contested</strong>
              <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "4px 0 0" }}>
                Claims with contradicting evidence. Address these before a committee does.
              </p>
            </div>
          )}
        </div>
      )}

      <form action={create} className="card" style={{ margin: "22px 0 30px", maxWidth: 760 }}>
        <div className="field">
          <label htmlFor="text">A claim you intend to make</label>
          <textarea id="text" name="text" rows={2} required
                    placeholder="Sleep deprivation reduces working-memory performance." />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {questions.length > 0 && (
            <div className="field" style={{ flex: "2 1 260px" }}>
              <label htmlFor="questionId">Which question does it serve?</label>
              <select id="questionId" name="questionId" defaultValue="">
                <option value="">— none —</option>
                {questions.map((x: any) => (
                  <option key={x.id} value={x.id}>{x.text.slice(0, 80)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="chapter">Chapter / section</label>
            <input id="chapter" name="chapter" />
          </div>
        </div>
        <button className="btn btn-primary">Add claim</button>
      </form>

      {claims.length === 0 && <p style={{ color: "var(--muted)" }}>No claims recorded yet.</p>}

      {claims.map((c: any) => {
        const ev = Number(c.ev), sup = Number(c.supports), ag = Number(c.against);
        const strength =
          ev === 0 ? ["INSUFFICIENT", "var(--muted)"]
          : ag > sup ? ["CONFLICTED", "var(--coral)"]
          : ag > 0 ? ["MIXED", "var(--gold)"]
          : sup >= 3 ? ["SUPPORTED", "var(--current)"]
          : ["LIMITED", "var(--seaglass)"];
        return (
          <div key={c.id} className="card" style={{ marginBottom: 12, maxWidth: 900,
               borderLeft: `3px solid ${strength[1]}` }}>
            <h3 style={{ fontSize: "1.02rem", marginBottom: 8 }}>
              <Link href={`/app/claims/${c.id}`} style={{ color: "inherit" }}>{c.text}</Link>
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="pill" style={{ color: strength[1] }}>{strength[0]}</span>
              <span className="pill">{sup} supporting</span>
              {ag > 0 && <span className="pill" style={{ color: "var(--coral)" }}>{ag} against</span>}
              {c.chapter && <span className="pill">{c.chapter}</span>}
              {c.question_text && (
                <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                  {c.question_text.slice(0, 70)}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <p style={{ color: "var(--muted)", fontSize: ".88rem", marginTop: 26, maxWidth: 680 }}>
        Strength labels describe what is in your own ledger — how many sources you have
        attached and how they relate. They are not a formal evidence grading, and this
        platform will never present them as one.
      </p>
    </>
  );
}
