import { q, one } from "@/lib/db";
import { PublicShell } from "@/components/Chrome";
import ReviewCommentForm from "@/components/ReviewCommentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review", robots: { index: false, follow: false } };

// A reviewer sees exactly one document and the comment thread on it. Nothing
// else in the scholar's workspace is reachable from here — no account, no
// navigation into private material.

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const share = await one<any>(
    `SELECT s.*, d.title, d.body, d.word_count, u.name AS owner_name
       FROM shares s
       JOIN documents d ON d.id = s.entity_id AND s.entity_type='document'
       JOIN users u ON u.id = s.owner_id
      WHERE s.token=$1 AND s.status='active' AND s.expires_at > now()`, [token]).catch(() => null);

  if (!share) {
    return (
      <PublicShell>
        <section className="wrap narrow" style={{ padding: "96px 24px 0", textAlign: "center" }}>
          <div className="card" style={{ padding: 44 }}>
            <h1>This review link isn&rsquo;t active.</h1>
            <p className="lede">
              It may have been revoked or expired. Ask the author to send a new one.
            </p>
          </div>
        </section>
      </PublicShell>
    );
  }

  await q(`UPDATE shares SET last_opened_at=now(), updated_at=now() WHERE id=$1`, [share.id])
    .catch(() => {});

  const comments = await q<any>(
    `SELECT * FROM review_comments WHERE share_id=$1 ORDER BY created_at`, [share.id]);

  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "56px 24px 0" }}>
        <div className="card stage stage-review" style={{ marginBottom: 26 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Shared for review</p>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            {share.owner_name} shared this with you as {share.reviewer_role}.
            {share.due_on && ` Comments requested by ${new Date(share.due_on).toLocaleDateString()}.`}
          </p>
        </div>

        <h1>{share.title}</h1>
        <p style={{ color: "var(--muted)" }}>{share.word_count} words</p>

        <article style={{ fontFamily: "var(--serif)", fontSize: "1.08rem", lineHeight: 1.8,
                          whiteSpace: "pre-wrap", margin: "26px 0" }}>
          {share.body || "This document is still empty."}
        </article>

        <h2 style={{ fontSize: "1.15rem" }}>
          Comments {comments.length > 0 && `(${comments.length})`}
        </h2>
        {comments.map((c: any) => (
          <div key={c.id} className="card" style={{ marginBottom: 10, padding: 16,
               opacity: c.resolved ? .6 : 1 }}>
            {c.anchor && (
              <blockquote style={{ margin: "0 0 8px", paddingLeft: 12,
                                   borderLeft: "2px solid var(--line)", fontStyle: "italic",
                                   color: "var(--muted)", fontSize: ".92rem" }}>
                {c.anchor}
              </blockquote>
            )}
            <p style={{ margin: "0 0 6px" }}>{c.body}</p>
            <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>
              {c.author_name} · {new Date(c.created_at).toLocaleString()}
              {c.resolved && " · resolved"}
            </span>
          </div>
        ))}

        {share.can_comment && <ReviewCommentForm token={token} />}

        <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: "24px 0 0" }}>
          This link opens only this document. It gives no access to the author&rsquo;s research
          library, journal, or other writing.
        </p>
      </section>
    </PublicShell>
  );
}
