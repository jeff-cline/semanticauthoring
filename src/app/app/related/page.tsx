import Link from "next/link";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { findRelated, reindexAll, embedderName, usingRealModel, LABELS, HREFS }
  from "@/lib/embed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find related" };

export default async function RelatedSearch(
  { searchParams }: { searchParams: Promise<{ q?: string; done?: string }> },
) {
  const user = (await currentUser())!;
  const { q: term, done } = await searchParams;

  const [indexed, results] = await Promise.all([
    one<any>(`SELECT count(*)::int AS n, max(updated_at) AS last, min(model) AS model
                FROM embeddings WHERE owner_id=$1`, [user.id]).catch(() => null),
    term ? findRelated(user.id, term, { limit: 25 }) : Promise.resolve([]),
  ]);

  async function reindex() {
    "use server";
    const me = (await currentUser())!;
    const n = await reindexAll(me.id);
    revalidatePath("/app/related");
    const { redirect } = await import("next/navigation");
    redirect(`/app/related?done=${n}`);
  }

  const real = usingRealModel();

  return (
    <>
      <p className="eyebrow">Connect</p>
      <h1>Find related</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700 }}>
        Search across everything you own at once — sources, questions, claims, annotations,
        writing, reading entries, life experiences, and captured thoughts — by similarity
        rather than exact words.
      </p>

      {/* Say plainly which engine is running. */}
      <div className="card" style={{ maxWidth: 760, margin: "20px 0",
           borderLeft: `3px solid ${real ? "var(--current)" : "var(--gold)"}` }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}>
          <strong>{real ? "Model embeddings" : "Local lexical embeddings"}</strong>
          {" — "}
          <code style={{ fontSize: ".85rem" }}>{embedderName()}</code>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          {real
            ? "True semantic similarity: related ideas surface even when they share no words."
            : "This finds material that shares vocabulary and word-shape — better than exact-match search, but it does not understand meaning. Two passages about the same idea in different words will not match. Set EMBEDDING_API_URL and EMBEDDING_API_KEY to switch to a real model."}
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: "10px 0 0" }}>
          {Number(indexed?.n ?? 0)} items indexed
          {indexed?.last && ` · last built ${new Date(indexed.last).toLocaleString()}`}
        </p>
        <form action={reindex} style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" style={{ padding: "8px 16px" }}>
            Rebuild index
          </button>
          {done && (
            <span style={{ color: "var(--current)", marginLeft: 12, fontSize: ".9rem" }}>
              Indexed {done} items.
            </span>
          )}
        </form>
      </div>

      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
        <input name="q" defaultValue={term ?? ""} style={{ maxWidth: 420 }}
               placeholder="A phrase, a question, a passage — anything" />
        <button className="btn btn-primary">Find related</button>
      </form>

      {Number(indexed?.n ?? 0) === 0 && (
        <p style={{ color: "var(--muted)" }}>
          Nothing is indexed yet. Build the index above, then search.
        </p>
      )}

      {term && results.length === 0 && Number(indexed?.n ?? 0) > 0 && (
        <div className="card" style={{ maxWidth: 640 }}>
          <p style={{ margin: 0 }}>Nothing came back above the similarity floor.</p>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Rather than show you weak matches dressed up as findings, this returns nothing.
          </p>
        </div>
      )}

      {results.map((r) => (
        <div key={`${r.entity_type}-${r.entity_id}`} className="card stage stage-connect"
             style={{ marginBottom: 10, maxWidth: 860 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="pill">{LABELS[r.entity_type] ?? r.entity_type}</span>
            <span className="pill" style={{ color: "var(--current)" }}>
              {(r.similarity * 100).toFixed(0)}% similar
            </span>
            <Link href={(HREFS[r.entity_type] ?? (() => "/app"))(r.entity_id)}
                  style={{ marginLeft: "auto", fontSize: ".88rem" }}>open →</Link>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: ".94rem" }}>
            {r.content.slice(0, 300)}{r.content.length > 300 ? "…" : ""}
          </p>
        </div>
      ))}
    </>
  );
}
