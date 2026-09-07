import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { buildLiteratureMap, findGaps } from "@/lib/literature";
import { searchEverywhere } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Literature" };

export default async function Literature(
  { searchParams }: { searchParams: Promise<{ q?: string; mode?: string }> },
) {
  const user = (await currentUser())!;
  const { q: term, mode } = await searchParams;

  const questions = await q<any>(
    `SELECT id, text FROM questions WHERE owner_id=$1 AND status IN ('active','refining','emerging')
      ORDER BY updated_at DESC LIMIT 10`, [user.id]);

  const [map, gapResult, everywhere] = term
    ? await Promise.all([
        buildLiteratureMap(term).catch(() => null),
        findGaps(term).catch(() => ({ gaps: [], sampleSize: 0 })),
        mode === "all" ? searchEverywhere(term, 10).catch(() => null) : Promise.resolve(null),
      ])
    : [null, { gaps: [], sampleSize: 0 }, null];

  return (
    <>
      <p className="eyebrow">Synthesize</p>
      <h1>Literature</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Map a topic across the published record: who is working on it, where it appears, how
        it has moved over time, and where the sample suggests something is missing.
      </p>

      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0" }}>
        <input name="q" defaultValue={term ?? ""} style={{ maxWidth: 380 }}
               placeholder="interoception and adult learning" />
        <button className="btn btn-primary">Map the literature</button>
        <button className="btn btn-secondary" name="mode" value="all">
          Search every index
        </button>
      </form>

      {questions.length > 0 && !term && (
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>Your questions:</span>
          {questions.map((x: any) => (
            <Link key={x.id} href={`/app/literature?q=${encodeURIComponent(x.text.slice(0, 90))}`}
                  className="pill" style={{ textDecoration: "none" }}>
              {x.text.slice(0, 60)}
            </Link>
          ))}
        </p>
      )}

      {everywhere && (
        <>
          <h2 style={{ fontSize: "1.15rem" }}>
            Across every index ({everywhere.works.length} after de-duplication)
          </h2>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: -6 }}>
            Queried {everywhere.providersQueried.join(", ")}. Records appearing in several
            indexes are merged — a paper indexed five times is one paper.
          </p>
          {everywhere.notes.map((n) => <p key={n} className="error">{n}</p>)}
          {everywhere.works.slice(0, 20).map((w) => (
            <div key={`${w.provider}-${w.providerId}`} className="card"
                 style={{ marginBottom: 8, padding: 14 }}>
              <strong style={{ fontSize: ".95rem" }}>{w.title}</strong>
              {w.isRetracted && (
                <span className="pill" style={{ color: "var(--coral)", marginLeft: 8 }}>
                  RETRACTED
                </span>
              )}
              <div style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 4 }}>
                {[w.authors.slice(0, 3).join(", "), w.year, w.publication].filter(Boolean).join(" · ")}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {w.sources.map((s) => <span key={s} className="pill">{s}</span>)}
                {w.citationCount != null && (
                  <span className="pill">{w.citationCount} citations</span>
                )}
                {w.doi && <a href={`https://doi.org/${w.doi}`} target="_blank"
                             rel="noopener noreferrer" className="pill"
                             style={{ textDecoration: "none" }}>DOI ↗</a>}
              </div>
            </div>
          ))}
        </>
      )}

      {map && (
        <>
          <div className="card" style={{ margin: "20px 0", maxWidth: 820,
               borderLeft: "3px solid var(--gold)" }}>
            <h2 style={{ fontSize: "1.02rem" }}>How this was built</h2>
            <ul style={{ color: "var(--muted)", fontSize: ".88rem", paddingLeft: 20,
                         margin: 0, lineHeight: 1.7 }}>
              {map.criteria.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>

          {map.byYear.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.05rem" }}>Published over time</h2>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110,
                            marginTop: 12 }}>
                {map.byYear.map((y) => {
                  const max = Math.max(...map.byYear.map((x) => x.n));
                  return (
                    <div key={y.year} title={`${y.year}: ${y.n}`}
                         style={{ flex: 1, minWidth: 4,
                                  height: `${Math.max(4, (y.n / max) * 100)}%`,
                                  background: "var(--current)", opacity: .8, borderRadius: 2 }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between",
                            color: "var(--muted)", fontSize: ".78rem", marginTop: 6 }}>
                <span>{map.byYear[0]?.year}</span>
                <span>{map.byYear[map.byYear.length - 1]?.year}</span>
              </div>
            </div>
          )}

          {gapResult.gaps.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.15rem", marginTop: 26 }}>
                Potential gaps ({gapResult.gaps.length})
              </h2>
              <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: -6 }}>
                Hypotheses drawn from a sample of {gapResult.sampleSize} works — not findings.
                Each says what would confirm it.
              </p>
              {gapResult.gaps.map((g, i) => (
                <div key={i} className="card" style={{ marginBottom: 10,
                     borderLeft: "3px solid var(--gold)" }}>
                  <span className="pill" style={{ color: "var(--gold)" }}>{g.kind}</span>
                  <p style={{ margin: "8px 0 6px", fontWeight: 600 }}>{g.statement}</p>
                  <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "0 0 6px" }}>
                    Evidence: {g.evidence}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>
                    To confirm: {g.confirmBy}
                  </p>
                </div>
              ))}
            </>
          )}

          <div className="grid grid-2" style={{ alignItems: "start", marginTop: 26 }}>
            <div>
              <h2 style={{ fontSize: "1.1rem" }}>Most cited in this sample</h2>
              {map.mostCited.map((w) => (
                <div key={w.providerId} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <strong style={{ fontSize: ".93rem" }}>{w.title}</strong>
                  <div style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 4 }}>
                    {[w.authors[0], w.year, w.publication].filter(Boolean).join(" · ")}
                    {" · "}<strong>{w.citationCount ?? "?"} citations</strong>
                  </div>
                </div>
              ))}

              <h2 style={{ fontSize: "1.1rem", marginTop: 20 }}>Reviews and meta-analyses</h2>
              {map.reviews.length === 0 && (
                <p style={{ color: "var(--muted)" }}>None surfaced in this sample.</p>
              )}
              {map.reviews.map((w) => (
                <div key={w.providerId} className="card" style={{ marginBottom: 8, padding: 14 }}>
                  <strong style={{ fontSize: ".93rem" }}>{w.title}</strong>
                  <div style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                    {[w.year, w.publication].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="card">
                <h2 style={{ fontSize: "1.05rem" }}>Who is publishing</h2>
                {map.authors.map((a) => (
                  <p key={a.name} style={{ margin: "6px 0", fontSize: ".92rem" }}>
                    {a.name}{" "}
                    <span style={{ color: "var(--muted)" }}>
                      · {a.works} works · {a.citations.toLocaleString()} citations
                    </span>
                  </p>
                ))}
              </div>
              <div className="card" style={{ marginTop: 14 }}>
                <h2 style={{ fontSize: "1.05rem" }}>Where it appears</h2>
                {map.venues.map((v) => (
                  <p key={v.name} style={{ margin: "6px 0", fontSize: ".92rem" }}>
                    {v.name} <span style={{ color: "var(--muted)" }}>· {v.works}</span>
                  </p>
                ))}
                <p style={{ marginTop: 12 }}>
                  <Link href={`/app/journals?q=${encodeURIComponent(term ?? "")}`}>
                    Find journals for this work →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
