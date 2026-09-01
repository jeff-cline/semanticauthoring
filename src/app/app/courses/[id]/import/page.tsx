import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";
import { storeFile } from "@/lib/storage";
import { extractPdfText } from "@/lib/pdf";
import { parseSyllabus, type Extracted } from "@/lib/syllabus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import a syllabus" };

// Extraction is deterministic and always reviewed. Nothing is written to the
// course until the scholar confirms it — a wrong guess must stay a wrong
// suggestion, never a wrong record.

export default async function ImportSyllabus(
  { params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> },
) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = (await currentUser())!;
  if (!can(user, "courses")) notFound();

  const course = await one<any>(
    `SELECT * FROM courses WHERE id=$1 AND owner_id=$2`, [Number(id), user.id]);
  if (!course) notFound();

  // Anything already extracted and awaiting review.
  const pending = await q<any>(
    `SELECT * FROM course_items WHERE course_id=$1 AND extracted=TRUE
      ORDER BY due_on NULLS LAST, id`, [course.id]);

  async function upload(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const cid = Number(formData.get("courseId"));
    const owned = await one<any>(`SELECT id, year FROM courses WHERE id=$1 AND owner_id=$2`,
      [cid, me.id]);
    if (!owned) return;

    const f = formData.get("file");
    if (!(f instanceof File) || f.size === 0) redirect(`/app/courses/${cid}/import?error=nofile`);
    if (f.type !== "application/pdf") redirect(`/app/courses/${cid}/import?error=type`);

    let text = "";
    let stored: { path: string; name: string; size: number } | null = null;
    try {
      stored = await storeFile(me.id, f);
      text = await extractPdfText(new Uint8Array(await f.arrayBuffer()));
    } catch {
      redirect(`/app/courses/${cid}/import?error=read`);
    }

    if (text.trim().length < 40) redirect(`/app/courses/${cid}/import?error=notext`);

    const year = Number(owned.year) || new Date().getFullYear();
    const parsed = parseSyllabus(text, year);

    if (stored) {
      await q(`UPDATE courses SET syllabus_file=$1, syllabus_name=$2, starts_on=COALESCE(starts_on,$3),
                      ends_on=COALESCE(ends_on,$4), updated_at=now() WHERE id=$5`,
        [stored.path, stored.name, parsed.termStart, parsed.termEnd, cid]);
    }

    // Clear any previous unreviewed extraction so a re-upload replaces it.
    await q(`DELETE FROM course_items WHERE course_id=$1 AND extracted=TRUE`, [cid]);

    const all: Extracted[] = [...parsed.items, ...parsed.books];
    for (const it of all.slice(0, 200)) {
      await q(
        `INSERT INTO course_items (course_id, owner_id, kind, title, detail, due_on,
                                   pages, author, extracted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)`,
        [cid, me.id, it.kind, it.title, it.detail, it.dueOn, it.pages, it.author]);
    }
    await logEvent("course", "syllabus_imported", { actorId: me.id, entityId: cid,
      detail: `${all.length} candidates` });
    redirect(`/app/courses/${cid}/import`);
  }

  async function confirm(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const cid = Number(formData.get("courseId"));
    const keep = formData.getAll("keep").map(Number);
    const lead = Number(formData.get("defaultLead") ?? 0) || 0;

    // Accept only what was ticked; drop the rest.
    await q(`DELETE FROM course_items WHERE course_id=$1 AND owner_id=$2 AND extracted=TRUE
              AND NOT (id = ANY($3::int[]))`, [cid, me.id, keep]);

    // Accepted items stop being "extracted" and gain a backward-planned start date.
    await q(
      `UPDATE course_items
          SET extracted=FALSE,
              lead_days = CASE WHEN kind='reading' THEN $1 ELSE 0 END,
              start_on = CASE WHEN kind='reading' AND due_on IS NOT NULL
                              THEN due_on - ($1 || ' days')::interval ELSE NULL END,
              updated_at = now()
        WHERE course_id=$2 AND owner_id=$3 AND extracted=TRUE`,
      [lead, cid, me.id]);

    // Readings that name a book become library sources, so the pieces connect.
    if (formData.get("toLibrary") === "on") {
      const books = await q<any>(
        `SELECT id, title, author FROM course_items
          WHERE course_id=$1 AND owner_id=$2 AND kind='reading' AND source_id IS NULL`,
        [cid, me.id]);
      for (const b of books) {
        const src = await one<{ id: number }>(
          `INSERT INTO sources (owner_id, title, kind, authors, tags)
           VALUES ($1,$2,'book',$3,'from syllabus') RETURNING id`,
          [me.id, b.title.slice(0, 400), b.author ?? ""]);
        if (src) await q(`UPDATE course_items SET source_id=$1 WHERE id=$2`, [src.id, b.id]);
      }
    }
    await logEvent("course", "syllabus_confirmed", { actorId: me.id, entityId: cid });
    redirect(`/app/courses/${cid}`);
  }

  const messages: Record<string, string> = {
    nofile: "Choose a PDF to upload.",
    type: "That needs to be a PDF.",
    read: "That PDF could not be read. If it is a scan, it has no text layer to extract.",
    notext: "No text was found. This is almost always a scanned PDF — it needs OCR first.",
  };

  const byKind = (k: string) => pending.filter((p: any) => p.kind === k);

  return (
    <>
      <p style={{ marginBottom: 8 }}>
        <Link href={`/app/courses/${course.id}`}>← {course.title}</Link>
      </p>
      <p className="eyebrow">Read</p>
      <h1>Import a syllabus</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Upload the PDF and we&rsquo;ll pull out the readings, assignments, and dates.
        Everything found is shown for review — nothing is added to your course until you
        confirm it.
      </p>

      {error && <p className="error">{messages[error] ?? "Something went wrong."}</p>}

      <form action={upload} className="card" style={{ maxWidth: 680, margin: "22px 0 28px" }}>
        <input type="hidden" name="courseId" value={course.id} />
        <div className="field">
          <label htmlFor="file">Syllabus PDF</label>
          <input id="file" name="file" type="file" accept="application/pdf" required />
          <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
            Up to 40 MB. The file is stored privately with the course. A scanned syllabus has
            no text layer and cannot be read without OCR.
          </p>
        </div>
        <button className="btn btn-primary">Read the syllabus</button>
        {course.syllabus_name && (
          <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 12, marginBottom: 0 }}>
            Currently attached: {course.syllabus_name}
          </p>
        )}
      </form>

      {pending.length > 0 && (
        <form action={confirm}>
          <input type="hidden" name="courseId" value={course.id} />

          <div className="card stage stage-review" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.05rem" }}>
              {pending.length} candidates found — keep what&rsquo;s right
            </h2>
            <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>
              Ticked items become part of the course. Confidence reflects how clearly the line
              read as a dated reading or assignment, not whether it is correct — you are the
              judge of that.
            </p>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
                <label htmlFor="defaultLead">Start readings this many days early</label>
                <input id="defaultLead" name="defaultLead" type="number" min={0} max={60}
                       defaultValue={5} />
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                              color: "var(--muted)", fontSize: ".9rem" }}>
                <input type="checkbox" name="toLibrary" defaultChecked style={{ width: "auto" }} />
                Also add readings to my research library
              </label>
            </div>
          </div>

          {(["reading", "assignment", "discussion", "note"] as const).map((kind) => {
            const rows = byKind(kind);
            if (!rows.length) return null;
            return (
              <div key={kind} style={{ marginBottom: 22 }}>
                <h3 style={{ fontSize: "1rem", textTransform: "capitalize" }}>
                  {kind}s ({rows.length})
                </h3>
                {rows.map((p: any) => (
                  <label key={p.id} className="card"
                         style={{ display: "flex", gap: 12, alignItems: "flex-start",
                                  marginBottom: 8, padding: 14, cursor: "pointer",
                                  fontWeight: 400 }}>
                    <input type="checkbox" name="keep" value={p.id}
                           defaultChecked={Boolean(p.due_on) || kind === "reading"}
                           style={{ width: "auto", marginTop: 4 }} />
                    <span style={{ flex: 1 }}>
                      <strong style={{ fontSize: ".95rem" }}>{p.title}</strong>
                      <span style={{ display: "block", marginTop: 4 }}>
                        {p.due_on && (
                          <span className="pill">
                            due {new Date(p.due_on).toLocaleDateString(undefined,
                              { month: "short", day: "numeric" })}
                          </span>
                        )}{" "}
                        {p.author && <span className="pill">{p.author}</span>}{" "}
                        {p.pages && <span className="pill">{p.pages}</span>}
                      </span>
                      <span style={{ display: "block", color: "var(--muted)",
                                     fontSize: ".84rem", marginTop: 4 }}>
                        {p.detail.slice(0, 160)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            );
          })}

          <button className="btn btn-primary">Add the ticked items to this course</button>
        </form>
      )}
    </>
  );
}
