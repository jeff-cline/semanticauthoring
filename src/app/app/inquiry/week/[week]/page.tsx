import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { SYNTHESIS, REQUIRED, findPatterns, ensureWeeks } from "@/lib/inquiry";

export const dynamic = "force-dynamic";
export const metadata = { title: "Week" };

export default async function Week({ params }: { params: Promise<{ week: string }> }) {
  const { week: weekRaw } = await params;
  const week = Number(weekRaw);
  if (!week || week < 1 || week > 15) notFound();

  const user = (await currentUser())!;
  await ensureWeeks(user.id);

  const [meta, entries, synthesis] = await Promise.all([
    one<any>(`SELECT * FROM inquiry_weeks WHERE owner_id=$1 AND week=$2`, [user.id, week]),
    q<any>(`SELECT * FROM inquiry_entries WHERE owner_id=$1 AND week=$2
             ORDER BY entry_date, id`, [user.id, week]),
    one<any>(`SELECT * FROM inquiry_synthesis WHERE owner_id=$1 AND week=$2`, [user.id, week]),
  ]);
  if (!meta) notFound();

  const patterns = findPatterns(entries);

  async function saveWeek(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await q(
      `UPDATE inquiry_weeks SET theme=$1, readings=$2, discussion=$3, instruction=$4,
              kind=$5, updated_at=now() WHERE owner_id=$6 AND week=$7`,
      [String(formData.get("theme") ?? "").slice(0, 300),
       String(formData.get("readings") ?? "").slice(0, 4000),
       String(formData.get("discussion") ?? "").slice(0, 4000),
       String(formData.get("instruction") ?? "").slice(0, 4000),
       String(formData.get("kind") ?? "reading"), me.id, Number(formData.get("week"))]);
    revalidatePath(`/app/inquiry/week/${formData.get("week")}`);
  }

  async function saveSynthesis(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const w = Number(formData.get("week"));
    const g = (k: string) => String(formData.get(k) ?? "").slice(0, 12000);
    await q(
      `INSERT INTO inquiry_synthesis (owner_id, week, patterns, resonance, resistance,
                                      shift, influence, carrying)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (owner_id, week) DO UPDATE SET patterns=EXCLUDED.patterns,
         resonance=EXCLUDED.resonance, resistance=EXCLUDED.resistance, shift=EXCLUDED.shift,
         influence=EXCLUDED.influence, carrying=EXCLUDED.carrying, updated_at=now()`,
      [me.id, w, g("patterns"), g("resonance"), g("resistance"), g("shift"),
       g("influence"), g("carrying")]);
    await logEvent("inquiry_synthesis", "saved", { actorId: me.id, entityId: w });
    revalidatePath(`/app/inquiry/week/${w}`);
  }

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/inquiry">← Journal</Link></p>
      <p className="eyebrow">Embodied Inquiry</p>
      <h1 style={{ marginBottom: 6 }}>Week {week}{meta.theme ? ` — ${meta.theme}` : ""}</h1>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 22 }}>
        <div>
          <h2 style={{ fontSize: "1.1rem" }}>
            Entries ({entries.length})
          </h2>
          {entries.length === 0 && (
            <p style={{ color: "var(--muted)" }}>
              Nothing yet. <Link href="/app/inquiry">Begin an entry →</Link>
            </p>
          )}
          {entries.map((e: any) => (
            <details key={e.id} className="card" style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer" }}>
                <strong>{new Date(e.entry_date).toLocaleDateString(undefined,
                  { weekday: "short", month: "short", day: "numeric" })}</strong>{" "}
                <span className="pill">{e.context}</span>{" "}
                {e.reading_ref && <span className="pill">{e.reading_ref.slice(0, 40)}</span>}
              </summary>
              <div style={{ marginTop: 12 }}>
                {REQUIRED.map((r) => e[r.key] ? (
                  <div key={r.key} style={{ marginBottom: 10 }}>
                    <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "0 0 2px" }}>
                      {r.label}
                    </p>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{e[r.key]}</p>
                  </div>
                ) : null)}
                <p style={{ marginTop: 10 }}>
                  <Link href={`/app/inquiry/entry/${e.id}`}>Open full entry →</Link>
                </p>
              </div>
            </details>
          ))}

          {/* Weekly synthesis */}
          <form action={saveSynthesis} className="card stage stage-celebrate"
                style={{ marginTop: 20 }}>
            <input type="hidden" name="week" value={week} />
            <h2 style={{ fontSize: "1.1rem", marginBottom: 4 }}>Weekly embodied synthesis</h2>
            <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
              Written at the end of the week, drawing on all {entries.length} of your entries
              above.
            </p>
            {SYNTHESIS.map((s) => (
              <div className="field" key={s.key}>
                <label htmlFor={s.key}>{s.label}</label>
                <textarea id={s.key} name={s.key} rows={3}
                          defaultValue={synthesis?.[s.key] ?? ""} />
              </div>
            ))}
            <button className="btn btn-primary">Save synthesis</button>
          </form>
        </div>

        <div>
          {/* Patterns — organisation of the scholar's own words, never generation. */}
          <div className="card stage stage-synthesize">
            <h2 style={{ fontSize: "1.05rem", marginBottom: 4 }}>Patterns in your own words</h2>
            <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>
              Counted from what you wrote. Nothing here is generated — it is your language,
              reflected back, to help you see what recurs.
            </p>

            {patterns.entryCount === 0 && (
              <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 0 }}>
                Patterns appear once you have written a few entries.
              </p>
            )}

            {patterns.bodyLocations.length > 0 && (
              <>
                <p className="eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>
                  Where you felt it
                </p>
                <p style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: 0 }}>
                  {patterns.bodyLocations.map((b) => (
                    <span key={b.word} className="pill">{b.word} ×{b.n}</span>
                  ))}
                </p>
              </>
            )}

            {patterns.emotions.length > 0 && (
              <>
                <p className="eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>
                  Emotions you named
                </p>
                <p style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: 0 }}>
                  {patterns.emotions.map((b) => (
                    <span key={b.word} className="pill">{b.word} ×{b.n}</span>
                  ))}
                </p>
              </>
            )}

            {patterns.recurring.length > 0 && (
              <>
                <p className="eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>Recurring words</p>
                <p style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: 0 }}>
                  {patterns.recurring.map((b) => (
                    <span key={b.word} className="pill">{b.word} ×{b.n}</span>
                  ))}
                </p>
              </>
            )}

            {patterns.echoes.length > 0 && (
              <>
                <p className="eyebrow" style={{ marginTop: 16, marginBottom: 6 }}>
                  Sentences where it surfaced
                </p>
                {patterns.echoes.map((e, i) => (
                  <blockquote key={i} style={{ margin: "8px 0", paddingLeft: 12,
                              borderLeft: "2px solid var(--seaglass)", fontSize: ".9rem" }}>
                    &ldquo;{e.sentence}&rdquo;
                    <span style={{ display: "block", color: "var(--muted)", fontSize: ".78rem" }}>
                      {new Date(e.date).toLocaleDateString(undefined,
                        { month: "short", day: "numeric" })}
                    </span>
                  </blockquote>
                ))}
              </>
            )}

            {patterns.entryCount > 0 && (
              <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 16,
                          marginBottom: 0 }}>
                A question worth sitting with: does what recurs here match what you think this
                week was about?
              </p>
            )}
          </div>

          <form action={saveWeek} className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: "1.05rem" }}>This week from the syllabus</h2>
            <input type="hidden" name="week" value={week} />
            <div className="field"><label htmlFor="theme">Theme</label>
              <input id="theme" name="theme" defaultValue={meta.theme} /></div>
            <div className="field">
              <label htmlFor="readings">Readings (one per line)</label>
              <textarea id="readings" name="readings" rows={4} defaultValue={meta.readings} />
            </div>
            <div className="field">
              <label htmlFor="discussion">Discussion question</label>
              <textarea id="discussion" name="discussion" rows={3} defaultValue={meta.discussion} />
            </div>
            <div className="field">
              <label htmlFor="instruction">Special instruction</label>
              <textarea id="instruction" name="instruction" rows={2}
                        defaultValue={meta.instruction}
                        placeholder="e.g. experiential week — take notes during class" />
            </div>
            <div className="field" style={{ maxWidth: 220 }}>
              <label htmlFor="kind">Week type</label>
              <select id="kind" name="kind" defaultValue={meta.kind}>
                <option value="reading">Reading</option>
                <option value="experiential">Experiential</option>
                <option value="practice">Practice</option>
              </select>
            </div>
            <button className="btn btn-secondary">Save week</button>
          </form>
        </div>
      </div>
    </>
  );
}
