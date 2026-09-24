import Link from "next/link";
import { PublicShell } from "@/components/Chrome";
import { searchByAuthorOrKeyword, type Hit } from "@/lib/search";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Search scholarship",
  description: "Search published essays, research notes, and working papers by keyword or author.",
  robots: { index: true, follow: true },
};

export default async function Search(
  { searchParams }: { searchParams: Promise<{ q?: string; author?: string }> },
) {
  // `author` is still accepted so older links and bookmarks keep working —
  // it now means the same thing as `q`.
  const { q: keyword, author } = await searchParams;
  const term = (keyword ?? author ?? "").trim();

  // Always the broader search. It matches keywords, authors, and both at once,
  // which is what people actually type.
  const hits: Hit[] = term ? await searchByAuthorOrKeyword(term) : [];

  const scholars = hits.filter((h) => h.kind === "scholar");
  const works = hits.filter((h) => h.kind === "publication");

  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "64px 24px 0" }}>
        <p className="eyebrow">Search</p>
        <h1>Find scholarship</h1>
        <p style={{ color: "var(--muted)" }}>
          Searches published work and public scholar profiles only. Private research,
          annotations, journals, and drafts are never searchable.
        </p>

        <form action="/search" method="get" role="search"
              style={{ margin: "26px 0 34px", maxWidth: 560 }}>
          <label htmlFor="q">Search for keyword or author or keyword + author</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="q" name="q" defaultValue={term}
                   placeholder="Search for keyword or author or keyword + author"
                   style={{ flex: 1, minWidth: 0 }} />
            <button className="btn btn-primary"
                    style={{ padding: "12px 20px", flexShrink: 0 }}>Go</button>
          </div>
        </form>

        {!term && (
          <p style={{ color: "var(--muted)" }}>
            Enter a search above, or <Link href="/discover">browse by topic →</Link>
          </p>
        )}

        {term && hits.length === 0 && (
          <div className="card">
            <p style={{ margin: 0 }}>
              Nothing published matches <strong>{term}</strong> yet.
            </p>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              The platform is new and scholars are still publishing their first work.
            </p>
          </div>
        )}

        {scholars.length > 0 && (
          <>
            <h2 style={{ fontSize: "1.15rem" }}>Scholars ({scholars.length})</h2>
            {scholars.map((h) => (
              <article key={h.url} className="card stage stage-connect" style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: "1.05rem", marginBottom: 2 }}>
                  <Link href={h.url}>{h.title}</Link>
                </h3>
                {h.subtitle && <p style={{ margin: "0 0 6px" }}>{h.subtitle}</p>}
                <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: 0 }}>{h.meta}</p>
              </article>
            ))}
          </>
        )}

        {works.length > 0 && (
          <>
            <h2 style={{ fontSize: "1.15rem", marginTop: scholars.length ? 32 : 0 }}>
              Published work ({works.length})
            </h2>
            {works.map((h) => (
              <article key={h.url} className="card stage stage-publish" style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: "1.05rem", marginBottom: 2 }}>
                  <Link href={h.url}>{h.title}</Link>
                </h3>
                {h.subtitle && <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>{h.subtitle}</p>}
                {h.snippet && <p style={{ fontSize: ".93rem", margin: "0 0 6px" }}>{h.snippet}</p>}
                <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: 0 }}>{h.meta}</p>
              </article>
            ))}
          </>
        )}
      </section>
    </PublicShell>
  );
}
