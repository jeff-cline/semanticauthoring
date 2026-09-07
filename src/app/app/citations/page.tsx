import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { openAlexByDoi, crossrefByDoi, normalizeDoi } from "@/lib/scholarly";
import { citationCount } from "@/lib/providers";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const metadata = { title: "Citation watch" };

export default async function Citations(
  { searchParams }: { searchParams: Promise<{ checked?: string }> },
) {
  const user = (await currentUser())!;
  const { checked } = await searchParams;

  const [watched, mine] = await Promise.all([
    q<any>(`SELECT * FROM citation_watch WHERE owner_id=$1 ORDER BY label, last_count DESC`,
      [user.id]),
    q<any>(`SELECT doi, title FROM publications
             WHERE owner_id=$1 AND doi <> '' AND status='published'`, [user.id]).catch(() => []),
  ]);

  async function add(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const doi = normalizeDoi(String(formData.get("doi") ?? ""));
    if (!doi) return;
    // Resolve first — a DOI that does not exist should not become a watch.
    const w = await crossrefByDoi(doi) ?? await openAlexByDoi(doi);
    if (!w) {
      await notify(me.id, "system", `That DOI did not resolve: ${doi}`,
        { body: "Nothing was added — a watch on a non-existent DOI would never fire." });
      revalidatePath("/app/citations");
      return;
    }
    await q(
      `INSERT INTO citation_watch (owner_id, doi, title, label, last_count, is_retracted,
                                   last_checked_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (owner_id, doi) DO UPDATE SET title=EXCLUDED.title, updated_at=now()`,
      [me.id, doi, w.title.slice(0, 400), String(formData.get("label") ?? "tracked"),
       w.citationCount ?? 0, w.isRetracted]);
    await logEvent("citation_watch", "added", { actorId: me.id, detail: doi });
    revalidatePath("/app/citations");
  }

  async function checkAll() {
    "use server";
    const me = (await currentUser())!;
    const rows = await q<any>(`SELECT * FROM citation_watch WHERE owner_id=$1`, [me.id]);
    let changed = 0;
    for (const r of rows) {
      const [oa, oc] = await Promise.all([
        openAlexByDoi(r.doi).catch(() => null),
        citationCount(r.doi).catch(() => null),
      ]);
      const count = oa?.citationCount ?? oc ?? r.last_count;
      const retracted = Boolean(oa?.isRetracted);

      if (count > r.last_count) {
        const delta = count - r.last_count;
        await notify(me.id, "citation",
          `${delta} new citation${delta === 1 ? "" : "s"} — ${r.title.slice(0, 80)}`,
          { body: `Now ${count}, was ${r.last_count}.`, href: "/app/citations" });
        changed++;
      }
      if (retracted && !r.is_retracted) {
        await notify(me.id, "retraction",
          `RETRACTED: ${r.title.slice(0, 90)}`,
          { body: `${r.doi} is now flagged as retracted. Check anywhere you cite it.`,
            href: "/app/integrity" });
        changed++;
      }
      await q(
        `UPDATE citation_watch SET last_count=$1, is_retracted=$2, last_checked_at=now(),
                updated_at=now() WHERE id=$3`, [count, retracted, r.id]);
    }
    revalidatePath("/app/citations");
    const { redirect } = await import("next/navigation");
    redirect(`/app/citations?checked=${changed}`);
  }

  async function remove(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await q(`DELETE FROM citation_watch WHERE id=$1 AND owner_id=$2`,
      [Number(formData.get("id")), me.id]);
    revalidatePath("/app/citations");
  }

  const total = watched.reduce((n: number, w: any) => n + w.last_count, 0);

  return (
    <>
      <p className="eyebrow">Celebrate</p>
      <h1>Citation watch</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Track DOIs — your own work, or papers your argument depends on — and be told when the
        count moves or a retraction appears. A retraction in something you cite is the single
        most useful alert this platform can send you.
      </p>

      {watched.length > 0 && (
        <div style={{ display: "flex", gap: 24, margin: "22px 0" }}>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: "2rem", color: "var(--current)" }}>
              {total.toLocaleString()}
            </div>
            <div style={{ color: "var(--muted)", fontSize: ".88rem" }}>citations tracked</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: "2rem", color: "var(--gold)" }}>
              {watched.length}
            </div>
            <div style={{ color: "var(--muted)", fontSize: ".88rem" }}>works watched</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <form action={checkAll}>
          <button className="btn btn-primary">Check all now</button>
        </form>
        {checked !== undefined && (
          <span style={{ color: checked === "0" ? "var(--muted)" : "var(--current)",
                         alignSelf: "center", fontSize: ".92rem" }}>
            {checked === "0" ? "No changes since the last check." : `${checked} change(s) found.`}
          </span>
        )}
      </div>

      <form action={add} className="card" style={{ maxWidth: 640, marginBottom: 26 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Watch a DOI</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "2 1 240px", marginBottom: 0 }}>
            <label htmlFor="doi">DOI</label>
            <input id="doi" name="doi" placeholder="10.1038/nature12373" required />
          </div>
          <div className="field" style={{ flex: "0 1 140px", marginBottom: 0 }}>
            <label htmlFor="label">Whose</label>
            <select id="label" name="label">
              <option value="mine">My work</option><option value="tracked">Tracking</option>
            </select>
          </div>
          <button className="btn btn-secondary" style={{ padding: "12px 18px" }}>Watch</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 12, marginBottom: 0 }}>
          The DOI is resolved before it is added — a watch on something that does not exist
          would never fire.
        </p>
        {mine.length > 0 && (
          <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 10, marginBottom: 0 }}>
            Your published DOIs: {mine.map((m: any) => m.doi).join(", ")}
          </p>
        )}
      </form>

      {watched.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing watched yet.</p>}
      {watched.map((w: any) => (
        <div key={w.id} className="card" style={{ marginBottom: 10, maxWidth: 900,
             borderLeft: `3px solid ${w.is_retracted ? "var(--coral)" : "var(--current)"}` }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <strong style={{ flex: "1 1 300px", fontSize: ".96rem" }}>{w.title || w.doi}</strong>
            {w.is_retracted && (
              <span className="pill" style={{ color: "var(--coral)" }}>RETRACTED</span>
            )}
            <span className="pill">{w.label}</span>
            <span className="pill" style={{ color: "var(--current)" }}>
              {w.last_count} citations
            </span>
            <form action={remove}>
              <input type="hidden" name="id" value={w.id} />
              <button className="btn btn-secondary"
                      style={{ padding: "4px 12px", fontSize: ".8rem" }}>Stop</button>
            </form>
          </div>
          <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
            <a href={`https://doi.org/${w.doi}`} target="_blank" rel="noopener noreferrer">
              {w.doi}
            </a>
            {w.last_checked_at && ` · checked ${new Date(w.last_checked_at).toLocaleString()}`}
          </p>
        </div>
      ))}
    </>
  );
}
