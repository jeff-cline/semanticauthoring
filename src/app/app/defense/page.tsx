import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Defense preparation" };

const CATEGORIES: [string, string, string][] = [
  ["theoretical", "Theoretical", "Why this framework, and not the obvious alternative?"],
  ["methodological", "Methodological", "Why this method? What did it make invisible?"],
  ["statistical", "Statistical", "Were the assumptions of your analysis met?"],
  ["epistemological", "Epistemological", "What counts as knowledge in this study, and who decided?"],
  ["ethical", "Ethical", "Who bore the risk of this research, and what did they get back?"],
  ["literature", "Literature", "Whose work are you not engaging with, and why?"],
  ["limitations", "Limitations", "What is the most serious limitation you have not written down?"],
  ["generalizability", "Generalizability", "To whom does this actually apply?"],
  ["contribution", "Contribution", "What does the field know now that it did not before?"],
  ["future_research", "Future research", "If you had three more years, what would you do next?"],
];

const CONFIDENCE: [string, string, string][] = [
  ["unprepared", "Unprepared", "var(--coral)"],
  ["shaky", "Shaky", "var(--gold)"],
  ["ready", "Ready", "var(--current)"],
];

export default async function Defense() {
  const user = (await currentUser())!;
  if (!can(user, "dissertation")) {
    return (
      <>
        <h1>Defense preparation</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Defense preparation arrives with the Doctoral tier.
          </p>
        </div>
      </>
    );
  }

  const [diss, questions, weakClaims] = await Promise.all([
    one<any>(`SELECT id, title, defense_on FROM dissertations WHERE owner_id=$1 LIMIT 1`, [user.id]),
    q<any>(`SELECT d.*, c.text AS claim_text FROM defense_questions d
              LEFT JOIN claims c ON c.id = d.claim_id
             WHERE d.owner_id=$1 ORDER BY d.confidence, d.created_at DESC`, [user.id]),
    q<any>(`SELECT c.id, c.text, c.chapter,
                   (SELECT count(*) FROM claim_evidence e WHERE e.claim_id=c.id) AS ev,
                   (SELECT count(*) FROM claim_evidence e WHERE e.claim_id=c.id
                      AND e.relation IN ('contradicts','fails_to_replicate')) AS against
              FROM claims c WHERE c.owner_id=$1 ORDER BY c.updated_at DESC`, [user.id]),
  ]);

  async function add(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const question = String(formData.get("question") ?? "").trim();
    if (!question) return;
    const cid = String(formData.get("claimId") ?? "");
    const row = await one<{ id: number }>(
      `INSERT INTO defense_questions (owner_id, dissertation_id, claim_id, category, question, origin)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, Number(formData.get("dissertationId")) || null, cid ? Number(cid) : null,
       String(formData.get("category") ?? "methodological"), question.slice(0, 2000),
       String(formData.get("origin") ?? "self")]);
    await logEvent("defense_question", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/defense");
  }

  async function answer(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    await q(`UPDATE defense_questions SET response=$1, confidence=$2, updated_at=now()
              WHERE id=$3 AND owner_id=$4`,
      [String(formData.get("response") ?? "").slice(0, 8000),
       String(formData.get("confidence") ?? "unprepared"), id, me.id]);
    revalidatePath("/app/defense");
  }

  const unprepared = questions.filter((x: any) => x.confidence === "unprepared").length;
  const unsupported = weakClaims.filter((c: any) => Number(c.ev) === 0);
  const contested = weakClaims.filter((c: any) => Number(c.against) > 0);

  return (
    <>
      <p className="eyebrow">Review</p>
      <h1>Defense preparation</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Audit your own argument before the committee does. The questions that make you
        uncomfortable are the ones to prepare — your discomfort is a reliable index of
        committee interest.
      </p>
      <p style={{ color: "var(--muted)", maxWidth: 700, fontSize: ".92rem" }}>
        <strong>These are your own anticipation notes.</strong> The prompts below are
        conversation starters drawn from common categories — they are not predictions of what
        your committee will ask, and this platform will never present them as such.
      </p>

      {diss?.defense_on && (
        <div className="card stage stage-review" style={{ margin: "20px 0" }}>
          <strong>Defense: {new Date(diss.defense_on).toLocaleDateString(undefined,
            { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>
          <span style={{ color: "var(--muted)", marginLeft: 12 }}>
            {Math.max(0, Math.ceil((new Date(diss.defense_on).getTime() - Date.now()) / 864e5))} days
          </span>
        </div>
      )}

      {(unsupported.length > 0 || contested.length > 0 || unprepared > 0) && (
        <div className="grid grid-3" style={{ margin: "20px 0" }}>
          {unsupported.length > 0 && (
            <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
              <strong style={{ color: "var(--gold)" }}>{unsupported.length} unsupported claims</strong>
              <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: "4px 0 0" }}>
                No evidence attached. <Link href="/app/claims">Fix in the ledger →</Link>
              </p>
            </div>
          )}
          {contested.length > 0 && (
            <div className="card" style={{ borderLeft: "3px solid var(--coral)" }}>
              <strong style={{ color: "var(--coral)" }}>{contested.length} contested claims</strong>
              <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: "4px 0 0" }}>
                Contradicting evidence exists. Address it in the text.
              </p>
            </div>
          )}
          {unprepared > 0 && (
            <div className="card" style={{ borderLeft: "3px solid var(--review)" }}>
              <strong style={{ color: "var(--review)" }}>{unprepared} unanswered</strong>
              <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: "4px 0 0" }}>
                Questions you haven&rsquo;t written a response to yet.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 20 }}>
        <div>
          <form action={add} className="card">
            <h2 style={{ fontSize: "1.05rem" }}>Anticipate a question</h2>
            <input type="hidden" name="dissertationId" value={diss?.id ?? ""} />
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" name="category">
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="question">The question</label>
              <textarea id="question" name="question" rows={2} required />
            </div>
            {weakClaims.length > 0 && (
              <div className="field">
                <label htmlFor="claimId">About a specific claim? (optional)</label>
                <select id="claimId" name="claimId" defaultValue="">
                  <option value="">— none —</option>
                  {weakClaims.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.text.slice(0, 80)}</option>
                  ))}
                </select>
              </div>
            )}
            <button className="btn btn-primary">Add</button>
          </form>

          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: "1.05rem" }}>Prompts by category</h2>
            <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              Starting points. Prepare at least one honest answer in every category.
            </p>
            {CATEGORIES.map(([key, label, prompt]) => {
              const n = questions.filter((x: any) => x.category === key).length;
              return (
                <div key={key} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
                  <strong style={{ fontSize: ".92rem" }}>{label}</strong>{" "}
                  {n > 0
                    ? <span className="pill">{n}</span>
                    : <span className="pill" style={{ color: "var(--coral)" }}>none yet</span>}
                  <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: "3px 0 0" }}>
                    {prompt}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: "1.05rem" }}>Your questions ({questions.length})</h2>
          {questions.length === 0 && (
            <p style={{ color: "var(--muted)" }}>
              Nothing yet. Start with the part of your work you least want to be asked about.
            </p>
          )}
          {questions.map((x: any) => {
            const conf = CONFIDENCE.find(([v]) => v === x.confidence) ?? CONFIDENCE[0];
            return (
              <details key={x.id} className="card" style={{ marginBottom: 10,
                       borderLeft: `3px solid ${conf[2]}` }}>
                <summary style={{ cursor: "pointer" }}>
                  <strong style={{ fontSize: ".95rem" }}>{x.question}</strong>
                  <div style={{ marginTop: 6 }}>
                    <span className="pill">
                      {CATEGORIES.find(([v]) => v === x.category)?.[1] ?? x.category}
                    </span>{" "}
                    <span className="pill" style={{ color: conf[2] }}>{conf[1]}</span>
                    {x.claim_text && (
                      <span style={{ color: "var(--muted)", fontSize: ".82rem", marginLeft: 8 }}>
                        on: {x.claim_text.slice(0, 50)}
                      </span>
                    )}
                  </div>
                </summary>
                <form action={answer} style={{ marginTop: 14 }}>
                  <input type="hidden" name="id" value={x.id} />
                  <div className="field">
                    <label htmlFor={`r${x.id}`}>Your answer</label>
                    <textarea id={`r${x.id}`} name="response" rows={5} defaultValue={x.response}
                              placeholder="Answer as you would in the room. Conceding a real limitation gracefully is a strong answer." />
                  </div>
                  <div className="field" style={{ maxWidth: 200 }}>
                    <label htmlFor={`c${x.id}`}>How ready are you?</label>
                    <select id={`c${x.id}`} name="confidence" defaultValue={x.confidence}>
                      {CONFIDENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-secondary">Save</button>
                </form>
              </details>
            );
          })}
        </div>
      </div>
    </>
  );
}
