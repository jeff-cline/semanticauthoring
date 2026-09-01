import { NextResponse } from "next/server";
import { one, q, logEvent } from "@/lib/db";
import { rateLimited, clientIp } from "@/lib/validate";
import { reviewCommentEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(req);
  if (rateLimited(`review:${ip}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const share = await one<any>(
    `SELECT s.*, u.email AS owner_email, u.name AS owner_name, d.title
       FROM shares s JOIN users u ON u.id = s.owner_id
       LEFT JOIN documents d ON d.id = s.entity_id AND s.entity_type='document'
      WHERE s.token=$1 AND s.status='active' AND s.expires_at > now()`, [token]);
  if (!share || !share.can_comment) {
    return NextResponse.json({ ok: false, error: "This review link is no longer active." }, { status: 404 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const body = String(b.body ?? "").trim();
  if (body.length < 2) {
    return NextResponse.json({ ok: false, error: "Please write a comment." }, { status: 400 });
  }

  const row = await one<{ id: number }>(
    `INSERT INTO review_comments (share_id, entity_type, entity_id, author_name, author_email, body, anchor)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [share.id, share.entity_type, share.entity_id,
     share.reviewer_name || share.reviewer_email, share.reviewer_email,
     body.slice(0, 8000), String(b.anchor ?? "").slice(0, 2000)]);

  await q(`UPDATE shares SET last_opened_at=now(), updated_at=now() WHERE id=$1`, [share.id]);
  await logEvent("review_comment", "created", { entityId: row?.id, detail: share.reviewer_email });

  const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
  reviewCommentEmail(share.owner_email, share.reviewer_name || share.reviewer_email,
    share.title ?? "your work", `${base}/app/review`).catch(() => {});

  return NextResponse.json({ ok: true });
}
