import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Life Map" };

export default async function LifeMap() {
  const user = (await currentUser())!;

  const [experiences, questions, links] = await Promise.all([
    q<any>(`SELECT * FROM life_experiences WHERE owner_id=$1 ORDER BY created_at DESC`, [user.id]),
    q<any>(`SELECT id, text FROM questions WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
    q<any>(`SELECT l.*, qq.text AS question_text, e.title AS experience_title
              FROM question_links l
              JOIN questions qq ON qq.id = l.question_id
              JOIN life_experiences e ON e.id = l.experience_id
             WHERE qq.owner_id = $1`, [user.id]),
  ]);

  async function addExperience(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const row = await one<{ id: number }>(
      `INSERT INTO life_experiences (owner_id, title, narrative, period, significance, themes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, title.slice(0, 300), String(formData.get("narrative") ?? "").slice(0, 8000),
       String(formData.get("period") ?? "").slice(0, 120),
       String(formData.get("significance") ?? "").slice(0, 2000),
       String(formData.get("themes") ?? "").slice(0, 300)],
    );
    await logEvent("life_experience", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/life-map");
  }

  async function link(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const qid = Number(formData.get("questionId"));
    const eid = Number(formData.get("experienceId"));
    const owns = await one(
      `SELECT 1 FROM questions qq JOIN life_experiences e ON e.owner_id = qq.owner_id
        WHERE qq.id=$1 AND e.id=$2 AND qq.owner_id=$3`, [qid, eid, me.id]);
    if (!owns) return;
    await q(`INSERT INTO question_links (question_id, experience_id, note) VALUES ($1,$2,$3)
             ON CONFLICT DO NOTHING`,
      [qid, eid, String(formData.get("note") ?? "").slice(0, 1000)]);
    revalidatePath("/app/life-map");
  }

  return (
    <>
      <p className="eyebrow">Connect</p>
      <h1>Life Map</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        The experiences that shaped the questions you are asking. This is the most private
        material in your workspace — visible only to you, never to administrators, and never
        used to train anything.
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 28 }}>
        <form action={addExperience} className="card">
          <h2 style={{ fontSize: "1.1rem" }}>Add an experience</h2>
          <div className="field">
            <label htmlFor="title">What happened?</label>
            <input id="title" name="title" required />
          </div>
          <div className="field">
            <label htmlFor="period">When, roughly?</label>
            <input id="period" name="period" placeholder="Sometime in my twenties · 2014 · During my MA" />
            <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
              Approximate is fine. Don&rsquo;t invent precision you don&rsquo;t have.
            </p>
          </div>
          <div className="field">
            <label htmlFor="narrative">The story</label>
            <textarea id="narrative" name="narrative" rows={5} />
          </div>
          <div className="field">
            <label htmlFor="significance">Why does it matter to your work?</label>
            <textarea id="significance" name="significance" rows={3} />
          </div>
          <div className="field">
            <label htmlFor="themes">Themes</label>
            <input id="themes" name="themes" placeholder="belonging, loss, embodiment" />
          </div>
          <button className="btn btn-primary">Save experience</button>
        </form>

        <div>
          {questions.length > 0 && experiences.length > 0 && (
            <form action={link} className="card" style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: "1.1rem" }}>Connect an experience to a question</h2>
              <div className="field">
                <label htmlFor="experienceId">Experience</label>
                <select id="experienceId" name="experienceId">
                  {experiences.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="questionId">Question</label>
                <select id="questionId" name="questionId">
                  {questions.map((x: any) => (
                    <option key={x.id} value={x.id}>{x.text.slice(0, 90)}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="note">How are they connected?</label>
                <input id="note" name="note" />
              </div>
              <button className="btn btn-secondary">Connect</button>
            </form>
          )}

          <h2 style={{ fontSize: "1.1rem" }}>Your timeline ({experiences.length})</h2>
          {experiences.length === 0 && (
            <p style={{ color: "var(--muted)" }}>Nothing here yet — and no rush.</p>
          )}
          {experiences.map((e: any) => (
            <div key={e.id} className="card stage stage-synthesize" style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 4 }}>{e.title}</h3>
              {e.period && <p className="pill" style={{ marginBottom: 8 }}>{e.period}</p>}
              {e.narrative && <p style={{ color: "var(--muted)", fontSize: ".95rem" }}>{e.narrative}</p>}
              {e.significance && (
                <p style={{ color: "var(--muted)", fontSize: ".95rem", fontStyle: "italic" }}>
                  {e.significance}
                </p>
              )}
              {links.filter((l: any) => l.experience_id === e.id).map((l: any) => (
                <p key={l.id} style={{ fontSize: ".9rem", color: "var(--current)", margin: "6px 0 0" }}>
                  → {l.question_text}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
