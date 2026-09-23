import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import SaveButton from "@/components/SaveButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

const WHEN = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});

export default async function Messages() {
  const user = await requireUser();
  const rows = await q<any>(
    `SELECT * FROM profile_messages
      WHERE owner_id=$1 AND status <> 'archived'
      ORDER BY created_at DESC LIMIT 200`, [user.id],
  ).catch(() => []);

  async function archive(formData: FormData) {
    "use server";
    const me = await requireUser();
    const id = Number(formData.get("id"));
    // Owner in the WHERE clause, not a check afterwards.
    await q(`UPDATE profile_messages SET status='archived' WHERE id=$1 AND owner_id=$2`,
      [id, me.id]);
    revalidatePath("/app/messages");
    redirect("/app/messages?saved=archived");
  }

  return (
    <>
      <p className="eyebrow">Your profile</p>
      <h1 style={{ marginBottom: 6 }}>Messages</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: 0 }}>
        People who reached you through your public profile. Reply from your email — their
        address is on each message.
      </p>

      {rows.length === 0 ? (
        <div className="card" style={{ maxWidth: 680, marginTop: 22 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Nothing yet. Messages sent from{" "}
            <Link href="/app/profile">your public profile</Link> arrive here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 760, marginTop: 22 }}>
          {rows.map((m: any) => (
            <div key={m.id} className="card">
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong>{m.from_name}</strong>
                <span className="pill">
                  {m.kind === "collaborate" ? "Collaboration" : "Message"}
                </span>
                <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>
                  {WHEN.format(new Date(m.created_at))}
                </span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: ".9rem" }}>
                <a href={`mailto:${m.from_email}?subject=${encodeURIComponent(
                  `Re: ${m.subject || "your message"}`)}`}>{m.from_email}</a>
              </p>
              {m.subject && <p style={{ margin: "8px 0 0", fontWeight: 600 }}>{m.subject}</p>}
              <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{m.body}</p>
              <form action={archive} style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={m.id} />
                <SaveButton className="btn btn-secondary" pendingLabel="Archiving…">
                  Archive
                </SaveButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
