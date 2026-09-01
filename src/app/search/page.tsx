import Link from "next/link";
import { PublicShell } from "@/components/Chrome";
import { searchPublications, searchByAuthorOrKeyword, type Hit } from "@/lib/search";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Search scholarship",
  description: "Search published essays, research notes, and working papers by keyword or author.",
  robots: { index: true, follow: true },
};

export default async function Search(
  { searchParams }: { searchParams: Promise<{ q?: string; author?: string }> },
) {
  const { q: keyword, author } = await searchParams;
  const term = (keyword ?? author ?? "").trim();
  const mode = author !== undefined && author !== "" ? "author" : "keyword";

  let hits: Hit[] = [];
  if (term) {
    hits = mode === "author"
      ? await searchByAuthorOrKeyword(term)
      : await searchPublications(term);
  }

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

        <div style={{ display: "grid", gap: 14,
                      gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                      margin: "26px 0 34px" }}>
          <form action="/search" method="get" role="search">
            <label htmlFor="q">Search for keyword</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="q" name="q" defaultValue={mode === "keyword" ? term : ""}
                     placeholder="embodiment, methodology…" />
              <button className="btn btn-primary" style={{ padding: "12px 16px" }}>Go</button>
            </div>
          </form>
          <form action="/search" method="get" role="search">
            <label htmlFor="author">Keyword or author</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="author" name="author" defaultValue={mode === "author" ? term : ""}
                     placeholder="a name, or a topic…" />
              <button className="btn btn-secondary" style={{ padding: "12px 16px" }}>Go</button>
            </div>
          </form>
        </div>

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
