import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import MobileCapture from "@/components/MobileCapture";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Capture",
  robots: { index: false },
};

// The phone screen. Optimised for the thing a phone is actually good for:
// getting a thought down in seconds, and reading what you already wrote.

export default async function Mobile() {
  const user = (await currentUser())!;

  const [recent, today, counts] = await Promise.all([
    q<any>(`SELECT id, body, kind, created_at FROM captures
             WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 8`, [user.id]),
    one<any>(`SELECT intention FROM journal_entries
               WHERE owner_id=$1 AND entry_date=CURRENT_DATE`, [user.id]).catch(() => null),
    one<any>(`SELECT
        (SELECT count(*)::int FROM captures WHERE owner_id=$1 AND processed=FALSE) AS inbox,
        (SELECT count(*)::int FROM sources WHERE owner_id=$1 AND read_status='unread') AS unread`,
      [user.id]),
  ]);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <p className="eyebrow">Capture</p>
      <h1 style={{ fontSize: "1.7rem", marginBottom: 6 }}>Get it down.</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: ".95rem" }}>
        Connect it later — the point is that it takes seconds now.
      </p>

      {today?.intention && (
        <div className="card stage stage-publish" style={{ margin: "16px 0", padding: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Today&rsquo;s intention</p>
          <p style={{ margin: 0 }}>{today.intention}</p>
        </div>
      )}

      <div className="card" style={{ margin: "18px 0", padding: 18 }}>
        <MobileCapture />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        {[["Journal", "/app/journal"], ["Embodied Inquiry", "/app/inquiry"],
          ["My reading", "/app/reading"], ["Questions", "/app/questions"],
          ["Library", "/app/library"], ["Full workspace", "/app"]].map(([l, h]) => (
          <Link key={h} href={h} className="pill" style={{ textDecoration: "none",
                padding: "10px 16px", fontSize: ".9rem" }}>{l}</Link>
        ))}
      </div>

      <div style={{ display: "flex", gap: 20, marginBottom: 22 }}>
        <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>
          <strong style={{ color: "var(--current)" }}>{counts?.inbox ?? 0}</strong> in your inbox
        </span>
        <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>
          <strong style={{ color: "var(--midnight)" }}>{counts?.unread ?? 0}</strong> unread sources
        </span>
      </div>

      {recent.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.05rem" }}>Recently captured</h2>
          {recent.map((c: any) => (
            <div key={c.id} className="card" style={{ marginBottom: 8, padding: 14 }}>
              <span className="pill">{c.kind}</span>
              <p style={{ margin: "6px 0 0", fontSize: ".95rem" }}>{c.body}</p>
              <span style={{ color: "var(--muted)", fontSize: ".76rem" }}>
                {new Date(c.created_at).toLocaleString()}
              </span>
            </div>
          ))}
          <p style={{ marginTop: 12 }}><Link href="/app/capture">All captures →</Link></p>
        </>
      )}

      <div className="card" style={{ marginTop: 26, padding: 16 }}>
        <h2 style={{ fontSize: "1rem" }}>Install this on your phone</h2>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", marginBottom: 0 }}>
          <strong>iPhone:</strong> Share → Add to Home Screen.{" "}
          <strong>Android:</strong> menu → Install app. It then opens full-screen like an app,
          and capture keeps working with no signal.
        </p>
      </div>
    </div>
  );
}
