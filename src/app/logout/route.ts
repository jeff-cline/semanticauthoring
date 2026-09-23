import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signing out MUST be a POST.
//
// This was a GET handler linked with <Link href="/logout">, and Next.js
// prefetches links in the viewport — so the router fetched /logout on its own
// and destroyed the session while the scholar was still working. The sidebar
// is always on screen, so this fired constantly: 24 sessions were created in a
// single afternoon and only the newest survived. Every save that failed was
// preceded by a prefetch of this route by one to nine seconds.
//
// A GET must never change state. Anything can issue one — a prefetcher, a
// link scanner, antivirus, a browser preloading what it thinks you'll click.

export async function POST(req: Request) {
  await destroySession().catch(() => {});
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}

// Kept for anyone who has bookmarked /logout. It does NOT sign them out —
// it sends them somewhere they can press the button.
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/app", req.url), { status: 303 });
}
