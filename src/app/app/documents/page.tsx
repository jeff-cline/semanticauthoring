import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { humanSize } from "@/lib/saved-exports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved documents" };

const KIND_LABEL: Record<string, string> = {
  inquiry: "Embodied Inquiry Journal",
  journal: "Daily Scholar Journal",
};

const WHEN = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

export default async function SavedDocuments() {
  const user = await requireUser();
  const docs = await q<any>(
    `SELECT id, kind, title, scope, filename, size_bytes, created_at
       FROM saved_exports WHERE owner_id=$1 ORDER BY created_at DESC`,
    [user.id],
  ).catch(() => []);

  return (
    <>
      <p className="eyebrow">Your work</p>
      <h1 style={{ marginBottom: 6 }}>Saved documents</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700, marginTop: 0 }}>
        Every Word document you have exported, kept exactly as it was generated. If you hand
        one in and are later asked what you submitted, this is the answer — regenerating from
        the journal today would produce a different document, because you have kept writing.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0 26px" }}>
        <Link href="/app/inquiry/export" className="pill" style={{ textDecoration: "none" }}>
          Export Embodied Inquiry →
        </Link>
        <Link href="/app/journal/export" className="pill" style={{ textDecoration: "none" }}>
          Export Daily Journal →
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="card" style={{ maxWidth: 680 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Nothing exported yet. Documents you export will appear here so you can download
            them again without rebuilding them.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
          {docs.map((d: any) => (
            <div key={d.id} className="card"
                 style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <strong>{KIND_LABEL[d.kind] ?? d.title}</strong>
                {d.scope && (
                  <span className="pill" style={{ marginLeft: 8 }}>{d.scope}</span>
                )}
                <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: ".84rem",
                            overflowWrap: "anywhere" }}>
                  {WHEN.format(new Date(d.created_at))} · {humanSize(Number(d.size_bytes ?? 0))}
                  {" · "}{d.filename}
                </p>
              </div>
              <a className="btn btn-secondary" href={`/app/documents/${d.id}`} download>
                Download ↓
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
