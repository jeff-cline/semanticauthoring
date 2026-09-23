import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendTransactional, esc } from "@/lib/email";
import { normalizePolicy } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A reader asking an author for the full text of a gated piece.
//
// Requires an account: the author is deciding about a person, and needs
// someone to decide about.

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const publicationId = Number(body.publicationId);
  const message = String(body.message ?? "").trim().slice(0, 1500);
  if (!Number.isInteger(publicationId)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const pub = await one<any>(
    `SELECT pb.id, pb.owner_id, pb.title, pb.slug, pb.reader_access, pb.status,
            u.email AS owner_email, pr.handle
       FROM publications pb
       JOIN users u ON u.id = pb.owner_id
       LEFT JOIN profiles pr ON pr.user_id = pb.owner_id
      WHERE pb.id = $1 AND pb.status = 'published'`, [publicationId]).catch(() => null);
  if (!pub) return NextResponse.json({ ok: false, error: "No such piece." }, { status: 404 });

  if (pub.owner_id === user.id) {
    return NextResponse.json({ ok: false, error: "This is your own work." }, { status: 400 });
  }
  if (normalizePolicy(pub.reader_access) === "public") {
    return NextResponse.json({ ok: false, error: "This piece is already open." },
      { status: 400 });
  }

  // A declined or revoked reader does not get another attempt by re-posting:
  // DO NOTHING rather than DO UPDATE. Asking again after the author said no
  // would turn their decision back into a negotiation.
  const inserted = await one<{ id: number }>(
    `INSERT INTO document_access (publication_id, owner_id, reader_id, status, origin, message)
     VALUES ($1,$2,$3,'pending','request',$4)
     ON CONFLICT (publication_id, reader_id) DO NOTHING
     RETURNING id`,
    [pub.id, pub.owner_id, user.id, message],
  ).catch(() => null);

  if (!inserted) {
    // Already has a standing — pending, approved, declined or revoked.
    return NextResponse.json({ ok: true, already: true });
  }

  await logEvent("document_access", "requested",
    { actorId: user.id, entityId: String(pub.id) });

  const who = user.name || user.email;
  await notify(pub.owner_id, "system", `${who} asked to read “${pub.title}”`, {
    body: message.slice(0, 300),
    href: `/app/publications/${pub.id}`,
  }).catch(() => {});

  await sendTransactional(
    pub.owner_email,
    `${who} asked to read “${pub.title}”`,
    "A reader would like the full text",
    `<p><strong>${esc(who)}</strong> asked to read <em>${esc(pub.title)}</em>.</p>
     ${message ? `<p style="white-space:pre-wrap">${esc(message)}</p>` : ""}
     <p>Approve or decline from your publications dashboard.</p>`,
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
