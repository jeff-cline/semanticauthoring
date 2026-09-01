import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge map" };

// Semantic knowledge map. Laid out deterministically on the server — questions
// on a central ring, their sources and experiences orbiting each one — so the
// same workspace always draws the same picture and nothing depends on a
// client-side physics library.

type Node = { id: string; label: string; x: number; y: number; r: number; fill: string; href?: string };
type Edge = { x1: number; y1: number; x2: number; y2: number; stroke: string };

export default async function KnowledgeMap() {
  const user = (await currentUser())!;

  const [questions, srcLinks, expLinks] = await Promise.all([
    q<any>(`SELECT id, text, status FROM questions WHERE owner_id=$1
             AND status NOT IN ('retired') ORDER BY updated_at DESC LIMIT 12`, [user.id]),
    q<any>(`SELECT c.to_id AS question_id, s.id AS source_id, s.title
              FROM connections c JOIN sources s ON s.id=c.from_id
             WHERE c.owner_id=$1 AND c.from_type='source' AND c.to_type='question'`, [user.id]),
    q<any>(`SELECT l.question_id, e.id AS experience_id, e.title
              FROM question_links l JOIN life_experiences e ON e.id=l.experience_id
             WHERE e.owner_id=$1`, [user.id]),
  ]);

  const W = 1000, H = 640, CX = W / 2, CY = H / 2;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const ringR = questions.length > 1 ? Math.min(200, 70 + questions.length * 16) : 0;

  questions.forEach((qq: any, i: number) => {
    const a = (i / Math.max(1, questions.length)) * Math.PI * 2 - Math.PI / 2;
    const qx = CX + Math.cos(a) * ringR;
    const qy = CY + Math.sin(a) * ringR * 0.72;

    nodes.push({
      id: `q${qq.id}`, label: qq.text, x: qx, y: qy, r: 13,
      fill: qq.status === "active" ? "#176B73" : "#17243A",
    });

    const kids = [
      ...srcLinks.filter((l: any) => l.question_id === qq.id)
        .map((l: any) => ({ label: l.title, fill: "#8FB8AE", href: `/app/library/${l.source_id}` })),
      ...expLinks.filter((l: any) => l.question_id === qq.id)
        .map((l: any) => ({ label: l.title, fill: "#C6A15B", href: "/app/life-map" })),
    ];

    kids.forEach((k, j) => {
      const spread = Math.PI / 1.6;
      const ka = a - spread / 2 + (kids.length === 1 ? spread / 2 : (j / (kids.length - 1)) * spread);
      const kd = 96 + (j % 2) * 26;
      const kx = qx + Math.cos(ka) * kd;
      const ky = qy + Math.sin(ka) * kd * 0.8;
      edges.push({ x1: qx, y1: qy, x2: kx, y2: ky, stroke: k.fill });
      nodes.push({ id: `k${qq.id}-${j}`, label: k.label, x: kx, y: ky, r: 6.5, fill: k.fill, href: k.href });
    });
  });

  const empty = questions.length === 0;

  return (
    <>
      <p className="eyebrow">Connect</p>
      <h1>Knowledge map</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Your questions and everything currently feeding them. Teal nodes are sources; gold
        nodes are life experiences. A question sitting alone is not a failure — but it is
        worth noticing.
      </p>

      {empty ? (
        <p style={{ color: "var(--muted)", marginTop: 26 }}>
          Nothing to map yet. <Link href="/app/questions">Start with a question →</Link>
        </p>
      ) : (
        <div className="card" style={{ marginTop: 24, padding: 12, overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 700 }}
               role="img" aria-label="Semantic knowledge map of your questions and sources">
            <title>Your questions and the sources and experiences connected to them</title>
            {edges.map((e, i) => (
              <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                    stroke={e.stroke} strokeWidth="1.4" opacity=".45" />
            ))}
            {nodes.map((n) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={n.r} fill={n.fill}
                        opacity={n.r > 10 ? .95 : .85} />
                <text x={n.x} y={n.y + n.r + 14} textAnchor="middle"
                      fontSize={n.r > 10 ? 13 : 11}
                      fill={n.r > 10 ? "var(--fg)" : "var(--muted)"}
                      style={{ fontFamily: n.r > 10 ? "var(--serif)" : "var(--sans)" }}>
                  {n.label.length > (n.r > 10 ? 42 : 26)
                    ? n.label.slice(0, n.r > 10 ? 42 : 26) + "…"
                    : n.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 18 }}>
        {[["#176B73", "Active question"], ["#17243A", "Other question"],
          ["#8FB8AE", "Source"], ["#C6A15B", "Life experience"]].map(([c, l]) => (
          <span key={l} style={{ display: "inline-flex", gap: 8, alignItems: "center",
                                 color: "var(--muted)", fontSize: ".88rem" }}>
            <span style={{ width: 11, height: 11, borderRadius: 6, background: c }} />{l}
          </span>
        ))}
      </div>

      <p style={{ marginTop: 20 }}>
        <Link href="/app/connect">See the same connections as a list →</Link>
      </p>
    </>
  );
}
