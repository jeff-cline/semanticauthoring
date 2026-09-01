import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { mintToken } from "@/lib/token";

export const dynamic = "force-dynamic";
export const metadata = { title: "Access tokens" };

export default async function Tokens(
  { searchParams }: { searchParams: Promise<{ new?: string }> },
) {
  const { new: fresh } = await searchParams;
  const user = (await currentUser())!;
  const rows = await q<any>(
    `SELECT id, name, prefix, scopes, last_used_at, revoked_at, created_at
       FROM access_tokens WHERE user_id=$1 ORDER BY created_at DESC`, [user.id]);

  async function create(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const { plain, hash, prefix } = mintToken();
    const scopes = formData.get("write") === "on" ? "read,write" : "read";
    await one(
      `INSERT INTO access_tokens (user_id, name, token_hash, prefix, scopes)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [me.id, String(formData.get("name") ?? "MCP").slice(0, 100), hash, prefix, scopes]);
    await logEvent("access_token", "created", { actorId: me.id, detail: scopes });
    const { redirect } = await import("next/navigation");
    redirect(`/app/tokens?new=${encodeURIComponent(plain)}`);
  }

  async function revoke(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const id = Number(formData.get("id"));
    await q(`UPDATE access_tokens SET revoked_at=now() WHERE id=$1 AND user_id=$2`, [id, me.id]);
    await logEvent("access_token", "revoked", { actorId: me.id, entityId: id });
    revalidatePath("/app/tokens");
  }

  return (
    <>
      <p className="eyebrow">Your data</p>
      <h1>Access tokens</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        For connecting the Semantic Authoring MCP server, so an AI assistant can search your
        library, read your questions, and look up scholarly metadata on your behalf.
      </p>

      {fresh && (
        <div className="card" style={{ borderLeft: "3px solid var(--gold)", margin: "20px 0" }}>
          <h2 style={{ fontSize: "1.05rem" }}>Your new token</h2>
          <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
            Copy it now — it is stored only as a hash and cannot be shown again.
          </p>
          <code style={{ display: "block", padding: "12px 14px", background: "var(--paper)",
                         border: "1px solid var(--line)", borderRadius: 8,
                         wordBreak: "break-all", fontSize: ".9rem" }}>
            {fresh}
          </code>
        </div>
      )}

      <form action={create} className="card" style={{ maxWidth: 620, margin: "20px 0 28px" }}>
        <div className="field">
          <label htmlFor="name">What is it for?</label>
          <input id="name" name="name" defaultValue="MCP server" />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400,
                        marginBottom: 16 }}>
          <input type="checkbox" name="write" style={{ width: "auto", marginTop: 4 }} />
          <span>Allow writing<br />
            <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>
              Without this the token can only read. Grant writing only if you want an
              assistant to create sources, questions, notes, or claims.
            </span>
          </span>
        </label>
        <button className="btn btn-primary">Create token</button>
      </form>

      {rows.length > 0 && (
        <table style={{ maxWidth: 820 }}>
          <thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {rows.map((t: any) => (
              <tr key={t.id} style={{ opacity: t.revoked_at ? .5 : 1 }}>
                <td>{t.name}</td>
                <td><code style={{ fontSize: ".84rem" }}>{t.prefix}…</code></td>
                <td><span className="pill">{t.scopes}</span></td>
                <td style={{ color: "var(--muted)", fontSize: ".86rem" }}>
                  {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "never"}
                </td>
                <td>
                  {t.revoked_at ? <span className="pill">revoked</span> : (
                    <form action={revoke}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="btn btn-secondary"
                              style={{ padding: "4px 12px", fontSize: ".8rem" }}>Revoke</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
