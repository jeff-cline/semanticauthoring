import { NextResponse } from "next/server";
import { q, one, logEvent } from "@/lib/db";
import { guardForm } from "@/lib/form-guard";
import { sendTransactional, esc } from "@/lib/email";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Contact me" / "Collaborate with me" from a public profile.
//
// Public and unauthenticated, so it is guarded like every other public form on
// the Core. A blocked submission still returns ok:true — a bot that learns it
// was caught just tries something else.

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });

  const handle = clean(body.handle, 80).toLowerCase();
  const kind = body.kind === "collaborate" ? "collaborate" : "contact";
  const fromName = clean(body.from_name, 160);
  const fromEmail = clean(body.from_email, 200);
  const subject = clean(body.subject, 200);
  const message = clean(body.body, 4000);

  const gate = await guardForm(req, "profile_message", body, {
    names: [fromName],
    texts: [subject, message],
    email: fromEmail,
  });
  if (gate.blocked) return NextResponse.json({ ok: true });

  if (!fromName || !fromEmail || !message) {
    return NextResponse.json({ ok: false, error: "Please complete every field." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) {
    return NextResponse.json({ ok: false, error: "That email doesn't look right." }, { status: 400 });
  }

  // Resolve the recipient from the handle — never from anything the sender
  // supplied, so this cannot be pointed at an arbitrary address.
  const owner = await one<any>(
    `SELECT p.user_id, p.display_name, p.contact_enabled, p.open_to_collaboration,
            u.email, u.name
       FROM profiles p JOIN users u ON u.id = p.user_id
      WHERE p.handle=$1 AND p.is_public = TRUE`, [handle]).catch(() => null);
  if (!owner) return NextResponse.json({ ok: false, error: "No such profile." }, { status: 404 });

  const allowed = kind === "collaborate" ? owner.open_to_collaboration : owner.contact_enabled !== false;
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "That scholar isn't accepting messages." },
      { status: 403 });
  }

  await q(
    `INSERT INTO profile_messages (owner_id, kind, from_name, from_email, subject, body)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [owner.user_id, kind, fromName, fromEmail, subject, message],
  );
  await logEvent("profile_message", "received", { entityId: owner.user_id, detail: kind });

  const label = kind === "collaborate" ? "Collaboration enquiry" : "Message";
  await notify(owner.user_id, "system", `${label} from ${fromName}`, {
    body: message.slice(0, 300),
    href: "/app/messages",
  }).catch(() => {});

  // Delivery is best-effort: the message is already stored, so a mail outage
  // must not tell the sender their note was lost.
  await sendTransactional(
    owner.email,
    `${label} via your profile — ${fromName}`,
    `${label} from ${esc(fromName)}`,
    `<p><strong>${esc(fromName)}</strong> &lt;${esc(fromEmail)}&gt;</p>
     ${subject ? `<p><em>${esc(subject)}</em></p>` : ""}
     <p style="white-space:pre-wrap">${esc(message)}</p>
     <p style="color:#61708A;font-size:14px">Reply directly to this email to reach them.</p>`,
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
