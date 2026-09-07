import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { parseAny, type Ref } from "@/lib/biblio";
import { crossrefByDoi, normalizeDoi } from "@/lib/scholarly";
import { pubmedSearch, arxivSearch } from "@/lib/providers";
import { indexEntity } from "@/lib/embed";
import { limitFor } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import references" };

export default async function Import(
  { searchParams }: { searchParams: Promise<{ done?: string; failed?: string; error?: string }> },
) {
  const user = (await currentUser())!;
  const { done, failed, error } = await searchParams;
  const count = await one<{ n: string }>(
    `SELECT count(*) n FROM sources WHERE owner_id=$1`, [user.id]);
  const cap = limitFor(user, "libraryItems");

  async function addRefs(me: any, refs: Ref[]): Promise<number> {
    let n = 0;
    const limit = limitFor(me, "libraryItems");
    let have = Number((await one<{ n: string }>(
      `SELECT count(*) n FROM sources WHERE owner_id=$1`, [me.id]))?.n ?? 0);

    for (const r of refs) {
      if (limit !== null && have >= limit) break;
      // Skip a DOI already in the library rather than creating a duplicate.
      if (r.doi) {
        const dup = await one(`SELECT id FROM sources WHERE owner_id=$1 AND lower(doi)=lower($2)`,
          [me.id, r.doi]);
        if (dup) continue;
      }
      const row = await one<{ id: number }>(
        `INSERT INTO sources (owner_id, title, kind, authors, year, publication, doi, url, tags,
                              notes, provider, source_url, retrieved_at, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),'imported') RETURNING id`,
        [me.id, r.title.slice(0, 400), r.kind, r.authors.slice(0, 400), r.year.slice(0, 20),
         r.publication.slice(0, 300), r.doi.slice(0, 200), r.url.slice(0, 600),
         r.tags.slice(0, 300), r.abstract.slice(0, 4000), "import", r.url.slice(0, 600)]);
      if (row) {
        await indexEntity(me.id, "source", row.id,
          [r.title, r.authors, r.publication, r.tags, r.abstract].filter(Boolean).join(" "));
        n++; have++;
      }
    }
    return n;
  }

  async function importText(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const raw = String(formData.get("payload") ?? "").trim();
    if (!raw) redirect("/app/import?error=empty");

    const parsed = parseAny(raw);
    if (parsed.format === "unknown") redirect("/app/import?error=format");
    const n = await addRefs(me, parsed.refs);
    await logEvent("source", "imported", { actorId: me.id,
      detail: `${parsed.format}: ${n} added, ${parsed.failed} unreadable` });
    revalidatePath("/app/library");
    redirect(`/app/import?done=${n}&failed=${parsed.failed}`);
  }

  async function importFile(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const f = formData.get("file");
    if (!(f instanceof File) || f.size === 0) {
      redirect("/app/import?error=empty");
    }
    if (f.size > 5 * 1024 * 1024) {
      redirect("/app/import?error=big");
    }
    const text = await f.text();
    const parsed = parseAny(text);
    if (parsed.format === "unknown") redirect("/app/import?error=format");
    const n = await addRefs(me, parsed.refs);
    revalidatePath("/app/library");
    redirect(`/app/import?done=${n}&failed=${parsed.failed}`);
  }

  /** Identifier lookup: DOI, PMID, or arXiv ID — one per line. */
  async function importIds(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const ids = String(formData.get("ids") ?? "").split(/[\n,]/)
      .map((s) => s.trim()).filter(Boolean).slice(0, 50);
    if (!ids.length) redirect("/app/import?error=empty");

    const refs: Ref[] = [];
    let missed = 0;
    for (const raw of ids) {
      const id = raw.replace(/^(doi:|pmid:|arxiv:)/i, "").trim();
      let ref: Ref | null = null;

      if (/^10\.\d{4,}\//.test(normalizeDoi(id))) {
        const w = await crossrefByDoi(id);
        if (w) {
          ref = { title: w.title, authors: w.authors.join(", "), year: w.year,
            publication: w.publication, publisher: w.publisher, volume: "", issue: "",
            pages: "", doi: w.doi, url: w.url, kind: "article", tags: "", abstract: "" };
        }
      } else if (/^\d{6,9}$/.test(id)) {
        const hits = await pubmedSearch(id, 1);
        const w = hits[0];
        if (w) {
          ref = { title: w.title, authors: w.authors.join(", "), year: w.year,
            publication: w.publication, publisher: "", volume: "", issue: "", pages: "",
            doi: w.doi, url: w.url, kind: "article", tags: "", abstract: "" };
        }
      } else if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(id) || /^[a-z-]+\/\d{7}$/i.test(id)) {
        const hits = await arxivSearch(id, 1);
        const w = hits[0];
        if (w) {
          ref = { title: w.title, authors: w.authors.join(", "), year: w.year,
            publication: w.publication, publisher: "", volume: "", issue: "", pages: "",
            doi: w.doi, url: w.url, kind: "article", tags: "preprint", abstract: "" };
        }
      }

      // An identifier that does not resolve is reported, never invented.
      if (ref) refs.push(ref); else missed++;
    }
    const n = await addRefs(me, refs);
    await logEvent("source", "imported_ids", { actorId: me.id, detail: `${n} added` });
    revalidatePath("/app/library");
    redirect(`/app/import?done=${n}&failed=${missed}`);
  }

  const messages: Record<string, string> = {
    empty: "Nothing to import.",
    format: "That didn't look like BibTeX, RIS, or CSL JSON. Nothing was imported.",
    big: "That file is larger than 5 MB.",
  };

  return (
    <>
      <p className="eyebrow">Read</p>
      <h1>Import references</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Bring in a bibliography from Zotero, EndNote, Mendeley, or a database export — or just
        paste identifiers. A reference that cannot be read is reported, never half-imported.
        {cap !== null && ` Your tier includes ${cap} library items (${count?.n ?? 0} used).`}
      </p>

      {error && <p className="error">{messages[error] ?? "Something went wrong."}</p>}
      {done !== undefined && (
        <p className="success">
          Imported {done} reference{done === "1" ? "" : "s"}.
          {Number(failed) > 0 && ` ${failed} could not be read and were skipped.`}
        </p>
      )}

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 22 }}>
        <form action={importIds} className="card stage stage-read">
          <h2 style={{ fontSize: "1.05rem" }}>By identifier</h2>
          <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
            DOIs, PubMed IDs, or arXiv IDs — one per line. Each is resolved against the real
            index, so what lands in your library is the registry&rsquo;s metadata, not a guess.
          </p>
          <div className="field">
            <label htmlFor="ids" className="hp">Identifiers</label>
            <textarea id="ids" name="ids" rows={6}
                      placeholder={"10.1038/nature12373\n32444576\n2301.04567"} />
          </div>
          <button className="btn btn-primary">Look up and import</button>
        </form>

        <div>
          <form action={importText} className="card">
            <h2 style={{ fontSize: "1.05rem" }}>Paste a bibliography</h2>
            <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              BibTeX, RIS, or CSL JSON. The format is detected automatically.
            </p>
            <div className="field">
              <label htmlFor="payload" className="hp">Bibliography</label>
              <textarea id="payload" name="payload" rows={8}
                        placeholder="@article{smith2019, title={...}, author={...}, year={2019}}"
                        style={{ fontFamily: "ui-monospace, monospace", fontSize: ".85rem" }} />
            </div>
            <button className="btn btn-primary">Import</button>
          </form>

          <form action={importFile} className="card" style={{ marginTop: 14 }}>
            <h2 style={{ fontSize: "1.05rem" }}>Or upload a file</h2>
            <div className="field">
              <label htmlFor="file" className="hp">File</label>
              <input id="file" name="file" type="file"
                     accept=".bib,.ris,.json,.txt,text/plain,application/json" />
            </div>
            <button className="btn btn-secondary">Upload and import</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22, maxWidth: 780 }}>
        <h2 style={{ fontSize: "1.02rem" }}>Export</h2>
        <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
          Your library, in the formats other tools read.
        </p>
        <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a className="btn btn-secondary" href="/app/export/library.bib" download>BibTeX</a>
          <a className="btn btn-secondary" href="/app/export/library.ris" download>RIS</a>
          <a className="btn btn-secondary" href="/app/export/library.json" download>CSL JSON</a>
          <Link className="btn btn-secondary" href="/app/export">Everything →</Link>
        </p>
      </div>
    </>
  );
}
