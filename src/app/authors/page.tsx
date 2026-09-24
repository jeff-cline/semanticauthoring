import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "@/components/Chrome";
import { q } from "@/lib/db";
import { stripTags } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

const DESCRIPTION =
  "Every author publishing on Semantic Authoring, in the order they joined. "
  + "Scholars writing on embodiment, somatic psychology, qualitative method and more.";

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ sort?: string }> },
): Promise<Metadata> {
  const { sort } = await searchParams;
  return {
    title: "Semantic Authors",
    description: DESCRIPTION,
    // Always the same canonical, and the sorted view is not indexed — one
    // address accrues the authority instead of two competing for it.
    alternates: { canonical: "/authors" },
    robots: sort ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website", title: "Semantic Authors",
      description: DESCRIPTION, url: `${SITE}/authors`,
    },
  };
}

const JOINED = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" });

// One authors index, not two.
//
// A second page listing the same people under a different sort would compete
// with this one for the same query and split whatever authority either earns —
// the opposite of helping anyone rank. So the ordering is a control on this
// page, the canonical URL never changes, and sorted variants are marked
// noindex so search engines only ever index the one address.
export default async function Authors({
  searchParams,
}: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams;
  const alpha = sort === "az";

  const rows = await q<any>(
    `SELECT pr.handle, pr.display_name, pr.headline, pr.bio, pr.about_html,
            pr.institution, pr.program, pr.degree, pr.avatar_url, pr.avatar_alt,
            u.name AS user_name, u.created_at AS joined_at,
            (SELECT count(*) FROM publications pb
              WHERE pb.owner_id = pr.user_id AND pb.status='published'
                AND pb.on_profile = TRUE) AS pubs
       FROM profiles pr JOIN users u ON u.id = pr.user_id
      WHERE pr.is_public = TRUE
      ORDER BY ${alpha
        ? `lower(coalesce(nullif(pr.display_name,''), u.name, pr.handle)) ASC`
        // Oldest account first: the people who have been here longest lead.
        : `u.created_at ASC, pr.handle ASC`}`)
    .catch(() => []);

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Semantic Authors",
    url: `${SITE}/authors`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: rows.length,
      itemListElement: rows.map((r: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Person",
          name: r.display_name || r.user_name || r.handle,
          url: `${SITE}/${r.handle}`,
          image: r.avatar_url || undefined,
          description: r.headline || undefined,
          affiliation: r.institution
            ? { "@type": "Organization", name: r.institution } : undefined,
        },
      })),
    },
  };

  return (
    <PublicShell>
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <section className="wrap" style={{ padding: "64px 24px 0" }}>
        <div className="narrow">
          <p className="eyebrow">Directory</p>
          <h1>Semantic Authors</h1>
          <p className="lede">
            Everyone publishing here{rows.length > 0 && `, all ${rows.length} of them`}
            {alpha ? ", A to Z" : ", in the order they joined"}.
          </p>
        </div>

        {rows.length > 0 && (
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "26px 0 0" }}>
            <Link href="/authors" className="pill" aria-current={!alpha ? "true" : undefined}
                  style={{ textDecoration: "none", minHeight: 38, padding: "8px 14px",
                           background: !alpha ? "var(--current)" : undefined,
                           color: !alpha ? "#fff" : undefined }}>
              Longest here first
            </Link>
            <Link href="/authors?sort=az" className="pill"
                  aria-current={alpha ? "true" : undefined}
                  style={{ textDecoration: "none", minHeight: 38, padding: "8px 14px",
                           background: alpha ? "var(--current)" : undefined,
                           color: alpha ? "#fff" : undefined }}>
              A–Z
            </Link>
          </p>
        )}

        {rows.length === 0 ? (
          <div className="card" style={{ marginTop: 30, maxWidth: 620 }}>
            <p style={{ margin: 0 }}>No public profiles yet.</p>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              Authors choose whether to appear here — profiles stay private until switched on.{" "}
              <Link href="/join">Start your workspace →</Link>
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 22, marginTop: 30, maxWidth: 820 }}>
            {rows.map((r: any) => {
              const name = r.display_name || r.user_name || r.handle;
              // Prefer what she wrote about herself; fall back to the headline.
              const about = (r.bio && r.bio.trim())
                || stripTags(r.about_html || "", 320)
                || r.headline || "";
              return (
                <article key={r.handle} className="card stage stage-connect"
                         style={{ display: "flex", gap: 20, alignItems: "flex-start",
                                  flexWrap: "wrap" }}>
                  <Link href={`/${r.handle}`} aria-label={name} style={{ flexShrink: 0 }}>
                    {r.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar_url} alt={r.avatar_alt || name}
                           width={96} height={96}
                           style={{ width: 96, height: 96, borderRadius: "50%",
                                    objectFit: "cover", display: "block" }} />
                    ) : (
                      <span aria-hidden="true"
                            style={{ width: 96, height: 96, borderRadius: "50%",
                                     display: "grid", placeItems: "center",
                                     background: "var(--wash, rgba(0,0,0,.05))",
                                     fontFamily: "var(--serif)", fontSize: "2rem" }}>
                        {name[0]?.toUpperCase() ?? "?"}
                      </span>
                    )}
                  </Link>

                  <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                    <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px" }}>
                      <Link href={`/${r.handle}`}
                            style={{ textDecoration: "none", color: "inherit" }}>
                        {name}
                      </Link>
                    </h2>

                    {r.headline && about !== r.headline && (
                      <p style={{ margin: "0 0 8px", color: "var(--current)",
                                  fontSize: ".95rem" }}>
                        {r.headline}
                      </p>
                    )}

                    <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "0 0 10px" }}>
                      {[r.degree, r.program, r.institution].filter(Boolean).join(" · ")}
                      {r.joined_at && (
                        <>
                          {[r.degree, r.program, r.institution].filter(Boolean).length > 0 && " · "}
                          Here since {JOINED.format(new Date(r.joined_at))}
                        </>
                      )}
                      {Number(r.pubs) > 0 && ` · ${r.pubs} published`}
                    </p>

                    {about && (
                      <p style={{ margin: 0 }}>
                        {about.length > 320 ? `${about.slice(0, 320)}…` : about}
                      </p>
                    )}

                    <p style={{ margin: "12px 0 0" }}>
                      <Link href={`/${r.handle}`}>Read {name.split(" ")[0]}&rsquo;s work →</Link>
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
