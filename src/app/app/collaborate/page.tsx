import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaborate" };

const SEEKING = [
  "co-author", "statistician", "methodologist", "qualitative researcher",
  "quantitative researcher", "mixed-methods researcher", "subject-matter expert",
  "faculty mentor", "committee expert", "dataset", "laboratory",
  "participant population access", "replication partner", "literature-review collaborator",
  "conference collaborator", "grant collaborator", "peer reviewer",
];

/** Overlap score from what both scholars actually wrote. No black box. */
function overlap(a: string, b: string): string[] {
  const norm = (s: string) => new Set(
    String(s || "").toLowerCase().split(/[,;\n]/).map((x) => x.trim()).filter((x) => x.length > 2));
  const A = norm(a), B = norm(b);
  return [...A].filter((x) => B.has(x));
}

export default async function Collaborate() {
  const user = (await currentUser())!;

  const [me, requests, others] = await Promise.all([
    one<any>(`SELECT * FROM profiles WHERE user_id=$1`, [user.id]),
    q<any>(`SELECT r.*, p.handle, p.display_name, u.name AS user_name
              FROM collaboration_requests r
              LEFT JOIN profiles p ON p.user_id = r.owner_id AND p.is_public = TRUE
              JOIN users u ON u.id = r.owner_id
             WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 100`),
    q<any>(`SELECT p.*, u.name AS user_name FROM profiles p JOIN users u ON u.id=p.user_id
             WHERE p.is_public=TRUE AND p.open_to_collaboration=TRUE AND p.user_id<>$1
             LIMIT 100`, [user.id]),
  ]);

  // Matches are explained by the shared terms, so a scholar can judge them.
  const matches = others.map((o: any) => {
    const interests = overlap(me?.interests ?? "", o.interests ?? "");
    const methods = overlap(me?.methodologies ?? "", o.methodologies ?? "");
    const populations = overlap(me?.populations ?? "", o.populations ?? "");
    // Complementary: what they offer that you are seeking, and vice versa.
    const theyOffer = overlap(me?.seeking ?? "", o.skills_offered ?? "");
    const youOffer = overlap(o.seeking ?? "", me?.skills_offered ?? "");
    const score = interests.length * 2 + methods.length * 2 + populations.length
      + theyOffer.length * 3 + youOffer.length * 3;
    return { o, interests, methods, populations, theyOffer, youOffer, score };
  }).filter((m) => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 20);

  async function saveProfile(formData: FormData) {
    "use server";
    const meU = (await currentUser())!;
    await q(
      `UPDATE profiles SET open_to_collaboration=$1, seeking=$2, skills_offered=$3,
              methodologies=$4, populations=$5, remote_ok=$6, collaboration_note=$7,
              updated_at=now() WHERE user_id=$8`,
      [formData.get("open_to_collaboration") === "on",
       formData.getAll("seeking").join(", ").slice(0, 500),
       String(formData.get("skills_offered") ?? "").slice(0, 500),
       String(formData.get("methodologies") ?? "").slice(0, 500),
       String(formData.get("populations") ?? "").slice(0, 500),
       formData.get("remote_ok") === "on",
       String(formData.get("collaboration_note") ?? "").slice(0, 2000), meU.id]);
    revalidatePath("/app/collaborate");
  }

  async function post(formData: FormData) {
    "use server";
    const meU = (await currentUser())!;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const row = await one<{ id: number }>(
      `INSERT INTO collaboration_requests (owner_id, title, description, seeking, topics,
                                           methods, timeline, authorship, remote_ok)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [meU.id, title.slice(0, 300), String(formData.get("description") ?? "").slice(0, 4000),
       formData.getAll("seeking").join(", ").slice(0, 400),
       String(formData.get("topics") ?? "").slice(0, 400),
       String(formData.get("methods") ?? "").slice(0, 400),
       String(formData.get("timeline") ?? "").slice(0, 200),
       String(formData.get("authorship") ?? "").slice(0, 400),
       formData.get("remote_ok") === "on"]);
    await logEvent("collaboration", "posted", { actorId: meU.id, entityId: row?.id });
    revalidatePath("/app/collaborate");
  }

  async function close(formData: FormData) {
    "use server";
    const meU = (await currentUser())!;
    await q(`UPDATE collaboration_requests SET status=$1, updated_at=now()
              WHERE id=$2 AND owner_id=$3`,
      [String(formData.get("to") ?? "closed"), Number(formData.get("id")), meU.id]);
    revalidatePath("/app/collaborate");
  }

  return (
    <>
      <p className="eyebrow">Connect</p>
      <h1>Collaborate</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Say what you are looking for and what you can offer, and see scholars whose stated
        interests overlap with yours.
      </p>

      <div className="card" style={{ maxWidth: 780, margin: "18px 0",
           borderLeft: "3px solid var(--seaglass)" }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}><strong>How matching works.</strong></p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          Overlap between what you and they wrote — shared interests, methods, and
          populations, weighted higher when what one of you is seeking matches what the other
          offers. Every match shows the exact terms that produced it, so you can judge it.
          Nobody is ranked by anything other than their own words, and only scholars who have
          switched this on appear at all.
        </p>
      </div>

      {!me ? (
        <p style={{ color: "var(--muted)" }}>
          <Link href="/app/profile">Set up your public profile</Link> first — collaboration
          works off what you have chosen to make public.
        </p>
      ) : (
        <form action={saveProfile} className="card" style={{ maxWidth: 780, marginBottom: 26 }}>
          <h2 style={{ fontSize: "1.05rem" }}>Your collaboration profile</h2>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 400,
                          marginBottom: 14 }}>
            <input type="checkbox" name="open_to_collaboration"
                   defaultChecked={me.open_to_collaboration} style={{ width: "auto" }} />
            I am open to collaboration
          </label>
          <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10,
                             padding: "12px 16px", marginBottom: 16 }}>
            <legend style={{ fontSize: ".84rem", color: "var(--muted)", padding: "0 6px" }}>
              I am looking for
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                          gap: 6 }}>
              {SEEKING.map((s) => (
                <label key={s} style={{ display: "flex", gap: 8, alignItems: "center",
                                        fontWeight: 400, fontSize: ".88rem" }}>
                  <input type="checkbox" name="seeking" value={s}
                         defaultChecked={String(me.seeking ?? "").includes(s)}
                         style={{ width: "auto" }} />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field"><label htmlFor="skills_offered">What I can offer</label>
            <input id="skills_offered" name="skills_offered" defaultValue={me.skills_offered}
                   placeholder="qualitative coding, IRB experience, somatic practice" /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label htmlFor="methodologies">Methodologies</label>
              <input id="methodologies" name="methodologies" defaultValue={me.methodologies} /></div>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label htmlFor="populations">Populations studied</label>
              <input id="populations" name="populations" defaultValue={me.populations} /></div>
          </div>
          <div className="field"><label htmlFor="collaboration_note">Anything else</label>
            <textarea id="collaboration_note" name="collaboration_note" rows={2}
                      defaultValue={me.collaboration_note} /></div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                          marginBottom: 14 }}>
            <input type="checkbox" name="remote_ok" defaultChecked={me.remote_ok}
                   style={{ width: "auto" }} /> Remote collaboration is fine
          </label>
          <button className="btn btn-primary">Save</button>
        </form>
      )}

      {matches.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.15rem" }}>Scholars who overlap with you ({matches.length})</h2>
          {matches.map((m) => (
            <div key={m.o.handle} className="card stage stage-connect"
                 style={{ marginBottom: 10, maxWidth: 900 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                <strong>
                  <Link href={`/s/${m.o.handle}`}>{m.o.display_name || m.o.user_name}</Link>
                </strong>
                {m.o.headline && (
                  <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{m.o.headline}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {m.theyOffer.map((t) => (
                  <span key={`o${t}`} className="pill" style={{ color: "var(--current)" }}>
                    offers what you need: {t}
                  </span>
                ))}
                {m.youOffer.map((t) => (
                  <span key={`y${t}`} className="pill" style={{ color: "var(--seaglass)" }}>
                    needs what you offer: {t}
                  </span>
                ))}
                {m.interests.map((t) => <span key={`i${t}`} className="pill">shared: {t}</span>)}
                {m.methods.map((t) => <span key={`m${t}`} className="pill">method: {t}</span>)}
              </div>
            </div>
          ))}
        </>
      )}

      <h2 style={{ fontSize: "1.15rem", marginTop: 30 }}>Open requests ({requests.length})</h2>
      {requests.length === 0 && <p style={{ color: "var(--muted)" }}>No open requests.</p>}
      {requests.map((r: any) => (
        <div key={r.id} className="card" style={{ marginBottom: 10, maxWidth: 900 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <strong style={{ flex: "1 1 260px" }}>{r.title}</strong>
            {r.handle ? (
              <Link href={`/s/${r.handle}`} style={{ fontSize: ".88rem" }}>{r.display_name || r.user_name}</Link>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>{r.user_name}</span>
            )}
            {r.owner_id === user.id && (
              <form action={close}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn btn-secondary" name="to" value="filled"
                        style={{ padding: "4px 12px", fontSize: ".8rem" }}>Mark filled</button>
              </form>
            )}
          </div>
          {r.description && <p style={{ fontSize: ".92rem", margin: "8px 0" }}>{r.description}</p>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {String(r.seeking ?? "").split(",").filter(Boolean).map((s: string) => (
              <span key={s} className="pill" style={{ color: "var(--current)" }}>{s.trim()}</span>
            ))}
            {r.timeline && <span className="pill">{r.timeline}</span>}
            {r.remote_ok && <span className="pill">remote ok</span>}
          </div>
          {r.authorship && (
            <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: "8px 0 0" }}>
              Authorship: {r.authorship}
            </p>
          )}
        </div>
      ))}

      <form action={post} className="card" style={{ marginTop: 26, maxWidth: 780 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Post a collaboration request</h2>
        <div className="field"><label htmlFor="title">What do you need?</label>
          <input id="title" name="title" required
                 placeholder="Statistician for a mixed-methods dissertation study" /></div>
        <div className="field"><label htmlFor="description">Describe it</label>
          <textarea id="description" name="description" rows={3} /></div>
        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10,
                           padding: "12px 16px", marginBottom: 16 }}>
          <legend style={{ fontSize: ".84rem", color: "var(--muted)", padding: "0 6px" }}>
            Seeking
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                        gap: 6 }}>
            {SEEKING.map((s) => (
              <label key={s} style={{ display: "flex", gap: 8, alignItems: "center",
                                      fontWeight: 400, fontSize: ".88rem" }}>
                <input type="checkbox" name="seeking" value={s} style={{ width: "auto" }} /> {s}
              </label>
            ))}
          </div>
        </fieldset>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="topics">Topics</label><input id="topics" name="topics" /></div>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="methods">Methods</label><input id="methods" name="methods" /></div>
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="timeline">Timeline</label><input id="timeline" name="timeline" /></div>
        </div>
        <div className="field"><label htmlFor="authorship">Authorship expectation</label>
          <input id="authorship" name="authorship"
                 placeholder="Say it up front — it prevents the most common collaboration failure" /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                        marginBottom: 14 }}>
          <input type="checkbox" name="remote_ok" defaultChecked style={{ width: "auto" }} />
          Remote is fine
        </label>
        <button className="btn btn-primary">Post request</button>
      </form>
    </>
  );
}
