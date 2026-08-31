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

  const [questions, experiences, contacts, subs, pending, leads] = await Promise.all([
    count(`SELECT count(*) n FROM questions WHERE owner_id=$1 AND status IN ('emerging','active','refining')`, [user.id]),
    count(`SELECT count(*) n FROM life_experiences WHERE owner_id=$1`, [user.id]),
    count(`SELECT count(*) n FROM contacts WHERE owner_id=$1`, [user.id]),
    count(`SELECT count(*) n FROM subscribers WHERE scholar_id=$1 AND status='confirmed'`, [user.id]),
    count(`SELECT count(*) n FROM testimonials WHERE owner_id=$1 AND status='pending'`, [user.id]),
    god ? count(`SELECT count(*) n FROM leads WHERE status='new'`) : Promise.resolve(0),
  ]);

  const cards = [
    { label: "Active questions", n: questions, href: "/app/questions", accent: "var(--current)" },
    { label: "Life experiences", n: experiences, href: "/app/life-map", accent: "var(--seaglass)" },
    { label: "Contacts", n: contacts, href: "/app/contacts", accent: "var(--midnight)" },
    { label: "Subscribers", n: subs, href: "/app/subscribers", accent: "var(--coral)" },
    { label: "Testimonials awaiting you", n: pending, href: "/app/testimonials", accent: "var(--gold)" },
    ...(god ? [{ label: "New leads", n: leads, href: "/app/leads", accent: "var(--review)" }] : []),
  ];

  return (
    <>
      <p className="eyebrow">Welcome back</p>
      <h1 style={{ marginBottom: 6 }}>{user.name || user.email}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        What is one meaningful scholarly action you want to complete today?
      </p>

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

      <div className="card" style={{ marginTop: 30 }}>
        <h2 style={{ fontSize: "1.15rem" }}>Where this is going</h2>
        <p style={{ color: "var(--muted)", marginBottom: 12 }}>
          The research library, PDF reader and annotation, Capture Thought, the daily journal,
          the authoring studio, and the semantic knowledge map arrive in the next phase.
          Your questions and Life Map are here now, and everything you record is preserved
          with full version history.
        </p>
        <Link href="/app/questions">Start with a research question →</Link>
      </div>
    </>
  );
}
