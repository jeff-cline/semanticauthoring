import { NextResponse } from "next/server";
import { currentUser, startImpersonation, stopImpersonation } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Start or stop viewing as another member.
//
// Both are POSTs. A GET that changed who you are signed in as would be the
// same mistake /logout made: anything can issue a GET, including the router's
// own prefetcher.

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "stop") {
    // No role check on purpose. Authorisation is the impersonator_id already
    // on this session — a God viewing as a member with no privileges must
    // still be able to get back out.
    const ok = await stopImpersonation();
    return NextResponse.json(ok
      ? { ok: true }
      : { ok: false, error: "You are not viewing as anyone." },
      { status: ok ? 200 : 400 });
  }

  // Starting requires being a God in your own right — and not already
  // wearing someone else's identity.
  if (user.impersonatedBy) {
    return NextResponse.json(
      { ok: false, error: "Stop viewing as this member first." }, { status: 400 });
  }
  if (user.role !== "god") {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const targetId = Number(body.userId);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const result = await startImpersonation(user.id, targetId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
