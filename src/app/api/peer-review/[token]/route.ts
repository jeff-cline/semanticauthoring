import { NextResponse } from "next/server";
import { one, q, logEvent } from "@/lib/db";
import { rateLimited, clientIp } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (rateLimited(`peerreview:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const a = await one<any>(
    `SELECT a.id, a.status, r.status AS round_status
       FROM review_assignments a JOIN review_rounds r ON r.id = a.round_id
      WHERE a.token=$1 AND a.expires_at > now() AND a.status <> 'withdrawn'`, [token]);
  if (!a) return NextResponse.json({ ok: false, error: "This link is no longer active." },
    { status: 404 });
  if (a.status === "submitted") {
    return NextResponse.json({ ok: false, error: "A review has already been submitted." },
      { status: 409 });
  }
  if (a.round_status === "closed") {
    return NextResponse.json({ ok: false, error: "This round has closed." }, { status: 409 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;

  if (b.decline) {
    await q(`UPDATE review_assignments SET status='declined', updated_at=now() WHERE id=$1`,
      [a.id]);
    await logEvent("review_assignment", "declined", { entityId: a.id });
    return NextResponse.json({ ok: true });
  }

  const rec = String(b.recommendation ?? "");
  const valid = ["accept", "minor_revisions", "major_revisions", "reject", "unsure"];
  if (!valid.includes(rec)) {
    return NextResponse.json({ ok: false, error: "Choose a recommendation." }, { status: 400 });
  }
  const summary = String(b.summary ?? "").trim();
  if (summary.length < 10) {
    return NextResponse.json({ ok: false, error: "Please write a short summary." },
      { status: 400 });
  }

  await q(
    `UPDATE review_assignments SET status='submitted', recommendation=$1, summary=$2,
            strengths=$3, concerns=$4, confidential=$5, submitted_at=now(), updated_at=now()
      WHERE id=$6`,
    [rec, summary.slice(0, 12000), String(b.strengths ?? "").slice(0, 12000),
     String(b.concerns ?? "").slice(0, 12000), String(b.confidential ?? "").slice(0, 8000),
     a.id]);
  await logEvent("review_assignment", "submitted", { entityId: a.id, detail: rec });

  return NextResponse.json({ ok: true });
}
