import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";
import { slugify, readingTime } from "@/lib/slug";
import { publishedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit publication" };

export default async function EditPublication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;
  if (!can(user, "publishing")) notFound();

  const pub = await one<any>(`SELECT * FROM publications WHERE id=$1 AND owner_id=$2`,
    [Number(id), user.id]);
  if (!pub) notFound();

  const profile = await one<any>(`SELECT handle, is_public FROM profiles WHERE user_id=$1`, [user.id]);
  const subs = await one<{ n: string }>(
    `SELECT count(*) n FROM subscribers WHERE scholar_id=$1 AND status='confirmed'`, [user.id]);

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const pid = Number(formData.get("id"));
    const owned = await one<any>(`SELECT id, slug FROM publications WHERE id=$1 AND owner_id=$2`,
      [pid, me.id]);
    if (!owned) return;
    const body = String(formData.get("body") ?? "");
    const title = String(formData.get("title") ?? "").slice(0, 300);
    await q(
      `UPDATE publications SET title=$1, subtitle=$2, abstract=$3, body=$4, kind=$5, tags=$6,
              topic=$7, doi=$8, external_url=$9, word_count=$10, reading_time=$11, updated_at=now()
        WHERE id=$12`,
      [title, String(formData.get("subtitle") ?? "").slice(0, 300),
       String(formData.get("abstract") ?? "").slice(0, 4000), body,
       String(formData.get("kind") ?? "essay"), String(formData.get("tags") ?? "").slice(0, 300),
       String(formData.get("topic") ?? "").slice(0, 120),
       String(formData.get("doi") ?? "").slice(0, 200),
       String(formData.get("external_url") ?? "").slice(0, 600),
       body.trim() ? body.trim().split(/\s+/).length : 0, readingTime(body), pid]);
    await logEvent("publication", "saved", { actorId: me.id, entityId: pid });
    revalidatePath(`/app/publications/${pid}`);
  }

  async function setStatus(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const pid = Number(formData.get("id"));
    const to = String(formData.get("to"));
    if (!["published", "unpublished", "draft"].includes(to)) return;

    const p = await one<any>(`SELECT * FROM publications WHERE id=$1 AND owner_id=$2`, [pid, me.id]);
    if (!p) return;

    // Publishing requires a public profile — otherwise the piece has no home.
    if (to === "published") {
      const prof = await one<any>(`SELECT handle, is_public FROM profiles WHERE user_id=$1`, [me.id]);
      if (!prof?.is_public) return;
    }

    const first = to === "published" && !p.published_at;
    await q(
      `UPDATE publications SET status=$1,
              published_at = CASE WHEN $1='published' AND published_at IS NULL THEN now()
                                  ELSE published_at END,
              updated_at=now() WHERE id=$2`, [to, pid]);
    await logEvent("publication", to, { actorId: me.id, entityId: pid });

    // Notify confirmed subscribers, but only the first time it goes live.
    if (first) {
      const prof = await one<any>(`SELECT handle FROM profiles WHERE user_id=$1`, [me.id]);
      const list = await q<any>(
        `SELECT email FROM subscribers WHERE scholar_id=$1 AND status='confirmed'`, [me.id]);
      const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
      for (const s of list) {
        publishedEmail(s.email, me.name || me.email, p.title,
          `${base}/s/${prof?.handle}/${p.slug}`, p.abstract).catch(() => {});
      }
    }
    revalidatePath(`/app/publications/${pid}`);
  }

  const url = profile?.handle ? `/s/${profile.handle}/${pub.slug}` : null;

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/publications">← Publications</Link></p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
                    marginBottom: 18 }}>
        <span className="pill" style={{ color: pub.status === "published" ? "var(--coral)" : undefined }}>
          {pub.status}
        </span>
        {pub.published_at && (
          <span style={{ color: "var(--muted)", fontSize: ".86rem" }}>
            published {new Date(pub.published_at).toLocaleDateString()}
          </span>
        )}
        {url && pub.status === "published" && <Link href={url}>View public page ↗</Link>}
        <form action={setStatus} style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <input type="hidden" name="id" value={pub.id} />
          {pub.status !== "published" ? (
            <button className="btn btn-primary" name="to" value="published"
                    disabled={!profile?.is_public}>
              Publish
            </button>
          ) : (
            <button className="btn btn-secondary" name="to" value="unpublished">Unpublish</button>
          )}
        </form>
      </div>

      {!profile?.is_public && (
        <div className="card" style={{ marginBottom: 18, borderLeft: "3px solid var(--gold)" }}>
          <p style={{ margin: 0 }}>
            Turn on your public profile before publishing — otherwise this piece has nowhere
            to live. <Link href="/app/profile">Profile settings →</Link>
          </p>
        </div>
      )}

      {pub.status !== "published" && Number(subs?.n ?? 0) > 0 && !pub.published_at && (
        <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>
          Publishing will notify your {subs?.n} confirmed subscriber
          {Number(subs?.n) === 1 ? "" : "s"}.
        </p>
      )}

      <form action={save} className="card" style={{ maxWidth: 860 }}>
        <h1 className="hp">{pub.title || "Untitled publication"}</h1>
        <input type="hidden" name="id" value={pub.id} />
        <div className="field"><label htmlFor="title">Title</label>
          <input id="title" name="title" defaultValue={pub.title} required /></div>
        <div className="field"><label htmlFor="subtitle">Subtitle</label>
          <input id="subtitle" name="subtitle" defaultValue={pub.subtitle} /></div>
        <div className="field">
          <label htmlFor="abstract">Abstract or short summary</label>
          <textarea id="abstract" name="abstract" rows={3} defaultValue={pub.abstract} />
          <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
            Used as the description for search engines, social cards, and your subscribers&rsquo; email.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="kind">Kind</label>
            <select id="kind" name="kind" defaultValue={pub.kind}>
              {["essay", "research_note", "article", "working_paper", "commentary",
                "reflection", "explainer", "conference_summary"].map((k) => (
                <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="topic">Topic</label>
            <input id="topic" name="topic" defaultValue={pub.topic}
                   placeholder="Psychology, Education…" />
          </div>
          <div className="field" style={{ flex: "2 1 240px" }}>
            <label htmlFor="tags">Tags</label>
            <input id="tags" name="tags" defaultValue={pub.tags} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="doi">DOI (if formally published)</label>
            <input id="doi" name="doi" defaultValue={pub.doi} />
          </div>
          <div className="field" style={{ flex: "1 1 240px" }}>
            <label htmlFor="external_url">Canonical / external URL</label>
            <input id="external_url" name="external_url" defaultValue={pub.external_url} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="body">Body</label>
          <textarea id="body" name="body" rows={22} defaultValue={pub.body}
                    style={{ fontFamily: "var(--serif)", fontSize: "1.04rem", lineHeight: 1.75,
                             padding: "20px 22px" }} />
        </div>
        <button className="btn btn-primary">Save</button>
        <span style={{ color: "var(--muted)", fontSize: ".86rem", marginLeft: 14 }}>
          {pub.word_count} words · about {pub.reading_time} min read
        </span>
      </form>
    </>
  );
}
