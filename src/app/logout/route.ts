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

/**
 * Redirect to a path on this site.
 *
 * Deliberately a RELATIVE Location header. `new URL(path, req.url)` looked
 * right and was not: behind nginx, Next rebuilds req.url from the socket it is
 * listening on, so signing out sent people to http://127.0.0.1:3100/. A
 * relative Location is resolved by the browser against the address it actually
 * asked for, which is the public one — no host reconstruction, nothing to get
 * wrong, and no dependence on SITE_URL being set correctly.
 */
const seeOther = (path: string) =>
  new NextResponse(null, { status: 303, headers: { location: path } });

export async function POST() {
  await destroySession().catch(() => {});
  return seeOther("/");
}

// Kept for anyone who has bookmarked /logout. It does NOT sign them out —
// it sends them somewhere they can press the button.
export function GET() {
  return seeOther("/app");
}
