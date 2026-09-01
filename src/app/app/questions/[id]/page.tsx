import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import DateField from "@/components/DateField";
import { ConnectPanel } from "@/components/ConnectPanel";
import { saveConnection } from "@/lib/connect";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question" };

const STATUSES = ["emerging", "active", "refining", "answered", "parked", "retired"];

export default async function QuestionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const question = await one<any>(
    `SELECT * FROM questions WHERE id=$1 AND owner_id=$2`, [Number(id), user.id]);
  if (!question) notFound();

  const versions = await q<any>(
    `SELECT * FROM question_versions WHERE question_id=$1 ORDER BY created_at DESC`, [question.id]);

  async function saveCore(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const qid = Number(formData.get("questionId"));
    const owned = await one(`SELECT id FROM questions WHERE id=$1 AND owner_id=$2`, [qid, me.id]);
    if (!owned) return;
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return;
    // The prior wording is preserved before anything changes.
    await q(`INSERT INTO question_versions (question_id, text, status, note)
             SELECT id, text, status, 'Revised' FROM questions WHERE id=$1`, [qid]);
    await q(`UPDATE questions SET text=$1, status=$2, discipline=$3, updated_at=now() WHERE id=$4`,
      [text.slice(0, 2000), String(formData.get("status") ?? "emerging"),
       String(formData.get("discipline") ?? "").slice(0, 120), qid]);
    await logEvent("question", "revised", { actorId: me.id, entityId: qid });
    revalidatePath(`/app/questions/${qid}`);
  }

  async function saveReflection(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const qid = Number(formData.get("questionId"));
    await q(
      `UPDATE questions SET beneath=$1, sensed_on=$2, sensed_note=$3, chosen_or_arrived=$4,
              chosen_note=$5, counterfactual=$6, cost=$7, given_back=$8, updated_at=now()
        WHERE id=$9 AND owner_id=$10`,
      [String(formData.get("beneath") ?? "").slice(0, 8000),
       String(formData.get("sensed_on") ?? "") || null,
       String(formData.get("sensed_note") ?? "").slice(0, 300),
       String(formData.get("chosen_or_arrived") ?? ""),
       String(formData.get("chosen_note") ?? "").slice(0, 8000),
       String(formData.get("counterfactual") ?? "").slice(0, 8000),
       String(formData.get("cost") ?? "").slice(0, 8000),
       String(formData.get("given_back") ?? "").slice(0, 8000), qid, me.id]);
    await logEvent("question", "reflection_saved", { actorId: me.id, entityId: qid });
    revalidatePath(`/app/questions/${qid}`);
  }

  async function connect(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await saveConnection(me.id, formData);
    revalidatePath(`/app/questions/${formData.get("fromId")}`);
  }

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/questions">← Questions</Link></p>
      <p className="eyebrow">Question · {question.status}</p>
      <h1 style={{ fontSize: "1.7rem" }}>{question.text}</h1>
      <p style={{ color: "var(--muted)" }}>
        From {question.origin}
        {question.discipline && ` · ${question.discipline}`}
        {` · ${versions.length} version${versions.length === 1 ? "" : "s"}`}
        {` · since ${new Date(question.created_at).toLocaleDateString()}`}
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 24 }}>
        <div>
          {/* The reflective work. These are the questions that turn a research
              topic into a question that is actually yours. */}
          <form action={saveReflection} className="card stage stage-synthesize">
            <h2 style={{ fontSize: "1.05rem" }}>Whose question is this?</h2>
            <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              Private to you. Nothing here is required, and there is no right answer — but
              scholars who can answer these tend to finish.
            </p>
            <input type="hidden" name="questionId" value={question.id} />

            <div className="field">
              <label htmlFor="beneath">What is the question beneath the question?</label>
              <textarea id="beneath" name="beneath" rows={3} defaultValue={question.beneath}
                        placeholder="The one you would ask if no one were assessing you." />
            </div>

            <DateField
              name="sensed_on"
              label="When did you first sense this question was yours?"
              defaultValue={question.sensed_on}
              noteName="sensed_note"
              noteValue={question.sensed_note}
              notePlaceholder="…or describe it — 'my second year', 'after my father died'"
              hint="Pick a date if you have one. Approximate is fine — don't invent precision."
            />

            <div className="field">
              <label htmlFor="chosen_or_arrived">Did you choose it, or did it arrive?</label>
              <select id="chosen_or_arrived" name="chosen_or_arrived"
                      defaultValue={question.chosen_or_arrived} style={{ maxWidth: 260 }}>
                <option value="">—</option>
                <option value="chose">I chose it</option>
                <option value="arrived">It arrived</option>
                <option value="both">Some of both</option>
                <option value="unsure">I&rsquo;m not sure yet</option>
              </select>
              <textarea name="chosen_note" rows={2} defaultValue={question.chosen_note}
                        style={{ marginTop: 10 }} placeholder="Say more, if you want to." />
            </div>

            <div className="field">
              <label htmlFor="counterfactual">
                What would have had to be different in your life for you never to have asked it?
              </label>
              <textarea id="counterfactual" name="counterfactual" rows={3}
                        defaultValue={question.counterfactual} />
            </div>

            <div className="field">
              <label htmlFor="cost">What has this work already cost you?</label>
              <textarea id="cost" name="cost" rows={3} defaultValue={question.cost} />
            </div>

            <div className="field">
              <label htmlFor="given_back">And what has it given back?</label>
              <textarea id="given_back" name="given_back" rows={3} defaultValue={question.given_back} />
            </div>

            <button className="btn btn-primary">Save reflection</button>
          </form>
        </div>

        <div>
          <form action={saveCore} className="card">
            <h2 style={{ fontSize: "1.05rem" }}>The question</h2>
            <input type="hidden" name="questionId" value={question.id} />
            <div className="field">
              <label htmlFor="text">Wording</label>
              <textarea id="text" name="text" rows={3} defaultValue={question.text} />
              <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
                Revising preserves the previous wording. How a question changed is itself
                evidence.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 150px" }}>
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={question.status}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: "1 1 150px" }}>
                <label htmlFor="discipline">Discipline</label>
                <input id="discipline" name="discipline" defaultValue={question.discipline} />
              </div>
            </div>
            <button className="btn btn-secondary">Save</button>
          </form>

          <div style={{ marginTop: 16 }}>
            <ConnectPanel ownerId={user.id} type="question" id={question.id} action={connect}
                          title="Connected to" />
          </div>

          {versions.length > 0 && (
            <details className="card" style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                How this question changed ({versions.length})
              </summary>
              {versions.map((v: any) => (
                <div key={v.id} style={{ borderLeft: "2px solid var(--line)", paddingLeft: 14,
                                         margin: "12px 0" }}>
                  <p style={{ margin: "0 0 4px", fontSize: ".93rem" }}>{v.text}</p>
                  <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                    {v.status} · {v.note} · {new Date(v.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </details>
          )}
        </div>
      </div>
    </>
  );
}
