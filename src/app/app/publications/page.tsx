import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { can } from "@/lib/tiers";
import { slugify, readingTime } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publications" };

const KINDS: [string, string][] = [
  ["essay", "Public essay"], ["research_note", "Research note"], ["article", "Article"],
  ["working_paper", "Working paper"], ["commentary", "Commentary"],
  ["reflection", "Literature reflection"], ["explainer", "Research explainer"],
  ["conference_summary", "Conference summary"],
];

export default async function Publications() {
  const user = (await currentUser())!;
  const allowed = can(user, "publishing");

  if (!allowed) {
    return (
      <>
        <h1>Publications</h1>
        <div className="card" style={{ maxWidth: 620 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Public publishing arrives with the Scholar tier — a public profile readers can
            follow, publication pages with proper scholarly metadata, and subscribers who are
            notified when you publish.
          </p>
        </div>
      </>
    );
  }

  const [pubs, docs, profile] = await Promise.all([
    q<any>(`SELECT * FROM publications WHERE owner_id=$1 ORDER BY updated_at DESC`, [user.id]),
    q<any>(`SELECT id, title, body, word_count FROM documents WHERE owner_id=$1
             ORDER BY updated_at DESC LIMIT 50`, [user.id]),
    one<any>(`SELECT handle, is_public FROM profiles WHERE user_id=$1`, [user.id]),
  ]);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (!can(me, "publishing")) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;

    const docId = String(formData.get("documentId") ?? "");
    let body = "";
    if (docId) {
      const d = await one<any>(`SELECT body FROM documents WHERE id=$1 AND owner_id=$2`,
        [Number(docId), me.id]);
      body = d?.body ?? "";
    }

    // Unique slug per author.
    const base = slugify(title);
    let slug = base;
    for (let i = 2; await one(`SELECT id FROM publications WHERE owner_id=$1 AND slug=$2`,
      [me.id, slug]); i++) slug = `${base}-${i}`;

    const row = await one<{ id: number }>(
      `INSERT INTO publications (owner_id, document_id, slug, title, kind, body, word_count, reading_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [me.id, docId ? Number(docId) : null, slug, title.slice(0, 300),
       String(formData.get("kind") ?? "essay"), body,
       body.trim() ? body.trim().split(/\s+/).length : 0, readingTime(body)]);
    await logEvent("publication", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/publications");
  }

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Publications</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Move finished work into the world, deliberately. Nothing here is public until you
        publish it, and you can unpublish at any time.
      </p>

      {!profile?.is_public && (
        <div className="card" style={{ margin: "20px 0", borderLeft: "3px solid var(--gold)" }}>
          <p style={{ margin: 0 }}>
            Your public profile is turned off, so published work won&rsquo;t be reachable yet.{" "}
            <Link href="/app/profile">Set up your profile →</Link>
          </p>
        </div>
      )}

      <form action={create} className="card" style={{ margin: "20px 0 28px", maxWidth: 720 }}>
        <h2 style={{ fontSize: "1.05rem" }}>New publication</h2>
        <div className="field"><label htmlFor="title">Title</label>
          <input id="title" name="title" required /></div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="kind">Kind</label>
            <select id="kind" name="kind">
              {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {docs.length > 0 && (
            <div className="field" style={{ flex: "2 1 260px" }}>
              <label htmlFor="documentId">Start from a document (optional)</label>
              <select id="documentId" name="documentId" defaultValue="">
                <option value="">— blank —</option>
                {docs.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.title.slice(0, 70)} ({d.word_count}w)</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button className="btn btn-primary">Create</button>
      </form>

      {pubs.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing yet.</p>}
      <div className="grid grid-2">
        {pubs.map((p: any) => (
          <Link key={p.id} href={`/app/publications/${p.id}`} className="card stage stage-publish"
                style={{ textDecoration: "none", color: "inherit" }}>
            <h3 style={{ fontSize: "1.02rem", marginBottom: 6 }}>{p.title}</h3>
            <span className="pill">{KINDS.find(([v]) => v === p.kind)?.[1] ?? p.kind}</span>{" "}
            <span className="pill" style={{ color: p.status === "published" ? "var(--coral)" : undefined }}>
              {p.status}
            </span>{" "}
            <span className="pill">{p.word_count} words</span>
            {p.status === "published" && profile?.handle && (
              <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "10px 0 0" }}>
                /s/{profile.handle}/{p.slug}
              </p>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
