import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell } from "@/components/Chrome";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

export const metadata: Metadata = {
  title: "Authors",
  description:
    "Every author publishing on Semantic Authoring, listed alphabetically. "
    + "Scholars writing on embodiment, somatic psychology, qualitative method and more.",
  alternates: { canonical: "/authors" },
  openGraph: {
    type: "website", title: "Authors — Semantic Authoring",
    description: "Every author publishing on Semantic Authoring, listed alphabetically.",
    url: `${SITE}/authors`,
  },
};

// A plain alphabetical index of everyone. /scholars ranks by publication count,
// which is a discovery surface; this is the complete list, which is a reference
// one — and the thing a crawler can follow to reach every author page in a
// single hop from the homepage.
export default async function Authors() {
  const rows = await q<any>(
    `SELECT pr.handle, pr.display_name, pr.headline, pr.institution, pr.avatar_url,
            pr.avatar_alt, u.name AS user_name,
            (SELECT count(*) FROM publications pb
              WHERE pb.owner_id = pr.user_id AND pb.status='published'
                AND pb.on_profile = TRUE) AS pubs
       FROM profiles pr JOIN users u ON u.id = pr.user_id
      WHERE pr.is_public = TRUE
      ORDER BY lower(coalesce(nullif(pr.display_name,''), u.name, pr.handle))`)
    .catch(() => []);

  // Group by first letter so a long list stays navigable.
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const label = String(r.display_name || r.user_name || r.handle).trim();
    const letter = /^[a-z]/i.test(label) ? label[0].toUpperCase() : "#";
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push({ ...r, label });
  }
  const letters = [...groups.keys()];

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Authors",
    url: `${SITE}/authors`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: rows.length,
      itemListElement: rows.map((r: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE}/${r.handle}`,
        name: r.display_name || r.user_name || r.handle,
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
          <h1>Authors</h1>
          <p className="lede">
            Everyone publishing here, A to Z. {rows.length > 0 && `${rows.length} author${
              rows.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ marginTop: 30, maxWidth: 620 }}>
            <p style={{ margin: 0 }}>No public profiles yet.</p>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              Authors choose whether to appear here — profiles stay private until switched on.{" "}
              <Link href="/join">Start your workspace →</Link>
            </p>
          </div>
        ) : (
          <>
            {letters.length > 1 && (
              <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "30px 0 10px" }}>
                {letters.map((l) => (
                  <a key={l} href={`#letter-${l}`} className="pill"
                     style={{ textDecoration: "none", minHeight: 36, padding: "7px 13px" }}>
                    {l}
                  </a>
                ))}
              </p>
            )}

            {letters.map((letter) => (
              <section key={letter} style={{ marginTop: 26 }}>
                <h2 id={`letter-${letter}`} style={{ fontSize: "1.1rem", marginBottom: 12 }}>
                  {letter}
                </h2>
                <div className="grid grid-2">
                  {groups.get(letter)!.map((r: any) => (
                    <Link key={r.handle} href={`/${r.handle}`}
                          className="card stage stage-connect"
                          style={{ textDecoration: "none", color: "inherit", display: "flex",
                                   gap: 14, alignItems: "center" }}>
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatar_url} alt={r.avatar_alt || r.label}
                             width={52} height={52}
                             style={{ width: 52, height: 52, borderRadius: "50%",
                                      objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <span aria-hidden="true"
                              style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                                       display: "grid", placeItems: "center",
                                       background: "var(--wash, rgba(0,0,0,.05))",
                                       fontFamily: "var(--serif)", fontSize: "1.2rem" }}>
                          {r.label[0]?.toUpperCase() ?? "?"}
                        </span>
                      )}
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: "block" }}>{r.label}</strong>
                        {r.headline && (
                          <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                            {r.headline}
                          </span>
                        )}
                        <span style={{ display: "block", color: "var(--muted)",
                                       fontSize: ".8rem", marginTop: 2 }}>
                          {[r.institution, Number(r.pubs) > 0
                            ? `${r.pubs} published` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </section>
    </PublicShell>
  );
}
