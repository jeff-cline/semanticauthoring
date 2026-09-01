import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { apa7, apaInText, missingFor } from "@/lib/apa";
import { ConnectPanel } from "@/components/ConnectPanel";
import { saveConnection } from "@/lib/connect";
import DateField from "@/components/DateField";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reading entry" };

export default async function ReadingEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const entry = await one<any>(
    `SELECT * FROM reading_log WHERE id=$1 AND owner_id=$2`, [Number(id), user.id]);
  if (!entry) notFound();

  const quotes = await q<any>(
    `SELECT * FROM reading_quotes WHERE entry_id=$1 ORDER BY created_at`, [entry.id]);

  async function addQuote(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const eid = Number(formData.get("entryId"));
    const owned = await one(`SELECT id FROM reading_log WHERE id=$1 AND owner_id=$2`, [eid, me.id]);
    if (!owned) return;
    const quote = String(formData.get("quote") ?? "").trim();
    if (!quote) return;
    await q(`INSERT INTO reading_quotes (entry_id, owner_id, quote, page, why)
             VALUES ($1,$2,$3,$4,$5)`,
      [eid, me.id, quote.slice(0, 6000), String(formData.get("page") ?? "").slice(0, 40),
       String(formData.get("why") ?? "").slice(0, 4000)]);
    await logEvent("reading_quote", "created", { actorId: me.id, entityId: eid });
    revalidatePath(`/app/reading/${eid}`);
  }

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const eid = Number(formData.get("entryId"));
    await q(
      `UPDATE reading_log SET read_on=$1, title=$2, authors=$3, year=$4, publication=$5,
              publisher=$6, volume=$7, issue=$8, page_range=$9, edition=$10, doi=$11, url=$12,
              kind=$13, why_matters=$14, reaction=$15, connections=$16, other_sources=$17,
              keywords=$18, updated_at=now()
        WHERE id=$19 AND owner_id=$20`,
      [String(formData.get("read_on") ?? "") || null,
       String(formData.get("title") ?? "").slice(0, 400),
       String(formData.get("authors") ?? "").slice(0, 400),
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
       String(formData.get("keywords") ?? "").slice(0, 400), eid, me.id]);
    revalidatePath(`/app/reading/${eid}`);
  }

  async function connect(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await saveConnection(me.id, formData);
    revalidatePath(`/app/reading/${formData.get("fromId")}`);
  }

  const ref = apa7(entry);
  const missing = missingFor(entry);

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/reading">← My reading</Link></p>
      <p className="eyebrow">
        Read {new Date(entry.read_on).toLocaleDateString(undefined,
          { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <h1 style={{ marginBottom: 6 }}>{entry.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {[entry.authors, entry.year, entry.publication].filter(Boolean).join(" · ")}
      </p>

      <div className="card" style={{ margin: "18px 0", background: "var(--paper)" }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>APA 7 reference</p>
        <p style={{ margin: "0 0 10px", fontFamily: "var(--serif)", fontSize: "1rem",
                    lineHeight: 1.7 }}>{ref}</p>
        <p className="eyebrow" style={{ marginBottom: 6 }}>In-text</p>
        <p style={{ margin: 0, fontFamily: "var(--serif)" }}>{apaInText(entry)}</p>
        {missing.length > 0 && (
          <p style={{ color: "var(--coral-ink)", fontSize: ".85rem", margin: "10px 0 0" }}>
            Incomplete — still needs: {missing.join(", ")}. Nothing has been guessed; fill the
            fields below and the reference completes itself.
          </p>
        )}
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div>
          <div className="card">
            <h2 style={{ fontSize: "1.05rem" }}>Quotes worth keeping</h2>
            {quotes.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>
                Nothing yet. A quote without its page number is a quote you cannot cite.
              </p>
            )}
            {quotes.map((qt: any) => (
              <div key={qt.id} style={{ borderLeft: "2px solid var(--line)", paddingLeft: 14,
                                        margin: "12px 0" }}>
                <p style={{ fontStyle: "italic", margin: "0 0 4px" }}>&ldquo;{qt.quote}&rdquo;</p>
                <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: 0 }}>
                  {apaInText(entry, qt.page)}
                </p>
                {qt.why && (
                  <p style={{ fontSize: ".9rem", margin: "6px 0 0" }}>{qt.why}</p>
                )}
              </div>
            ))}

            <form action={addQuote} style={{ marginTop: 16 }}>
              <input type="hidden" name="entryId" value={entry.id} />
              <div className="field">
                <label htmlFor="quote">Quote</label>
                <textarea id="quote" name="quote" rows={3} required />
              </div>
              <div className="field" style={{ maxWidth: 150 }}>
                <label htmlFor="page">Page</label>
                <input id="page" name="page" placeholder="214" />
              </div>
              <div className="field">
                <label htmlFor="why">Why is it important?</label>
                <textarea id="why" name="why" rows={2} />
              </div>
              <button className="btn btn-primary">Add quote</button>
            </form>
          </div>

          <div style={{ marginTop: 16 }}>
            <ConnectPanel ownerId={user.id} type="reading" id={entry.id} action={connect}
                          title="Connected to" />
          </div>
        </div>

        <form action={save} className="card">
          <h2 style={{ fontSize: "1.05rem" }}>Details</h2>
          <input type="hidden" name="entryId" value={entry.id} />
          <DateField name="read_on" label="Date read" defaultValue={entry.read_on} />
          <div className="field">
            <label htmlFor="kind">Type</label>
            <select id="kind" name="kind" defaultValue={entry.kind}>
              {[["journal_article", "Journal article"], ["book", "Book"], ["chapter", "Book chapter"],
                ["website", "Website"], ["report", "Report"], ["dissertation", "Dissertation"]]
                .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={entry.title} /></div>
          <div className="field"><label htmlFor="authors">Author(s)</label>
            <input id="authors" name="authors" defaultValue={entry.authors} /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "0 1 110px" }}>
              <label htmlFor="year">Year</label>
              <input id="year" name="year" defaultValue={entry.year} /></div>
            <div className="field" style={{ flex: "2 1 200px" }}>
              <label htmlFor="publication">Journal / book</label>
              <input id="publication" name="publication" defaultValue={entry.publication} /></div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[["publisher", "Publisher", entry.publisher], ["volume", "Vol.", entry.volume],
              ["issue", "Issue", entry.issue], ["page_range", "Pages", entry.page_range],
              ["edition", "Edition", entry.edition]].map(([n, l, v]) => (
              <div key={n as string} className="field" style={{ flex: "1 1 100px" }}>
                <label htmlFor={n as string}>{l}</label>
                <input id={n as string} name={n as string} defaultValue={v as string} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="doi">DOI</label>
              <input id="doi" name="doi" defaultValue={entry.doi} /></div>
            <div className="field" style={{ flex: "1 1 200px" }}>
              <label htmlFor="url">URL</label>
              <input id="url" name="url" defaultValue={entry.url} /></div>
          </div>
          <div className="field"><label htmlFor="why_matters">Why it matters</label>
            <textarea id="why_matters" name="why_matters" rows={3}
                      defaultValue={entry.why_matters} /></div>
          <div className="field"><label htmlFor="reaction">Your reaction</label>
            <textarea id="reaction" name="reaction" rows={3} defaultValue={entry.reaction} /></div>
          <div className="field"><label htmlFor="connections">Connections</label>
            <textarea id="connections" name="connections" rows={2}
                      defaultValue={entry.connections} /></div>
          <div className="field"><label htmlFor="other_sources">Sources it points to</label>
            <textarea id="other_sources" name="other_sources" rows={2}
                      defaultValue={entry.other_sources} /></div>
          <div className="field"><label htmlFor="keywords">Keywords</label>
            <input id="keywords" name="keywords" defaultValue={entry.keywords} /></div>
          <button className="btn btn-primary">Save</button>
        </form>
      </div>
    </>
  );
}
