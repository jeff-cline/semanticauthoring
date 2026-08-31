import Link from "next/link";
import { Mark, JOURNEY } from "./Brand";
import Consent from "./Consent";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="brand"><Mark /> Semantic Authoring</Link>
          <nav className="nav" aria-label="Main">
            <Link href="/journey">Journey</Link>
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
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--serif)", color: "#fff" }}>Semantic Authoring</span>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/login">Sign in</Link>
            <span style={{ marginLeft: "auto", fontSize: ".85rem" }}>
              Private enough for your unfinished thinking. Public enough for your finished ideas to matter.
            </span>
          </div>
        </div>
      </footer>
      <Consent />
    </>
  );
}
