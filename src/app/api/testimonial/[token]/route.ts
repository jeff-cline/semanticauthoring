import { NextResponse } from "next/server";
import { one, logEvent } from "@/lib/db";
import { testimonialSchema, rateLimited, clientIp } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public submission endpoint for a tokenized testimonial request.
// No account required. Nothing submitted here is ever public until the scholar
// approves it individually (spec §9).

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(req);
  if (rateLimited(`test:${ip}`, 5, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const reqRow = await one<any>(
    `SELECT * FROM testimonial_requests
      WHERE token = $1 AND status IN ('sent','opened') AND expires_at > now()`,
    [token],
  );
  if (!reqRow) {
    return NextResponse.json({ ok: false, error: "This request has expired or was already used." }, { status: 404 });
  }

  const parsed = testimonialSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please write at least a couple of sentences." }, { status: 400 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });

  // A scholar cannot endorse themselves.
  const self = await one<{ id: number }>(
    `SELECT id FROM users WHERE id = $1 AND lower(email) = lower($2)`,
    [reqRow.owner_id, d.authorEmail],
  );
  if (self) {
    return NextResponse.json({ ok: false, error: "A testimonial cannot be written about yourself." }, { status: 400 });
  }

  const t = await one<{ id: number }>(
    `INSERT INTO testimonials
       (request_id, owner_id, author_name, author_email, author_role, author_institution, body, kind, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING id`,
    [reqRow.id, reqRow.owner_id, d.authorName, d.authorEmail, d.authorRole,
     d.authorInstitution, d.body, reqRow.kind],
  );

  await one(`UPDATE testimonial_requests SET status='submitted', updated_at=now() WHERE id=$1`, [reqRow.id]);

  // The giver becomes a contact in the scholar's own CRM, for long-arc follow-up.
  await one(
    `INSERT INTO contacts (owner_id, name, email, role, institution, notes)
     VALUES ($1,$2,$3,'other',$4,'Wrote a testimonial')`,
    [reqRow.owner_id, d.authorName, d.authorEmail, d.authorInstitution],
  ).catch(() => null);

  await logEvent("testimonial", "submitted", { entityId: t?.id, detail: d.authorEmail });
  return NextResponse.json({ ok: true });
}
