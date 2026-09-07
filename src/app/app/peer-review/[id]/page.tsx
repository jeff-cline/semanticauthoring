import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { reviewAssignmentEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review round" };

const RECS: Record<string, [string, string]> = {
  accept: ["Accept", "var(--current)"],
  minor_revisions: ["Minor revisions", "var(--seaglass)"],
  major_revisions: ["Major revisions", "var(--gold)"],
  reject: ["Reject", "var(--coral)"],
  unsure: ["Unsure", "var(--muted)"],
};

export default async function Round({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  const round = await one<any>(
    `SELECT * FROM review_rounds WHERE id=$1 AND owner_id=$2`, [Number(id), user.id]);
  if (!round) notFound();

  const assignments = await q<any>(
    `SELECT * FROM review_assignments WHERE round_id=$1 ORDER BY created_at`, [round.id]);

  async function invite(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const rid = Number(formData.get("roundId"));
    const r = await one<any>(`SELECT * FROM review_rounds WHERE id=$1 AND owner_id=$2`,
      [rid, me.id]);
    if (!r) return;
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email.includes("@")) return;
    const token = randomBytes(24).toString("hex");
    const row = await one<{ id: number }>(
      `INSERT INTO review_assignments (round_id, owner_id, reviewer_name, reviewer_email,
                                       token, expires_at)
       VALUES ($1,$2,$3,$4,$5, now() + interval '120 days') RETURNING id`,
      [rid, me.id, String(formData.get("name") ?? "").slice(0, 200), email, token]);
    const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
    reviewAssignmentEmail(email, me.name || me.email, r.title,
      `${base}/peer-review/${token}`,
      r.due_on ? new Date(r.due_on).toLocaleDateString() : undefined, r.blinding)
      .catch(() => {});
    await logEvent("review_assignment", "invited", { actorId: me.id, entityId: row?.id,
      detail: email });
    revalidatePath(`/app/peer-review/${rid}`);
  }

  async function withdraw(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const aid = Number(formData.get("assignmentId"));
    await q(`UPDATE review_assignments SET status='withdrawn', updated_at=now()
              WHERE id=$1 AND owner_id=$2`, [aid, me.id]);
    revalidatePath(`/app/peer-review/${formData.get("roundId")}`);
  }

  async function closeRound(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const rid = Number(formData.get("roundId"));
    await q(`UPDATE review_rounds SET status=CASE WHEN status='open' THEN 'closed' ELSE 'open' END,
                    updated_at=now() WHERE id=$1 AND owner_id=$2`, [rid, me.id]);
    revalidatePath(`/app/peer-review/${rid}`);
  }

  const returned = assignments.filter((a: any) => a.status === "submitted");
  const tally = returned.reduce((m: Record<string, number>, a: any) => {
    if (a.recommendation) m[a.recommendation] = (m[a.recommendation] ?? 0) + 1;
    return m;
  }, {});

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/peer-review">← Peer review</Link></p>
      <p className="eyebrow">Round {round.round_number} · {round.blinding} blind</p>
      <h1 style={{ marginBottom: 6 }}>{round.title}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {returned.length} of {assignments.length} returned
        {round.due_on && ` · due ${new Date(round.due_on).toLocaleDateString()}`}
        {` · ${round.status}`}
      </p>
      <form action={closeRound} style={{ marginBottom: 20 }}>
        <input type="hidden" name="roundId" value={round.id} />
        <button className="btn btn-secondary" style={{ padding: "8px 16px" }}>
          {round.status === "open" ? "Close round" : "Reopen round"}
        </button>
      </form>

      {Object.keys(tally).length > 0 && (
        <div className="card" style={{ maxWidth: 700, marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.02rem" }}>Recommendations</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {Object.entries(tally).map(([k, n]) => (
              <span key={k} className="pill" style={{ color: RECS[k]?.[1] }}>
                {RECS[k]?.[0] ?? k} ×{n}
              </span>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: "10px 0 0" }}>
            A tally, not a verdict. Reviewers disagreeing is information, not a problem to
            average away.
          </p>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div>
          <h2 style={{ fontSize: "1.1rem" }}>Reviewers ({assignments.length})</h2>
          {assignments.length === 0 && (
            <p style={{ color: "var(--muted)" }}>Nobody invited yet.</p>
          )}
          {assignments.map((a: any) => (
            <details key={a.id} className="card" style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer" }}>
                <strong>{a.reviewer_name || a.reviewer_email}</strong>{" "}
                <span className="pill">{a.status}</span>{" "}
                {a.recommendation && (
                  <span className="pill" style={{ color: RECS[a.recommendation]?.[1] }}>
                    {RECS[a.recommendation]?.[0] ?? a.recommendation}
                  </span>
                )}
              </summary>
              <div style={{ marginTop: 12 }}>
                {a.status === "submitted" ? (
                  <>
                    {[["Summary", a.summary], ["Strengths", a.strengths],
                      ["Concerns", a.concerns],
                      ["Confidential to you", a.confidential]].map(([l, v]) => v ? (
                      <div key={l as string} style={{ marginBottom: 12 }}>
                        <p className="eyebrow" style={{ marginBottom: 2 }}>{l}</p>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{v}</p>
                      </div>
                    ) : null)}
                    <p style={{ color: "var(--muted)", fontSize: ".8rem" }}>
                      Returned {new Date(a.submitted_at).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
                    Nothing returned yet. Invited {new Date(a.created_at).toLocaleDateString()}.
                  </p>
                )}
                {a.status !== "withdrawn" && a.status !== "submitted" && (
                  <form action={withdraw}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <input type="hidden" name="roundId" value={round.id} />
                    <button className="btn btn-secondary"
                            style={{ padding: "4px 12px", fontSize: ".8rem" }}>
                      Withdraw invitation
                    </button>
                  </form>
                )}
              </div>
            </details>
          ))}
        </div>

        <form action={invite} className="card">
          <h2 style={{ fontSize: "1.05rem" }}>Invite a reviewer</h2>
          <input type="hidden" name="roundId" value={round.id} />
          <div className="field"><label htmlFor="name">Their name</label>
            <input id="name" name="name" /></div>
          <div className="field"><label htmlFor="email">Their email</label>
            <input id="email" name="email" type="email" required /></div>
          <button className="btn btn-primary">Send invitation</button>
          <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 12, marginBottom: 0 }}>
            No account needed. The link opens this manuscript only, and expires in 120 days.
            {round.blinding === "double" && " Your name is withheld from them."}
          </p>
        </form>
      </div>
    </>
  );
}
