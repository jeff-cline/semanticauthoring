import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const metadata = { title: "Groups" };

const KINDS: [string, string][] = [
  ["cohort", "Doctoral cohort"], ["university", "University group"],
  ["research_interest", "Research interest"], ["reading_circle", "Reading circle"],
  ["writing", "Writing group"], ["accountability", "Accountability group"],
  ["methodology", "Methodology group"], ["publication", "Publication group"],
  ["peer_support", "Peer support"],
];

export default async function Groups() {
  const user = (await currentUser())!;

  const [mine, discoverable] = await Promise.all([
    q<any>(`SELECT g.*, m.role,
                   (SELECT count(*) FROM group_members x WHERE x.group_id=g.id) AS members,
                   (SELECT count(*) FROM group_posts p WHERE p.group_id=g.id) AS posts
              FROM groups g JOIN group_members m ON m.group_id=g.id AND m.user_id=$1
             ORDER BY g.updated_at DESC`, [user.id]),
    q<any>(`SELECT g.*,
                   (SELECT count(*) FROM group_members x WHERE x.group_id=g.id) AS members
              FROM groups g
             WHERE g.visibility='public'
               AND NOT EXISTS (SELECT 1 FROM group_members m
                                WHERE m.group_id=g.id AND m.user_id=$1)
             ORDER BY members DESC LIMIT 30`, [user.id]),
  ]);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const base = slugify(name, "group");
    let slug = base;
    for (let i = 2; await one(`SELECT id FROM groups WHERE slug=$1`, [slug]); i++) slug = `${base}-${i}`;
    const row = await one<{ id: number }>(
      `INSERT INTO groups (owner_id, slug, name, purpose, kind, visibility)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, slug, name.slice(0, 200), String(formData.get("purpose") ?? "").slice(0, 2000),
       String(formData.get("kind") ?? "reading_circle"),
       String(formData.get("visibility") ?? "private")]);
    if (row) {
      await q(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1,$2,'owner')`,
        [row.id, me.id]);
    }
    await logEvent("group", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/groups");
  }

  async function join(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const gid = Number(formData.get("groupId"));
    const g = await one<any>(`SELECT id FROM groups WHERE id=$1 AND visibility='public'`, [gid]);
    if (!g) return;
    await q(`INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)
             ON CONFLICT DO NOTHING`, [gid, me.id]);
    await logEvent("group", "joined", { actorId: me.id, entityId: gid });
    revalidatePath("/app/groups");
  }

  return (
    <>
      <p className="eyebrow">Connect</p>
      <h1>Groups</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680 }}>
        Cohorts, reading circles, writing groups, accountability partners. Your private
        research is never visible to a group — only what you deliberately post.
      </p>

      <details className="card" style={{ margin: "22px 0 28px", maxWidth: 720 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Create a group</summary>
        <form action={create} style={{ marginTop: 16 }}>
          <div className="field"><label htmlFor="name">Name</label>
            <input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="purpose">What is it for?</label>
            <textarea id="purpose" name="purpose" rows={2} /></div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "2 1 200px" }}>
              <label htmlFor="kind">Kind</label>
              <select id="kind" name="kind">
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: "1 1 160px" }}>
              <label htmlFor="visibility">Visibility</label>
              <select id="visibility" name="visibility">
                <option value="private">Private — invite only</option>
                <option value="public">Public — anyone can join</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary">Create group</button>
        </form>
      </details>

      <h2 style={{ fontSize: "1.1rem" }}>Your groups ({mine.length})</h2>
      {mine.length === 0 && <p style={{ color: "var(--muted)" }}>You&rsquo;re not in any groups yet.</p>}
      <div className="grid grid-2">
        {mine.map((g: any) => (
          <Link key={g.id} href={`/app/groups/${g.slug}`} className="card stage stage-connect"
                style={{ textDecoration: "none", color: "inherit" }}>
            <h3 style={{ fontSize: "1.02rem", marginBottom: 4 }}>{g.name}</h3>
            {g.purpose && (
              <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "0 0 8px" }}>
                {g.purpose.slice(0, 110)}
              </p>
            )}
            <span className="pill">{KINDS.find(([v]) => v === g.kind)?.[1] ?? g.kind}</span>{" "}
            <span className="pill">{g.members} members</span>{" "}
            <span className="pill">{g.posts} posts</span>{" "}
            {g.role === "owner" && <span className="pill">owner</span>}
          </Link>
        ))}
      </div>

      {discoverable.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.1rem", marginTop: 36 }}>Open groups</h2>
          {discoverable.map((g: any) => (
            <div key={g.id} className="card" style={{ marginBottom: 10, padding: 18,
                 display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 300px" }}>
                <strong>{g.name}</strong>{" "}
                <span className="pill">{g.members} members</span>
                {g.purpose && (
                  <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "4px 0 0" }}>
                    {g.purpose.slice(0, 140)}
                  </p>
                )}
              </div>
              <form action={join}>
                <input type="hidden" name="groupId" value={g.id} />
                <button className="btn btn-secondary">Join</button>
              </form>
            </div>
          ))}
        </>
      )}
    </>
  );
}
