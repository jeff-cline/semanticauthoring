import Link from "next/link";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { advisingInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Advisees" };

const ROLES = ["chair", "advisor", "committee", "reader"];

export default async function Faculty() {
  const user = (await currentUser())!;

  const advisees = await q<any>(
    `SELECT a.*, u.name, u.email,
            d.title AS diss_title, d.proposal_status, d.defense_on,
            (SELECT count(*)::int FROM dissertation_chapters c
              WHERE c.owner_id = a.scholar_id AND c.status='complete') AS chapters_done,
            (SELECT count(*)::int FROM dissertation_chapters c
              WHERE c.owner_id = a.scholar_id) AS chapters_total,
            (SELECT count(*)::int FROM claims c
              WHERE c.owner_id = a.scholar_id
                AND NOT EXISTS (SELECT 1 FROM claim_evidence e WHERE e.claim_id=c.id)) AS unsupported,
            (SELECT count(*)::int FROM shares s
              WHERE s.owner_id = a.scholar_id AND lower(s.reviewer_email)=lower($2)
                AND s.status='active') AS shared_with_me,
            (SELECT max(m.achieved_at) FROM milestones m WHERE m.owner_id = a.scholar_id) AS last_milestone
       FROM advising a
       LEFT JOIN users u ON u.id = a.scholar_id
       LEFT JOIN LATERAL (SELECT title, proposal_status, defense_on FROM dissertations
                           WHERE owner_id = a.scholar_id LIMIT 1) d ON TRUE
      WHERE a.faculty_id = $1 ORDER BY a.status, u.name NULLS LAST`,
    [user.id, user.email]);

  async function invite(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email.includes("@")) return;
    const token = randomBytes(24).toString("hex");
    const role = String(formData.get("role") ?? "advisor");
    const scholar = await one<any>(`SELECT id FROM users WHERE lower(email)=$1`, [email]);
    const row = await one<{ id: number }>(
      `INSERT INTO advising (faculty_id, scholar_id, invite_email, invite_token, role, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, scholar?.id ?? null, email, token, role,
       String(formData.get("note") ?? "").slice(0, 1000)]);
    const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
    advisingInviteEmail(email, me.name || me.email, role, `${base}/advising/${token}`)
      .catch(() => {});
    await logEvent("advising", "invited", { actorId: me.id, entityId: row?.id, detail: email });
    revalidatePath("/app/faculty");
  }

  async function end(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    await q(`UPDATE advising SET status='ended', updated_at=now()
              WHERE id=$1 AND faculty_id=$2`, [id, me.id]);
    revalidatePath("/app/faculty");
  }

  const active = advisees.filter((a: any) => a.status === "active");
  const pending = advisees.filter((a: any) => a.status === "invited");

  return (
    <>
      <p className="eyebrow">Faculty</p>
      <h1>Advisees</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Progress at a glance for the scholars who have accepted you as an advisor.
      </p>

      <div className="card" style={{ maxWidth: 760, margin: "18px 0",
           borderLeft: "3px solid var(--seaglass)" }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}>
          <strong>What you can and cannot see.</strong>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          Progress signals — chapter status, proposal stage, deadlines, milestones, and how
          many claims still lack evidence — plus anything a scholar deliberately sends you for
          review. You cannot see their research library, journal, Life Map, or unshared drafts.
          That boundary is enforced in the queries, not by convention.
        </p>
      </div>

      {active.length === 0 && pending.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No advisees yet. Invite one below.</p>
      )}

      {active.map((a: any) => {
        const pct = a.chapters_total > 0
          ? Math.round((a.chapters_done / a.chapters_total) * 100) : 0;
        const soon = a.defense_on
          ? Math.ceil((new Date(a.defense_on).getTime() - Date.now()) / 864e5) : null;
        return (
          <div key={a.id} className="card" style={{ marginBottom: 12, maxWidth: 900,
               borderLeft: "3px solid var(--current)" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <strong style={{ fontSize: "1.03rem" }}>{a.name || a.invite_email}</strong>
              <span className="pill">{a.role}</span>
              {a.diss_title && (
                <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{a.diss_title}</span>
              )}
              <form action={end} style={{ marginLeft: "auto" }}>
                <input type="hidden" name="id" value={a.id} />
                <button className="btn btn-secondary"
                        style={{ padding: "4px 12px", fontSize: ".8rem" }}>End</button>
              </form>
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
              <Signal label="Chapters" value={`${a.chapters_done}/${a.chapters_total}`}
                      accent="var(--current)" />
              <Signal label="Proposal" value={String(a.proposal_status ?? "—").replace(/_/g, " ")}
                      accent="var(--gold)" />
              <Signal label="Unsupported claims" value={String(a.unsupported)}
                      accent={a.unsupported > 0 ? "var(--coral)" : "var(--muted)"} />
              <Signal label="Shared with you" value={String(a.shared_with_me)}
                      accent="var(--review)" />
              {soon !== null && (
                <Signal label="Defense" value={soon >= 0 ? `in ${soon}d` : "past"}
                        accent="var(--seaglass)" />
              )}
            </div>

            {a.chapters_total > 0 && (
              <div style={{ marginTop: 12, height: 6, background: "var(--line)",
                            borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--current)" }} />
              </div>
            )}

            {a.shared_with_me > 0 && (
              <p style={{ margin: "12px 0 0", fontSize: ".9rem" }}>
                <Link href="/app/review">Open what they&rsquo;ve shared with you →</Link>
              </p>
            )}
            {a.last_milestone && (
              <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "8px 0 0" }}>
                Last milestone {new Date(a.last_milestone).toLocaleDateString()}
              </p>
            )}
          </div>
        );
      })}

      {pending.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginTop: 28 }}>Awaiting acceptance</h2>
          {pending.map((a: any) => (
            <div key={a.id} className="card" style={{ marginBottom: 8, padding: 14 }}>
              {a.invite_email} <span className="pill">{a.role}</span>{" "}
              <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                invited {new Date(a.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </>
      )}

      <form action={invite} className="card" style={{ marginTop: 26, maxWidth: 640 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Invite a scholar</h2>
        <div className="field"><label htmlFor="email">Their email</label>
          <input id="email" name="email" type="email" required /></div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label htmlFor="role">Your role</label>
          <select id="role" name="role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        </div>
        <div className="field"><label htmlFor="note">A note (optional)</label>
          <textarea id="note" name="note" rows={2} /></div>
        <button className="btn btn-primary">Send invitation</button>
        <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 12, marginBottom: 0 }}>
          They choose whether to accept. Nothing is shared until they do.
        </p>
      </form>
    </>
  );
}

function Signal({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--serif)", fontSize: "1.3rem", color: accent }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: ".8rem" }}>{label}</div>
    </div>
  );
}
