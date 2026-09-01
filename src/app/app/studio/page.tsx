import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { limitFor } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authoring studio" };

const KINDS: [string, string][] = [
  ["essay", "Public essay"], ["course_paper", "Course paper"], ["discussion", "Discussion post"],
  ["lit_review", "Literature review"], ["proposal", "Research proposal"],
  ["chapter", "Dissertation chapter"], ["manuscript", "Journal manuscript"],
  ["abstract", "Conference abstract"], ["working_paper", "Working paper"],
  ["research_note", "Research note"],
];

export default async function Studio() {
  const user = (await currentUser())!;
  const rows = await q<any>(
    `SELECT d.*, (SELECT count(*) FROM document_versions v WHERE v.document_id=d.id) AS versions
       FROM documents d WHERE d.owner_id=$1 ORDER BY d.updated_at DESC`, [user.id]);
  const cap = limitFor(user, "authoringDocs");

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const limit = limitFor(me, "authoringDocs");
    if (limit !== null) {
      const c = await one<{ n: string }>(`SELECT count(*) n FROM documents WHERE owner_id=$1`, [me.id]);
      if (Number(c?.n ?? 0) >= limit) { revalidatePath("/app/studio"); return; }
    }
    const row = await one<{ id: number }>(
      `INSERT INTO documents (owner_id, title, kind) VALUES ($1,$2,$3) RETURNING id`,
      [me.id, title.slice(0, 300), String(formData.get("kind") ?? "essay")]);
    await logEvent("document", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/studio");
  }

  return (
    <>
      <p className="eyebrow">Author</p>
      <h1>Authoring studio</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Write with your sources, notes, and questions within reach. Every save keeps the
        previous version — nothing you wrote is ever lost to a revision.
        {cap !== null && ` Your tier includes ${cap} documents (${rows.length} used).`}
      </p>

      <form action={create} className="card" style={{ margin: "24px 0 30px", maxWidth: 640 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "2 1 240px", marginBottom: 0 }}>
            <label htmlFor="title">Title</label><input id="title" name="title" required />
          </div>
          <div className="field" style={{ flex: "1 1 190px", marginBottom: 0 }}>
            <label htmlFor="kind">Kind</label>
            <select id="kind" name="kind">
              {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <button className="btn btn-primary">New document</button>
        </div>
      </form>

      {rows.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing written yet.</p>}
      <div className="grid grid-2">
        {rows.map((d: any) => (
          <Link key={d.id} href={`/app/studio/${d.id}`} className="card stage stage-author"
                style={{ textDecoration: "none", color: "inherit" }}>
            <h3 style={{ fontSize: "1.02rem", marginBottom: 6 }}>{d.title}</h3>
            <span className="pill">{KINDS.find(([v]) => v === d.kind)?.[1] ?? d.kind}</span>{" "}
            <span className="pill">{d.status}</span>{" "}
            <span className="pill">{d.word_count} words</span>{" "}
            <span className="pill">{d.versions} version{Number(d.versions) === 1 ? "" : "s"}</span>
            <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "10px 0 0" }}>
              Updated {new Date(d.updated_at).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
