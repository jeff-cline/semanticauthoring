import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { toCslJson } from "@/lib/biblio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const rows = await q<any>(
    `SELECT * FROM sources WHERE owner_id=$1 ORDER BY year DESC, title`, [user.id]);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCslJson(rows), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="library-${stamp}.csl.json"`,
      "cache-control": "private, no-store",
    },
  });
}
