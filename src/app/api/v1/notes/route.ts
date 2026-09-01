import { NextResponse } from "next/server";
import { userFromRequest, canWrite } from "@/lib/token";
import { q, one, logEvent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const term = new URL(req.url).searchParams.get("q") ?? "";
  const rows = await q<any>(
    `SELECT a.id, a.page, a.quote, a.kind, a.evidence, a.says, a.think, a.matters,
            a.connects, a.created_at, s.title AS source, s.doi
       FROM annotations a JOIN sources s ON s.id = a.source_id
      WHERE a.owner_id=$1 ${term ? "AND (a.quote ILIKE $2 OR a.says ILIKE $2 OR a.think ILIKE $2)" : ""}
      ORDER BY a.created_at DESC LIMIT 200`,
    term ? [u.id, `%${term}%`] : [u.id]);
  return NextResponse.json({ ok: true, notes: rows, retrieved_at: new Date().toISOString() });
}

export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(u)) return NextResponse.json({ error: "token lacks write scope" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const sid = Number(b.source_id);
  const owned = await one(`SELECT id FROM sources WHERE id=$1 AND owner_id=$2`, [sid, u.id]);
  if (!owned) return NextResponse.json({ error: "unknown source" }, { status: 404 });

  const row = await one<{ id: number }>(
    `INSERT INTO annotations (owner_id, source_id, page, quote, kind, evidence,
                              says, think, matters, connects, generated_by_ai, ai_model,
                              human_verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [u.id, sid, String(b.page ?? "").slice(0, 40), String(b.quote ?? "").slice(0, 6000),
     String(b.kind ?? "general"), String(b.evidence ?? ""),
     String(b.says ?? "").slice(0, 4000), String(b.think ?? "").slice(0, 4000),
     String(b.matters ?? "").slice(0, 4000), String(b.connects ?? "").slice(0, 4000),
     Boolean(b.generated_by_ai), String(b.ai_model ?? ""),
     b.generated_by_ai ? false : true]);
  await logEvent("annotation", "created_api", { actorId: u.id, entityId: row?.id });
  return NextResponse.json({ ok: true, id: row?.id });
}
