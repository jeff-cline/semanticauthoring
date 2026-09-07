import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import {
  zenodoCreateDraft, zenodoPublish, zenodoPayload, osfCreateProject, repoConfigured,
} from "@/lib/repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposit" };

export default async function DepositDetail(
  { params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ confirm?: string }> },
) {
  const { id } = await params;
  const { confirm } = await searchParams;
  const user = (await currentUser())!;

  const d = await one<any>(
    `SELECT * FROM deposits WHERE id=$1 AND owner_id=$2`, [Number(id), user.id]);
  if (!d) notFound();

  const configured = repoConfigured(d.repository, d.sandbox);
  const payload = zenodoPayload(d);

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const did = Number(formData.get("id"));
    await q(
      `UPDATE deposits SET title=$1, description=$2, creators=$3, keywords=$4,
              upload_type=$5, license=$6, sandbox=$7, updated_at=now()
        WHERE id=$8 AND owner_id=$9 AND status IN ('draft','prepared','failed')`,
      [String(formData.get("title") ?? "").slice(0, 400),
       String(formData.get("description") ?? "").slice(0, 8000),
       String(formData.get("creators") ?? "").slice(0, 2000),
       String(formData.get("keywords") ?? "").slice(0, 500),
       String(formData.get("upload_type") ?? "publication"),
       String(formData.get("license") ?? "cc-by-4.0"),
       formData.get("sandbox") !== null, did, me.id]);
    revalidatePath(`/app/deposit/${did}`);
  }

  async function createDraft(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const did = Number(formData.get("id"));
    const row = await one<any>(`SELECT * FROM deposits WHERE id=$1 AND owner_id=$2`, [did, me.id]);
    if (!row || row.status === "published") return;

    const res = row.repository === "osf"
      ? await osfCreateProject(row)
      : await zenodoCreateDraft(row, row.sandbox);

    if (res.ok) {
      const remoteId = String(res.data?.id ?? res.data?.data?.id ?? "");
      const url = res.data?.links?.html ?? res.data?.data?.links?.html ?? "";
      await q(
        `UPDATE deposits SET status='deposited', remote_id=$1, remote_url=$2, last_error='',
                updated_at=now() WHERE id=$3`, [remoteId, url, did]);
      await logEvent("deposit", "draft_created", { actorId: me.id, entityId: did,
        detail: remoteId });
    } else {
      await q(`UPDATE deposits SET status='failed', last_error=$1, updated_at=now() WHERE id=$2`,
        [String(res.error ?? "unknown error").slice(0, 500), did]);
    }
    revalidatePath(`/app/deposit/${did}`);
  }

  // Publishing is irreversible, so it requires the typed confirmation phrase.
  async function publish(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const did = Number(formData.get("id"));
    const typed = String(formData.get("confirm_text") ?? "").trim().toUpperCase();
    if (typed !== "PUBLISH") {
      revalidatePath(`/app/deposit/${did}`);
      const { redirect } = await import("next/navigation");
      redirect(`/app/deposit/${did}?confirm=mismatch`);
    }
    const row = await one<any>(`SELECT * FROM deposits WHERE id=$1 AND owner_id=$2`, [did, me.id]);
    if (!row?.remote_id || row.status === "published") return;

    const res = await zenodoPublish(row.remote_id, row.sandbox, true);
    if (res.ok) {
      await q(
        `UPDATE deposits SET status='published', doi=$1, remote_url=$2, published_at=now(),
                last_error='', updated_at=now() WHERE id=$3`,
        [String(res.data?.doi ?? ""), String(res.data?.links?.record_html ?? row.remote_url), did]);
      await logEvent("deposit", "published", { actorId: me.id, entityId: did,
        detail: String(res.data?.doi ?? "") });
    } else {
      await q(`UPDATE deposits SET last_error=$1, updated_at=now() WHERE id=$2`,
        [String(res.error ?? "publish failed").slice(0, 500), did]);
    }
    revalidatePath(`/app/deposit/${did}`);
  }

  const editable = ["draft", "prepared", "failed"].includes(d.status);

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/deposit">← Deposits</Link></p>
      <p className="eyebrow">
        {d.repository}{d.sandbox ? " · sandbox" : " · LIVE"} · {d.status}
      </p>
      <h1 style={{ marginBottom: 8 }}>{d.title}</h1>
      {d.doi && (
        <p><strong>DOI:</strong>{" "}
          <a href={`https://doi.org/${d.doi}`} target="_blank" rel="noopener noreferrer">
            {d.doi}
          </a>
        </p>
      )}
      {d.remote_url && (
        <p><a href={d.remote_url} target="_blank" rel="noopener noreferrer">
          Open the record ↗</a></p>
      )}
      {d.last_error && <p className="error">{d.last_error}</p>}
      {confirm === "mismatch" && (
        <p className="error">
          Nothing was published — the confirmation word did not match.
        </p>
      )}

      {!configured && (
        <div className="card" style={{ borderLeft: "3px solid var(--gold)", maxWidth: 780,
             margin: "18px 0" }}>
          <strong style={{ color: "var(--gold)" }}>No token configured</strong>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
            Set {d.repository === "osf" ? <code>OSF_TOKEN</code>
              : d.sandbox ? <code>ZENODO_SANDBOX_TOKEN</code> : <code>ZENODO_ACCESS_TOKEN</code>}{" "}
            to deposit. You can still prepare and preview the metadata below.
          </p>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 20 }}>
        <form action={save} className="card">
          <h2 style={{ fontSize: "1.05rem" }}>Metadata</h2>
          <input type="hidden" name="id" value={d.id} />
          <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="field"><label htmlFor="title">Title</label>
              <input id="title" name="title" defaultValue={d.title} /></div>
            <div className="field"><label htmlFor="creators">Creators (one per line)</label>
              <textarea id="creators" name="creators" rows={3} defaultValue={d.creators} /></div>
            <div className="field"><label htmlFor="description">Description</label>
              <textarea id="description" name="description" rows={5}
                        defaultValue={d.description} /></div>
            <div className="field"><label htmlFor="keywords">Keywords</label>
              <input id="keywords" name="keywords" defaultValue={d.keywords} /></div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1 1 150px" }}>
                <label htmlFor="upload_type">Type</label>
                <select id="upload_type" name="upload_type" defaultValue={d.upload_type}>
                  {["publication", "dataset", "software", "presentation", "thesis"].map((t) =>
                    <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: "1 1 150px" }}>
                <label htmlFor="license">License</label>
                <select id="license" name="license" defaultValue={d.license}>
                  {["cc-by-4.0", "cc-by-sa-4.0", "cc-by-nc-4.0", "cc-zero"].map((l) =>
                    <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                            marginBottom: 14 }}>
              <input type="checkbox" name="sandbox" defaultChecked={d.sandbox}
                     style={{ width: "auto" }} /> Sandbox
            </label>
            <button className="btn btn-secondary">Save metadata</button>
          </fieldset>
          {!editable && (
            <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 10 }}>
              This deposit has been sent to the repository, so its metadata is locked here.
              Edit it at the repository itself.
            </p>
          )}
        </form>

        <div>
          <div className="card">
            <h2 style={{ fontSize: "1.05rem" }}>Exactly what will be sent</h2>
            <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>
              No surprises — this is the literal payload.
            </p>
            <pre style={{ background: "var(--paper)", border: "1px solid var(--line)",
                          borderRadius: 8, padding: 14, fontSize: ".78rem", overflowX: "auto",
                          margin: 0 }}>
{JSON.stringify(payload, null, 2)}
            </pre>
          </div>

          {d.status !== "published" && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: "1.05rem" }}>Send it</h2>
              {!d.remote_id ? (
                <form action={createDraft}>
                  <input type="hidden" name="id" value={d.id} />
                  <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
                    Step one creates a <strong>draft</strong>. Reversible — no DOI is minted and
                    nothing becomes public.
                  </p>
                  <button className="btn btn-primary" disabled={!configured}>
                    Create draft at {d.repository}
                  </button>
                </form>
              ) : d.repository === "zenodo" ? (
                <form action={publish}>
                  <input type="hidden" name="id" value={d.id} />
                  <p style={{ color: "var(--coral-ink)", fontSize: ".92rem" }}>
                    <strong>This is irreversible.</strong> Publishing mints a permanent DOI
                    {d.sandbox ? " in the sandbox" : " on the live Zenodo"} and the record
                    cannot be withdrawn.
                  </p>
                  <div className="field">
                    <label htmlFor="confirm_text">Type PUBLISH to confirm</label>
                    <input id="confirm_text" name="confirm_text" autoComplete="off"
                           style={{ maxWidth: 220 }} />
                  </div>
                  <button className="btn btn-primary">Publish and mint the DOI</button>
                </form>
              ) : (
                <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>
                  The OSF project has been created privately. Make it public at OSF when you
                  are ready — we deliberately do not flip that switch for you.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
