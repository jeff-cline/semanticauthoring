import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { verifySource, providerHealth } from "@/lib/scholarly";

export const dynamic = "force-dynamic";
export const metadata = { title: "Citation integrity" };

const STATUS_COLOR: Record<string, string> = {
  VERIFIED_METADATA: "var(--current)",
  NOT_FOUND: "var(--coral)",
  MISMATCH: "var(--gold)",
  RETRACTED: "var(--coral)",
  CORRECTED: "var(--gold)",
  EXPRESSION_OF_CONCERN: "var(--coral)",
  UNVERIFIED: "var(--muted)",
  ERROR: "var(--muted)",
};

export default async function Integrity() {
  const user = (await currentUser())!;

  const [sources, health] = await Promise.all([
    q<any>(
      `SELECT s.id, s.title, s.authors, s.year, s.doi,
              c.status, c.detail, c.provider, c.checked_at
         FROM sources s
         LEFT JOIN LATERAL (
           SELECT status, detail, provider, checked_at FROM citation_checks
            WHERE source_id = s.id ORDER BY checked_at DESC LIMIT 1
         ) c ON TRUE
        WHERE s.owner_id=$1 ORDER BY s.created_at DESC`, [user.id]),
    providerHealth().catch(() => []),
  ]);

  async function check(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const sid = Number(formData.get("sourceId"));
    const src = await one<any>(
      `SELECT id, title, year, doi FROM sources WHERE id=$1 AND owner_id=$2`, [sid, me.id]);
    if (!src) return;

    const result = await verifySource(src);
    await q(
      `INSERT INTO citation_checks (source_id, owner_id, status, provider, detail, raw)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [sid, me.id, result.status, result.provider, result.detail,
       result.work ? JSON.stringify(result.work).slice(0, 8000) : ""]);

    // Record the provenance of anything we learned from an external index.
    if (result.work) {
      await q(
        `UPDATE sources SET provider=$1, provider_id=$2, source_url=$3, retrieved_at=now(),
                confidence=$4, updated_at=now() WHERE id=$5`,
        [result.work.provider, result.work.providerId, result.work.url,
         result.status === "VERIFIED_METADATA" ? "verified" : "unverified", sid]);
    }
    await logEvent("citation_check", result.status, { actorId: me.id, entityId: sid });
    revalidatePath("/app/integrity");
  }

  async function checkAll() {
    "use server";
    const me = (await currentUser())!;
    const list = await q<any>(
      `SELECT id, title, year, doi FROM sources
        WHERE owner_id=$1 AND doi <> '' ORDER BY created_at DESC LIMIT 25`, [me.id]);
    for (const src of list) {
      const result = await verifySource(src);
      await q(
        `INSERT INTO citation_checks (source_id, owner_id, status, provider, detail, raw)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [src.id, me.id, result.status, result.provider, result.detail,
         result.work ? JSON.stringify(result.work).slice(0, 8000) : ""]);
      if (result.work) {
        await q(
          `UPDATE sources SET provider=$1, provider_id=$2, source_url=$3, retrieved_at=now(),
                  confidence=$4, updated_at=now() WHERE id=$5`,
          [result.work.provider, result.work.providerId, result.work.url,
           result.status === "VERIFIED_METADATA" ? "verified" : "unverified", src.id]);
      }
    }
    await logEvent("citation_check", "batch", { actorId: me.id, detail: String(list.length) });
    revalidatePath("/app/integrity");
  }

  const withDoi = sources.filter((s: any) => s.doi);
  const flagged = sources.filter((s: any) =>
    ["RETRACTED", "NOT_FOUND", "MISMATCH", "EXPRESSION_OF_CONCERN"].includes(s.status));

  return (
    <>
      <p className="eyebrow">Author</p>
      <h1>Citation integrity</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Checks your recorded DOIs against Crossref and OpenAlex — does the DOI resolve, does
        the metadata match what you wrote down, and has the work been retracted or corrected?
      </p>
      <p style={{ color: "var(--muted)", maxWidth: 700, fontSize: ".93rem" }}>
        <strong>What this does not do:</strong> it never claims a paper supports your argument.
        That judgement is yours, and asserting it from metadata would be exactly the kind of
        fabrication this platform exists to prevent.
      </p>

      {health.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
          {health.map((h: any) => (
            <span key={h.name} className="pill"
                  style={{ color: h.status === "PUBLIC API" ? "var(--current)" : "var(--coral)" }}>
              {h.name}: {h.status} ({h.ms}ms)
            </span>
          ))}
        </div>
      )}

      {flagged.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--coral)", margin: "20px 0" }}>
          <strong style={{ color: "var(--coral)" }}>{flagged.length} need attention</strong>
          <p style={{ color: "var(--muted)", fontSize: ".92rem", margin: "4px 0 0" }}>
            Retracted, unresolvable, or disagreeing with the registry.
          </p>
        </div>
      )}

      {withDoi.length > 0 && (
        <form action={checkAll} style={{ margin: "20px 0" }}>
          <button className="btn btn-primary">
            Check all {Math.min(withDoi.length, 25)} sources with a DOI
          </button>
        </form>
      )}

      {sources.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          Nothing in your library yet. <Link href="/app/library">Add a source →</Link>
        </p>
      )}

      {sources.map((s: any) => (
        <div key={s.id} className="card" style={{ marginBottom: 10, maxWidth: 900,
             borderLeft: `3px solid ${STATUS_COLOR[s.status] ?? "var(--line)"}` }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 340px" }}>
              <strong><Link href={`/app/library/${s.id}`}>{s.title}</Link></strong>
              <div style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                {[s.authors, s.year].filter(Boolean).join(" · ")}
                {s.doi ? ` · ${s.doi}` : " · no DOI recorded"}
              </div>
              {s.status && (
                <div style={{ marginTop: 8 }}>
                  <span className="pill" style={{ color: STATUS_COLOR[s.status] }}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                  {s.provider && <span className="pill" style={{ marginLeft: 6 }}>{s.provider}</span>}
                  <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
                    {s.detail}
                  </p>
                  <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>
                    checked {new Date(s.checked_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <form action={check}>
              <input type="hidden" name="sourceId" value={s.id} />
              <button className="btn btn-secondary" style={{ padding: "8px 16px" }}>
                {s.status ? "Re-check" : "Check"}
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
