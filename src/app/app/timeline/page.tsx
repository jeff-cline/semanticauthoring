import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { milestoneEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Milestones and timeline" };

// Sophisticated and encouraging, never gamified. No points, no streaks, no badges.
const CATALOG = [
  "First reading completed", "10 readings", "100 annotations", "First synthesis",
  "First semester complete", "First major paper", "Research topic selected",
  "Research question developed", "Proposal submitted", "Proposal approved",
  "Ethics / IRB approval", "Data collection started", "Data collection completed",
  "First dissertation chapter", "Dissertation draft complete", "Defense scheduled",
  "Dissertation defended", "First conference presentation", "First journal submission",
  "First revise-and-resubmit", "First peer-reviewed publication", "First citation",
  "Doctorate completed",
];

export default async function Timeline() {
  const user = (await currentUser())!;
  const rows = await q<any>(
    `SELECT * FROM milestones WHERE owner_id=$1 ORDER BY achieved_at DESC`, [user.id]);
  const claimed = new Set(rows.map((r: any) => r.title));

  async function record(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const row = await one<{ id: number }>(
      `INSERT INTO milestones (owner_id, title, detail, reflection, visibility)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [me.id, title.slice(0, 300), String(formData.get("detail") ?? "").slice(0, 2000),
       String(formData.get("reflection") ?? "").slice(0, 4000),
       String(formData.get("visibility") ?? "only_me")]);
    await logEvent("milestone", "recorded", { actorId: me.id, entityId: row?.id, detail: title });
    milestoneEmail(me.email, me.name || me.email, title).catch(() => {});
    revalidatePath("/app/timeline");
  }

  return (
    <>
      <p className="eyebrow">Celebrate</p>
      <h1>Milestones and timeline</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Scholarship can take years. The readings finished, the questions discovered, the drafts
        rewritten — not only the degree at the end. You choose what stays private and what
        becomes part of your public record.
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 26 }}>
        <form action={record} className="card stage stage-celebrate">
          <h2 style={{ fontSize: "1.1rem" }}>Record a milestone</h2>
          <div className="field">
            <label htmlFor="title">What did you reach?</label>
            <input id="title" name="title" list="catalog" required
                   placeholder="Choose one, or write your own" />
            <datalist id="catalog">
              {CATALOG.filter((c) => !claimed.has(c)).map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="detail">Anything worth noting?</label>
            <input id="detail" name="detail" />
          </div>
          <div className="field">
            <label htmlFor="reflection">Reflect on this moment</label>
            <textarea id="reflection" name="reflection" rows={3}
                      placeholder="What did it take to get here?" />
          </div>
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="visibility">Visibility</label>
            <select id="visibility" name="visibility">
              <option value="only_me">Only me</option>
              <option value="public">Public timeline</option>
            </select>
          </div>
          <button className="btn btn-primary">Record it</button>
        </form>

        <div>
          <h2 style={{ fontSize: "1.1rem" }}>Your timeline ({rows.length})</h2>
          {rows.length === 0 && (
            <p style={{ color: "var(--muted)" }}>
              Nothing recorded yet. The first reading you finish counts.
            </p>
          )}
          {rows.map((m: any) => (
            <div key={m.id} className="card" style={{ marginBottom: 12,
                 borderLeft: "3px solid var(--gold)" }}>
              <h3 style={{ fontSize: "1.02rem", color: "var(--gold)", marginBottom: 4 }}>{m.title}</h3>
              {m.detail && <p style={{ margin: "0 0 6px", fontSize: ".93rem" }}>{m.detail}</p>}
              {m.reflection && (
                <p style={{ color: "var(--muted)", fontSize: ".92rem", fontStyle: "italic", margin: "0 0 6px" }}>
                  {m.reflection}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="pill">{m.visibility === "public" ? "public" : "private"}</span>
                <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                  {new Date(m.achieved_at).toLocaleDateString(undefined,
                    { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
