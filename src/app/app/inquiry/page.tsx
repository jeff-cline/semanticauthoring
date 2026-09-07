import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { ensureWeeks, CONTEXTS, PRELOADED_WEEKS } from "@/lib/inquiry";

export const dynamic = "force-dynamic";
export const metadata = { title: "Embodied Inquiry Journal" };

export default async function Inquiry() {
  const user = (await currentUser())!;
  await ensureWeeks(user.id);

  const [settings, weeks, entries, syntheses] = await Promise.all([
    one<any>(`SELECT * FROM inquiry_settings WHERE owner_id=$1`, [user.id]),
    q<any>(`SELECT * FROM inquiry_weeks WHERE owner_id=$1 ORDER BY week`, [user.id]),
    q<any>(`SELECT week, count(*)::int AS n, max(entry_date) AS last
              FROM inquiry_entries WHERE owner_id=$1 GROUP BY week`, [user.id]),
    q<any>(`SELECT week FROM inquiry_synthesis WHERE owner_id=$1`, [user.id]),
  ]);

  const byWeek = new Map(entries.map((e: any) => [e.week, e]));
  const synth = new Set(syntheses.map((s: any) => s.week));
  const total = entries.reduce((n: number, e: any) => n + e.n, 0);

  async function start(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const week = Number(formData.get("week"));
    if (!week || week < 1 || week > 15) return;
    const row = await one<{ id: number }>(
      `INSERT INTO inquiry_entries (owner_id, week, entry_date, reading_ref, context)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [me.id, week, String(formData.get("entry_date") ?? "") || new Date().toISOString().slice(0, 10),
       String(formData.get("reading_ref") ?? "").slice(0, 300),
       String(formData.get("context") ?? "Reading")]);
    await logEvent("inquiry_entry", "created", { actorId: me.id, entityId: row?.id });
    redirect(`/app/inquiry/entry/${row!.id}`);
  }

  async function saveSettings(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await q(
      `INSERT INTO inquiry_settings (owner_id, scholar_name, course_title, course_code, term, instructor)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (owner_id) DO UPDATE SET scholar_name=EXCLUDED.scholar_name,
         course_title=EXCLUDED.course_title, course_code=EXCLUDED.course_code,
         term=EXCLUDED.term, instructor=EXCLUDED.instructor, updated_at=now()`,
      [me.id, String(formData.get("scholar_name") ?? "").slice(0, 200),
       String(formData.get("course_title") ?? "").slice(0, 200),
       String(formData.get("course_code") ?? "").slice(0, 60),
       String(formData.get("term") ?? "").slice(0, 60),
       String(formData.get("instructor") ?? "").slice(0, 200)]);
    revalidatePath("/app/inquiry");
  }

  const defaultWeek = weeks.find((w: any) => !byWeek.has(w.week))?.week ?? 1;
  const readingOptions = (w: any) =>
    String(w?.readings || "").split("\n").map((s: string) => s.trim()).filter(Boolean);

  return (
    <>
      <p className="eyebrow">Embodied Inquiry Journal</p>
      <h1 style={{ marginBottom: 4 }}>Notice. Feel. Reflect. Integrate.</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700, marginTop: 0 }}>
        {settings?.course_title} — {settings?.course_code} · {settings?.term}
      </p>

      <div className="card stage stage-synthesize" style={{ margin: "22px 0", maxWidth: 780 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Begin an entry</h2>
        <form action={start}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "0 1 130px" }}>
              <label htmlFor="week">Week</label>
              <select id="week" name="week" defaultValue={defaultWeek}>
                {weeks.map((w: any) => (
                  <option key={w.week} value={w.week}>Week {w.week}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "0 1 170px" }}>
              <label htmlFor="entry_date">Date</label>
              <input id="entry_date" name="entry_date" type="date"
                     defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="context">Practice / context</label>
              <select id="context" name="context">
                {CONTEXTS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="reading_ref">Reading</label>
            <input id="reading_ref" name="reading_ref" list="readings"
                   placeholder="Which reading, film, or practice is this entry about?" />
            <datalist id="readings">
              {weeks.flatMap((w: any) =>
                readingOptions(w).map((r: string) => (
                  <option key={`${w.week}-${r}`} value={r}>Week {w.week}</option>
                )))}
            </datalist>
          </div>
          <button className="btn btn-primary">Arrive in your body →</button>
        </form>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "0 0 22px" }}>
        <span className="pill">{total} entries</span>
        <span className="pill">{synth.size} weekly syntheses</span>
        <Link href="/app/inquiry/export" className="pill" style={{ textDecoration: "none" }}>
          Export semester journal →
        </Link>
      </div>

      <h2 style={{ fontSize: "1.15rem" }}>The semester</h2>
      <div className="grid grid-3">
        {weeks.map((w: any) => {
          const e = byWeek.get(w.week);
          const preloaded = PRELOADED_WEEKS.includes(w.week);
          const accent = w.kind === "experiential" ? "var(--seaglass)"
                       : w.kind === "practice" ? "var(--coral)" : "var(--current)";
          return (
            <Link key={w.week} href={`/app/inquiry/week/${w.week}`} className="card"
                  style={{ textDecoration: "none", color: "inherit",
                           borderLeft: `3px solid ${accent}` }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "baseline" }}>
                <strong>Week {w.week}</strong>
                {e && <span className="pill">{e.n} {e.n === 1 ? "entry" : "entries"}</span>}
              </div>
              {w.theme && <p style={{ margin: "4px 0 0", fontSize: ".93rem" }}>{w.theme}</p>}
              {w.readings && (
                <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: "6px 0 0" }}>
                  {w.readings.split("\n").filter(Boolean).join(" · ")}
                </p>
              )}
              {w.kind !== "reading" && (
                <span className="pill" style={{ marginTop: 8, display: "inline-block",
                                                color: accent }}>
                  {w.kind}
                </span>
              )}
              {!preloaded && !w.readings && !w.theme && (
                <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "8px 0 0",
                            fontStyle: "italic" }}>
                  Not yet loaded from the syllabus
                </p>
              )}
              {synth.has(w.week) && (
                <span className="pill" style={{ marginTop: 8, display: "inline-block",
                                                color: "var(--gold)" }}>synthesis written</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 26, borderLeft: "3px solid var(--gold)",
                                     maxWidth: 780 }}>
        <h2 style={{ fontSize: "1.02rem" }}>Weeks {PRELOADED_WEEKS.join(", ")} are preloaded</h2>
        <p style={{ color: "var(--muted)", fontSize: ".93rem", marginBottom: 0 }}>
          Those are the weeks I have confirmed detail for. The rest are blank and editable —
          open any week to fill in its readings and discussion question, or paste them from
          the syllabus. I have deliberately left them empty rather than guessing, because a
          plausible-looking wrong reading is worse than an obviously missing one.
        </p>
      </div>

      <details className="card" style={{ marginTop: 16, maxWidth: 640 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Course details for export</summary>
        <form action={saveSettings} style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="scholar_name">Your name</label>
            <input id="scholar_name" name="scholar_name"
                   defaultValue={settings?.scholar_name || user.name} /></div>
          <div className="field"><label htmlFor="course_title">Course</label>
            <input id="course_title" name="course_title" defaultValue={settings?.course_title} /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 140px" }}>
              <label htmlFor="course_code">Code</label>
              <input id="course_code" name="course_code" defaultValue={settings?.course_code} /></div>
            <div className="field" style={{ flex: "1 1 140px" }}>
              <label htmlFor="term">Term</label>
              <input id="term" name="term" defaultValue={settings?.term} /></div>
          </div>
          <div className="field"><label htmlFor="instructor">Instructor</label>
            <input id="instructor" name="instructor" defaultValue={settings?.instructor} /></div>
          <button className="btn btn-secondary">Save</button>
        </form>
      </details>
    </>
  );
}
