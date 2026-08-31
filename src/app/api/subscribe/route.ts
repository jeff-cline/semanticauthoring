import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { one, logEvent } from "@/lib/db";
import { subscriberConfirmEmail } from "@/lib/email";
import { subscribeSchema, rateLimited, clientIp } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-scholar subscription with DOUBLE OPT-IN (spec §10).
// No email is ever sent to an address until it has been confirmed — this is
// both the legal requirement and the single biggest protection for sender
// reputation.

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimited(`sub:${ip}`, 5, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  const parsed = subscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please check your details." }, { status: 400 });
  }
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });   // honeypot

  const scholar = await one<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE id = $1`, [d.scholarId],
  );
  if (!scholar) return NextResponse.json({ ok: false, error: "Unknown scholar." }, { status: 404 });

  const token = randomBytes(24).toString("hex");

  // Re-subscribing an existing address refreshes the token rather than erroring.
  const row = await one<{ id: number; status: string }>(
    `INSERT INTO subscribers (scholar_id, name, email, source, source_page, confirm_token, consent_ip)
     VALUES ($1,$2,$3,'visitor',$4,$5,$6)
     ON CONFLICT (scholar_id, email) DO UPDATE
        SET confirm_token = EXCLUDED.confirm_token,
            name = COALESCE(NULLIF(EXCLUDED.name,''), subscribers.name),
            status = CASE WHEN subscribers.status = 'confirmed' THEN 'confirmed' ELSE 'pending' END,
            updated_at = now()
     RETURNING id, status`,
    [d.scholarId, d.name, d.email, d.sourcePage, token, ip],
  );

  await logEvent("subscriber", "requested", { entityId: row?.id, detail: d.email });

  // Already confirmed — don't re-send, and don't reveal subscription state.
  if (row?.status !== "confirmed") {
    const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
    await subscriberConfirmEmail(d.email, scholar.name || "this scholar",
      `${base}/api/subscribe/confirm?token=${token}`);
  }

  return NextResponse.json({ ok: true });
}
