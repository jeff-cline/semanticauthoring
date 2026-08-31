import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { testimonialRequestEmail } from "@/lib/email";
import { limitFor } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Testimonials" };

export default async function Testimonials() {
  const user = (await currentUser())!;
  const [requests, received] = await Promise.all([
    q<any>(`SELECT * FROM testimonial_requests WHERE owner_id=$1 ORDER BY created_at DESC`, [user.id]),
    q<any>(`SELECT * FROM testimonials WHERE owner_id=$1 ORDER BY created_at DESC`, [user.id]),
  ]);
  const cap = limitFor(user, "testimonialRequests");

  async function sendRequest(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const email = String(formData.get("email") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    if (!email || !name) return;

    const limit = limitFor(me, "testimonialRequests");
    if (limit !== null) {
      const c = await one<{ n: string }>(
        `SELECT count(*) n FROM testimonial_requests WHERE owner_id=$1`, [me.id]);
      if (Number(c?.n ?? 0) >= limit) return;
    }

    const token = randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 30 * 864e5);       // 30 days
    const message = String(formData.get("message") ?? "").slice(0, 2000);

    const row = await one<{ id: number }>(
      `INSERT INTO testimonial_requests
         (owner_id, recipient_name, recipient_email, token, message, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, name.slice(0, 200), email.slice(0, 200), token, message, expires],
    );

    const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
    await testimonialRequestEmail(email, me.name || me.email, message, `${base}/testimonial/${token}`);
    await logEvent("testimonial_request", "sent", { actorId: me.id, entityId: row?.id, detail: email });
    revalidatePath("/app/testimonials");
  }

  async function decide(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    const status = String(formData.get("status"));
    if (!["published", "private", "withdrawn"].includes(status)) return;
    const owned = await one(`SELECT id FROM testimonials WHERE id=$1 AND owner_id=$2`, [id, me.id]);
    if (!owned) return;
    await q(
      `UPDATE testimonials SET status=$1, published_at = CASE WHEN $1='published' THEN now() ELSE NULL END,
              updated_at=now() WHERE id=$2`, [status, id]);
    await logEvent("testimonial", status, { actorId: me.id, entityId: id });
    revalidatePath("/app/testimonials");
  }

  return (
    <>
      <p className="eyebrow">Endorsements</p>
      <h1>Testimonials</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Ask the people who know your work to write a few words. Nothing appears publicly
        unless you approve it — silence is not consent. Written text only; there are no
        ratings anywhere on this platform.
        {cap !== null && ` Your tier includes ${cap} requests (${requests.length} used).`}
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 26 }}>
        <form action={sendRequest} className="card">
          <h2 style={{ fontSize: "1.1rem" }}>Request a testimonial</h2>
          <div className="field"><label htmlFor="name">Their name</label><input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="email">Their email</label><input id="email" name="email" type="email" required /></div>
          <div className="field">
            <label htmlFor="message">A personal note (optional)</label>
            <textarea id="message" name="message" rows={4}
                      placeholder="Why you're asking them specifically." />
          </div>
          <button className="btn btn-primary">Send request</button>
          <p style={{ color: "var(--muted)", fontSize: ".84rem", marginBottom: 0, marginTop: 12 }}>
            They&rsquo;ll get a single-use link, valid for 30 days. No account needed.
          </p>
        </form>

        <div>
          <h2 style={{ fontSize: "1.1rem" }}>Received ({received.length})</h2>
          {received.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing yet.</p>}
          {received.map((t: any) => (
            <div key={t.id} className="card stage stage-publish" style={{ marginBottom: 12 }}>
              <p style={{ fontSize: "1.02rem", fontStyle: "italic" }}>&ldquo;{t.body}&rdquo;</p>
              <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "8px 0" }}>
                — {t.author_name}{t.author_role ? `, ${t.author_role}` : ""}
                {t.author_institution ? `, ${t.author_institution}` : ""}
              </p>
              <span className="pill">{t.status}</span>
              <form action={decide} style={{ display: "inline-flex", gap: 8, marginLeft: 12 }}>
                <input type="hidden" name="id" value={t.id} />
                {t.status !== "published" && (
                  <button className="btn btn-secondary" name="status" value="published"
                          style={{ padding: "6px 14px", fontSize: ".85rem" }}>Publish</button>
                )}
                {t.status !== "private" && (
                  <button className="btn btn-secondary" name="status" value="private"
                          style={{ padding: "6px 14px", fontSize: ".85rem" }}>Keep private</button>
                )}
                <button className="btn btn-secondary" name="status" value="withdrawn"
                        style={{ padding: "6px 14px", fontSize: ".85rem" }}>Withdraw</button>
              </form>
            </div>
          ))}

          {requests.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.1rem", marginTop: 30 }}>Requests sent ({requests.length})</h2>
              <table>
                <thead><tr><th>Person</th><th>Status</th><th>Sent</th></tr></thead>
                <tbody>
                  {requests.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.recipient_name}<br />
                        <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>{r.recipient_email}</span>
                      </td>
                      <td><span className="pill">{r.status}</span></td>
                      <td style={{ color: "var(--muted)", fontSize: ".86rem" }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </>
  );
}
