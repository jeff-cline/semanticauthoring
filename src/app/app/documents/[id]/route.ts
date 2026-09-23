import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { DOCX_MIME } from "@/lib/saved-exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Re-download a document exactly as it was generated. The owner check is in
// the WHERE clause, not an if-statement after the fetch, so another scholar's
// id can never return bytes.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const row = await one<any>(
    `SELECT filename, content FROM saved_exports WHERE id=$1 AND owner_id=$2`,
    [Number(id), user.id],
  );
  if (!row) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(row.content), {
    headers: {
      "content-type": DOCX_MIME,
      "content-disposition": `attachment; filename="${row.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
