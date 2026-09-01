import { NextResponse } from "next/server";
import { userFromRequest, canWrite } from "@/lib/token";
import { q, one, logEvent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await q<any>(
    `SELECT c.id, c.text, c.chapter, c.created_at,
            json_agg(json_build_object(
              'relation', e.relation, 'source_id', e.source_id, 'source', s.title,
              'doi', s.doi, 'location', e.location, 'note', e.note,
              'confidence', e.confidence, 'generated_by_ai', e.generated_by_ai
            )) FILTER (WHERE e.id IS NOT NULL) AS evidence
       FROM claims c
       LEFT JOIN claim_evidence e ON e.claim_id = c.id
       LEFT JOIN sources s ON s.id = e.source_id
      WHERE c.owner_id=$1 GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 200`, [u.id]);
  return NextResponse.json({
    ok: true,
    claims: rows.map((r: any) => ({ ...r, evidence: r.evidence ?? [] })),
    retrieved_at: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(u)) return NextResponse.json({ error: "token lacks write scope" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const text = String(b.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const row = await one<{ id: number }>(
    `INSERT INTO claims (owner_id, text, chapter) VALUES ($1,$2,$3) RETURNING id`,
    [u.id, text.slice(0, 2000), String(b.chapter ?? "").slice(0, 120)]);

  // Evidence may only reference sources this scholar owns.
  if (row && Array.isArray(b.evidence)) {
    for (const e of b.evidence.slice(0, 20)) {
      const sid = Number(e?.source_id);
      if (!sid) continue;
      const owned = await one(`SELECT id FROM sources WHERE id=$1 AND owner_id=$2`, [sid, u.id]);
      if (!owned) continue;
      await q(
        `INSERT INTO claim_evidence (claim_id, owner_id, source_id, relation, location, note,
                                     confidence, generated_by_ai, ai_model, human_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE)`,
        [row.id, u.id, sid, String(e.relation ?? "supports"),
         String(e.location ?? "").slice(0, 120), String(e.note ?? "").slice(0, 4000),
         String(e.confidence ?? "stated"), Boolean(e.generated_by_ai),
         String(e.ai_model ?? "")]);
    }
  }
  await logEvent("claim", "created_api", { actorId: u.id, entityId: row?.id });
  return NextResponse.json({ ok: true, id: row?.id });
}
