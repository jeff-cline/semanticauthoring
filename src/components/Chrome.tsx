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
            <Link href="/authors">Authors</Link>
            <Link href="/journey">Journey</Link>
            <Link href="/answers">Answers</Link>
            <Link href="/mission">Mission</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/about">About</Link>
            <Link href="/join">Join</Link>
            {/* Signing in is the most common reason a returning member opens
                the site; it was only reachable from the footer. */}
            <Link href="/login" className="nav-signin">Sign in</Link>
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
          <div className="grid" style={{ gap: "28px 40px", marginBottom: 36,
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
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
                <li><Link href="/authors" style={{ fontSize: ".92rem" }}>Semantic Authors</Link></li>
                <li><Link href="/login" style={{ fontSize: ".92rem" }}>Sign in</Link></li>
              </ul>
            </div>

            {/* Machine-readable surfaces. Answer engines, chat assistants, and
                crawlers use these; keeping them linked makes them discoverable
                rather than merely present. */}
            <div>
              <p className="eyebrow" style={{ color: "var(--seaglass)" }}>For machines</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 2 }}>
                <li>
                  <a href="/sitemap.xml" style={{ fontSize: ".92rem" }}>XML sitemap</a>
                  <span style={{ color: "#6d8099", fontSize: ".78rem" }}> · every public page</span>
                </li>
                <li>
                  <a href="/feed.xml" style={{ fontSize: ".92rem" }}>RSS feed</a>
                  <span style={{ color: "#6d8099", fontSize: ".78rem" }}> · new scholarship</span>
                </li>
                <li>
                  <a href="/llms.txt" style={{ fontSize: ".92rem" }}>llms.txt</a>
                  <span style={{ color: "#6d8099", fontSize: ".78rem" }}> · for AI assistants</span>
                </li>
                <li>
                  <a href="/robots.txt" style={{ fontSize: ".92rem" }}>robots.txt</a>
                  <span style={{ color: "#6d8099", fontSize: ".78rem" }}> · crawl rules</span>
                </li>
                <li>
                  <Link href="/answers" style={{ fontSize: ".92rem" }}>Answer pages</Link>
                  <span style={{ color: "#6d8099", fontSize: ".78rem" }}> · structured Q&amp;A</span>
                </li>
              </ul>
              <p style={{ color: "#6d8099", fontSize: ".78rem", marginTop: 12, lineHeight: 1.6 }}>
                Every public page carries schema.org structured data —
                <code style={{ color: "#8fa3c0" }}> ScholarlyArticle</code>,
                <code style={{ color: "#8fa3c0" }}> Person</code>,
                <code style={{ color: "#8fa3c0" }}> FAQPage</code> — so search engines and
                chat assistants can read it directly.
              </p>
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

          <div style={{ borderTop: "1px solid #24344c", marginTop: 22, paddingTop: 20,
                        fontSize: ".88rem", lineHeight: 1.7 }}>
            <p style={{ margin: 0 }}>
              <span aria-hidden="true" style={{ marginInlineEnd: 6 }}>🚀</span>
              Proudly built by{" "}
              <a href="https://r0cketship.com" target="_blank" rel="noopener noreferrer"
                 style={{ color: "#fff", fontWeight: 600 }}>
                R0cketShip
              </a>
              {" "}— and the help of all of our scholars and collaborators!
            </p>
          </div>
        </div>
      </footer>
      <Consent />
    </>
  );
}
