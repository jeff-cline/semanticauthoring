import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { one, q, logEvent } from "@/lib/db";
import { slugify, handleProblem } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const metadata = { title: "Public profile" };

export default async function ProfilePage(
  { searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> },
) {
  const { error, ok } = await searchParams;
  const user = (await currentUser())!;
  const profile = await one<any>(`SELECT * FROM profiles WHERE user_id=$1`, [user.id]);
  const pubCount = await one<{ n: string }>(
    `SELECT count(*) n FROM publications WHERE owner_id=$1 AND status='published'`, [user.id]);

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const handle = slugify(String(formData.get("handle") ?? ""), "");
    const problem = handleProblem(handle);
    if (problem) redirect("/app/profile?error=handle");

    const taken = await one(`SELECT user_id FROM profiles WHERE handle=$1 AND user_id<>$2`,
      [handle, me.id]);
    if (taken) redirect("/app/profile?error=taken");

    const vals = [
      handle,
      String(formData.get("display_name") ?? "").slice(0, 200),
      String(formData.get("headline") ?? "").slice(0, 300),
      String(formData.get("bio") ?? "").slice(0, 4000),
      String(formData.get("institution") ?? "").slice(0, 200),
      String(formData.get("program") ?? "").slice(0, 200),
      String(formData.get("degree") ?? "").slice(0, 120),
      String(formData.get("interests") ?? "").slice(0, 500),
      String(formData.get("orcid") ?? "").slice(0, 60),
      String(formData.get("website") ?? "").slice(0, 400),
      String(formData.get("social") ?? "").slice(0, 600),
      formData.get("is_public") === "on",
      formData.get("show_timeline") === "on",
    ];

    await q(
      `INSERT INTO profiles (user_id, handle, display_name, headline, bio, institution, program,
                             degree, interests, orcid, website, social, is_public, show_timeline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (user_id) DO UPDATE SET
         handle=EXCLUDED.handle, display_name=EXCLUDED.display_name, headline=EXCLUDED.headline,
         bio=EXCLUDED.bio, institution=EXCLUDED.institution, program=EXCLUDED.program,
         degree=EXCLUDED.degree, interests=EXCLUDED.interests, orcid=EXCLUDED.orcid,
         website=EXCLUDED.website, social=EXCLUDED.social, is_public=EXCLUDED.is_public,
         show_timeline=EXCLUDED.show_timeline, updated_at=now()`,
      [me.id, ...vals]);

    await logEvent("profile", "saved", { actorId: me.id, entityId: me.id });
    revalidatePath("/app/profile");
    redirect("/app/profile?ok=1");
  }

  const messages: Record<string, string> = {
    handle: "Use 3–30 characters: lowercase letters, numbers, and hyphens.",
    taken: "That handle is already taken.",
  };

  const suggested = profile?.handle ?? slugify(user.name || user.email.split("@")[0], "scholar");

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Public profile</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        You control exactly what appears here. Your profile stays invisible until you turn it
        on, and nothing from your library, journal, or Life Map ever appears.
      </p>

      {error && <p className="error">{messages[error] ?? "Please try again."}</p>}
      {ok && <p className="success">Profile saved.</p>}

      {profile?.is_public && (
        <div className="card stage stage-publish" style={{ margin: "20px 0" }}>
          <p style={{ margin: 0 }}>
            Live at{" "}
            <Link href={`/s/${profile.handle}`}>semanticauthoring.org/s/{profile.handle}</Link>
            {" · "}
            <span style={{ color: "var(--muted)" }}>
              {pubCount?.n ?? 0} published piece{Number(pubCount?.n ?? 0) === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      )}

      <form action={save} className="card" style={{ maxWidth: 760, marginTop: 20 }}>
        <div className="field">
          <label htmlFor="handle">Your handle</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--muted)", fontSize: ".93rem" }}>semanticauthoring.org/s/</span>
            <input id="handle" name="handle" defaultValue={suggested} required />
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="display_name">Display name</label>
            <input id="display_name" name="display_name"
                   defaultValue={profile?.display_name || user.name} />
          </div>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="degree">Degree / status</label>
            <input id="degree" name="degree" defaultValue={profile?.degree ?? ""}
                   placeholder="PhD candidate" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="headline">Headline</label>
          <input id="headline" name="headline" defaultValue={profile?.headline ?? ""}
                 placeholder="Researching embodied cognition in adult learning" />
        </div>
        <div className="field">
          <label htmlFor="bio">Biography</label>
          <textarea id="bio" name="bio" rows={5} defaultValue={profile?.bio ?? ""} />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="institution">Institution</label>
            <input id="institution" name="institution" defaultValue={profile?.institution ?? ""} />
          </div>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="program">Program</label>
            <input id="program" name="program" defaultValue={profile?.program ?? ""} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="interests">Research interests</label>
          <input id="interests" name="interests" defaultValue={profile?.interests ?? ""}
                 placeholder="embodiment, adult learning, qualitative methods" />
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="orcid">ORCID</label>
            <input id="orcid" name="orcid" defaultValue={profile?.orcid ?? ""}
                   placeholder="0000-0000-0000-0000" />
          </div>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="website">Website</label>
            <input id="website" name="website" defaultValue={profile?.website ?? ""} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="social">Social links (one per line)</label>
          <textarea id="social" name="social" rows={3} defaultValue={profile?.social ?? ""} />
        </div>

        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10,
                           padding: "14px 18px", marginBottom: 20 }}>
          <legend style={{ fontSize: ".84rem", color: "var(--muted)", padding: "0 6px" }}>
            Visibility
          </legend>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400,
                          marginBottom: 10 }}>
            <input type="checkbox" name="is_public" defaultChecked={profile?.is_public}
                   style={{ width: "auto", marginTop: 4 }} />
            <span>Make my profile public<br />
              <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                Off by default. Only what&rsquo;s on this page plus work you publish will show.
              </span>
            </span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
            <input type="checkbox" name="show_timeline" defaultChecked={profile?.show_timeline}
                   style={{ width: "auto", marginTop: 4 }} />
            <span>Show milestones I marked public<br />
              <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                Only milestones you individually set to public.
              </span>
            </span>
          </label>
        </fieldset>

        <button className="btn btn-primary">Save profile</button>
      </form>
    </>
  );
}
