import { NextResponse } from "next/server";
import { userFromRequest, canWrite } from "@/lib/token";
import { q, one, logEvent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const term = new URL(req.url).searchParams.get("q") ?? "";
  const rows = term
    ? await q<any>(
        `SELECT id, title, authors, year, publication, doi, kind, tags, read_status,
                provider, retrieved_at, confidence
           FROM sources WHERE owner_id=$1
            AND (title ILIKE $2 OR authors ILIKE $2 OR tags ILIKE $2)
          ORDER BY updated_at DESC LIMIT 100`, [u.id, `%${term}%`])
    : await q<any>(
        `SELECT id, title, authors, year, publication, doi, kind, tags, read_status,
                provider, retrieved_at, confidence
           FROM sources WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100`, [u.id]);
  return NextResponse.json({ ok: true, sources: rows, retrieved_at: new Date().toISOString() });
}

export async function POST(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canWrite(u)) return NextResponse.json({ error: "token lacks write scope" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const title = String(b.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const row = await one<{ id: number }>(
    `INSERT INTO sources (owner_id, title, kind, authors, year, publication, doi, url, tags,
                          provider, provider_id, source_url, retrieved_at, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             CASE WHEN $10 <> '' THEN now() ELSE NULL END, $13) RETURNING id`,
    [u.id, title.slice(0, 400), String(b.kind ?? "article"),
     String(b.authors ?? "").slice(0, 400), String(b.year ?? "").slice(0, 20),
     String(b.publication ?? "").slice(0, 300), String(b.doi ?? "").slice(0, 200),
     String(b.url ?? "").slice(0, 600), String(b.tags ?? "").slice(0, 300),
     String(b.provider ?? ""), String(b.provider_id ?? ""), String(b.source_url ?? ""),
     String(b.confidence ?? "")]);
  await logEvent("source", "created_api", { actorId: u.id, entityId: row?.id });
  return NextResponse.json({ ok: true, id: row?.id });
}
