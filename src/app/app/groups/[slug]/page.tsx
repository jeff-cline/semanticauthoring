import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Group" };

export default async function Group({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = (await currentUser())!;

  const group = await one<any>(
    `SELECT g.*, m.role AS my_role FROM groups g
       LEFT JOIN group_members m ON m.group_id=g.id AND m.user_id=$1
      WHERE g.slug=$2`, [user.id, slug]);

  // A private group is invisible to non-members — not "forbidden", simply not there.
  if (!group || (!group.my_role && group.visibility !== "public")) notFound();

  const [posts, members, sources] = await Promise.all([
    q<any>(`SELECT p.*, u.name AS author_name, s.title AS source_title
              FROM group_posts p JOIN users u ON u.id=p.author_id
              LEFT JOIN sources s ON s.id=p.source_id
             WHERE p.group_id=$1 ORDER BY p.created_at DESC LIMIT 200`, [group.id]),
    q<any>(`SELECT m.role, u.name, u.email FROM group_members m JOIN users u ON u.id=m.user_id
             WHERE m.group_id=$1 ORDER BY m.joined_at`, [group.id]),
    group.my_role
      ? q<any>(`SELECT id, title FROM sources WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 40`,
          [user.id])
      : Promise.resolve([]),
  ]);

  async function post(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const gid = Number(formData.get("groupId"));
    const member = await one(`SELECT id FROM group_members WHERE group_id=$1 AND user_id=$2`,
      [gid, me.id]);
    if (!member) return;                       // only members can post
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    const sid = String(formData.get("sourceId") ?? "");
    // A shared source must belong to the poster — you cannot surface someone else's library.
    let sourceId: number | null = null;
    if (sid) {
      const owned = await one(`SELECT id FROM sources WHERE id=$1 AND owner_id=$2`,
        [Number(sid), me.id]);
      if (owned) sourceId = Number(sid);
    }
    const row = await one<{ id: number }>(
      `INSERT INTO group_posts (group_id, author_id, body, kind, source_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [gid, me.id, body.slice(0, 8000), String(formData.get("kind") ?? "discussion"), sourceId]);
    await q(`UPDATE groups SET updated_at=now() WHERE id=$1`, [gid]);
    await logEvent("group_post", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath(`/app/groups/${formData.get("slug")}`);
  }

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/groups">← Groups</Link></p>
      <p className="eyebrow">{group.kind.replace(/_/g, " ")} · {group.visibility}</p>
      <h1 style={{ marginBottom: 6 }}>{group.name}</h1>
      {group.purpose && <p style={{ color: "var(--muted)", marginTop: 0 }}>{group.purpose}</p>}

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 24 }}>
        <div>
          {group.my_role ? (
            <form action={post} className="card">
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="slug" value={group.slug} />
              <div className="field">
                <label htmlFor="body">Post to the group</label>
                <textarea id="body" name="body" rows={3} required />
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 160px" }}>
                  <label htmlFor="kind">Kind</label>
                  <select id="kind" name="kind">
                    {["discussion", "question", "recommendation", "milestone", "accountability"]
                      .map((k) => <option key={k}>{k}</option>)}
                  </select>
                </div>
                {sources.length > 0 && (
                  <div className="field" style={{ flex: "2 1 220px" }}>
                    <label htmlFor="sourceId">Recommend one of your sources</label>
                    <select id="sourceId" name="sourceId" defaultValue="">
                      <option value="">— none —</option>
                      {sources.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.title.slice(0, 60)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button className="btn btn-primary">Post</button>
              <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 12, marginBottom: 0 }}>
                Only what you post here is visible. Your library, notes, and journal are not.
              </p>
            </form>
          ) : (
            <div className="card">
              <p style={{ margin: 0 }}>You&rsquo;re viewing a public group.</p>
              <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                <Link href="/app/groups">Join it</Link> to take part.
              </p>
            </div>
          )}

          <h2 style={{ fontSize: "1.05rem", marginTop: 26 }}>Discussion ({posts.length})</h2>
          {posts.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing posted yet.</p>}
          {posts.map((p: any) => (
            <div key={p.id} className="card" style={{ marginBottom: 10, padding: 18 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: ".92rem" }}>{p.author_name || "A scholar"}</strong>
                <span className="pill">{p.kind}</span>
                <span style={{ color: "var(--muted)", fontSize: ".78rem", marginLeft: "auto" }}>
                  {new Date(p.created_at).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.body}</p>
              {p.source_title && (
                <p style={{ margin: "8px 0 0", fontSize: ".9rem", color: "var(--current)" }}>
                  Recommended reading: {p.source_title}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <h2 style={{ fontSize: "1.05rem" }}>Members ({members.length})</h2>
          {members.map((m: any, i: number) => (
            <p key={i} style={{ margin: "6px 0", fontSize: ".93rem" }}>
              {m.name || m.email}{" "}
              {m.role !== "member" && <span className="pill">{m.role}</span>}
            </p>
          ))}
        </div>
      </div>
    </>
  );
}
