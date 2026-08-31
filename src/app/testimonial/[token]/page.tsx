import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { PublicShell } from "@/components/Chrome";
import TestimonialForm from "@/components/TestimonialForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Write a testimonial", robots: { index: false } };

export default async function TestimonialPage(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const row = await one<any>(
    `SELECT r.id, r.message, r.recipient_name, u.name AS scholar_name
       FROM testimonial_requests r JOIN users u ON u.id = r.owner_id
      WHERE r.token = $1 AND r.status IN ('sent','opened') AND r.expires_at > now()`,
    [token],
  ).catch(() => null);

  if (!row) {
    return (
      <PublicShell>
        <section className="wrap narrow" style={{ padding: "96px 24px 0", textAlign: "center" }}>
          <div className="card" style={{ padding: 44 }}>
            <h1>This link has expired.</h1>
            <p className="lede">
              Testimonial links are single-use and time-limited. Ask the scholar to send a new one.
            </p>
          </div>
        </section>
      </PublicShell>
    );
  }

  const scholar = row.scholar_name || "this scholar";

  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "64px 24px 0" }}>
        <p className="eyebrow">A request for your words</p>
        <h1>{scholar} asked for a few words.</h1>
        {row.message && (
          <blockquote style={{ borderLeft: "3px solid var(--seaglass)", margin: "22px 0",
                               padding: "4px 0 4px 18px", color: "var(--muted)" }}>
            {row.message}
          </blockquote>
        )}
        <p style={{ color: "var(--muted)", marginBottom: 30 }}>
          Write as much or as little as feels right. Nothing you write appears publicly
          unless {scholar} approves it first.
        </p>
        <TestimonialForm token={token} scholar={scholar} />
      </section>
    </PublicShell>
  );
}
