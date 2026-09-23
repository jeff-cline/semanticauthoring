import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { one, q, logEvent } from "@/lib/db";
import { slugify, handleProblem } from "@/lib/slug";
import { sanitizeRichText } from "@/lib/sanitize";
import AboutEditor from "@/components/AboutEditor";
import AvatarUpload from "@/components/AvatarUpload";
import SaveButton from "@/components/SaveButton";

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
      String(formData.get("goals") ?? "").slice(0, 4000),
      // Sanitised, never trusted: this is rendered as HTML on a public page.
      sanitizeRichText(String(formData.get("about_html") ?? "")),
      String(formData.get("avatar_url") ?? "").slice(0, 600),
      String(formData.get("avatar_alt") ?? "").slice(0, 300),
      formData.get("contact_enabled") === "on",
      formData.get("show_about") === "on",
      formData.get("show_goals") === "on",
      formData.get("show_interests") === "on",
      formData.get("show_affiliation") === "on",
      formData.get("show_links") === "on",
      formData.get("show_publications") === "on",
      formData.get("show_testimonials") === "on",
      formData.get("show_subscribe") === "on",
      String(formData.get("meta_title") ?? "").slice(0, 400),
      String(formData.get("meta_description") ?? "").slice(0, 400),
      String(formData.get("og_title") ?? "").slice(0, 400),
      String(formData.get("og_description") ?? "").slice(0, 400),
      String(formData.get("og_image") ?? "").slice(0, 400),
      String(formData.get("seo_keywords") ?? "").slice(0, 400),
      formData.get("allow_indexing") === "on",
    ];

    await q(
      `INSERT INTO profiles (user_id, handle, display_name, headline, bio, institution, program,
                             degree, interests, orcid, website, social, is_public, show_timeline,
                             goals, about_html, avatar_url, avatar_alt, contact_enabled,
                             show_about, show_goals, show_interests, show_affiliation, show_links, show_publications, show_testimonials, show_subscribe, meta_title, meta_description, og_title, og_description, og_image, seo_keywords, allow_indexing)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
       ON CONFLICT (user_id) DO UPDATE SET
         handle=EXCLUDED.handle, display_name=EXCLUDED.display_name, headline=EXCLUDED.headline,
         bio=EXCLUDED.bio, institution=EXCLUDED.institution, program=EXCLUDED.program,
         degree=EXCLUDED.degree, interests=EXCLUDED.interests, orcid=EXCLUDED.orcid,
         website=EXCLUDED.website, social=EXCLUDED.social, is_public=EXCLUDED.is_public,
         show_timeline=EXCLUDED.show_timeline, goals=EXCLUDED.goals,
         about_html=EXCLUDED.about_html, avatar_url=EXCLUDED.avatar_url,
         avatar_alt=EXCLUDED.avatar_alt, contact_enabled=EXCLUDED.contact_enabled,
         show_about=EXCLUDED.show_about, show_goals=EXCLUDED.show_goals, show_interests=EXCLUDED.show_interests, show_affiliation=EXCLUDED.show_affiliation, show_links=EXCLUDED.show_links, show_publications=EXCLUDED.show_publications, show_testimonials=EXCLUDED.show_testimonials, show_subscribe=EXCLUDED.show_subscribe, meta_title=EXCLUDED.meta_title, meta_description=EXCLUDED.meta_description, og_title=EXCLUDED.og_title, og_description=EXCLUDED.og_description, og_image=EXCLUDED.og_image, seo_keywords=EXCLUDED.seo_keywords, allow_indexing=EXCLUDED.allow_indexing,
         updated_at=now()`,
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
            <Link href={`/${profile.handle}`}>semanticauthoring.org/{profile.handle}</Link>
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
        <AvatarUpload
          defaultUrl={profile?.avatar_url ?? ""}
          defaultAlt={profile?.avatar_alt ?? ""}
          suggestedAlt={profile?.display_name || user.name || "Scholar"}
        />

        <div className="field">
          <label htmlFor="headline">Headline</label>
          <input id="headline" name="headline" defaultValue={profile?.headline ?? ""}
                 placeholder="Researching embodied cognition in adult learning" />
        </div>
        <div className="field">
          <label htmlFor="bio">Short biography</label>
          <textarea id="bio" name="bio" rows={3} defaultValue={profile?.bio ?? ""} />
          <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "6px 0 0" }}>
            Plain text. Used for search results and link previews, where formatting cannot
            be shown. Keep it to a sentence or two.
          </p>
        </div>

        <AboutEditor name="about_html" defaultValue={profile?.about_html ?? ""} />

        <div className="field">
          <label htmlFor="goals">What I am working toward</label>
          <textarea id="goals" name="goals" rows={3} defaultValue={profile?.goals ?? ""}
                    placeholder="The question driving the work, and where it is going." />
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
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400,
                          marginBottom: 10 }}>
            <input type="checkbox" name="contact_enabled"
                   defaultChecked={profile?.contact_enabled !== false}
                   style={{ width: "auto", marginTop: 4 }} />
            <span>Let people contact me from my profile<br />
              <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>
                Adds a Contact button. Messages arrive in{" "}
                <Link href="/app/messages">Messages</Link> and by email. Your address is
                never shown.
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


        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10,
                           padding: "14px 18px", marginBottom: 20 }}>
          <legend style={{ fontSize: ".84rem", color: "var(--muted)", padding: "0 6px" }}>
            What appears on your page
          </legend>
          <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
            Your name and photo always appear — they are what makes the page yours.
            Everything else is yours to switch off.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_about"
                   defaultChecked={profile?.show_about !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>About me<br /><span style={{ color: "var(--muted)", fontSize: ".86rem" }}>Your written introduction.</span></span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_goals"
                   defaultChecked={profile?.show_goals !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>What I am working toward<br /><span style={{ color: "var(--muted)", fontSize: ".86rem" }}>Your goals section.</span></span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_interests"
                   defaultChecked={profile?.show_interests !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>Research interests<br /><span style={{ color: "var(--muted)", fontSize: ".86rem" }}>The tag row.</span></span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_affiliation"
                   defaultChecked={profile?.show_affiliation !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>Degree, program, institution<br /><span style={{ color: "var(--muted)", fontSize: ".86rem" }}>The line under your name.</span></span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_links"
                   defaultChecked={profile?.show_links !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>ORCID, website and social links</span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_publications"
                   defaultChecked={profile?.show_publications !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>Published work<br /><span style={{ color: "var(--muted)", fontSize: ".86rem" }}>Only pieces you marked \u201cAdd to my profile.\u201d</span></span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_testimonials"
                   defaultChecked={profile?.show_testimonials !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>Endorsements</span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40, marginBottom: 8 }}>
            <input type="checkbox" name="show_subscribe"
                   defaultChecked={profile?.show_subscribe !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>Let readers subscribe<br /><span style={{ color: "var(--muted)", fontSize: ".86rem" }}>The follow box in the sidebar.</span></span>
          </label>
        </fieldset>

        <details className="card" style={{ marginBottom: 20 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Search engines and social sharing
          </summary>
          <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: 12 }}>
            Leave any of these blank and we use your real content instead — your name, your
            headline, your photo. Fill one in only when you want something different.
          </p>
          <div className="field">
            <label htmlFor="meta_title">Search result title</label>
            <input id="meta_title" name="meta_title" maxLength={200}
                   defaultValue={profile?.meta_title ?? ""}
                   placeholder={profile?.display_name || user.name || "Your name"} />
          </div>
          <div className="field">
            <label htmlFor="meta_description">Search result description</label>
            <textarea id="meta_description" name="meta_description" rows={2} maxLength={400}
                      defaultValue={profile?.meta_description ?? ""}
                      placeholder="Around 150 characters is what Google shows." />
          </div>
          <div className="field">
            <label htmlFor="seo_keywords">Keywords (comma separated)</label>
            <input id="seo_keywords" name="seo_keywords" maxLength={400}
                   defaultValue={profile?.seo_keywords ?? ""}
                   placeholder="Defaults to your research interests." />
          </div>
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />
          <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
            How your page looks when someone shares it on LinkedIn, Bluesky, Facebook or
            in a message.
          </p>
          <div className="field">
            <label htmlFor="og_title">Share title</label>
            <input id="og_title" name="og_title" maxLength={200}
                   defaultValue={profile?.og_title ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="og_description">Share description</label>
            <textarea id="og_description" name="og_description" rows={2} maxLength={400}
                      defaultValue={profile?.og_description ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="og_image">Share image URL</label>
            <input id="og_image" name="og_image" maxLength={400}
                   defaultValue={profile?.og_image ?? ""}
                   placeholder="Defaults to your profile photo. 1200x630 works best." />
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start",
                          fontWeight: 400, minHeight: 40 }}>
            <input type="checkbox" name="allow_indexing"
                   defaultChecked={profile?.allow_indexing !== false}
                   style={{ width: 20, height: 20, marginTop: 3, flexShrink: 0 }} />
            <span>Allow search engines to list this page<br />
              <span style={{ color: "var(--muted)", fontSize: ".86rem" }}>
                Turn off to keep a public page shareable by link but out of search results.
              </span>
            </span>
          </label>
        </details>

        <SaveButton>Save profile</SaveButton>
      </form>
    </>
  );
}
