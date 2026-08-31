import { NextResponse } from "next/server";
import { q, one, logEvent } from "@/lib/db";
import { coreLead } from "@/lib/core";
import { notifyGods, esc } from "@/lib/email";
import { leadSchema, rateLimited, clientIp, turnstileOk } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public lead endpoint for the waitlist form. The browser posts here; the
// server persists locally, forwards to the Core CRM, and notifies the God
// accounts. The Core secret never leaves the server.

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimited(`lead:${ip}`, 5, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const parsed = leadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please check the form and try again." }, { status: 400 });
  }
  const d = parsed.data;

  // Honeypot: silently accept so bots don't learn they were caught.
  if (d.website) return NextResponse.json({ ok: true });

  if (!(await turnstileOk((d as any).turnstileToken))) {
    return NextResponse.json({ ok: false, error: "Verification failed. Please try again." }, { status: 400 });
  }

  const lead = await one<{ id: number }>(
    `INSERT INTO leads (name, email, message, interest, source_page, referrer)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [d.name, d.email, d.message, d.interest, d.sourcePage, d.referrer],
  );

  await logEvent("lead", "created", { entityId: lead?.id, detail: d.email });

  // Forward to the Core CRM and notify — both best-effort. The visitor's
  // submission is already safe in our own database.
  const core = await coreLead({
    name: d.name,
    email: d.email,
    notes: [d.interest && `Stage: ${d.interest}`, d.message].filter(Boolean).join(" · "),
  });
  if (core.ok && lead) {
    await q(`UPDATE leads SET forwarded_to_core = TRUE, updated_at = now() WHERE id = $1`, [lead.id]);
  }

  await notifyGods(
    "New early-access request — Semantic Authoring",
    "New early-access request",
    `<table style="border-collapse:collapse;font-size:14px">
       <tr><td style="padding:3px 12px 3px 0;color:#61708a">Name</td><td>${esc(d.name)}</td></tr>
       <tr><td style="padding:3px 12px 3px 0;color:#61708a">Email</td><td>${esc(d.email)}</td></tr>
       <tr><td style="padding:3px 12px 3px 0;color:#61708a">Stage</td><td>${esc(d.interest)}</td></tr>
       <tr><td style="padding:3px 12px 3px 0;color:#61708a;vertical-align:top">Working on</td><td>${esc(d.message)}</td></tr>
       <tr><td style="padding:3px 12px 3px 0;color:#61708a">Page</td><td>${esc(d.sourcePage)}</td></tr>
     </table>`,
  );

  return NextResponse.json({ ok: true });
}
