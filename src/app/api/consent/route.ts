import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { clientIp, rateLimited } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records the visitor's tracking decision with a timestamp and the page it was
// made on — retained as proof of consent (spec §5).

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimited(`consent:${ip}`, 10, 60_000)) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as { granted?: boolean; page?: string };
  await q(
    `INSERT INTO consent_records (granted, page, ip, policy_version) VALUES ($1,$2,$3,$4)`,
    [Boolean(body.granted), String(body.page ?? "").slice(0, 300), ip, "1.0"],
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
