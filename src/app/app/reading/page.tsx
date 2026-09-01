import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { apa7, missingFor } from "@/lib/apa";

export const dynamic = "force-dynamic";
export const metadata = { title: "My reading" };

const KINDS: [string, string][] = [
  ["journal_article", "Journal article"], ["book", "Book"], ["chapter", "Book chapter"],
  ["website", "Website"], ["report", "Report"], ["dissertation", "Dissertation"],
];

export default async function MyReading(
  { searchParams }: { searchParams: Promise<{ q?: string }> },
) {
  const user = (await currentUser())!;
  const { q: term } = await searchParams;

  const entries = await q<any>(
    term
      ? `SELECT e.*, (SELECT count(*) FROM reading_quotes r WHERE r.entry_id=e.id) AS quotes
           FROM reading_log e
          WHERE e.owner_id=$1 AND (e.title ILIKE $2 OR e.authors ILIKE $2 OR e.keywords ILIKE $2
                OR e.why_matters ILIKE $2 OR e.reaction ILIKE $2 OR e.connections ILIKE $2
                OR e.other_sources ILIKE $2
                OR EXISTS (SELECT 1 FROM reading_quotes r
                            WHERE r.entry_id=e.id AND (r.quote ILIKE $2 OR r.why ILIKE $2)))
          ORDER BY e.read_on DESC, e.id DESC`
      : `SELECT e.*, (SELECT count(*) FROM reading_quotes r WHERE r.entry_id=e.id) AS quotes
           FROM reading_log e WHERE e.owner_id=$1 ORDER BY e.read_on DESC, e.id DESC LIMIT 200`,
    term ? [user.id, `%${term}%`] : [user.id]);

  const sources = await q<any>(
    `SELECT id, title, authors, year, publication, doi FROM sources
      WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 60`, [user.id]);

  // Every keyword the scholar has used, for one-click filtering.
  const allKeywords = [...new Set(
    entries.flatMap((e: any) => String(e.keywords || "").split(",").map((k: string) => k.trim()))
      .filter(Boolean))].slice(0, 30);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const sid = String(formData.get("sourceId") ?? "");
    const row = await one<{ id: number }>(
      `INSERT INTO reading_log (owner_id, source_id, read_on, title, authors, year, publication,
                                publisher, volume, issue, page_range, edition, doi, url, kind,
                                why_matters, reaction, connections, other_sources, keywords)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [me.id, sid ? Number(sid) : null,
       String(formData.get("read_on") ?? "") || new Date().toISOString().slice(0, 10),
       title.slice(0, 400), String(formData.get("authors") ?? "").slice(0, 400),
       String(formData.get("year") ?? "").slice(0, 12),
       String(formData.get("publication") ?? "").slice(0, 300),
       String(formData.get("publisher") ?? "").slice(0, 200),
       String(formData.get("volume") ?? "").slice(0, 30),
       String(formData.get("issue") ?? "").slice(0, 30),
       String(formData.get("page_range") ?? "").slice(0, 40),
       String(formData.get("edition") ?? "").slice(0, 30),
       String(formData.get("doi") ?? "").slice(0, 200),
       String(formData.get("url") ?? "").slice(0, 600),
       String(formData.get("kind") ?? "journal_article"),
       String(formData.get("why_matters") ?? "").slice(0, 8000),
       String(formData.get("reaction") ?? "").slice(0, 8000),
       String(formData.get("connections") ?? "").slice(0, 8000),
       String(formData.get("other_sources") ?? "").slice(0, 4000),
       String(formData.get("keywords") ?? "").slice(0, 400)]);
    await logEvent("reading_log", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/reading");
  }

  return (
    <>
      <p className="eyebrow">Read</p>
      <h1>My reading</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        A journal of what you read, when you read it, and what it did to your thinking —
        with the quotes and page numbers you will need later, and an APA 7 reference built
        from what you record.
      </p>

      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0" }}>
        <input name="q" defaultValue={term ?? ""} style={{ maxWidth: 340 }}
               placeholder="Search titles, authors, quotes, keywords, reactions" />
        <button className="btn btn-secondary">Search</button>
        {term && <Link href="/app/reading" className="btn btn-secondary">Clear</Link>}
      </form>

      {allKeywords.length > 0 && (
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {allKeywords.map((k) => (
            <Link key={k} href={`/app/reading?q=${encodeURIComponent(k)}`} className="pill"
                  style={{ textDecoration: "none" }}>{k}</Link>
          ))}
        </p>
      )}

      <details className="card" style={{ marginBottom: 26, maxWidth: 860 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Log a reading</summary>
        <form action={create} style={{ marginTop: 18 }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "0 1 170px" }}>
              <label htmlFor="read_on">Date read</label>
              <input id="read_on" name="read_on" type="date"
                     defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="kind">Type</label>
              <select id="kind" name="kind">
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {sources.length > 0 && (
              <div className="field" style={{ flex: "2 1 240px" }}>
                <label htmlFor="sourceId">Link to a library source</label>
                <select id="sourceId" name="sourceId" defaultValue="">
                  <option value="">— none —</option>
                  {sources.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.title.slice(0, 60)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="field"><label htmlFor="title">Title</label>
            <input id="title" name="title" required /></div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "2 1 240px" }}>
              <label htmlFor="authors">Author(s)</label>
              <input id="authors" name="authors" placeholder="Smith, J. A., & Jones, B." />
            </div>
            <div className="field" style={{ flex: "0 1 110px" }}>
              <label htmlFor="year">Year</label><input id="year" name="year" /></div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "2 1 220px" }}>
              <label htmlFor="publication">Journal / book title</label>
              <input id="publication" name="publication" /></div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="publisher">Publisher</label>
              <input id="publisher" name="publisher" /></div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[["volume", "Volume"], ["issue", "Issue"], ["page_range", "Pages"],
              ["edition", "Edition"]].map(([n, l]) => (
              <div key={n} className="field" style={{ flex: "1 1 110px" }}>
                <label htmlFor={n}>{l}</label><input id={n} name={n} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label htmlFor="doi">DOI</label><input id="doi" name="doi" /></div>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label htmlFor="url">URL</label><input id="url" name="url" /></div>
          </div>

          <div className="field">
            <label htmlFor="why_matters">Why does this matter to your work?</label>
            <textarea id="why_matters" name="why_matters" rows={3} />
          </div>
          <div className="field">
            <label htmlFor="reaction">Your reaction — what did it do to your thinking?</label>
            <textarea id="reaction" name="reaction" rows={3} />
          </div>
          <div className="field">
            <label htmlFor="connections">What does it connect to?</label>
            <textarea id="connections" name="connections" rows={2}
                      placeholder="Other readings, your questions, a chapter…" />
          </div>
          <div className="field">
            <label htmlFor="other_sources">Sources it quotes or points you toward</label>
            <textarea id="other_sources" name="other_sources" rows={2}
                      placeholder="Works cited here that you should chase down" />
          </div>
          <div className="field">
            <label htmlFor="keywords">Keywords</label>
            <input id="keywords" name="keywords" placeholder="embodiment, methodology, chapter 2" />
          </div>
          <button className="btn btn-primary">Save entry</button>
        </form>
      </details>

      {entries.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          {term ? "Nothing matches that search." : "No reading logged yet."}
        </p>
      )}

      {entries.map((e: any) => {
        const ref = apa7(e);
        const missing = missingFor(e);
        return (
          <div key={e.id} className="card stage stage-read" style={{ marginBottom: 12, maxWidth: 900 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <strong style={{ fontSize: "1.02rem" }}>
                <Link href={`/app/reading/${e.id}`} style={{ color: "inherit" }}>{e.title}</Link>
              </strong>
              <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                read {new Date(e.read_on).toLocaleDateString(undefined,
                  { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "4px 0 10px" }}>
              {[e.authors, e.year, e.publication].filter(Boolean).join(" · ")}
            </p>

            <div style={{ background: "var(--paper)", border: "1px solid var(--line)",
                          borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
              <p className="eyebrow" style={{ marginBottom: 4 }}>APA 7</p>
              <p style={{ margin: 0, fontSize: ".92rem", lineHeight: 1.6,
                          fontFamily: "var(--serif)" }}>
                {ref}
              </p>
              {missing.length > 0 && (
                <p style={{ color: "var(--coral-ink)", fontSize: ".82rem", margin: "8px 0 0" }}>
                  Incomplete — still needs: {missing.join(", ")}. Nothing has been guessed.
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill">{Number(e.quotes)} quote{Number(e.quotes) === 1 ? "" : "s"}</span>
              {String(e.keywords || "").split(",").filter((k: string) => k.trim())
                .map((k: string) => <span key={k} className="pill">{k.trim()}</span>)}
            </div>
            {e.why_matters && (
              <p style={{ fontSize: ".93rem", margin: "10px 0 0" }}>{e.why_matters}</p>
            )}
            <p style={{ margin: "10px 0 0" }}>
              <Link href={`/app/reading/${e.id}`} style={{ fontSize: ".9rem" }}>
                Open entry — quotes, connections, citation →
              </Link>
            </p>
          </div>
        );
      })}
    </>
  );
}
