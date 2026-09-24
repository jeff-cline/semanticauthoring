import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public author list.
//
// Exposes nothing that is not already on /authors — only profiles their owner
// switched to public, and only the fields that page already prints. It exists
// so the 404 page can show a live list without depending on a database read at
// build time, which is when Next renders not-found.
export async function GET() {
  const rows = await q<any>(
    `SELECT pr.handle,
            coalesce(nullif(pr.display_name,''), u.name, pr.handle) AS name,
            pr.headline, pr.avatar_url, pr.avatar_alt
       FROM profiles pr JOIN users u ON u.id = pr.user_id
      WHERE pr.is_public = TRUE
      ORDER BY u.created_at ASC
      LIMIT 60`).catch(() => []);

  return NextResponse.json({ authors: rows }, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=600" },
  });
}
