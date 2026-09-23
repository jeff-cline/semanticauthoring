import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import JournalExportPicker from "@/components/JournalExportPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export daily journal" };

export default async function ExportDailyJournal() {
  const user = await requireUser();
  const [counts, span] = await Promise.all([
    one<any>(`SELECT count(*)::int AS entries FROM journal_entries WHERE owner_id=$1`,
      [user.id]),
    one<any>(`SELECT min(entry_date) AS first, max(entry_date) AS last
                FROM journal_entries WHERE owner_id=$1`, [user.id]),
  ]);

  const total = Number(counts?.entries ?? 0);
  const iso = (d: any) => (d ? String(d).slice(0, 10) : null);

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/journal">← Daily journal</Link></p>
      <p className="eyebrow">Daily Scholar Journal</p>
      <h1>Export your journal</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        A Word document, one section per day, with the prompt you were given and the answer
        you wrote. Export everything, this year, or any range of dates.
      </p>

      {total === 0 ? (
        <div className="card" style={{ maxWidth: 680, marginTop: 22 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            There is nothing to export yet.{" "}
            <Link href="/app/journal">Write today&rsquo;s entry →</Link>
          </p>
        </div>
      ) : (
        <JournalExportPicker
          total={total}
          first={iso(span?.first)}
          last={iso(span?.last)}
        />
      )}
    </>
  );
}
