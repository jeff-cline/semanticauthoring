import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicShell } from "@/components/Chrome";
import SubscribeForm from "@/components/SubscribeForm";
import ShareRow from "@/components/ShareRow";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

async function load(handle: string, slug: string) {
  return one<any>(
    `SELECT pub.*, pr.handle, pr.display_name, pr.institution, pr.orcid, pr.headline,
            u.id AS user_id, u.name AS user_name
       FROM publications pub
       JOIN profiles pr ON pr.user_id = pub.owner_id AND pr.is_public = TRUE
       JOIN users u ON u.id = pub.owner_id
      WHERE pr.handle=$1 AND pub.slug=$2 AND pub.status='published'`,
    [handle, slug]).catch(() => null);
}

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string; slug: string }> }): Promise<Metadata> {
  const { handle, slug } = await params;
  const p = await load(handle, slug);
  if (!p) return { title: "Not found", robots: { index: false } };
  const author = p.display_name || p.user_name;
  const desc = p.abstract?.slice(0, 200) || p.subtitle || `${p.title} — by ${author}.`;
  return {
    title: p.title,
    description: desc,
    authors: [{ name: author, url: `${SITE}/s/${p.handle}` }],
    alternates: { canonical: p.external_url || `/s/${p.handle}/${p.slug}` },
    openGraph: {
      type: "article", title: p.title, description: desc,
      url: `/s/${p.handle}/${p.slug}`,
      publishedTime: p.published_at ? new Date(p.published_at).toISOString() : undefined,
      authors: [author],
    },
    twitter: { card: "summary_large_image", title: p.title, description: desc },
  };
}

export default async function PublicationPage(
  { params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  const p = await load(handle, slug);
  if (!p) notFound();

  const author = p.display_name || p.user_name;
  const url = `${SITE}/s/${p.handle}/${p.slug}`;

  const related = await q<any>(
    `SELECT slug, title, abstract FROM publications
      WHERE owner_id=$1 AND status='published' AND id<>$2
      ORDER BY published_at DESC LIMIT 3`, [p.user_id, p.id]);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      headline: p.title,
      alternativeHeadline: p.subtitle || undefined,
      abstract: p.abstract || undefined,
      datePublished: p.published_at ? new Date(p.published_at).toISOString() : undefined,
      dateModified: new Date(p.updated_at).toISOString(),
      wordCount: p.word_count || undefined,
      keywords: p.tags || undefined,
      about: p.topic || undefined,
      inLanguage: "en",
      isAccessibleForFree: true,
      identifier: p.doi ? `https://doi.org/${p.doi}` : undefined,
      author: {
        "@type": "Person", name: author, url: `${SITE}/s/${p.handle}`,
        affiliation: p.institution ? { "@type": "Organization", name: p.institution } : undefined,
        identifier: p.orcid ? `https://orcid.org/${p.orcid}` : undefined,
      },
      publisher: { "@type": "Organization", name: "Semantic Authoring", url: SITE },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Scholars", item: `${SITE}/scholars` },
        { "@type": "ListItem", position: 2, name: author, item: `${SITE}/s/${p.handle}` },
        { "@type": "ListItem", position: 3, name: p.title, item: url },
      ],
    },
  ];

  return (
    <PublicShell>
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <article className="wrap" style={{ padding: "56px 24px 0" }}>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(250px,1fr)", gap: 40 }}>
          <div>
            <nav aria-label="Breadcrumb" style={{ fontSize: ".85rem", marginBottom: 14 }}>
              <Link href="/scholars">Scholars</Link>
              <span style={{ color: "var(--muted)" }}> / </span>
              <Link href={`/s/${p.handle}`}>{author}</Link>
            </nav>

            <p className="eyebrow">{p.kind.replace(/_/g, " ")}</p>
            <h1 style={{ marginBottom: 8 }}>{p.title}</h1>
            {p.subtitle && <p className="lede">{p.subtitle}</p>}

            <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>
              By <Link href={`/s/${p.handle}`}>{author}</Link>
              {p.institution && ` · ${p.institution}`}
              {p.published_at && ` · ${new Date(p.published_at).toLocaleDateString(undefined,
                { year: "numeric", month: "long", day: "numeric" })}`}
              {` · ${p.reading_time} min read`}
            </p>

            {p.abstract && (
              <div className="card stage stage-publish" style={{ margin: "26px 0" }}>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Abstract</p>
                <p style={{ margin: 0 }}>{p.abstract}</p>
              </div>
            )}

            {(p.doi || p.external_url) && (
              <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
                {p.doi && <>DOI: <a href={`https://doi.org/${p.doi}`} target="_blank"
                                    rel="noopener noreferrer">{p.doi}</a>{" "}</>}
                {p.external_url && <a href={p.external_url} target="_blank"
                                      rel="noopener noreferrer">Canonical version ↗</a>}
              </p>
            )}

            <div style={{ fontFamily: "var(--serif)", fontSize: "1.1rem", lineHeight: 1.85,
                          whiteSpace: "pre-wrap", margin: "30px 0" }}>
              {p.body}
            </div>

            {p.tags && (
              <p style={{ margin: "24px 0" }}>
                {p.tags.split(",").map((t: string) => (
                  <span key={t} className="pill" style={{ marginRight: 6 }}>{t.trim()}</span>
                ))}
              </p>
            )}

            <ShareRow url={url} title={p.title} author={author} />

            {related.length > 0 && (
              <>
                <h2 style={{ marginTop: 48 }}>More from {author}</h2>
                {related.map((r: any) => (
                  <p key={r.slug} style={{ margin: "10px 0" }}>
                    <Link href={`/s/${p.handle}/${r.slug}`}>{r.title}</Link>
                  </p>
                ))}
              </>
            )}
          </div>

          <aside>
            <SubscribeForm scholarId={p.user_id} scholarName={author} />
          </aside>
        </div>
      </article>
    </PublicShell>
  );
}
