import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicShell } from "@/components/Chrome";
import SubscribeForm from "@/components/SubscribeForm";
import ProfileContact from "@/components/ProfileContact";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

// semanticauthoring.org/first-last — the canonical public address for a scholar.
//
// Next resolves static segments before dynamic ones, so /login, /about, /pricing
// and every other real page still win; this only sees what nothing else claimed.
// Anything that is not a published handle 404s, exactly as before this existed.

async function load(handle: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(handle)) return null;
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
  const url = `${SITE}/${p.handle}`;
  return {
    title: name,
    description: desc,
    keywords: p.interests ? p.interests.split(",").map((s: string) => s.trim()) : undefined,
    alternates: { canonical: `/${p.handle}` },
    openGraph: {
      type: "profile", title: name, description: desc, url,
      images: p.avatar_url ? [{ url: p.avatar_url, alt: p.avatar_alt || name }] : undefined,
    },
    twitter: {
      card: p.avatar_url ? "summary_large_image" : "summary",
      title: name, description: desc,
      images: p.avatar_url ? [p.avatar_url] : undefined,
    },
  };
}

export default async function ScholarProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await load(handle);
  if (!p) notFound();

  const [pubs, testimonials, milestones] = await Promise.all([
    // on_profile is the scholar's explicit "show this here" decision, separate
    // from publishing — she can publish quietly without it appearing up front.
    q<any>(`SELECT slug, title, subtitle, abstract, kind, topic, tags, reading_time, published_at
              FROM publications
             WHERE owner_id=$1 AND status='published' AND on_profile = TRUE
             ORDER BY published_at DESC`, [p.user_id]).catch(() => []),
    q<any>(`SELECT author_name, author_role, author_institution, body
              FROM testimonials WHERE owner_id=$1 AND status='published'
             ORDER BY published_at DESC LIMIT 6`, [p.user_id]).catch(() => []),
    p.show_timeline
      ? q<any>(`SELECT title, detail, achieved_at FROM milestones
                 WHERE owner_id=$1 AND visibility='public' ORDER BY achieved_at DESC LIMIT 20`,
        [p.user_id]).catch(() => [])
      : Promise.resolve([]),
  ]);

  const name = p.display_name || p.user_name;
  const social = String(p.social || "").split("\n").map((s: string) => s.trim()).filter(Boolean);

  // Structured data for search AND answer engines. ProfilePage wrapping a
  // Person is what Google documents for author pages; the publication list
  // gives an answer engine something concrete to cite.
  const ld = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name,
      url: `${SITE}/${p.handle}`,
      description: p.headline || p.bio?.slice(0, 300) || undefined,
      image: p.avatar_url || undefined,
      jobTitle: p.degree || undefined,
      affiliation: p.institution ? { "@type": "Organization", name: p.institution } : undefined,
      identifier: p.orcid ? `https://orcid.org/${p.orcid}` : undefined,
      knowsAbout: p.interests
        ? p.interests.split(",").map((s: string) => s.trim()).filter(Boolean)
        : undefined,
      sameAs: [p.website, ...social].filter(Boolean),
    },
    hasPart: pubs.map((pub: any) => ({
      "@type": "ScholarlyArticle",
      headline: pub.title,
      abstract: pub.abstract || undefined,
      datePublished: pub.published_at || undefined,
      url: `${SITE}/s/${p.handle}/${pub.slug}`,
      author: { "@type": "Person", name },
    })),
  };

  return (
    <PublicShell>
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <section className="wrap" style={{ padding: "64px 24px 0" }}>
        <div className="grid"
             style={{ gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)", gap: 40 }}>
          <div>
            <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
              {p.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.avatar_url}
                  alt={p.avatar_alt || name}
                  width={120} height={120}
                  style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover",
                           flexShrink: 0, border: "1px solid var(--line)" }}
                />
              )}
              <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                <p className="eyebrow">Scholar</p>
                <h1 style={{ marginBottom: 6 }}>{name}</h1>
                {p.headline && <p className="lede" style={{ marginBottom: 10 }}>{p.headline}</p>}
                <p style={{ color: "var(--muted)", marginTop: 0 }}>
                  {[p.degree, p.program, p.institution].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            <ProfileContact
              handle={p.handle}
              name={name}
              contactEnabled={p.contact_enabled !== false}
              openToCollaboration={!!p.open_to_collaboration}
              collaborationNote={p.collaboration_note || ""}
            />

            {/* Rich About Me when she has written one, plain bio otherwise. The
                HTML is sanitised on save — see /app/profile. */}
            {p.about_html ? (
              <div className="prose" style={{ margin: "26px 0" }}
                   dangerouslySetInnerHTML={{ __html: p.about_html }} />
            ) : p.bio ? (
              <div style={{ margin: "26px 0" }}>
                <p style={{ whiteSpace: "pre-wrap" }}>{p.bio}</p>
              </div>
            ) : null}

            {p.goals && (
              <div className="card stage stage-synthesize" style={{ margin: "0 0 26px" }}>
                <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>What I am working toward</h2>
                <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{p.goals}</p>
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
                  <span className="pill">{String(pub.kind).replace(/_/g, " ")}</span>
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
