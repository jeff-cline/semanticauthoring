"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Author = {
  handle: string; name: string; headline: string | null;
  avatar_url: string | null; avatar_alt: string | null;
};

/**
 * The author list on the 404 page.
 *
 * Fetched in the browser rather than on the server, because Next renders
 * not-found at build time — a database read there would bake in whoever
 * existed at deploy and go stale the moment someone new joined.
 */
export default function AuthorsMini({ limit = 12 }: { limit?: number }) {
  const [authors, setAuthors] = useState<Author[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/authors")
      .then((r) => r.json())
      .then((j) => { if (alive) setAuthors(j.authors ?? []); })
      .catch(() => { if (alive) setAuthors([]); });
    return () => { alive = false; };
  }, []);

  // Nothing at all until it resolves: a heading over an empty space reads as
  // broken on a page the visitor already suspects is broken.
  if (authors === null || authors.length === 0) return null;

  return (
    <section style={{ marginTop: 44 }}>
      <h2 style={{ fontSize: "1.1rem" }}>Or read one of our authors</h2>
      <div style={{ display: "grid", gap: 10,
                    gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
        {authors.slice(0, limit).map((a) => (
          <Link key={a.handle} href={`/${a.handle}`} className="card"
                style={{ display: "flex", gap: 12, alignItems: "center",
                         textDecoration: "none", color: "inherit", padding: 14 }}>
            {a.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.avatar_url} alt={a.avatar_alt || a.name} width={40} height={40}
                   style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover",
                            flexShrink: 0 }} />
            ) : (
              <span aria-hidden="true"
                    style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                             display: "grid", placeItems: "center",
                             background: "var(--wash, rgba(0,0,0,.05))",
                             fontFamily: "var(--serif)" }}>
                {a.name[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: ".95rem" }}>{a.name}</strong>
              {a.headline && (
                <span style={{ color: "var(--muted)", fontSize: ".8rem",
                               display: "block", overflow: "hidden",
                               textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.headline}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
      {authors.length > limit && (
        <p style={{ marginTop: 14 }}>
          <Link href="/authors">See all {authors.length} authors →</Link>
        </p>
      )}
    </section>
  );
}
