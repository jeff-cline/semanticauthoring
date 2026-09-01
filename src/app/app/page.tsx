import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

async function count(sql: string, params: unknown[] = []) {
  const r = await one<{ n: string }>(sql, params).catch(() => null);
  return Number(r?.n ?? 0);
}

export default async function Dashboard() {
  const user = (await currentUser())!;
  const god = user.role === "god";

  const [questions, sources, unread, annotations, docs, inbox, milestones, pending, leads] =
    await Promise.all([
      count(`SELECT count(*) n FROM questions WHERE owner_id=$1 AND status IN ('emerging','active','refining')`, [user.id]),
      count(`SELECT count(*) n FROM sources WHERE owner_id=$1`, [user.id]),
      count(`SELECT count(*) n FROM sources WHERE owner_id=$1 AND read_status='unread'`, [user.id]),
      count(`SELECT count(*) n FROM annotations WHERE owner_id=$1`, [user.id]),
      count(`SELECT count(*) n FROM documents WHERE owner_id=$1`, [user.id]),
      count(`SELECT count(*) n FROM captures WHERE owner_id=$1 AND processed=FALSE`, [user.id]),
      count(`SELECT count(*) n FROM milestones WHERE owner_id=$1`, [user.id]),
      count(`SELECT count(*) n FROM testimonials WHERE owner_id=$1 AND status='pending'`, [user.id]),
      god ? count(`SELECT count(*) n FROM leads WHERE status='new'`) : Promise.resolve(0),
    ]);

  const journal = await one<any>(
    `SELECT intention FROM journal_entries WHERE owner_id=$1 AND entry_date=CURRENT_DATE`,
    [user.id]).catch(() => null);

  const cards = [
    { label: "Active questions", n: questions, href: "/app/questions", accent: "var(--current)" },
    { label: "Sources · " + unread + " unread", n: sources, href: "/app/library", accent: "var(--midnight)" },
    { label: "Annotations", n: annotations, href: "/app/library", accent: "var(--seaglass)" },
    { label: "Documents", n: docs, href: "/app/studio", accent: "var(--ink)" },
    { label: "Waiting in your inbox", n: inbox, href: "/app/capture", accent: "var(--review)" },
    { label: "Milestones", n: milestones, href: "/app/timeline", accent: "var(--gold)" },
    ...(pending ? [{ label: "Testimonials awaiting you", n: pending, href: "/app/testimonials", accent: "var(--coral)" }] : []),
    ...(god ? [{ label: "New leads", n: leads, href: "/app/leads", accent: "var(--review)" }] : []),
  ];

  return (
    <>
      <p className="eyebrow">Welcome back</p>
      <h1 style={{ marginBottom: 6 }}>{user.name || user.email}</h1>
      {journal?.intention ? (
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Today&rsquo;s intention: <strong style={{ color: "var(--fg)" }}>{journal.intention}</strong>
        </p>
      ) : (
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          What is one meaningful scholarly action you want to complete today?{" "}
          <Link href="/app/journal">Set an intention →</Link>
        </p>
      )}

      <div className="grid grid-3" style={{ marginTop: 30 }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card"
                style={{ textDecoration: "none", color: "inherit", borderLeft: `3px solid ${c.accent}` }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: "2.4rem", color: c.accent, lineHeight: 1 }}>
              {c.n}
            </div>
            <div style={{ color: "var(--muted)", marginTop: 8, fontSize: ".95rem" }}>{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginTop: 30, alignItems: "start" }}>
        <div className="card stage stage-read">
          <h2 style={{ fontSize: "1.1rem" }}>Where to start</h2>
          <ul style={{ color: "var(--muted)", paddingLeft: 20, lineHeight: 1.9, marginBottom: 0 }}>
            <li><Link href="/app/questions">Write down the question</Link> you&rsquo;re actually trying to answer</li>
            <li><Link href="/app/library">Add a source</Link> and annotate it while it&rsquo;s fresh</li>
            <li><Link href="/app/journal">Set today&rsquo;s intention</Link> — one meaningful action</li>
            <li><Link href="/app/studio">Open the studio</Link> when you&rsquo;re ready to write</li>
          </ul>
        </div>
        <div className="card">
          <h2 style={{ fontSize: "1.1rem" }}>Still coming</h2>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Mentor and committee review, course organization, the dissertation workspace, the
            publication pipeline, and the visual knowledge map. Everything you record now
            carries full version history, so none of it will need redoing.
          </p>
        </div>
      </div>
    </>
  );
}
