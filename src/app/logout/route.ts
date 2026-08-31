import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await destroySession().catch(() => {});
  return NextResponse.redirect(new URL("/", req.url));
}
