import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses" };

export default async function Courses() {
  const user = (await currentUser())!;
  if (!can(user, "courses")) {
    return (
      <>
        <h1>Courses</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Course organization arrives with the Doctoral tier — syllabus, reading list,
            assignments, and deadlines, with past coursework staying searchable after the
            semester ends.
          </p>
        </div>
      </>
    );
  }

  const rows = await q<any>(
    `SELECT c.*,
            (SELECT count(*) FROM course_items i WHERE i.course_id=c.id) AS items,
            (SELECT count(*) FROM course_items i WHERE i.course_id=c.id AND NOT i.done) AS open
       FROM courses c WHERE c.owner_id=$1 ORDER BY c.archived, c.created_at DESC`, [user.id]);

  const upcoming = await q<any>(
    `SELECT i.*, c.title AS course_title FROM course_items i JOIN courses c ON c.id=i.course_id
      WHERE i.owner_id=$1 AND NOT i.done AND i.due_on IS NOT NULL
      ORDER BY i.due_on LIMIT 12`, [user.id]);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (!can(me, "courses")) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const row = await one<{ id: number }>(
      `INSERT INTO courses (owner_id, title, code, term, year, instructor)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, title.slice(0, 300), String(formData.get("code") ?? "").slice(0, 60),
       String(formData.get("term") ?? "").slice(0, 60), String(formData.get("year") ?? "").slice(0, 12),
       String(formData.get("instructor") ?? "").slice(0, 200)]);
    await logEvent("course", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/courses");
  }

  return (
    <>
      <p className="eyebrow">Read</p>
      <h1>Courses</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Each course keeps its own syllabus, readings, and deadlines — and stays searchable
        long after the semester ends, because the research you did in year one still matters
        in year four.
      </p>

      {upcoming.length > 0 && (
        <div className="card stage stage-review" style={{ margin: "24px 0" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Coming up</h2>
          {upcoming.map((i: any) => {
            const due = new Date(i.due_on);
            const late = due < new Date(new Date().toDateString());
            return (
              <p key={i.id} style={{ margin: "6px 0", fontSize: ".93rem" }}>
                <span style={{ color: late ? "var(--coral-ink)" : "var(--muted)" }}>
                  {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>{" · "}
                <Link href={`/app/courses/${i.course_id}`}>{i.title}</Link>{" "}
                <span className="pill">{i.kind}</span>{" "}
                <span style={{ color: "var(--muted)" }}>{i.course_title}</span>
              </p>
            );
          })}
        </div>
      )}

      <details className="card" style={{ margin: "20px 0 28px", maxWidth: 720 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Add a course</summary>
        <form action={create} style={{ marginTop: 16 }}>
          <div className="field"><label htmlFor="title">Course title</label>
            <input id="title" name="title" required /></div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 130px" }}>
              <label htmlFor="code">Code</label><input id="code" name="code" placeholder="EDU 801" /></div>
            <div className="field" style={{ flex: "1 1 130px" }}>
              <label htmlFor="term">Term</label><input id="term" name="term" placeholder="Fall" /></div>
            <div className="field" style={{ flex: "0 1 110px" }}>
              <label htmlFor="year">Year</label><input id="year" name="year" /></div>
            <div className="field" style={{ flex: "2 1 200px" }}>
              <label htmlFor="instructor">Instructor</label><input id="instructor" name="instructor" /></div>
          </div>
          <button className="btn btn-primary">Add course</button>
        </form>
      </details>

      {rows.length === 0 && <p style={{ color: "var(--muted)" }}>No courses yet.</p>}
      <div className="grid grid-2">
        {rows.map((c: any) => (
          <Link key={c.id} href={`/app/courses/${c.id}`} className="card stage stage-read"
                style={{ textDecoration: "none", color: "inherit", opacity: c.archived ? .65 : 1 }}>
            <h3 style={{ fontSize: "1.02rem", marginBottom: 4 }}>{c.title}</h3>
            <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "0 0 8px" }}>
              {[c.code, c.term, c.year, c.instructor].filter(Boolean).join(" · ") || "—"}
            </p>
            <span className="pill">{c.items} items</span>{" "}
            {Number(c.open) > 0 && <span className="pill">{c.open} open</span>}{" "}
            {c.archived && <span className="pill">archived</span>}
          </Link>
        ))}
      </div>
    </>
  );
}
