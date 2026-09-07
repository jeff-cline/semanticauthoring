import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { one, q, logEvent } from "@/lib/db";
import { PublicShell } from "@/components/Chrome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Advising invitation", robots: { index: false } };

// The scholar decides. An advising relationship is consent, not an assignment.

export default async function AdvisingInvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await one<any>(
    `SELECT a.*, f.name AS faculty_name, f.email AS faculty_email
       FROM advising a JOIN users f ON f.id = a.faculty_id
      WHERE a.invite_token=$1 AND a.status='invited'`, [token]).catch(() => null);

  const user = await currentUser().catch(() => null);

  async function decide(formData: FormData) {
    "use server";
    const me = await currentUser();
    if (!me) redirect(`/login?next=/advising/${formData.get("token")}`);
    const decision = String(formData.get("decision"));
    const t = String(formData.get("token"));
    const row = await one<any>(
      `SELECT id, invite_email FROM advising WHERE invite_token=$1 AND status='invited'`, [t]);
    if (!row) redirect("/app");
    if (decision === "accept") {
      await q(
        `UPDATE advising SET scholar_id=$1, status='active', accepted_at=now(),
                invite_token=NULL, updated_at=now() WHERE id=$2`, [me.id, row.id]);
      await logEvent("advising", "accepted", { actorId: me.id, entityId: row.id });
    } else {
      await q(`UPDATE advising SET status='declined', invite_token=NULL, updated_at=now()
                WHERE id=$1`, [row.id]);
      await logEvent("advising", "declined", { actorId: me.id, entityId: row.id });
    }
    redirect("/app");
  }

  if (!invite) {
    return (
      <PublicShell>
        <section className="wrap narrow" style={{ padding: "96px 24px 0", textAlign: "center" }}>
          <div className="card" style={{ padding: 44 }}>
            <h1>This invitation isn&rsquo;t active.</h1>
            <p className="lede">It may have been withdrawn, or already answered.</p>
          </div>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "72px 24px 0" }}>
        <p className="eyebrow">Advising invitation</p>
        <h1>{invite.faculty_name || invite.faculty_email} would like to advise your work.</h1>
        <p className="lede">As your <strong>{invite.role}</strong>.</p>
        {invite.note && (
          <blockquote style={{ borderLeft: "3px solid var(--seaglass)", margin: "20px 0",
                               padding: "4px 0 4px 18px", color: "var(--muted)" }}>
            {invite.note}
          </blockquote>
        )}

        <div className="card stage stage-review" style={{ margin: "26px 0" }}>
          <h2 style={{ fontSize: "1.05rem" }}>What accepting shares</h2>
          <ul style={{ color: "var(--muted)", paddingLeft: 20, lineHeight: 1.9, margin: 0 }}>
            <li>Chapter status and dissertation progress</li>
            <li>Proposal stage and defense date</li>
            <li>Milestones you have recorded</li>
            <li>How many claims still lack evidence</li>
            <li>Anything you deliberately send them for review</li>
          </ul>
          <h2 style={{ fontSize: "1.05rem", marginTop: 18 }}>What it does not share</h2>
          <ul style={{ color: "var(--muted)", paddingLeft: 20, lineHeight: 1.9, margin: 0 }}>
            <li>Your research library and annotations</li>
            <li>Your daily journal and Embodied Inquiry entries</li>
            <li>Your Life Map</li>
            <li>Any draft you have not shared</li>
          </ul>
          <p style={{ color: "var(--muted)", fontSize: ".88rem", marginTop: 14, marginBottom: 0 }}>
            You can end this at any time.
          </p>
        </div>

        {user ? (
          <form action={decide} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input type="hidden" name="token" value={token} />
            <button className="btn btn-primary" name="decision" value="accept">Accept</button>
            <button className="btn btn-secondary" name="decision" value="decline">Decline</button>
          </form>
        ) : (
          <p>
            <a className="btn btn-primary" href={`/login?next=/advising/${token}`}>
              Sign in to respond
            </a>
          </p>
        )}
      </section>
    </PublicShell>
  );
}
