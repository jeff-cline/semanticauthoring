import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connections" };

// A readable view of the semantic graph as it stands today: which sources
// speak to which questions, and which life experiences feed them. The visual
// knowledge map builds on exactly this data.

export default async function Connect() {
  const user = (await currentUser())!;

  const [questions, srcLinks, expLinks, annCounts] = await Promise.all([
    q<any>(`SELECT * FROM questions WHERE owner_id=$1 ORDER BY
              CASE status WHEN 'active' THEN 0 WHEN 'refining' THEN 1 WHEN 'emerging' THEN 2
                          ELSE 3 END, updated_at DESC`, [user.id]),
    q<any>(`SELECT c.to_id AS question_id, s.id AS source_id, s.title, s.authors, s.year, c.note
              FROM connections c JOIN sources s ON s.id = c.from_id
             WHERE c.owner_id=$1 AND c.from_type='source' AND c.to_type='question'`, [user.id]),
    q<any>(`SELECT l.question_id, e.id AS experience_id, e.title, e.period, l.note
              FROM question_links l JOIN life_experiences e ON e.id = l.experience_id
             WHERE e.owner_id=$1`, [user.id]),
    q<any>(`SELECT s.id AS source_id, count(a.id) AS n FROM sources s
              LEFT JOIN annotations a ON a.source_id = s.id
             WHERE s.owner_id=$1 GROUP BY s.id`, [user.id]),
  ]);

  const notes = new Map(annCounts.map((r: any) => [r.source_id, Number(r.n)]));
  const orphans = questions.filter(
    (x: any) => !srcLinks.some((l: any) => l.question_id === x.id)
             && !expLinks.some((l: any) => l.question_id === x.id));

  return (
    <>
      <p className="eyebrow">Connect</p>
      <h1>Connections</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Your questions with everything currently feeding them — sources you&rsquo;ve linked,
        and the experiences behind them. Ideas do not exist in isolation.
      </p>

      {questions.length === 0 && (
        <p style={{ color: "var(--muted)", marginTop: 26 }}>
          Nothing to connect yet. <Link href="/app/questions">Start with a question →</Link>
        </p>
      )}

      <div style={{ marginTop: 28 }}>
        {questions.map((x: any) => {
          const srcs = srcLinks.filter((l: any) => l.question_id === x.id);
          const exps = expLinks.filter((l: any) => l.question_id === x.id);
          if (!srcs.length && !exps.length) return null;
          return (
            <div key={x.id} className="card stage stage-connect" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.08rem", marginBottom: 4 }}>{x.text}</h2>
              <span className="pill">{x.status}</span>
              <div className="grid grid-2" style={{ marginTop: 16, gap: 18 }}>
                {srcs.length > 0 && (
                  <div>
                    <p className="eyebrow" style={{ color: "var(--midnight)" }}>
                      Sources ({srcs.length})
                    </p>
                    {srcs.map((l: any) => (
                      <p key={l.source_id} style={{ fontSize: ".92rem", margin: "6px 0" }}>
                        <Link href={`/app/library/${l.source_id}`}>{l.title}</Link>
                        <span style={{ color: "var(--muted)" }}>
                          {l.authors ? ` — ${l.authors}` : ""}
                          {notes.get(l.source_id) ? ` · ${notes.get(l.source_id)} annotations` : ""}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
                {exps.length > 0 && (
                  <div>
                    <p className="eyebrow" style={{ color: "var(--seaglass)" }}>
                      Experiences ({exps.length})
                    </p>
                    {exps.map((l: any) => (
                      <p key={l.experience_id} style={{ fontSize: ".92rem", margin: "6px 0" }}>
                        {l.title}
                        {l.period && <span style={{ color: "var(--muted)" }}> · {l.period}</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {orphans.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1.05rem" }}>Questions with nothing attached yet</h2>
          <p style={{ color: "var(--muted)", fontSize: ".93rem" }}>
            Not a problem — but if a question stays empty for months, it may be a question you
            have stopped asking.
          </p>
          {orphans.map((x: any) => (
            <p key={x.id} style={{ margin: "6px 0", fontSize: ".93rem" }}>{x.text}</p>
          ))}
        </div>
      )}
    </>
  );
}
