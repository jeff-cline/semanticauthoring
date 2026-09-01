import Link from "next/link";
import { PublicShell } from "@/components/Chrome";
import { q } from "@/lib/db";
import { liveTopics } from "@/lib/search";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover scholarship",
  description: "Browse recently published essays, research notes, and working papers by topic.",
};

export default async function Discover(
  { searchParams }: { searchParams: Promise<{ topic?: string }> },
) {
  const { topic } = await searchParams;

  const [topics, recent] = await Promise.all([
    liveTopics().catch(() => []),
    q<any>(
      `SELECT pub.slug, pub.title, pub.subtitle, pub.abstract, pub.kind, pub.topic,
              pub.reading_time, pub.published_at, pr.handle, pr.display_name, u.name AS user_name
         FROM publications pub
         JOIN profiles pr ON pr.user_id = pub.owner_id AND pr.is_public = TRUE
         JOIN users u ON u.id = pub.owner_id
        WHERE pub.status='published' ${topic ? "AND pub.topic = $1" : ""}
        ORDER BY pub.published_at DESC NULLS LAST LIMIT 60`,
      topic ? [topic] : []).catch(() => []),
  ]);

  return (
    <PublicShell>
      <section className="wrap" style={{ padding: "64px 24px 0" }}>
        <div className="narrow">
          <p className="eyebrow">Discover</p>
          <h1>{topic ? topic : "Published scholarship"}</h1>
          <p className="lede">
            Work scholars have chosen to make public — essays, research notes, working papers,
            and reflections.
          </p>
        </div>

        {topics.length > 0 && (
          <p style={{ margin: "26px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/discover" className="pill" style={{ textDecoration: "none" }}>All</Link>
            {topics.map((t: any) => (
              <Link key={t.topic} href={`/discover?topic=${encodeURIComponent(t.topic)}`}
                    className="pill" style={{ textDecoration: "none" }}>
                {t.topic} ({t.n})
              </Link>
            ))}
          </p>
        )}

        {recent.length === 0 ? (
          <div className="card" style={{ marginTop: 24, maxWidth: 640 }}>
            <p style={{ margin: 0 }}>Nothing published yet.</p>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              This page fills as founding scholars publish their first work.{" "}
              <Link href="/join">Start your workspace →</Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-2" style={{ marginTop: 24 }}>
            {recent.map((p: any) => (
              <article key={`${p.handle}/${p.slug}`} className="card stage stage-publish">
                <h3 style={{ fontSize: "1.08rem", marginBottom: 4 }}>
                  <Link href={`/s/${p.handle}/${p.slug}`}>{p.title}</Link>
                </h3>
                {p.subtitle && <p style={{ color: "var(--muted)", margin: "0 0 6px" }}>{p.subtitle}</p>}
                {p.abstract && (
                  <p style={{ fontSize: ".93rem", margin: "0 0 8px" }}>
                    {p.abstract.slice(0, 180)}{p.abstract.length > 180 ? "…" : ""}
                  </p>
                )}
                <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: 0 }}>
                  <Link href={`/s/${p.handle}`}>{p.display_name || p.user_name}</Link>
                  {` · ${p.reading_time} min read`}
                  {p.published_at && ` · ${new Date(p.published_at).toLocaleDateString()}`}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
