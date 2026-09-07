import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { ARRIVE, REQUIRED, CONNECTION, CONTEXTS } from "@/lib/inquiry";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal entry" };

export default async function Entry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const entry = await one<any>(
    `SELECT * FROM inquiry_entries WHERE id=$1 AND owner_id=$2`, [Number(id), user.id]);
  if (!entry) notFound();

  const week = await one<any>(
    `SELECT * FROM inquiry_weeks WHERE owner_id=$1 AND week=$2`, [user.id, entry.week]);

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const eid = Number(formData.get("entryId"));
    const g = (k: string) => String(formData.get(k) ?? "").slice(0, 12000);
    await q(
      `UPDATE inquiry_entries SET
         entry_date=$1, reading_ref=$2, context=$3,
         sensations=$4, location=$5, emotions=$6, breath_body=$7, precognitive=$8,
         noticed=$9, changed=$10, surprised=$11, alive_constricted=$12,
         trigger_author=$13, trigger_concept=$14, trigger_quote=$15, trigger_page=$16,
         body_where=$17, accompaniment=$18, meaning=$19, deepens=$20, updated_at=now()
       WHERE id=$21 AND owner_id=$22`,
      [String(formData.get("entry_date") ?? "") || null,
       g("reading_ref").slice(0, 300), g("context").slice(0, 60),
       g("sensations"), g("location"), g("emotions"), g("breath_body"), g("precognitive"),
       g("noticed"), g("changed"), g("surprised"), g("alive_constricted"),
       g("trigger_author").slice(0, 200), g("trigger_concept").slice(0, 300),
       g("trigger_quote"), g("trigger_page").slice(0, 40),
       g("body_where"), g("accompaniment"), g("meaning"), g("deepens"), eid, me.id]);
    await logEvent("inquiry_entry", "saved", { actorId: me.id, entityId: eid });
    revalidatePath(`/app/inquiry/entry/${eid}`);
  }

  const readings = String(week?.readings || "").split("\n").map((s: string) => s.trim()).filter(Boolean);

  return (
    <>
      <p style={{ marginBottom: 8 }}>
        <Link href="/app/inquiry">← Journal</Link>
        {" · "}
        <Link href={`/app/inquiry/week/${entry.week}`}>Week {entry.week}</Link>
      </p>
      <p className="eyebrow">Embodied Inquiry · Week {entry.week}</p>
      <h1 style={{ marginBottom: 6 }}>
        {new Date(entry.entry_date).toLocaleDateString(undefined,
          { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </h1>

      {week?.instruction && (
        <div className="card stage stage-celebrate" style={{ maxWidth: 820, marginBottom: 18 }}>
          <p style={{ margin: 0 }}><strong>This week:</strong> {week.instruction}</p>
        </div>
      )}
      {week?.discussion && (
        <div className="card" style={{ maxWidth: 820, marginBottom: 18 }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Discussion question</p>
          <p style={{ margin: 0 }}>{week.discussion}</p>
        </div>
      )}

      <form action={save} style={{ maxWidth: 820 }}>
        <input type="hidden" name="entryId" value={entry.id} />

        <div className="card" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "0 1 170px" }}>
              <label htmlFor="entry_date">Date</label>
              <input id="entry_date" name="entry_date" type="date"
                     defaultValue={String(entry.entry_date).slice(0, 10)} />
            </div>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="context">Practice / context</label>
              <select id="context" name="context" defaultValue={entry.context}>
                {CONTEXTS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: "2 1 240px" }}>
              <label htmlFor="reading_ref">Reading</label>
              <input id="reading_ref" name="reading_ref" defaultValue={entry.reading_ref}
                     list="wk" />
              <datalist id="wk">
                {readings.map((r: string) => <option key={r} value={r} />)}
              </datalist>
            </div>
          </div>
        </div>

        {/* ARRIVE — before analysis */}
        <section className="card stage stage-read" style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: 4 }}>Arrive in your body</h2>
          <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
            Before analysing the reading, pause.
          </p>
          {ARRIVE.map((a) => (
            <div className="field" key={a.key}>
              <label htmlFor={a.key}>{a.n}. {a.label}</label>
              <textarea id={a.key} name={a.key} rows={a.n === 4 ? 3 : 2}
                        defaultValue={entry[a.key] ?? ""} />
            </div>
          ))}
        </section>

        {/* REQUIRED — syllabus-mandated, visually distinct, never removable */}
        <section style={{ marginBottom: 22, border: "2px solid var(--gold)", borderRadius: 12,
                          padding: "24px 26px", background: "var(--card)" }}>
          <p className="eyebrow" style={{ color: "var(--gold)" }}>Required by the syllabus</p>
          <h2 style={{ fontSize: "1.15rem", marginBottom: 4 }}>Embodied inquiry</h2>
          <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
            These four appear in every entry and cannot be removed.
          </p>
          {REQUIRED.map((r) => (
            <div className="field" key={r.key}>
              <label htmlFor={r.key} style={{ fontSize: ".97rem" }}>
                {r.n}. {r.label}
              </label>
              <textarea id={r.key} name={r.key} rows={4} defaultValue={entry[r.key] ?? ""} />
            </div>
          ))}
        </section>

        {/* READING → BODY */}
        <section className="card stage stage-connect" style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: 4 }}>Reading → body connection</h2>
          <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
            What specifically in today&rsquo;s reading produced a bodily response, resonance,
            or resistance?
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="trigger_author">Author</label>
              <input id="trigger_author" name="trigger_author"
                     defaultValue={entry.trigger_author} />
            </div>
            <div className="field" style={{ flex: "2 1 220px" }}>
              <label htmlFor="trigger_concept">Concept or idea</label>
              <input id="trigger_concept" name="trigger_concept"
                     defaultValue={entry.trigger_concept} />
            </div>
            <div className="field" style={{ flex: "0 1 110px" }}>
              <label htmlFor="trigger_page">Page</label>
              <input id="trigger_page" name="trigger_page" defaultValue={entry.trigger_page} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="trigger_quote">Quote</label>
            <textarea id="trigger_quote" name="trigger_quote" rows={3}
                      defaultValue={entry.trigger_quote} />
          </div>
          {CONNECTION.map((c) => (
            <div className="field" key={c.key}>
              <label htmlFor={c.key}>{c.label}</label>
              <textarea id={c.key} name={c.key} rows={c.key === "deepens" ? 5 : 3}
                        defaultValue={entry[c.key] ?? ""} />
              {"note" in c && c.note && (
                <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
                  {c.note}
                </p>
              )}
            </div>
          ))}
        </section>

        <button className="btn btn-primary">Save entry</button>
        <span style={{ color: "var(--muted)", fontSize: ".86rem", marginLeft: 14 }}>
          Last saved {new Date(entry.updated_at).toLocaleString()}
        </span>
      </form>

      <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 24, maxWidth: 700 }}>
        This writing is yours. Nothing in this journal is generated for you — the platform
        will organise your entries and surface patterns across them, but the reflection
        submitted for your course must be, and remains, your own words.
      </p>
    </>
  );
}
