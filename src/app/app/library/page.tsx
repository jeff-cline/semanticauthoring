import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { limitFor } from "@/lib/tiers";
import { storeFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Research library" };

const KINDS = ["article", "book", "chapter", "website", "lecture", "report", "video", "podcast", "course_doc", "note"];

export default async function Library(
  { searchParams }: { searchParams: Promise<{ q?: string; kind?: string; error?: string }> },
) {
  const user = (await currentUser())!;
  const { q: search, kind, error } = await searchParams;

  const where = ["owner_id = $1"];
  const params: unknown[] = [user.id];
  if (search) { params.push(`%${search}%`); where.push(`(title ILIKE $${params.length} OR authors ILIKE $${params.length} OR tags ILIKE $${params.length})`); }
  if (kind) { params.push(kind); where.push(`kind = $${params.length}`); }

  const rows = await q<any>(
    `SELECT s.*, (SELECT count(*) FROM annotations a WHERE a.source_id = s.id) AS notes
       FROM sources s WHERE ${where.join(" AND ")} ORDER BY s.created_at DESC LIMIT 400`, params);

  const total = await one<{ n: string }>(`SELECT count(*) n FROM sources WHERE owner_id=$1`, [user.id]);
  const cap = limitFor(user, "libraryItems");

  async function add(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;

    const limit = limitFor(me, "libraryItems");
    if (limit !== null) {
      const c = await one<{ n: string }>(`SELECT count(*) n FROM sources WHERE owner_id=$1`, [me.id]);
      if (Number(c?.n ?? 0) >= limit) { revalidatePath("/app/library"); return; }
    }

    let stored = null;
    try {
      const f = formData.get("file");
      if (f instanceof File && f.size > 0) stored = await storeFile(me.id, f);
    } catch { /* surfaced below as a source without a file */ }

    const row = await one<{ id: number }>(
      `INSERT INTO sources (owner_id, title, kind, authors, year, publication, doi, url, tags,
                            file_path, file_name, file_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [me.id, title.slice(0, 400), String(formData.get("kind") ?? "article"),
       String(formData.get("authors") ?? "").slice(0, 400), String(formData.get("year") ?? "").slice(0, 20),
       String(formData.get("publication") ?? "").slice(0, 300), String(formData.get("doi") ?? "").slice(0, 200),
       String(formData.get("url") ?? "").slice(0, 600), String(formData.get("tags") ?? "").slice(0, 300),
       stored?.path ?? "", stored?.name ?? "", stored?.size ?? 0],
    );
    await logEvent("source", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/library");
  }

  return (
    <>
      <p className="eyebrow">Read</p>
      <h1>Research library</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Everything you read, in one place — with your annotations, evidence labels, and the
        questions each source speaks to.
        {cap !== null && ` Your tier includes ${cap} items (${total?.n ?? 0} used).`}
      </p>

      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0" }}>
        <input name="q" placeholder="Search title, author, or tag" defaultValue={search ?? ""}
               style={{ maxWidth: 320 }} />
        <select name="kind" defaultValue={kind ?? ""} style={{ maxWidth: 180 }}>
          <option value="">All kinds</option>
          {KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
        </select>
        <button className="btn btn-secondary">Filter</button>
        {(search || kind) && <Link href="/app/library" className="btn btn-secondary">Clear</Link>}
      </form>

      <details className="card" style={{ marginBottom: 26, maxWidth: 780 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Add a source</summary>
        <form action={add} style={{ marginTop: 18 }}>
          <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" required /></div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="kind">Kind</label>
              <select id="kind" name="kind">{KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}</select>
            </div>
            <div className="field" style={{ flex: "2 1 240px" }}>
              <label htmlFor="authors">Author(s)</label><input id="authors" name="authors" />
            </div>
            <div className="field" style={{ flex: "0 1 110px" }}>
              <label htmlFor="year">Year</label><input id="year" name="year" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label htmlFor="publication">Journal / publisher</label><input id="publication" name="publication" />
            </div>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="doi">DOI</label><input id="doi" name="doi" placeholder="10.xxxx/xxxxx" />
            </div>
          </div>
          <div className="field"><label htmlFor="url">URL</label><input id="url" name="url" /></div>
          <div className="field"><label htmlFor="tags">Tags</label>
            <input id="tags" name="tags" placeholder="embodiment, methodology, chapter 2" /></div>
          <div className="field">
            <label htmlFor="file">Attach a file (optional)</label>
            <input id="file" name="file" type="file" accept=".pdf,.txt,.md,.epub,.doc,.docx" />
            <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
              PDF, text, Markdown, EPUB, or Word — up to 40 MB. Stored privately and never
              reachable by URL; only you can open it.
            </p>
          </div>
          <button className="btn btn-primary">Add to library</button>
        </form>
      </details>

      {error && <p className="error">{error}</p>}

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>
          {search || kind ? "Nothing matches that filter." : "Your library is empty. Add your first source above."}
        </p>
      ) : (
        <div className="grid grid-2">
          {rows.map((s: any) => (
            <Link key={s.id} href={`/app/library/${s.id}`} className="card stage stage-read"
                  style={{ textDecoration: "none", color: "inherit" }}>
              <h3 style={{ fontSize: "1.02rem", marginBottom: 4 }}>{s.title}</h3>
              <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "0 0 8px" }}>
                {[s.authors, s.year, s.publication].filter(Boolean).join(" · ") || "—"}
              </p>
              <span className="pill">{s.kind.replace("_", " ")}</span>{" "}
              <span className="pill">{s.notes} annotation{Number(s.notes) === 1 ? "" : "s"}</span>{" "}
              {s.file_name && <span className="pill">file attached</span>}{" "}
              <span className="pill">{s.read_status}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
