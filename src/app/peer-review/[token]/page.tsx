import { q, one } from "@/lib/db";
import { PublicShell } from "@/components/Chrome";
import PeerReviewForm from "@/components/PeerReviewForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Peer review", robots: { index: false, follow: false } };

export default async function ReviewerView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const a = await one<any>(
    `SELECT a.*, r.title, r.brief, r.blinding, r.due_on, r.round_number, r.status AS round_status,
            d.body, d.word_count, u.name AS author_name
       FROM review_assignments a
       JOIN review_rounds r ON r.id = a.round_id
       LEFT JOIN documents d ON d.id = r.document_id
       JOIN users u ON u.id = r.owner_id
      WHERE a.token=$1 AND a.expires_at > now() AND a.status <> 'withdrawn'`,
    [token]).catch(() => null);

  if (!a) {
    return (
      <PublicShell>
        <section className="wrap narrow" style={{ padding: "96px 24px 0", textAlign: "center" }}>
          <div className="card" style={{ padding: 44 }}>
            <h1>This review link isn&rsquo;t active.</h1>
            <p className="lede">It may have expired or been withdrawn.</p>
          </div>
        </section>
      </PublicShell>
    );
  }

  // Double blind: the author's identity is withheld from the reviewer.
  const showAuthor = a.blinding !== "double";

  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "56px 24px 0" }}>
        <div className="card stage stage-review" style={{ marginBottom: 24 }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Peer review · round {a.round_number} · {a.blinding} blind
          </p>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            {showAuthor ? `Submitted by ${a.author_name}. ` : "The author's identity is withheld. "}
            {a.due_on && `Requested by ${new Date(a.due_on).toLocaleDateString()}.`}
          </p>
        </div>

        <h1>{a.title}</h1>
        {a.word_count ? (
          <p style={{ color: "var(--muted)" }}>{a.word_count} words</p>
        ) : null}

        {a.brief && (
          <div className="card" style={{ margin: "20px 0" }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>What would help most</p>
            <p style={{ margin: 0 }}>{a.brief}</p>
          </div>
        )}

        {a.body ? (
          <article style={{ fontFamily: "var(--serif)", fontSize: "1.06rem", lineHeight: 1.8,
                            whiteSpace: "pre-wrap", margin: "26px 0" }}>
            {a.body}
          </article>
        ) : (
          <p style={{ color: "var(--muted)" }}>
            No manuscript text has been attached to this round yet.
          </p>
        )}

        {a.status === "submitted" ? (
          <div className="card" role="status">
            <h2 style={{ fontSize: "1.1rem" }}>Your review has been received.</h2>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>
              Thank you — returned {new Date(a.submitted_at).toLocaleString()}.
            </p>
          </div>
        ) : a.round_status === "closed" ? (
          <div className="card">
            <p style={{ margin: 0 }}>This round has closed.</p>
          </div>
        ) : (
          <PeerReviewForm token={token} />
        )}
      </section>
    </PublicShell>
  );
}
