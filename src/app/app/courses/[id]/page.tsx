import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Course" };

const KINDS = ["reading", "assignment", "discussion", "note"];

export default async function Course({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;
  if (!can(user, "courses")) notFound();

  const course = await one<any>(`SELECT * FROM courses WHERE id=$1 AND owner_id=$2`,
    [Number(id), user.id]);
  if (!course) notFound();

  const [items, sources] = await Promise.all([
    q<any>(`SELECT i.*, s.title AS source_title FROM course_items i
              LEFT JOIN sources s ON s.id = i.source_id
             WHERE i.course_id=$1 ORDER BY i.done, i.due_on NULLS LAST, i.created_at`, [course.id]),
    q<any>(`SELECT id, title FROM sources WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 60`,
      [user.id]),
  ]);

  async function addItem(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const cid = Number(formData.get("courseId"));
    const owned = await one(`SELECT id FROM courses WHERE id=$1 AND owner_id=$2`, [cid, me.id]);
    if (!owned) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const due = String(formData.get("due_on") ?? "");
    const srcRaw = String(formData.get("source_id") ?? "");
    const row = await one<{ id: number }>(
      `INSERT INTO course_items (course_id, owner_id, kind, title, detail, due_on, source_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [cid, me.id, String(formData.get("kind") ?? "reading"), title.slice(0, 400),
       String(formData.get("detail") ?? "").slice(0, 2000),
       due || null, srcRaw ? Number(srcRaw) : null]);
    await logEvent("course_item", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath(`/app/courses/${cid}`);
  }

  async function toggle(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const iid = Number(formData.get("itemId"));
    await q(`UPDATE course_items SET done = NOT done, updated_at=now()
              WHERE id=$1 AND owner_id=$2`, [iid, me.id]);
    revalidatePath(`/app/courses/${formData.get("courseId")}`);
  }

  async function saveSyllabus(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const cid = Number(formData.get("courseId"));
    await q(`UPDATE courses SET syllabus=$1, notes=$2, archived=$3, updated_at=now()
              WHERE id=$4 AND owner_id=$5`,
      [String(formData.get("syllabus") ?? "").slice(0, 20000),
       String(formData.get("notes") ?? "").slice(0, 20000),
       formData.get("archived") === "on", cid, me.id]);
    revalidatePath(`/app/courses/${cid}`);
  }

  const open = items.filter((i: any) => !i.done);
  const done = items.filter((i: any) => i.done);

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/courses">← Courses</Link></p>
      <h1 style={{ marginBottom: 4 }}>{course.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {[course.code, course.term, course.year, course.instructor].filter(Boolean).join(" · ")}
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 24 }}>
        <div>
          <form action={addItem} className="card">
            <h2 style={{ fontSize: "1.05rem" }}>Add to this course</h2>
            <input type="hidden" name="courseId" value={course.id} />
            <div className="field"><label htmlFor="title">Title</label>
              <input id="title" name="title" required /></div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 140px" }}>
                <label htmlFor="kind">Kind</label>
                <select id="kind" name="kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
              </div>
              <div className="field" style={{ flex: "1 1 150px" }}>
                <label htmlFor="due_on">Due</label>
                <input id="due_on" name="due_on" type="date" />
              </div>
            </div>
            {sources.length > 0 && (
              <div className="field">
                <label htmlFor="source_id">Link a source (optional)</label>
                <select id="source_id" name="source_id" defaultValue="">
                  <option value="">— none —</option>
                  {sources.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.title.slice(0, 80)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field"><label htmlFor="detail">Detail</label>
              <textarea id="detail" name="detail" rows={2} /></div>
            <button className="btn btn-primary">Add</button>
          </form>

          <form action={saveSyllabus} className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: "1.05rem" }}>Syllabus and notes</h2>
            <input type="hidden" name="courseId" value={course.id} />
            <div className="field"><label htmlFor="syllabus">Syllabus</label>
              <textarea id="syllabus" name="syllabus" rows={6} defaultValue={course.syllabus} /></div>
            <div className="field"><label htmlFor="notes">Course notes</label>
              <textarea id="notes" name="notes" rows={4} defaultValue={course.notes} /></div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                            color: "var(--muted)", marginBottom: 12 }}>
              <input type="checkbox" name="archived" defaultChecked={course.archived}
                     style={{ width: "auto" }} />
              Archive this course (stays searchable)
            </label>
            <button className="btn btn-secondary">Save</button>
          </form>
        </div>

        <div>
          <h2 style={{ fontSize: "1.05rem" }}>Open ({open.length})</h2>
          {open.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing outstanding.</p>}
          {open.map((i: any) => (
            <div key={i.id} className="card" style={{ marginBottom: 10, padding: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <form action={toggle}>
                  <input type="hidden" name="itemId" value={i.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <button className="btn btn-secondary"
                          style={{ padding: "4px 10px", fontSize: ".8rem" }}>Done</button>
                </form>
                <div style={{ flex: 1 }}>
                  <strong>{i.title}</strong> <span className="pill">{i.kind}</span>
                  {i.due_on && (
                    <span className="pill" style={{ marginLeft: 6 }}>
                      due {new Date(i.due_on).toLocaleDateString(undefined,
                        { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {i.detail && <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>{i.detail}</p>}
                  {i.source_id && (
                    <p style={{ margin: "6px 0 0", fontSize: ".88rem" }}>
                      <Link href={`/app/library/${i.source_id}`}>{i.source_title}</Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {done.length > 0 && (
            <details style={{ marginTop: 18 }}>
              <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
                Completed ({done.length})
              </summary>
              {done.map((i: any) => (
                <div key={i.id} className="card" style={{ marginTop: 8, padding: 12, opacity: .7 }}>
                  <form action={toggle} style={{ display: "inline" }}>
                    <input type="hidden" name="itemId" value={i.id} />
                    <input type="hidden" name="courseId" value={course.id} />
                    <button className="btn btn-secondary"
                            style={{ padding: "3px 9px", fontSize: ".76rem" }}>Undo</button>
                  </form>{" "}
                  {i.title}
                </div>
              ))}
            </details>
          )}
        </div>
      </div>
    </>
  );
}
