import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { can } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

// Two views over the same rows: a month grid and a list. Readings appear twice —
// once on the day they are due, and once on the day the scholar needs to START
// to arrive prepared. Backward planning is the whole point: a deadline you see
// on the day it falls is a deadline you have already missed.

const MS_DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Calendar(
  { searchParams }: { searchParams: Promise<{ m?: string; view?: string }> },
) {
  const user = (await currentUser())!;
  const { m, view } = await searchParams;
  const listView = view === "list";

  const today = new Date();
  const cursor = m ? new Date(`${m}-01T00:00:00Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  const items = can(user, "courses")
    ? await q<any>(
        `SELECT i.*, c.title AS course_title, c.id AS course_id, s.title AS source_title
           FROM course_items i
           JOIN courses c ON c.id = i.course_id
           LEFT JOIN sources s ON s.id = i.source_id
          WHERE i.owner_id=$1 AND i.extracted=FALSE
            AND (i.due_on IS NOT NULL OR i.start_on IS NOT NULL)
          ORDER BY i.due_on NULLS LAST`, [user.id])
    : [];

  const submissions = await q<any>(
    `SELECT id, title, venue, revision_due, submitted_on FROM submissions
      WHERE owner_id=$1 AND revision_due IS NOT NULL`, [user.id]).catch(() => []);

  const chapters = await q<any>(
    `SELECT id, title, due_on FROM dissertation_chapters
      WHERE owner_id=$1 AND due_on IS NOT NULL`, [user.id]).catch(() => []);

  type Ev = { date: string; label: string; kind: string; href: string; accent: string; sub?: string };
  const events: Ev[] = [];

  for (const i of items) {
    if (i.due_on) {
      events.push({
        date: iso(new Date(i.due_on)), label: i.title, kind: i.kind,
        href: `/app/courses/${i.course_id}`, sub: i.course_title,
        accent: i.kind === "assignment" ? "var(--coral)"
              : i.kind === "discussion" ? "var(--review)" : "var(--current)",
      });
    }
    if (i.start_on && i.kind === "reading") {
      events.push({
        date: iso(new Date(i.start_on)), label: `Start: ${i.title}`, kind: "start",
        href: `/app/courses/${i.course_id}`, sub: `${i.lead_days} days before due`,
        accent: "var(--seaglass)",
      });
    }
  }
  for (const s of submissions) {
    events.push({ date: iso(new Date(s.revision_due)), label: `Revision due — ${s.title}`,
      kind: "revision", href: "/app/pipeline", sub: s.venue, accent: "var(--gold)" });
  }
  for (const ch of chapters) {
    events.push({ date: iso(new Date(ch.due_on)), label: ch.title, kind: "chapter",
      href: "/app/dissertation", sub: "dissertation", accent: "var(--midnight)" });
  }

  const byDay = new Map<string, Ev[]>();
  for (const e of events) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }

  // Month grid, Monday-first.
  const startPad = (first.getUTCDay() + 6) % 7;
  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: last.getUTCDate() }, (_, i) => new Date(Date.UTC(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 7);
  const monthName = first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  const upcoming = events
    .filter((e) => new Date(e.date).getTime() >= Date.now() - MS_DAY)
    .sort((a, b) => a.date.localeCompare(b.date));

  async function shift(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("itemId"));
    const due = String(formData.get("due_on") ?? "");
    const lead = Number(formData.get("lead_days") ?? 0) || 0;
    const owned = await one(`SELECT id FROM course_items WHERE id=$1 AND owner_id=$2`, [id, me.id]);
    if (!owned) return;
    await q(
      `UPDATE course_items
          SET due_on = $1,
              lead_days = $2,
              start_on = CASE WHEN $1::date IS NOT NULL
                              THEN $1::date - ($2 || ' days')::interval ELSE NULL END,
              updated_at = now()
        WHERE id=$3`, [due || null, lead, id]);
    revalidatePath("/app/calendar");
  }

  return (
    <>
      <p className="eyebrow">Plan</p>
      <h1>Calendar</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        Every due date, plus the day you need to <em>start</em> each reading to arrive
        prepared. A deadline you first see on the day it falls is a deadline you have
        already missed.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
                    margin: "22px 0" }}>
        <Link href={`/app/calendar?m=${prev}${listView ? "&view=list" : ""}`}
              className="btn btn-secondary" style={{ padding: "8px 14px" }}>←</Link>
        <strong style={{ fontFamily: "var(--serif)", fontSize: "1.2rem", minWidth: 200 }}>
          {monthName}
        </strong>
        <Link href={`/app/calendar?m=${next}${listView ? "&view=list" : ""}`}
              className="btn btn-secondary" style={{ padding: "8px 14px" }}>→</Link>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href={`/app/calendar?m=${year}-${String(month + 1).padStart(2, "0")}`}
                className="pill" style={{ textDecoration: "none",
                  background: listView ? "transparent" : "rgba(23,107,115,.14)" }}>Month</Link>
          <Link href={`/app/calendar?view=list`} className="pill"
                style={{ textDecoration: "none",
                  background: listView ? "rgba(23,107,115,.14)" : "transparent" }}>List</Link>
        </span>
      </div>

      {events.length === 0 && (
        <div className="card" style={{ maxWidth: 640 }}>
          <p style={{ margin: 0 }}>Nothing scheduled yet.</p>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            <Link href="/app/courses">Add a course</Link> — or import a syllabus PDF and let it
            fill this in.
          </p>
        </div>
      )}

      {!listView && events.length > 0 && (
        <div className="card" style={{ padding: 12, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(110px,1fr))",
                        gap: 1, background: "var(--line)", minWidth: 780 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} style={{ background: "var(--card)", padding: "8px 10px",
                                    fontSize: ".74rem", letterSpacing: ".1em",
                                    textTransform: "uppercase", color: "var(--muted)" }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              const key = d ? iso(d) : `pad-${i}`;
              const evs = d ? (byDay.get(iso(d)) ?? []) : [];
              const isToday = d && iso(d) === iso(today);
              return (
                <div key={key} style={{ background: "var(--card)", minHeight: 96,
                                        padding: "6px 8px",
                                        outline: isToday ? "2px solid var(--current)" : "none",
                                        outlineOffset: -2 }}>
                  {d && (
                    <div style={{ fontSize: ".78rem", color: isToday ? "var(--current)" : "var(--muted)",
                                  fontWeight: isToday ? 700 : 400 }}>
                      {d.getUTCDate()}
                    </div>
                  )}
                  {evs.map((e, j) => (
                    <Link key={j} href={e.href}
                          style={{ display: "block", fontSize: ".76rem", lineHeight: 1.3,
                                   marginTop: 4, paddingLeft: 6, textDecoration: "none",
                                   borderLeft: `3px solid ${e.accent}`, color: "var(--fg)" }}>
                      {e.label.slice(0, 42)}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {listView && (
        <div>
          {upcoming.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing upcoming.</p>}
          {upcoming.map((e, i) => {
            const late = new Date(e.date).getTime() < Date.now() - MS_DAY;
            return (
              <div key={i} className="card" style={{ marginBottom: 8, padding: 14,
                   borderLeft: `3px solid ${e.accent}`, display: "flex", gap: 14,
                   flexWrap: "wrap", alignItems: "center" }}>
                <strong style={{ minWidth: 110, color: late ? "var(--coral-ink)" : "var(--fg)" }}>
                  {new Date(e.date).toLocaleDateString(undefined,
                    { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                </strong>
                <span style={{ flex: "1 1 260px" }}>
                  <Link href={e.href}>{e.label}</Link>
                  {e.sub && <span style={{ color: "var(--muted)" }}> · {e.sub}</span>}
                </span>
                <span className="pill">{e.kind}</span>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginTop: 36 }}>Adjust dates</h2>
          <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>
            Change a due date or the lead time and the start date recalculates.
          </p>
          {items.filter((i: any) => i.due_on).map((i: any) => (
            <form key={i.id} action={shift} className="card"
                  style={{ marginBottom: 8, padding: 14, display: "flex", gap: 12,
                           flexWrap: "wrap", alignItems: "flex-end" }}>
              <input type="hidden" name="itemId" value={i.id} />
              <span style={{ flex: "2 1 260px" }}>
                <strong style={{ fontSize: ".93rem" }}>{i.title}</strong>
                <span style={{ display: "block", color: "var(--muted)", fontSize: ".82rem" }}>
                  {i.course_title} · {i.kind}
                  {i.start_on && ` · start ${new Date(i.start_on).toLocaleDateString(undefined,
                    { month: "short", day: "numeric" })}`}
                </span>
              </span>
              <div className="field" style={{ marginBottom: 0, flex: "0 1 165px" }}>
                <label htmlFor={`d${i.id}`}>Due</label>
                <input id={`d${i.id}`} name="due_on" type="date"
                       defaultValue={String(i.due_on).slice(0, 10)} />
              </div>
              <div className="field" style={{ marginBottom: 0, flex: "0 1 120px" }}>
                <label htmlFor={`l${i.id}`}>Lead days</label>
                <input id={`l${i.id}`} name="lead_days" type="number" min={0} max={90}
                       defaultValue={i.lead_days} />
              </div>
              <button className="btn btn-secondary" style={{ padding: "10px 16px" }}>Save</button>
            </form>
          ))}
        </>
      )}
    </>
  );
}
