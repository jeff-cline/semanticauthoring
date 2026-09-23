import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendTransactional, esc } from "@/lib/email";
import { normalizePolicy } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

// The author's side of cohort access: set the policy, approve, decline,
// revoke, invite.
//
// Every statement filters on owner_id. Ownership is never checked once and
// then trusted for the rest of the request.

async function rowsFor(publicationId: number, ownerId: number) {
  return q<any>(
    `SELECT da.id, da.reader_id, da.status, da.origin, da.message,
            u.name, u.email, p.handle, p.avatar_url
       FROM document_access da
       JOIN users u ON u.id = da.reader_id
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE da.publication_id = $1 AND da.owner_id = $2
      ORDER BY CASE da.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
               da.created_at`,
    [publicationId, ownerId],
  ).catch(() => []);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const publicationId = Number(b.publicationId);
  const action = String(b.action ?? "");
  if (!Number.isInteger(publicationId)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const pub = await one<any>(
    `SELECT pb.id, pb.title, pb.slug, pb.reader_access, pr.handle
       FROM publications pb
       LEFT JOIN profiles pr ON pr.user_id = pb.owner_id
      WHERE pb.id=$1 AND pb.owner_id=$2`, [publicationId, user.id]).catch(() => null);
  if (!pub) return NextResponse.json({ ok: false, error: "Not your publication." },
    { status: 404 });

  const link = pub.handle ? `${SITE}/s/${pub.handle}/${pub.slug}` : SITE;

  if (action === "policy") {
    const policy = normalizePolicy(b.policy);
    await q(`UPDATE publications SET reader_access=$1, updated_at=now()
              WHERE id=$2 AND owner_id=$3`, [policy, publicationId, user.id]);
    await logEvent("publication", "access_policy",
      { actorId: user.id, entityId: String(publicationId), detail: policy });
    return NextResponse.json({ ok: true, policy, rows: await rowsFor(publicationId, user.id) });
  }

  if (action === "invite") {
    const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "That email doesn't look right." },
        { status: 400 });
    }
    const reader = await one<any>(`SELECT id, name, email FROM users WHERE lower(email)=$1`,
      [email]).catch(() => null);
    if (!reader) {
      return NextResponse.json(
        { ok: false, error: "No account here with that address yet. Ask them to join first." },
        { status: 404 });
    }
    if (reader.id === user.id) {
      return NextResponse.json({ ok: false, error: "That is you." }, { status: 400 });
    }
    await q(
      `INSERT INTO document_access (publication_id, owner_id, reader_id, status, origin, decided_at)
       VALUES ($1,$2,$3,'approved','invite',now())
       ON CONFLICT (publication_id, reader_id)
       DO UPDATE SET status='approved', decided_at=now(), updated_at=now()`,
      [publicationId, user.id, reader.id]);

    await notify(reader.id, "system", `You can read “${pub.title}”`,
      { body: `${user.name || "The author"} invited you.`, href: link }).catch(() => {});
    await sendTransactional(reader.email,
      `You can now read “${pub.title}”`, "An author shared their work with you",
      `<p><strong>${esc(user.name || user.email)}</strong> invited you to read
        <em>${esc(pub.title)}</em>.</p>
       <p><a href="${esc(link)}">Read it here</a></p>`).catch(() => {});

    return NextResponse.json({ ok: true, rows: await rowsFor(publicationId, user.id) });
  }

  const readerId = Number(b.readerId);
  if (!Number.isInteger(readerId)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const next = action === "approve" ? "approved"
    : action === "decline" ? "declined"
    : action === "revoke" ? "revoked" : null;
  if (!next) return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });

  const updated = await one<{ id: number }>(
    `UPDATE document_access SET status=$1, decided_at=now(), updated_at=now()
      WHERE publication_id=$2 AND reader_id=$3 AND owner_id=$4
      RETURNING id`,
    [next, publicationId, readerId, user.id]).catch(() => null);
  if (!updated) return NextResponse.json({ ok: false, error: "No such request." },
    { status: 404 });

  await logEvent("document_access", next,
    { actorId: user.id, entityId: String(publicationId) });

  // Tell them when they gain access. Silence on a decline or revoke is
  // deliberate: the author owes a reader their decision, not an explanation,
  // and a "you have been declined" email invites an argument.
  if (next === "approved") {
    const reader = await one<any>(`SELECT id, email FROM users WHERE id=$1`, [readerId])
      .catch(() => null);
    if (reader) {
      await notify(reader.id, "system", `You can read “${pub.title}”`, { href: link })
        .catch(() => {});
      await sendTransactional(reader.email,
        `You can now read “${pub.title}”`, "Your request was approved",
        `<p><strong>${esc(user.name || user.email)}</strong> shared the full text of
          <em>${esc(pub.title)}</em> with you.</p>
         <p><a href="${esc(link)}">Read it here</a></p>`).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, rows: await rowsFor(publicationId, user.id) });
}
