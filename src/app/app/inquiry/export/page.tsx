import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import ExportPicker from "@/components/ExportPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export journal" };

export default async function ExportJournal() {
  const user = await requireUser();
  const [settings, counts, weekRows] = await Promise.all([
    one<any>(`SELECT * FROM inquiry_settings WHERE owner_id=$1`, [user.id]),
    one<any>(`SELECT
        (SELECT count(*)::int FROM inquiry_entries WHERE owner_id=$1) AS entries,
        (SELECT count(*)::int FROM inquiry_synthesis WHERE owner_id=$1) AS syntheses,
        (SELECT count(DISTINCT week)::int FROM inquiry_entries WHERE owner_id=$1) AS weeks`,
      [user.id]),
    // Only weeks with something in them are offered — you cannot usefully
    // export a week you have not written.
    q<any>(`SELECT w.week, w.theme,
                   (SELECT count(*)::int FROM inquiry_entries e
                     WHERE e.owner_id=w.owner_id AND e.week=w.week) AS entries,
                   EXISTS (SELECT 1 FROM inquiry_synthesis s
                            WHERE s.owner_id=w.owner_id AND s.week=w.week) AS synthesis
              FROM inquiry_weeks w WHERE w.owner_id=$1 ORDER BY w.week`, [user.id]),
  ]);

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/inquiry">← Journal</Link></p>
      <p className="eyebrow">Embodied Inquiry Journal</p>
      <h1>Export the semester</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        A Word document, organised by week, with your entries and weekly syntheses in the
        order you wrote them. Export the whole journal, a single week, any set of weeks, or
        a date range.
      </p>

      <div className="grid grid-3" style={{ margin: "24px 0", maxWidth: 620 }}>
        {[["Entries", counts?.entries], ["Weeks written", counts?.weeks],
          ["Syntheses", counts?.syntheses]].map(([l, n]) => (
          <div key={l as string} className="card" style={{ padding: 18 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: "1.9rem", color: "var(--current)" }}>
              {Number(n ?? 0)}
            </div>
            <div style={{ color: "var(--muted)", fontSize: ".9rem" }}>{l}</div>
          </div>
        ))}
      </div>

      <p style={{ margin: "0 0 14px", fontSize: ".95rem" }}>
        <strong>{settings?.scholar_name || user.name}</strong>
        <span style={{ color: "var(--muted)" }}>
          {" · "}{settings?.course_title} — {settings?.course_code} · {settings?.term}
        </span>
      </p>

      <ExportPicker weeks={weekRows.map((w: any) => ({
        week: w.week,
        theme: w.theme ?? "",
        entries: Number(w.entries ?? 0),
        synthesis: Boolean(w.synthesis),
      }))} />

      {Number(counts?.entries ?? 0) === 0 && (
        <p style={{ color: "var(--muted)", marginTop: 20 }}>
          There is nothing to export yet. <Link href="/app/inquiry">Write your first entry →</Link>
        </p>
      )}
    </>
  );
}
