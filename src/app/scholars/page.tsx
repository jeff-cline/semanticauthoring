import Link from "next/link";
import { PublicShell } from "@/components/Chrome";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Scholars",
  description: "Discover scholars publishing on Semantic Authoring and follow their work.",
};

export default async function Scholars() {
  const rows = await q<any>(
    `SELECT pr.handle, pr.display_name, pr.headline, pr.institution, pr.program, pr.interests,
            u.name AS user_name,
            (SELECT count(*) FROM publications pb
              WHERE pb.owner_id = pr.user_id AND pb.status='published') AS pubs
       FROM profiles pr JOIN users u ON u.id = pr.user_id
      WHERE pr.is_public = TRUE ORDER BY pubs DESC, pr.updated_at DESC LIMIT 200`)
    .catch(() => []);

  return (
    <PublicShell>
      <section className="wrap" style={{ padding: "64px 24px 0" }}>
        <div className="narrow">
          <p className="eyebrow">Discover</p>
          <h1>Scholars</h1>
          <p className="lede">
            Follow the people whose thinking you want to keep up with.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ marginTop: 30, maxWidth: 620 }}>
            <p style={{ margin: 0 }}>No public profiles yet.</p>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              Scholars choose whether to appear here — profiles are private until switched on.{" "}
              <Link href="/join">Start your workspace →</Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-2" style={{ marginTop: 30 }}>
            {rows.map((r: any) => (
              <Link key={r.handle} href={`/s/${r.handle}`} className="card stage stage-connect"
                    style={{ textDecoration: "none", color: "inherit" }}>
                <h3 style={{ fontSize: "1.05rem", marginBottom: 4 }}>
                  {r.display_name || r.user_name}
                </h3>
                {r.headline && <p style={{ margin: "0 0 6px" }}>{r.headline}</p>}
                <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>
                  {[r.program, r.institution].filter(Boolean).join(" · ")}
                </p>
                <span className="pill" style={{ marginTop: 8, display: "inline-block" }}>
                  {r.pubs} published
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
