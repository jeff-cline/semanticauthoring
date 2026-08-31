import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one, logEvent } from "@/lib/db";
import { limitFor } from "@/lib/tiers";

export const dynamic = "force-dynamic";
export const metadata = { title: "My contacts" };

const ROLES = ["mentor", "advisor", "committee", "peer", "collaborator", "editor", "other"];

export default async function Contacts() {
  const user = (await currentUser())!;
  const rows = await q<any>(
    `SELECT * FROM contacts WHERE owner_id=$1 ORDER BY created_at DESC`, [user.id]);
  const cap = limitFor(user, "contacts");

  async function add(formData: FormData) {
    "use server";
    const me = (await currentUser())!;
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const limit = limitFor(me, "contacts");
    if (limit !== null) {
      const c = await one<{ n: string }>(`SELECT count(*) n FROM contacts WHERE owner_id=$1`, [me.id]);
      if (Number(c?.n ?? 0) >= limit) return;      // tier gate enforced server-side
    }
    const row = await one<{ id: number }>(
      `INSERT INTO contacts (owner_id, name, email, role, institution, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [me.id, name.slice(0, 200), String(formData.get("email") ?? "").slice(0, 200),
       String(formData.get("role") ?? "other"), String(formData.get("institution") ?? "").slice(0, 200),
       String(formData.get("notes") ?? "").slice(0, 4000)],
    );
    await logEvent("contact", "created", { actorId: me.id, entityId: row?.id });
    revalidatePath("/app/contacts");
  }

  return (
    <>
      <p className="eyebrow">Your private CRM</p>
      <h1>My contacts</h1>
      <p style={{ color: "var(--muted)", maxWidth: 640 }}>
        Mentors, committee members, collaborators, and everyone who has supported your work.
        Private to you — administrators do not browse this.
        {cap !== null && ` Your tier includes ${cap} contacts (${rows.length} used).`}
      </p>

      <div className="grid grid-2" style={{ alignItems: "start", marginTop: 26 }}>
        <form action={add} className="card">
          <h2 style={{ fontSize: "1.1rem" }}>Add a contact</h2>
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" /></div>
          <div className="field">
            <label htmlFor="role">Relationship</label>
            <select id="role" name="role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <div className="field"><label htmlFor="institution">Institution</label><input id="institution" name="institution" /></div>
          <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" rows={3} /></div>
          <button className="btn btn-primary">Add contact</button>
        </form>

        <div>
          <h2 style={{ fontSize: "1.1rem" }}>{rows.length} contact{rows.length === 1 ? "" : "s"}</h2>
          {rows.length === 0 && <p style={{ color: "var(--muted)" }}>No contacts yet.</p>}
          {rows.map((c: any) => (
            <div key={c.id} className="card" style={{ marginBottom: 10, padding: 18 }}>
              <strong>{c.name}</strong> <span className="pill">{c.role}</span>
              <div style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: 4 }}>
                {[c.institution, c.email].filter(Boolean).join(" · ")}
              </div>
              {c.notes && <p style={{ color: "var(--muted)", fontSize: ".92rem", margin: "8px 0 0" }}>{c.notes}</p>}
              <div style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 8 }}>
                Added {new Date(c.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
