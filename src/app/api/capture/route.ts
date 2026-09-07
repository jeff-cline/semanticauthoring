import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { one, logEvent } from "@/lib/db";
import { rateLimited, clientIp } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Capture endpoint the mobile app and the offline queue both post to. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (rateLimited(`capture:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const body = String(b.body ?? "").trim();
  if (!body) return NextResponse.json({ ok: false, error: "Nothing to capture." },
    { status: 400 });

  const kinds = ["idea", "quote", "question", "reflection", "insight"];
  const kind = kinds.includes(String(b.kind)) ? String(b.kind) : "idea";

  const row = await one<{ id: number }>(
    `INSERT INTO captures (owner_id, body, kind) VALUES ($1,$2,$3) RETURNING id`,
    [user.id, body.slice(0, 8000), kind]);
  await logEvent("capture", "created_mobile", { actorId: user.id, entityId: row?.id });

  return NextResponse.json({ ok: true, id: row?.id });
}
