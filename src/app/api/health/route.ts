import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { coreConfigured, corePing } from "@/lib/core";
import { emailProviderHealth } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await q("SELECT 1");
    checks.database = "CONNECTED";
  } catch {
    checks.database = "DOWN";
  }

  if (!coreConfigured()) {
    checks.core = "KEY REQUIRED";
  } else {
    const p = await corePing();
    checks.core = p.ok ? "CONNECTED" : "DOWN";
  }

  checks.turnstile = process.env.TURNSTILE_SECRET_KEY ? "CONNECTED" : "KEY REQUIRED";

  // Email is checked per provider: the Core key can be valid while an
  // individual provider's own credentials are not.
  if (checks.core === "CONNECTED") {
    const providers = await emailProviderHealth().catch(() => []);
    for (const p of providers) checks[`email:${p.provider}`] = p.status;
  }

  const ok = checks.database === "CONNECTED";
  return NextResponse.json({ ok, checks, at: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
