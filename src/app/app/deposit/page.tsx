import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { repositoryHealth } from "@/lib/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Repository deposit" };

export default async function Deposit() {
  const user = (await currentUser())!;

  const [deposits, publications, documents, health] = await Promise.all([
    q<any>(`SELECT * FROM deposits WHERE owner_id=$1 ORDER BY created_at DESC`, [user.id]),
    q<any>(`SELECT id, title, abstract FROM publications WHERE owner_id=$1
             ORDER BY updated_at DESC`, [user.id]),
    q<any>(`SELECT id, title FROM documents WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
    repositoryHealth().catch(() => []),
  ]);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const pubId = String(formData.get("publication_id") ?? "");
    const docId = String(formData.get("document_id") ?? "");
    const row = await one<{ id: number }>(
      `INSERT INTO deposits (owner_id, publication_id, document_id, repository, sandbox,
                             title, description, creators, keywords, upload_type, license)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [me.id, pubId ? Number(pubId) : null, docId ? Number(docId) : null,
       String(formData.get("repository") ?? "zenodo"),
       formData.get("sandbox") !== null,
       title.slice(0, 400), String(formData.get("description") ?? "").slice(0, 8000),
       String(formData.get("creators") ?? me.name ?? "").slice(0, 2000),
       String(formData.get("keywords") ?? "").slice(0, 500),
       String(formData.get("upload_type") ?? "publication"),
       String(formData.get("license") ?? "cc-by-4.0")]);
    await logEvent("deposit", "created", { actorId: me.id, entityId: row?.id });
    redirect(`/app/deposit/${row!.id}`);
  }

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Repository deposit</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Deposit finished work to Zenodo or OSF. Zenodo mints a DOI, which is what makes a
        piece citable and discoverable by the scholarly indexes.
      </p>

      <div className="card" style={{ maxWidth: 780, margin: "18px 0",
           borderLeft: "3px solid var(--coral)" }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}>
          <strong>Publishing is irreversible.</strong>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          A draft can be edited or deleted freely. Publishing mints a permanent DOI and the
          record cannot be withdrawn. So publishing is a separate, explicitly confirmed step —
          never a side effect of saving — and you see the exact metadata first. Sandbox is
          the default so you can rehearse the whole thing without putting a real DOI into the
          world.
        </p>
        {health.length > 0 && (
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 0" }}>
            {health.map((h: any) => (
              <span key={h.name} className="pill"
                    style={{ color: h.status === "CONNECTED" ? "var(--current)"
                           : h.status === "KEY REQUIRED" ? "var(--gold)" : "var(--coral)" }}>
                {h.name}: {h.status}
              </span>
            ))}
          </p>
        )}
      </div>

      <details className="card" style={{ maxWidth: 780, marginBottom: 26 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Prepare a deposit</summary>
        <form action={create} style={{ marginTop: 16 }}>
          <div className="field"><label htmlFor="title">Title</label>
            <input id="title" name="title" required /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 150px" }}>
              <label htmlFor="repository">Repository</label>
              <select id="repository" name="repository">
                <option value="zenodo">Zenodo (mints a DOI)</option>
                <option value="osf">OSF (private project)</option>
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="upload_type">Type</label>
              <select id="upload_type" name="upload_type">
                {["publication", "dataset", "software", "presentation", "thesis"].map((t) =>
                  <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="license">License</label>
              <select id="license" name="license">
                <option value="cc-by-4.0">CC BY 4.0</option>
                <option value="cc-by-sa-4.0">CC BY-SA 4.0</option>
                <option value="cc-by-nc-4.0">CC BY-NC 4.0</option>
                <option value="cc-zero">CC0</option>
              </select>
            </div>
          </div>
          {publications.length > 0 && (
            <div className="field">
              <label htmlFor="publication_id">From a publication</label>
              <select id="publication_id" name="publication_id" defaultValue="">
                <option value="">— none —</option>
                {publications.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.title.slice(0, 70)}</option>
                ))}
              </select>
            </div>
          )}
          {documents.length > 0 && (
            <div className="field">
              <label htmlFor="document_id">Or a document</label>
              <select id="document_id" name="document_id" defaultValue="">
                <option value="">— none —</option>
                {documents.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.title.slice(0, 70)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field"><label htmlFor="creators">Creators (one per line)</label>
            <textarea id="creators" name="creators" rows={2}
                      defaultValue={user.name} placeholder="Crews, Krystalore" /></div>
          <div className="field"><label htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={3} /></div>
          <div className="field"><label htmlFor="keywords">Keywords</label>
            <input id="keywords" name="keywords" placeholder="somatic psychology, embodiment" /></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                          marginBottom: 16 }}>
            <input type="checkbox" name="sandbox" defaultChecked style={{ width: "auto" }} />
            Use the sandbox (recommended — rehearse without minting a real DOI)
          </label>
          <button className="btn btn-primary">Prepare deposit</button>
        </form>
      </details>

      {deposits.length === 0 && <p style={{ color: "var(--muted)" }}>No deposits yet.</p>}
      {deposits.map((d: any) => (
        <div key={d.id} className="card" style={{ marginBottom: 10, maxWidth: 900,
             borderLeft: `3px solid ${d.status === "published" ? "var(--coral)" : "var(--line)"}` }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <strong><Link href={`/app/deposit/${d.id}`} style={{ color: "inherit" }}>
              {d.title}</Link></strong>
            <span className="pill">{d.repository}</span>
            {d.sandbox && <span className="pill">sandbox</span>}
            <span className="pill" style={{ color: d.status === "published" ? "var(--coral)" : undefined }}>
              {d.status}
            </span>
            {d.doi && <span className="pill" style={{ color: "var(--current)" }}>{d.doi}</span>}
            <Link href={`/app/deposit/${d.id}`} style={{ marginLeft: "auto", fontSize: ".88rem" }}>
              open →
            </Link>
          </div>
          {d.last_error && (
            <p className="error" style={{ fontSize: ".86rem", margin: "8px 0 0" }}>{d.last_error}</p>
          )}
        </div>
      ))}
    </>
  );
}
