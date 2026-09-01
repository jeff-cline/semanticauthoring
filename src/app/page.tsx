import Link from "next/link";
import { PublicShell } from "@/components/Chrome";
import { JOURNEY, Mark } from "@/components/Brand";
import HeroSearch from "@/components/HeroSearch";
import { TIERS } from "@/lib/tiers";

export default function Home() {
  return (
    <PublicShell>
      {/* Hero */}
      <section style={{ background: "var(--midnight)", color: "#e8eef7", padding: "72px 0 92px" }}>
        <div className="wrap narrow" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", color: "#fff",
                        marginBottom: 10 }}>
            <Mark size={264} />
          </div>
          <p className="eyebrow" style={{ color: "var(--gold)", letterSpacing: ".26em",
                                          fontSize: ".82rem" }}>
            Semantic Authoring
          </p>
          <h1 style={{ color: "#fff", marginBottom: 30 }}>
            The operating system for scholarly thinking.
          </h1>

          <HeroSearch />

          <p className="lede" style={{ color: "#bccbe0", margin: "34px 0" }}>
            Read deeply. Connect ideas. Develop original scholarship. Collaborate with
            mentors. Publish what matters.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/join" className="btn btn-primary">Start Your Scholar Workspace</Link>
            <Link href="/discover" className="btn btn-secondary"
                  style={{ color: "#dbe4f0", borderColor: "#3a4c66" }}>
              Explore Scholarship
            </Link>
          </div>
          <p style={{ marginTop: 36, color: "#8fa3c0", fontSize: ".95rem" }}>
            Your ideas. Connected. Developed. Published.
          </p>
        </div>
      </section>

      {/* The promise */}
      <section className="wrap" style={{ padding: "80px 24px 0" }}>
        <div className="narrow" style={{ margin: "0 auto", textAlign: "center" }}>
          <h2>Don&rsquo;t just store what you read.</h2>
          <p className="lede">
            See how what you read becomes what you think — and how what you think becomes
            what you contribute.
          </p>
        </div>
      </section>

      {/* Journey */}
      <section className="wrap" style={{ padding: "56px 24px 0" }}>
        <div className="grid grid-3">
          {JOURNEY.map((s) => (
            <div key={s.key} className={`card stage ${s.cls}`}>
              <h3>{s.label}</h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: ".97rem" }}>{s.line}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two environments */}
      <section className="wrap" style={{ padding: "84px 24px 0" }}>
        <div className="narrow" style={{ margin: "0 auto 34px", textAlign: "center" }}>
          <p className="eyebrow">One platform, two environments</p>
          <h2>Private enough for your unfinished thinking.</h2>
        </div>
        <div className="grid grid-2">
          <div className="card">
            <h3 style={{ color: "var(--current)" }}>Your private studio</h3>
            <p style={{ color: "var(--muted)" }}>
              Coursework, research library, annotations, reflections, your daily journal,
              research questions, drafts, mentor feedback, and dissertation work. Nothing
              here becomes public unless you deliberately publish it.
            </p>
          </div>
          <div className="card">
            <h3 style={{ color: "var(--coral)" }}>Your public scholarship</h3>
            <p style={{ color: "var(--muted)" }}>
              Essays, research notes, working papers, and published work — with a scholar
              profile readers can follow and subscribe to. You choose exactly what appears.
            </p>
          </div>
        </div>
      </section>

      {/* Differentiator */}
      <section style={{ background: "var(--card)", borderTop: "1px solid var(--line)",
                        borderBottom: "1px solid var(--line)", margin: "84px 0 0", padding: "72px 0" }}>
        <div className="wrap narrow" style={{ textAlign: "center" }}>
          <p className="eyebrow">Intellectual provenance</p>
          <h2>We preserve the lineage of your thought.</h2>
          <p className="lede">
            What you read. What you noticed. What you questioned. What you connected.
            What you concluded. What others challenged. What you revised. What you
            ultimately contributed.
          </p>
          <p style={{ color: "var(--muted)", marginTop: 26 }}>
            AI here is a research assistant, never a ghostwriter. The platform always
            distinguishes what you read, what a machine suggested, and what you authored.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="wrap" style={{ padding: "80px 24px 0" }}>
        <div className="narrow" style={{ margin: "0 auto 34px", textAlign: "center" }}>
          <p className="eyebrow">Membership</p>
          <h2>Every tier is free while we build.</h2>
        </div>
        <div className="grid grid-3">
          {TIERS.map((t) => (
            <div key={t.key} className="card">
              <h3>{t.name}</h3>
              <p style={{ fontFamily: "var(--serif)", fontSize: "2rem", color: "var(--gold)", margin: ".2em 0" }}>
                {t.price}
              </p>
              <p style={{ color: "var(--muted)", margin: 0 }}>{t.blurb}</p>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: 30 }}>
          <Link href="/pricing">See what&rsquo;s in each tier →</Link>
        </p>
      </section>

      {/* CTA */}
      <section className="wrap" style={{ padding: "80px 24px 0", textAlign: "center" }}>
        <div className="card narrow" style={{ margin: "0 auto", padding: 44 }}>
          <h2>We don&rsquo;t replace the scholar&rsquo;s thinking.</h2>
          <p className="lede">We create a place for it to grow.</p>
          <Link href="/join" className="btn btn-primary" style={{ marginTop: 14 }}>
            Request early access
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
