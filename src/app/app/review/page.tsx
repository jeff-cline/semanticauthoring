import Link from "next/link";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";
import { reviewInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review" };

const ROLES = ["mentor", "advisor", "committee", "peer", "reviewer"];

export default async function Review() {
  const user = (await currentUser())!;
  if (!can(user, "review")) {
    return (
      <>
        <h1>Review</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Mentor and committee review arrives with the Doctoral tier — share one chapter
            with a methodology advisor without exposing your journal or the rest of your
            research.
          </p>
        </div>
      </>
    );
  }

  const [documents, shares, comments] = await Promise.all([
    q<any>(`SELECT id, title, status FROM documents WHERE owner_id=$1 ORDER BY updated_at DESC`,
      [user.id]),
    q<any>(`SELECT s.*, d.title AS doc_title,
                   (SELECT count(*) FROM review_comments c WHERE c.share_id = s.id) AS comment_count
              FROM shares s LEFT JOIN documents d ON d.id = s.entity_id AND s.entity_type='document'
             WHERE s.owner_id=$1 ORDER BY s.created_at DESC`, [user.id]),
    q<any>(`SELECT c.*, d.title AS doc_title, d.id AS doc_id
              FROM review_comments c
              JOIN documents d ON d.id = c.entity_id AND c.entity_type='document'
             WHERE d.owner_id=$1 ORDER BY c.resolved, c.created_at DESC LIMIT 100`, [user.id]),
  ]);

  async function share(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (!can(me, "review")) return;
    const docId = Number(formData.get("documentId"));
    const email = String(formData.get("email") ?? "").trim();
    if (!docId || !email.includes("@")) return;

    const doc = await one<any>(`SELECT id, title FROM documents WHERE id=$1 AND owner_id=$2`,
      [docId, me.id]);
    if (!doc) return;

    const token = randomBytes(24).toString("hex");
    const due = String(formData.get("due_on") ?? "");
    const role = String(formData.get("role") ?? "reviewer");
    const expires = new Date(Date.now() + 90 * 864e5);

    const row = await one<{ id: number }>(
      `INSERT INTO shares (owner_id, entity_type, entity_id, reviewer_name, reviewer_email,
                           reviewer_role, token, due_on, expires_at)
       VALUES ($1,'document',$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [me.id, docId, String(formData.get("name") ?? "").slice(0, 200), email.slice(0, 200),
       role, token, due || null, expires]);

    const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
    reviewInviteEmail(email, me.name || me.email, doc.title, role,
      `${base}/review/${token}`, due || undefined).catch(() => {});
    await logEvent("share", "created", { actorId: me.id, entityId: row?.id, detail: email });
    revalidatePath("/app/review");
  }

  async function revoke(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    await q(`UPDATE shares SET status='revoked', updated_at=now() WHERE id=$1 AND owner_id=$2`,
      [id, me.id]);
    await logEvent("share", "revoked", { actorId: me.id, entityId: id });
    revalidatePath("/app/review");
  }

  async function resolve(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    await q(`UPDATE review_comments c SET resolved = NOT c.resolved, updated_at=now()
              FROM documents d
             WHERE c.id=$1 AND d.id = c.entity_id AND c.entity_type='document' AND d.owner_id=$2`,
      [id, me.id]);
    revalidatePath("/app/review");
  }

  const openComments = comments.filter((c: any) => !c.resolved);

  return (
    <>
      <p className="eyebrow">Review</p>
      <h1>Mentor and committee review</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        Share exactly one document with exactly one person. A methodology advisor sees your
        methodology chapter — not your journal, not your library, not your other writing.
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 26 }}>
        <div>
          {documents.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Nothing to share yet. <Link href="/app/studio">Write something first →</Link>
              </p>
            </div>
          ) : (
            <form action={share} className="card stage stage-review">
              <h2 style={{ fontSize: "1.05rem" }}>Send for review</h2>
              <div className="field">
                <label htmlFor="documentId">Which document?</label>
                <select id="documentId" name="documentId">
                  {documents.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.title.slice(0, 80)}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label htmlFor="name">Their name</label>
                <input id="name" name="name" /></div>
              <div className="field"><label htmlFor="email">Their email</label>
                <input id="email" name="email" type="email" required /></div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 150px" }}>
                  <label htmlFor="role">Their role</label>
                  <select id="role" name="role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                </div>
                <div className="field" style={{ flex: "1 1 150px" }}>
                  <label htmlFor="due_on">Comments by</label>
                  <input id="due_on" name="due_on" type="date" />
                </div>
              </div>
              <button className="btn btn-primary">Send review link</button>
              <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 12, marginBottom: 0 }}>
                They don&rsquo;t need an account. The link expires in 90 days and you can
                revoke it at any moment.
              </p>
            </form>
          )}

          {shares.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2 style={{ fontSize: "1.05rem" }}>Shared</h2>
              {shares.map((s: any) => (
                <div key={s.id} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
                  <strong style={{ fontSize: ".95rem" }}>{s.doc_title}</strong>
                  <div style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                    {s.reviewer_name || s.reviewer_email} · {s.reviewer_role}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                    <span className="pill">{s.status}</span>
                    <span className="pill">{s.comment_count} comments</span>
                    {s.last_opened_at && (
                      <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>
                        opened {new Date(s.last_opened_at).toLocaleDateString()}
                      </span>
                    )}
                    {s.status === "active" && (
                      <form action={revoke} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn btn-secondary"
                                style={{ padding: "4px 12px", fontSize: ".8rem" }}>Revoke</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: "1.05rem" }}>
            Feedback {openComments.length > 0 && `(${openComments.length} open)`}
          </h2>
          {comments.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No comments yet.</p>
          )}
          {comments.map((c: any) => (
            <div key={c.id} className="card" style={{ marginBottom: 10, padding: 16,
                 opacity: c.resolved ? .6 : 1,
                 borderLeft: `3px solid ${c.resolved ? "var(--line)" : "var(--review)"}` }}>
              <div style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 6 }}>
                {c.author_name} on <Link href={`/app/studio/${c.doc_id}`}>{c.doc_title}</Link>
              </div>
              {c.anchor && (
                <blockquote style={{ margin: "0 0 8px", paddingLeft: 12,
                                     borderLeft: "2px solid var(--line)", fontStyle: "italic",
                                     fontSize: ".9rem", color: "var(--muted)" }}>
                  {c.anchor}
                </blockquote>
              )}
              <p style={{ margin: "0 0 8px" }}>{c.body}</p>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>
                  {new Date(c.created_at).toLocaleString()}
                </span>
                <form action={resolve} style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="btn btn-secondary"
                          style={{ padding: "4px 12px", fontSize: ".8rem" }}>
                    {c.resolved ? "Reopen" : "Resolve"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
