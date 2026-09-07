import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export journal" };

export default async function ExportJournal() {
  const user = (await currentUser())!;
  const [settings, counts] = await Promise.all([
    one<any>(`SELECT * FROM inquiry_settings WHERE owner_id=$1`, [user.id]),
    one<any>(`SELECT
        (SELECT count(*)::int FROM inquiry_entries WHERE owner_id=$1) AS entries,
        (SELECT count(*)::int FROM inquiry_synthesis WHERE owner_id=$1) AS syntheses,
        (SELECT count(DISTINCT week)::int FROM inquiry_entries WHERE owner_id=$1) AS weeks`,
      [user.id]),
  ]);

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/inquiry">← Journal</Link></p>
      <p className="eyebrow">Embodied Inquiry Journal</p>
      <h1>Export the semester</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        One Word document, organised by week, with your entries and weekly syntheses in the
        order you wrote them.
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

      <div className="card stage stage-celebrate" style={{ maxWidth: 680 }}>
        <h2 style={{ fontSize: "1.05rem" }}>
          {settings?.scholar_name || user.name}
        </h2>
        <p style={{ color: "var(--muted)", margin: "0 0 18px" }}>
          {settings?.course_title} — {settings?.course_code} · {settings?.term}
        </p>
        <a className="btn btn-primary" href="/app/inquiry/export/journal.docx" download>
          Export semester embodied inquiry journal
        </a>
        <p style={{ color: "var(--muted)", fontSize: ".88rem", marginTop: 16, marginBottom: 0 }}>
          Your original language and dates are preserved exactly. Nothing is rewritten,
          summarised, or edited on the way out — this is your submitted work, and changing it
          during export would be changing your submission.
        </p>
      </div>

      {Number(counts?.entries ?? 0) === 0 && (
        <p style={{ color: "var(--muted)", marginTop: 20 }}>
          There is nothing to export yet. <Link href="/app/inquiry">Write your first entry →</Link>
        </p>
      )}
    </>
  );
}
