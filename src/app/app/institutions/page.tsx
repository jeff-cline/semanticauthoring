import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { discover } from "@/lib/oidc";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const metadata = { title: "Institutions" };

export default async function Institutions(
  { searchParams }: { searchParams: Promise<{ check?: string }> },
) {
  const user = (await currentUser())!;
  if (user.role !== "god") redirect("/app");
  const { check } = await searchParams;

  const rows = await q<any>(
    `SELECT i.*, (SELECT count(*)::int FROM institution_members m WHERE m.institution_id=i.id) AS members
       FROM institutions i ORDER BY i.name`);

  // Live discovery probe, so a misconfigured issuer is visible before a user hits it.
  let probe: { ok: boolean; detail: string } | null = null;
  if (check) {
    const inst = rows.find((r: any) => r.slug === check);
    if (inst?.oidc_issuer) {
      const doc = await discover(inst.oidc_issuer);
      probe = doc
        ? { ok: true, detail: `Discovery OK — authorization at ${doc.authorization_endpoint}` }
        : { ok: false, detail: "Could not fetch .well-known/openid-configuration from that issuer." };
    }
  }

  async function save(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    if (me.role !== "god") return;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const id = Number(formData.get("id") ?? 0);
    const vals = [
      name.slice(0, 200),
      slugify(String(formData.get("slug") ?? "") || name, "institution"),
      String(formData.get("ror") ?? "").slice(0, 60),
      String(formData.get("email_domains") ?? "").slice(0, 400),
      String(formData.get("oidc_issuer") ?? "").trim().slice(0, 400),
      String(formData.get("oidc_client_id") ?? "").trim().slice(0, 300),
      String(formData.get("oidc_client_secret") ?? "").trim().slice(0, 500),
      formData.get("oidc_enabled") === "on",
      formData.get("auto_join") === "on",
      String(formData.get("default_tier") ?? "doctoral"),
      Number(formData.get("seats") ?? 0) || 0,
    ];
    if (id) {
      // An empty secret field means "leave it alone", so editing other fields
      // does not silently wipe the credential.
      const keepSecret = !vals[6];
      await q(
        `UPDATE institutions SET name=$1, slug=$2, ror=$3, email_domains=$4, oidc_issuer=$5,
                oidc_client_id=$6,
                oidc_client_secret = CASE WHEN $12 THEN oidc_client_secret ELSE $7 END,
                oidc_enabled=$8, auto_join=$9, default_tier=$10, seats=$11, updated_at=now()
          WHERE id=$13`, [...vals, keepSecret, id]);
    } else {
      await q(
        `INSERT INTO institutions (name, slug, ror, email_domains, oidc_issuer, oidc_client_id,
                                   oidc_client_secret, oidc_enabled, auto_join, default_tier, seats)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, vals);
    }
    await logEvent("institution", id ? "updated" : "created", { actorId: me.id, detail: name });
    revalidatePath("/app/institutions");
  }

  const base = process.env.SITE_URL ?? "https://semanticauthoring.org";

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>Institutions</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Universities and programs sign in through their own identity provider over OpenID
        Connect. Their IT team supplies an issuer, client ID, and secret; we never hold a
        password for their people.
      </p>
      <div className="card" style={{ maxWidth: 760, margin: "18px 0",
           borderLeft: "3px solid var(--gold)" }}>
        <p style={{ margin: 0, fontSize: ".92rem" }}>
          <strong>OIDC only — SAML is not supported.</strong>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          SAML needs XML canonicalisation and signature validation, and a half-correct
          implementation of that is a security hole rather than a feature. Entra, Okta, Google
          Workspace, and Keycloak all speak OIDC.
        </p>
      </div>

      {probe && (
        <p className={probe.ok ? "success" : "error"}>{probe.detail}</p>
      )}

      {rows.map((i: any) => (
        <details key={i.id} className="card" style={{ marginBottom: 12, maxWidth: 860 }}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{i.name}</strong>{" "}
            <span className="pill" style={{ color: i.oidc_enabled ? "var(--current)" : "var(--muted)" }}>
              {i.oidc_enabled ? "SSO on" : "SSO off"}
            </span>{" "}
            <span className="pill">{i.members} members</span>{" "}
            {i.seats > 0 && <span className="pill">{i.members}/{i.seats} seats</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: ".9rem" }}>
              Sign-in URL: <code>{base}/sso/{i.slug}</code>
              {" · "}
              <Link href={`/app/institutions?check=${i.slug}`}>test discovery</Link>
            </p>
            <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>
              Give their IT team this redirect URI: <code>{base}/sso/callback</code>
            </p>
            <InstForm inst={i} action={save} />
          </div>
        </details>
      ))}

      <details className="card" style={{ maxWidth: 860 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Add an institution</summary>
        <div style={{ marginTop: 14 }}><InstForm action={save} /></div>
      </details>
    </>
  );
}

function InstForm({ inst, action }: { inst?: any; action: (fd: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      {inst && <input type="hidden" name="id" value={inst.id} />}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "2 1 240px" }}>
          <label>Name<input name="name" defaultValue={inst?.name} required /></label>
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label>Slug<input name="slug" defaultValue={inst?.slug}
                            placeholder="used in the sign-in URL" /></label>
        </div>
        <div className="field" style={{ flex: "1 1 130px" }}>
          <label>ROR ID<input name="ror" defaultValue={inst?.ror} /></label>
        </div>
      </div>
      <div className="field">
        <label>Email domains (comma separated)
          <input name="email_domains" defaultValue={inst?.email_domains}
                 placeholder="ciis.edu, alumni.ciis.edu" /></label>
      </div>
      <div className="field">
        <label>OIDC issuer
          <input name="oidc_issuer" defaultValue={inst?.oidc_issuer}
                 placeholder="https://login.microsoftonline.com/<tenant>/v2.0" /></label>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "1 1 240px" }}>
          <label>Client ID<input name="oidc_client_id" defaultValue={inst?.oidc_client_id} /></label>
        </div>
        <div className="field" style={{ flex: "1 1 240px" }}>
          <label>Client secret
            <input name="oidc_client_secret" type="password"
                   placeholder={inst ? "leave blank to keep the current secret" : ""} /></label>
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "0 1 160px" }}>
          <label>Default tier
            <select name="default_tier" defaultValue={inst?.default_tier ?? "doctoral"}>
              <option value="free">Free</option><option value="scholar">Scholar</option>
              <option value="doctoral">Doctoral</option>
            </select></label>
        </div>
        <div className="field" style={{ flex: "0 1 120px" }}>
          <label>Seats (0 = ∞)
            <input name="seats" type="number" min={0} defaultValue={inst?.seats ?? 0} /></label>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                        marginBottom: 14 }}>
          <input type="checkbox" name="oidc_enabled" defaultChecked={inst?.oidc_enabled}
                 style={{ width: "auto" }} /> SSO enabled
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400,
                        marginBottom: 14 }}>
          <input type="checkbox" name="auto_join" defaultChecked={inst?.auto_join ?? true}
                 style={{ width: "auto" }} /> Create accounts on first sign-in
        </label>
      </div>
      <button className="btn btn-primary">{inst ? "Save" : "Add institution"}</button>
    </form>
  );
}
