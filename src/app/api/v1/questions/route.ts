import { NextResponse } from "next/server";
import { userFromRequest, canWrite } from "@/lib/token";
import { q, one, logEvent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await q<any>(
    `SELECT id, text, status, origin, discipline, created_at, updated_at
       FROM questions WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 200`, [u.id]);
  return NextResponse.json({ ok: true, questions: rows, retrieved_at: new Date().toISOString() });
}

export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(u)) return NextResponse.json({ error: "token lacks write scope" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const text = String(b.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const row = await one<{ id: number }>(
    `INSERT INTO questions (owner_id, text, status, origin, discipline)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [u.id, text.slice(0, 2000), String(b.status ?? "emerging"),
     String(b.origin ?? "unprompted"), String(b.discipline ?? "").slice(0, 120)]);
  if (row) {
    await q(`INSERT INTO question_versions (question_id, text, status, note)
             VALUES ($1,$2,$3,'Created via API')`,
      [row.id, text.slice(0, 2000), String(b.status ?? "emerging")]);
  }
  await logEvent("question", "created_api", { actorId: u.id, entityId: row?.id });
  return NextResponse.json({ ok: true, id: row?.id });
}
