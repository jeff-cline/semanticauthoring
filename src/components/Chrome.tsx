import Link from "next/link";
import { Mark, JOURNEY } from "./Brand";
import Consent from "./Consent";
import { ANSWERS } from "@/lib/answers";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand"><Mark /> Semantic Authoring</Link>
          <nav className="nav" aria-label="Main">
            <Link href="/discover">Discover</Link>
            <Link href="/scholars">Scholars</Link>
            <Link href="/journey">Journey</Link>
            <Link href="/answers">Answers</Link>
            <Link href="/mission">Mission</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/about">About</Link>
            <Link href="/join" className="tag" style={{ color: "#fff", borderColor: "#3a4c66" }}>
              Request access
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="journey-bar">
            {JOURNEY.map((s) => <span key={s.key}>{s.label}</span>)}
          </div>

          {/* Deep internal links — every answer page reachable from every page. */}
          <div className="grid grid-3" style={{ gap: "28px 40px", marginBottom: 36 }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--seaglass)" }}>Answers for scholars</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 2 }}>
                {ANSWERS.slice(0, 5).map((a) => (
                  <li key={a.slug}>
                    <Link href={`/answers/${a.slug}`} style={{ fontSize: ".92rem" }}>
                      {a.question}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow" style={{ color: "var(--seaglass)" }}>Research practice</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 2 }}>
                {ANSWERS.slice(5).map((a) => (
                  <li key={a.slug}>
                    <Link href={`/answers/${a.slug}`} style={{ fontSize: ".92rem" }}>
                      {a.question}
                    </Link>
                  </li>
                ))}
                <li><Link href="/answers" style={{ fontSize: ".92rem" }}>All answers →</Link></li>
              </ul>
            </div>
            <div>
              <p className="eyebrow" style={{ color: "var(--seaglass)" }}>Platform</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 2 }}>
                <li><Link href="/discover" style={{ fontSize: ".92rem" }}>Discover scholarship</Link></li>
                <li><Link href="/scholars" style={{ fontSize: ".92rem" }}>Scholars</Link></li>
                <li><Link href="/search" style={{ fontSize: ".92rem" }}>Search</Link></li>
                <li><Link href="/journey" style={{ fontSize: ".92rem" }}>The scholarly journey</Link></li>
                <li><Link href="/mission" style={{ fontSize: ".92rem" }}>Mission and values</Link></li>
                <li><Link href="/pricing" style={{ fontSize: ".92rem" }}>Pricing</Link></li>
                <li><Link href="/about" style={{ fontSize: ".92rem" }}>About</Link></li>
                <li><Link href="/join" style={{ fontSize: ".92rem" }}>Request early access</Link></li>
                <li><Link href="/login" style={{ fontSize: ".92rem" }}>Sign in</Link></li>
              </ul>
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
                        borderTop: "1px solid #24344c", paddingTop: 22 }}>
            <span style={{ fontFamily: "var(--serif)", color: "#fff" }}>Semantic Authoring</span>
            <Link href="/privacy" style={{ fontSize: ".9rem" }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: ".9rem" }}>Terms</Link>
            <span style={{ marginLeft: "auto", fontSize: ".85rem", maxWidth: 460 }}>
              Private enough for your unfinished thinking. Public enough for your finished
              ideas to matter.
            </span>
          </div>
        </div>
      </footer>
      <Consent />
    </>
  );
}
