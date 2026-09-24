import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { TIERS } from "@/lib/tiers";
import SaveButton from "@/components/SaveButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member" };

const WHEN = new Intl.DateTimeFormat("en-US", {
  year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
});

export default async function Member({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  if (me.role !== "god") redirect("/app");

  const { id } = await params;
  const member = await one<any>(
    `SELECT u.*, p.handle, p.display_name, p.is_public, p.avatar_url
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`, [Number(id)]).catch(() => null);
  if (!member) notFound();

  const activity = await q<any>(
    `SELECT entity, action, detail, created_at FROM event_log
      WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 25`, [member.id]).catch(() => []);

  async function save(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (actor.role !== "god") return;
    const target = Number(formData.get("id"));

    const tier = String(formData.get("tier") ?? "");
    const role = String(formData.get("role") ?? "");
    if (!TIERS.some((t) => t.key === tier)) return;
    if (!["member", "god"].includes(role)) return;

    // A God cannot demote themselves. Locking the last administrator out of
    // their own platform is not a state worth being one misclick away from.
    const selfDemotion = target === actor.id && role !== "god";
    await q(
      `UPDATE users SET tier=$1, role=$2, must_change_password=$3, updated_at=now()
        WHERE id=$4`,
      [tier, selfDemotion ? "god" : role,
       formData.get("must_change_password") === "on", target]);

    await logEvent("user", "admin_update",
      { actorId: actor.id, entityId: String(target), detail: `${role}/${tier}` });
    revalidatePath(`/app/members/${target}`);
    redirect(`/app/members/${target}?saved=entry`);
  }

  const name = member.display_name || member.name || member.email;

  return (
    <>
      <p style={{ marginBottom: 8 }}><Link href="/app/members">← Members</Link></p>
      <p className="eyebrow">Administration</p>
      <h1 style={{ marginBottom: 6 }}>{name}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, overflowWrap: "anywhere" }}>
        {member.email}
        {member.handle && (
          <> · <Link href={`/${member.handle}`}>semanticauthoring.org/{member.handle}</Link>
            {member.is_public ? "" : " (private)"}</>
        )}
      </p>
      <p style={{ color: "var(--muted)", fontSize: ".88rem" }}>
        Joined {WHEN.format(new Date(member.created_at))}
        {member.last_login_at
          ? ` · last signed in ${WHEN.format(new Date(member.last_login_at))}`
          : " · never signed in"}
      </p>

      <form action={save} className="card" style={{ maxWidth: 620, marginTop: 22 }}>
        <input type="hidden" name="id" value={member.id} />
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Account</h2>

        <div className="field">
          <label htmlFor="tier">Tier</label>
          <select id="tier" name="tier" defaultValue={member.tier}>
            {TIERS.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue={member.role}
                  disabled={member.id === me.id}>
            <option value="member">Member</option>
            <option value="god">God</option>
          </select>
          {member.id === me.id && (
            <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "6px 0 0" }}>
              You cannot change your own role.
            </p>
          )}
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400,
                        minHeight: 44, marginBottom: 14 }}>
          <input type="checkbox" name="must_change_password"
                 defaultChecked={member.must_change_password}
                 style={{ width: 20, height: 20, marginTop: 3 }} />
          <span>Require a new password at next sign-in<br />
            <span style={{ color: "var(--muted)", fontSize: ".86rem" }}>
              Their current password keeps working until they change it.
            </span>
          </span>
        </label>

        <SaveButton>Save changes</SaveButton>
      </form>

      <div className="card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Recent activity</h2>
        {activity.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Nothing recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {activity.map((a: any, i: number) => (
              <p key={i} style={{ margin: 0, fontSize: ".88rem" }}>
                <span style={{ color: "var(--muted)" }}>
                  {WHEN.format(new Date(a.created_at))}
                </span>
                {" — "}{a.entity} {a.action}
                {a.detail ? ` (${String(a.detail).slice(0, 60)})` : ""}
              </p>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
