import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/token";
import { one } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const counts = await one<any>(
    `SELECT (SELECT count(*)::int FROM sources WHERE owner_id=$1) AS sources,
            (SELECT count(*)::int FROM questions WHERE owner_id=$1) AS questions,
            (SELECT count(*)::int FROM claims WHERE owner_id=$1) AS claims,
            (SELECT count(*)::int FROM annotations WHERE owner_id=$1) AS annotations`, [u.id]);
  return NextResponse.json({
    ok: true, scholar: { name: u.name, email: u.email, tier: u.tier },
    scopes: u.scopes, counts,
  });
}
