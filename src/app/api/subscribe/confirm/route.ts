import { NextResponse } from "next/server";
import { one, logEvent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const base = process.env.SITE_URL ?? "https://semanticauthoring.org";

  if (!token) return NextResponse.redirect(`${base}/subscribed?status=invalid`);

  const row = await one<{ id: number }>(
    `UPDATE subscribers
        SET status = 'confirmed', confirmed_at = now(), confirm_token = NULL, updated_at = now()
      WHERE confirm_token = $1 AND status = 'pending'
      RETURNING id`,
    [token],
  );

  if (!row) return NextResponse.redirect(`${base}/subscribed?status=invalid`);
  await logEvent("subscriber", "confirmed", { entityId: row.id });
  return NextResponse.redirect(`${base}/subscribed?status=ok`);
}
