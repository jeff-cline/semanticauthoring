import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { searchGrants, grantProviderHealth } from "@/lib/grants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grants" };

const STATUSES = ["watching", "preparing", "submitted", "awarded", "declined"];

export default async function Grants(
  { searchParams }: { searchParams: Promise<{ q?: string }> },
) {
  const user = (await currentUser())!;
  const { q: term } = await searchParams;

  const [saved, results, health] = await Promise.all([
    q<any>(`SELECT * FROM grant_saved WHERE owner_id=$1 ORDER BY
              CASE status WHEN 'preparing' THEN 0 WHEN 'submitted' THEN 1
                          WHEN 'watching' THEN 2 ELSE 3 END,
              close_date NULLS LAST`, [user.id]),
    term ? searchGrants(term) : Promise.resolve({ open: [], awarded: [], failed: [] }),
    grantProviderHealth().catch(() => []),
  ]);

  const savedKeys = new Set(saved.map((s: any) => `${s.provider}:${s.provider_id}`));

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    await q(
      `INSERT INTO grant_saved (owner_id, provider, provider_id, title, agency, url,
                                close_date, amount, summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (owner_id, provider, provider_id) DO NOTHING`,
      [me.id, String(formData.get("provider")), String(formData.get("provider_id")),
       String(formData.get("title")).slice(0, 500), String(formData.get("agency")).slice(0, 200),
       String(formData.get("url")).slice(0, 600),
       String(formData.get("close_date") ?? "") || null,
       String(formData.get("amount") ?? "").slice(0, 60),
       String(formData.get("summary") ?? "").slice(0, 2000)]);
    await logEvent("grant", "saved", { actorId: me.id, detail: String(formData.get("title")).slice(0, 80) });
    revalidatePath("/app/grants");
  }

  async function update(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    if (formData.get("remove")) {
      await q(`DELETE FROM grant_saved WHERE id=$1 AND owner_id=$2`, [id, me.id]);
    } else {
      await q(`UPDATE grant_saved SET status=$1, note=$2, updated_at=now()
                WHERE id=$3 AND owner_id=$4`,
        [String(formData.get("status") ?? "watching"),
         String(formData.get("note") ?? "").slice(0, 4000), id, me.id]);
    }
    revalidatePath("/app/grants");
  }

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Grants</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Search open federal opportunities alongside what NIH and NSF have already funded.
      </p>

      <div className="card" style={{ maxWidth: 780, margin: "18px 0",
           borderLeft: "3px solid var(--gold)" }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}>
          <strong>Two different things, kept separate.</strong>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          <strong>Open opportunities</strong> from Grants.gov are calls you can apply to.
          <strong> Funded awards</strong> from NIH RePORTER and NSF are money already granted —
          you cannot apply to them. They are worth reading anyway: they show who funds work
          like yours, which program officers to approach, and who might collaborate.
        </p>
        {health.length > 0 && (
          <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 0" }}>
            {health.map((h: any) => (
              <span key={h.name} className="pill"
                    style={{ color: h.status === "PUBLIC API" ? "var(--current)" : "var(--coral)" }}>
                {h.name}: {h.status}
              </span>
            ))}
          </p>
        )}
      </div>

      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0" }}>
        <input name="q" defaultValue={term ?? ""} style={{ maxWidth: 380 }}
               placeholder="somatic psychology, embodiment, adult learning…" />
        <button className="btn btn-primary">Search funders</button>
      </form>

      {results.failed.length > 0 && (
        <p className="error">
          Did not respond: {results.failed.join(", ")}. Results below are from the rest.
        </p>
      )}

      {term && results.open.length === 0 && results.awarded.length === 0 &&
        results.failed.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Nothing matched that term.</p>
      )}

      {results.open.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.15rem" }}>Open opportunities ({results.open.length})</h2>
          {results.open.map((o) => (
            <ResultCard key={`${o.provider}-${o.providerId}`} o={o} action={save}
                        saved={savedKeys.has(`${o.provider}:${o.providerId}`)} />
          ))}
        </>
      )}

      {results.awarded.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.15rem", marginTop: 30 }}>
            Already funded ({results.awarded.length})
          </h2>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: -6 }}>
            Intelligence, not applications.
          </p>
          {results.awarded.map((o) => (
            <ResultCard key={`${o.provider}-${o.providerId}`} o={o} action={save}
                        saved={savedKeys.has(`${o.provider}:${o.providerId}`)} />
          ))}
        </>
      )}

      <h2 style={{ fontSize: "1.15rem", marginTop: 36 }}>Tracked ({saved.length})</h2>
      {saved.length === 0 && (
        <p style={{ color: "var(--muted)" }}>Nothing tracked yet.</p>
      )}
      {saved.map((s: any) => (
        <details key={s.id} className="card" style={{ marginBottom: 10, maxWidth: 900 }}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{s.title}</strong>{" "}
            <span className="pill">{s.status}</span>{" "}
            <span className="pill">{s.provider.replace("_", ".")}</span>{" "}
            {s.close_date && (
              <span className="pill" style={{ color: "var(--gold)" }}>
                closes {new Date(s.close_date).toLocaleDateString()}
              </span>
            )}
          </summary>
          <div style={{ marginTop: 12 }}>
            <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              {s.agency}{s.amount && ` · ${s.amount}`}
            </p>
            {s.summary && <p style={{ fontSize: ".92rem" }}>{s.summary}</p>}
            {s.url && <p><a href={s.url} target="_blank" rel="noopener noreferrer">
              Open at the funder ↗</a></p>}
            <form action={update} style={{ display: "flex", gap: 12, flexWrap: "wrap",
                                           alignItems: "flex-end" }}>
              <input type="hidden" name="id" value={s.id} />
              <div className="field" style={{ marginBottom: 0, flex: "0 1 170px" }}>
                <label htmlFor={`st${s.id}`}>Status</label>
                <select id={`st${s.id}`} name="status" defaultValue={s.status}>
                  {STATUSES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, flex: "2 1 220px" }}>
                <label htmlFor={`n${s.id}`}>Note</label>
                <input id={`n${s.id}`} name="note" defaultValue={s.note} />
              </div>
              <button className="btn btn-secondary" style={{ padding: "10px 16px" }}>Save</button>
              <button className="btn btn-secondary" name="remove" value="1"
                      style={{ padding: "10px 16px" }}>Remove</button>
            </form>
          </div>
        </details>
      ))}
    </>
  );
}

function ResultCard({ o, action, saved }: { o: any; action: any; saved: boolean }) {
  return (
    <div className="card" style={{ marginBottom: 10, maxWidth: 900,
         borderLeft: `3px solid ${o.kind === "open" ? "var(--current)" : "var(--muted)"}` }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <strong style={{ fontSize: ".98rem", flex: "1 1 320px" }}>{o.title}</strong>
        <span className="pill" style={{ color: o.kind === "open" ? "var(--current)" : "var(--muted)" }}>
          {o.kind === "open" ? "open call" : "awarded"}
        </span>
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: "6px 0" }}>
        {[o.agency, o.amount, o.closeDate && `closes ${new Date(o.closeDate).toLocaleDateString()}`]
          .filter(Boolean).join(" · ")}
      </p>
      {o.summary && (
        <p style={{ fontSize: ".9rem", margin: "0 0 8px" }}>{o.summary.slice(0, 260)}</p>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: ".88rem" }}>
          Open at the funder ↗
        </a>
        {saved ? (
          <span className="pill" style={{ marginLeft: "auto" }}>tracked</span>
        ) : (
          <form action={action} style={{ marginLeft: "auto" }}>
            {["provider", "providerId", "title", "agency", "url", "amount", "summary"].map((k) => (
              <input key={k} type="hidden"
                     name={k === "providerId" ? "provider_id" : k} value={o[k] ?? ""} />
            ))}
            <input type="hidden" name="close_date" value={o.closeDate ?? ""} />
            <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: ".85rem" }}>
              Track
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
