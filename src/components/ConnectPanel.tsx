import Link from "next/link";
import { q } from "@/lib/db";

/**
 * The one connection surface used everywhere.
 *
 * Anything in the workspace can be linked to anything else, because that is how
 * thinking actually works — a reading feeds a question, a question drives a
 * claim, a life experience explains why the question is yours. This renders the
 * existing links for one entity and a form to add another.
 *
 * Server component: it reads the scholar's own rows only, and the action it
 * posts to re-checks ownership on both ends before writing.
 */

export const LINKABLE = [
  ["source", "Source"], ["question", "Question"], ["claim", "Claim"],
  ["document", "Document"], ["experience", "Life experience"], ["reading", "Reading entry"],
] as const;

export const RELATIONS = [
  "relates_to", "speaks_to", "supports", "complicates", "originates_from", "leads_to",
] as const;

const HREF: Record<string, (id: number) => string> = {
  source: (id) => `/app/library/${id}`,
  question: () => `/app/questions`,
  claim: (id) => `/app/claims/${id}`,
  document: (id) => `/app/studio/${id}`,
  experience: () => `/app/life-map`,
  reading: () => `/app/reading`,
};

async function labelFor(ownerId: number, type: string, id: number): Promise<string> {
  const table = {
    source: "sources", question: "questions", claim: "claims",
    document: "documents", experience: "life_experiences", reading: "reading_log",
  }[type];
  const col = { question: "text", claim: "text" }[type] ?? "title";
  if (!table) return `${type} #${id}`;
  const rows = await q<any>(
    `SELECT ${col} AS label FROM ${table} WHERE id=$1 AND owner_id=$2`, [id, ownerId])
    .catch(() => []);
  return rows[0]?.label ?? `${type} #${id}`;
}

export async function ConnectPanel({
  ownerId, type, id, action, title = "Connected",
}: {
  ownerId: number;
  type: string;
  id: number;
  action: (fd: FormData) => Promise<void>;
  title?: string;
}) {
  // Links in either direction — a connection is symmetric to a reader.
  const rows = await q<any>(
    `SELECT id, from_type, from_id, to_type, to_id, relation, note FROM connections
      WHERE owner_id=$1 AND ((from_type=$2 AND from_id=$3) OR (to_type=$2 AND to_id=$3))
      ORDER BY created_at DESC LIMIT 40`, [ownerId, type, id]).catch(() => []);

  const links = await Promise.all(rows.map(async (r: any) => {
    const other = r.from_type === type && r.from_id === id
      ? { t: r.to_type, i: r.to_id } : { t: r.from_type, i: r.from_id };
    return {
      id: r.id, relation: r.relation, note: r.note, type: other.t, otherId: other.i,
      label: await labelFor(ownerId, other.t, other.i),
      href: (HREF[other.t] ?? (() => "/app"))(other.i),
    };
  }));

  // Candidates the scholar can link to, per type.
  const candidates = await Promise.all(LINKABLE.map(async ([t, l]) => {
    const table = {
      source: "sources", question: "questions", claim: "claims",
      document: "documents", experience: "life_experiences", reading: "reading_log",
    }[t]!;
    const col = t === "question" || t === "claim" ? "text" : "title";
    const rows = await q<any>(
      `SELECT id, ${col} AS label FROM ${table} WHERE owner_id=$1
        ORDER BY updated_at DESC NULLS LAST LIMIT 40`, [ownerId]).catch(() => []);
    return { type: t, label: l, rows };
  }));

  return (
    <div className="card stage stage-connect">
      <h3 style={{ fontSize: "1rem" }}>{title}</h3>

      {links.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
          Nothing connected yet.
        </p>
      )}
      {links.map((l) => (
        <p key={l.id} style={{ margin: "6px 0", fontSize: ".92rem" }}>
          <span className="pill">{l.relation.replace(/_/g, " ")}</span>{" "}
          <Link href={l.href}>{String(l.label).slice(0, 90)}</Link>
          {l.note && <span style={{ color: "var(--muted)" }}> — {l.note}</span>}
        </p>
      ))}

      <form action={action} style={{ marginTop: 14 }}>
        <input type="hidden" name="fromType" value={type} />
        <input type="hidden" name="fromId" value={id} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 150px", marginBottom: 10 }}>
            <label htmlFor={`rel-${type}-${id}`}>Relation</label>
            <select id={`rel-${type}-${id}`} name="relation">
              {RELATIONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: "2 1 240px", marginBottom: 10 }}>
            <label htmlFor={`to-${type}-${id}`}>Connect to</label>
            <select id={`to-${type}-${id}`} name="to">
              {candidates.filter((c) => c.rows.length > 0).map((c) => (
                <optgroup key={c.type} label={c.label}>
                  {c.rows
                    .filter((r: any) => !(c.type === type && r.id === id))
                    .map((r: any) => (
                      <option key={`${c.type}:${r.id}`} value={`${c.type}:${r.id}`}>
                        {String(r.label ?? "").slice(0, 70)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor={`note-${type}-${id}`}>How are they connected?</label>
          <input id={`note-${type}-${id}`} name="note" />
        </div>
        <button className="btn btn-secondary">Connect</button>
      </form>
    </div>
  );
}
