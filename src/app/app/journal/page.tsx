import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { promptsFor, STATES } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily scholar journal" };

export default async function Journal() {
  const user = (await currentUser())!;
  const today = new Date();
  const prompts = promptsFor(today);
  const iso = today.toISOString().slice(0, 10);

  const [entry, past] = await Promise.all([
    one<any>(`SELECT * FROM journal_entries WHERE owner_id=$1 AND entry_date=$2`, [user.id, iso]),
    q<any>(`SELECT * FROM journal_entries WHERE owner_id=$1 AND entry_date < $2
             ORDER BY entry_date DESC LIMIT 30`, [user.id, iso]),
  ]);

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const date = String(formData.get("date"));
    const nums = Object.fromEntries(
      STATES.map((s) => {
        const v = String(formData.get(s) ?? "");
        return [s, v === "" ? null : Math.max(1, Math.min(5, Number(v)))];
      }),
    );

    await q(
      `INSERT INTO journal_entries
         (owner_id, entry_date, intellectual_prompt, intellectual, somatic_prompt, somatic,
          intention, reflection, energy, focus, stress, curiosity, confidence, capacity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (owner_id, entry_date) DO UPDATE SET
         intellectual = EXCLUDED.intellectual, somatic = EXCLUDED.somatic,
         intention = EXCLUDED.intention, reflection = EXCLUDED.reflection,
         energy = EXCLUDED.energy, focus = EXCLUDED.focus, stress = EXCLUDED.stress,
         curiosity = EXCLUDED.curiosity, confidence = EXCLUDED.confidence,
         capacity = EXCLUDED.capacity, updated_at = now()`,
      [me.id, date,
       String(formData.get("intellectual_prompt") ?? ""), String(formData.get("intellectual") ?? "").slice(0, 8000),
       String(formData.get("somatic_prompt") ?? ""), String(formData.get("somatic") ?? "").slice(0, 8000),
       String(formData.get("intention") ?? "").slice(0, 2000),
       String(formData.get("reflection") ?? "").slice(0, 8000),
       nums.energy, nums.focus, nums.stress, nums.curiosity, nums.confidence, nums.capacity],
    );
    await logEvent("journal", "saved", { actorId: me.id, entityId: date });
    revalidatePath("/app/journal");
  }

  return (
    <>
      <p className="eyebrow">Today · {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1>Daily scholar journal</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Private to you. Scholars are people, not productivity machines — this is a place for
        the thinking and the noticing, not a progress report.
      </p>

      <form action={save} className="card" style={{ maxWidth: 780, marginTop: 24 }}>
        <input type="hidden" name="date" value={iso} />
        <input type="hidden" name="intellectual_prompt" value={prompts.intellectual} />
        <input type="hidden" name="somatic_prompt" value={prompts.somatic} />

        <div className="stage stage-connect" style={{ marginBottom: 24 }}>
          <label htmlFor="intellectual" style={{ fontSize: "1.02rem", fontFamily: "var(--serif)" }}>
            {prompts.intellectual}
          </label>
          <textarea id="intellectual" name="intellectual" rows={4}
                    defaultValue={entry?.intellectual ?? ""} />
        </div>

        <div className="stage stage-synthesize" style={{ marginBottom: 24 }}>
          <label htmlFor="somatic" style={{ fontSize: "1.02rem", fontFamily: "var(--serif)" }}>
            {prompts.somatic}
          </label>
          <textarea id="somatic" name="somatic" rows={3} defaultValue={entry?.somatic ?? ""} />
          <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
            Noticing, not diagnosing. There is no wrong answer.
          </p>
        </div>

        <div className="stage stage-publish" style={{ marginBottom: 24 }}>
          <label htmlFor="intention" style={{ fontSize: "1.02rem", fontFamily: "var(--serif)" }}>
            What is the one meaningful scholarly action you want to complete today?
          </label>
          <input id="intention" name="intention" defaultValue={entry?.intention ?? ""} />
        </div>

        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 18px",
                           marginBottom: 24 }}>
          <legend style={{ fontSize: ".84rem", color: "var(--muted)", padding: "0 6px" }}>
            How is it today? (optional, 1–5)
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
            {STATES.map((s) => (
              <div key={s}>
                <label htmlFor={s} style={{ textTransform: "capitalize", fontSize: ".82rem" }}>{s}</label>
                <select id={s} name={s} defaultValue={entry?.[s] ?? ""}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="stage stage-celebrate" style={{ marginBottom: 24 }}>
          <label htmlFor="reflection" style={{ fontSize: "1.02rem", fontFamily: "var(--serif)" }}>
            End of day — what did you move forward? What can you release until tomorrow?
          </label>
          <textarea id="reflection" name="reflection" rows={3} defaultValue={entry?.reflection ?? ""} />
        </div>

        <button className="btn btn-primary">{entry ? "Update today" : "Save today"}</button>
        {entry && (
          <span style={{ color: "var(--muted)", fontSize: ".85rem", marginLeft: 14 }}>
            Last saved {new Date(entry.updated_at).toLocaleTimeString()}
          </span>
        )}
      </form>

      {past.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.15rem", marginTop: 40 }}>Earlier entries</h2>
          {past.map((e: any) => (
            <details key={e.id} className="card" style={{ marginBottom: 10, maxWidth: 780 }}>
              <summary style={{ cursor: "pointer" }}>
                <strong>{new Date(e.entry_date).toLocaleDateString(undefined,
                  { weekday: "short", month: "short", day: "numeric" })}</strong>
                {e.intention && (
                  <span style={{ color: "var(--muted)" }}> — {e.intention.slice(0, 80)}</span>
                )}
              </summary>
              <div style={{ marginTop: 12 }}>
                {[["", e.intellectual_prompt, e.intellectual],
                  ["", e.somatic_prompt, e.somatic],
                  ["End of day", "", e.reflection]].map(([_, prompt, val], i) =>
                  val ? (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "0 0 2px" }}>
                        {prompt || "End of day"}
                      </p>
                      <p style={{ margin: 0 }}>{val}</p>
                    </div>
                  ) : null)}
              </div>
            </details>
          ))}
        </>
      )}
    </>
  );
}
