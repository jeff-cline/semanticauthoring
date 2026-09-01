import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicShell } from "@/components/Chrome";
import SubscribeForm from "@/components/SubscribeForm";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

async function load(handle: string) {
  return one<any>(
    `SELECT p.*, u.id AS user_id, u.name AS user_name
       FROM profiles p JOIN users u ON u.id = p.user_id
      WHERE p.handle = $1 AND p.is_public = TRUE`, [handle]).catch(() => null);
}

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const p = await load(handle);
  if (!p) return { title: "Scholar not found", robots: { index: false } };
  const name = p.display_name || p.user_name;
  const desc = p.headline || p.bio?.slice(0, 180) || `Scholarship by ${name}.`;
  return {
    title: name,
    description: desc,
    alternates: { canonical: `/s/${p.handle}` },
    openGraph: { type: "profile", title: name, description: desc, url: `/s/${p.handle}` },
    twitter: { card: "summary_large_image", title: name, description: desc },
  };
}

export default async function ScholarProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await load(handle);
  if (!p) notFound();

  const [pubs, testimonials, milestones] = await Promise.all([
    q<any>(`SELECT slug, title, subtitle, abstract, kind, topic, tags, reading_time, published_at
              FROM publications WHERE owner_id=$1 AND status='published'
             ORDER BY published_at DESC`, [p.user_id]),
    q<any>(`SELECT author_name, author_role, author_institution, body
              FROM testimonials WHERE owner_id=$1 AND status='published'
             ORDER BY published_at DESC LIMIT 6`, [p.user_id]),
    p.show_timeline
      ? q<any>(`SELECT title, detail, achieved_at FROM milestones
                 WHERE owner_id=$1 AND visibility='public' ORDER BY achieved_at DESC LIMIT 20`,
        [p.user_id])
      : Promise.resolve([]),
  ]);

  const name = p.display_name || p.user_name;
  const social = String(p.social || "").split("\n").map((s: string) => s.trim()).filter(Boolean);

  const ld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: `${SITE}/s/${p.handle}`,
    description: p.headline || undefined,
    jobTitle: p.degree || undefined,
    affiliation: p.institution ? { "@type": "Organization", name: p.institution } : undefined,
    identifier: p.orcid ? `https://orcid.org/${p.orcid}` : undefined,
    knowsAbout: p.interests ? p.interests.split(",").map((s: string) => s.trim()) : undefined,
    sameAs: [p.website, ...social].filter(Boolean),
  };

  return (
    <PublicShell>
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <section className="wrap" style={{ padding: "64px 24px 0" }}>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)", gap: 40 }}>
          <div>
            <p className="eyebrow">Scholar</p>
            <h1 style={{ marginBottom: 6 }}>{name}</h1>
            {p.headline && <p className="lede" style={{ marginBottom: 10 }}>{p.headline}</p>}
            <p style={{ color: "var(--muted)", marginTop: 0 }}>
              {[p.degree, p.program, p.institution].filter(Boolean).join(" · ")}
            </p>

            {p.bio && (
              <div style={{ margin: "26px 0" }}>
                <p style={{ whiteSpace: "pre-wrap" }}>{p.bio}</p>
              </div>
            )}

            {p.interests && (
              <p style={{ margin: "0 0 20px" }}>
                {p.interests.split(",").map((t: string) => (
                  <span key={t} className="pill" style={{ marginRight: 6 }}>{t.trim()}</span>
                ))}
              </p>
            )}

            <p style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {p.orcid && (
                <a href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer">
                  ORCID {p.orcid}
                </a>
              )}
              {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer">Website</a>}
              {social.map((s: string) => (
                <a key={s} href={s} target="_blank" rel="noopener noreferrer">
                  {(() => { try { return new URL(s).hostname.replace("www.", ""); } catch { return s; } })()}
                </a>
              ))}
            </p>

            <h2 style={{ marginTop: 44 }}>
              {pubs.length > 0 ? `Published work (${pubs.length})` : "Published work"}
            </h2>
            {pubs.length === 0 && (
              <p style={{ color: "var(--muted)" }}>Nothing published yet.</p>
            )}
            {pubs.map((pub: any) => (
              <article key={pub.slug} className="card stage stage-publish" style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: "1.15rem", marginBottom: 4 }}>
                  <Link href={`/s/${p.handle}/${pub.slug}`}>{pub.title}</Link>
                </h3>
                {pub.subtitle && (
                  <p style={{ color: "var(--muted)", margin: "0 0 8px" }}>{pub.subtitle}</p>
                )}
                {pub.abstract && (
                  <p style={{ color: "var(--muted)", fontSize: ".95rem" }}>
                    {pub.abstract.slice(0, 220)}{pub.abstract.length > 220 ? "…" : ""}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="pill">{pub.kind.replace(/_/g, " ")}</span>
                  {pub.topic && <span className="pill">{pub.topic}</span>}
                  <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                    {pub.reading_time} min read
                    {pub.published_at && ` · ${new Date(pub.published_at).toLocaleDateString(
                      undefined, { year: "numeric", month: "long", day: "numeric" })}`}
                  </span>
                </div>
              </article>
            ))}

            {milestones.length > 0 && (
              <>
                <h2 style={{ marginTop: 44 }}>Timeline</h2>
                {milestones.map((m: any, i: number) => (
                  <div key={i} style={{ borderLeft: "3px solid var(--gold)", paddingLeft: 16,
                                        marginBottom: 16 }}>
                    <strong style={{ color: "var(--gold)" }}>{m.title}</strong>
                    {m.detail && <p style={{ margin: "2px 0", color: "var(--muted)" }}>{m.detail}</p>}
                    <span style={{ color: "var(--muted)", fontSize: ".82rem" }}>
                      {new Date(m.achieved_at).toLocaleDateString(undefined,
                        { year: "numeric", month: "long" })}
                    </span>
                  </div>
                ))}
              </>
            )}

            {testimonials.length > 0 && (
              <>
                <h2 style={{ marginTop: 44 }}>Endorsements</h2>
                {testimonials.map((t: any, i: number) => (
                  <blockquote key={i} className="card" style={{ margin: "0 0 14px" }}>
                    <p style={{ fontStyle: "italic", fontSize: "1.02rem" }}>&ldquo;{t.body}&rdquo;</p>
                    <footer style={{ color: "var(--muted)", fontSize: ".9rem" }}>
                      — {t.author_name}
                      {t.author_role ? `, ${t.author_role}` : ""}
                      {t.author_institution ? `, ${t.author_institution}` : ""}
                    </footer>
                  </blockquote>
                ))}
              </>
            )}
          </div>

          <aside>
            <SubscribeForm scholarId={p.user_id} scholarName={name} />
            <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 18 }}>
              <Link href="/scholars">Browse all scholars →</Link>
            </p>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}
