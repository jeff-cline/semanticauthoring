import Link from "next/link";
import AuthorsMini from "@/components/AuthorsMini";

const SECTIONS: { heading: string; links: { href: string; label: string; hint: string }[] }[] = [
  {
    heading: "Read",
    links: [
      { href: "/authors", label: "Semantic Authors", hint: "Everyone publishing here" },
      { href: "/discover", label: "Discover", hint: "Published work by topic" },
      { href: "/answers", label: "Answers", hint: "Questions scholars ask, answered" },
      { href: "/scholars", label: "Scholars", hint: "Ranked by published work" },
    ],
  },
  {
    heading: "About",
    links: [
      { href: "/mission", label: "Mission", hint: "Why this exists" },
      { href: "/journey", label: "The journey", hint: "How the work moves" },
      { href: "/about", label: "About", hint: "What the platform is" },
      { href: "/pricing", label: "Pricing", hint: "What it costs" },
    ],
  },
  {
    heading: "Your work",
    links: [
      { href: "/join", label: "Create an account", hint: "Start a workspace" },
      { href: "/login", label: "Sign in", hint: "Back to your desk" },
      { href: "/app", label: "Your workspace", hint: "If you are already signed in" },
      { href: "/forgot", label: "Forgot your password", hint: "Send a reset link" },
    ],
  },
];

/**
 * The body of every 404 on the site.
 *
 * Shared so the global not-found and the one for a mistyped handle are the
 * same page — a visitor who gets one should not get a different, worse
 * version depending on how many slashes they typed.
 */
export default function NotFoundBody() {
  return (

    <PublicShell>
      <section className="wrap" style={{ padding: "64px 24px 0" }}>
        <div className="narrow">
          <p className="eyebrow">404</p>
          <h1>That page isn&rsquo;t here</h1>
          <p className="lede">
            The address may have changed, or it may never have existed. Nothing is lost —
            try a search, or pick up from one of the doors below.
          </p>

          <form action="/search" method="get" role="search"
                aria-label="Search published scholarship by keyword or author"
                style={{ margin: "28px 0 0", maxWidth: 560 }}>
            <label htmlFor="nf-q">Search for keyword or author or keyword + author</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="nf-q" name="q" autoFocus
                     placeholder="Search for keyword or author or keyword + author"
                     style={{ flex: 1, minWidth: 0 }} />
              <button className="btn btn-primary"
                      style={{ padding: "12px 20px", flexShrink: 0 }}>Search</button>
            </div>
          </form>
        </div>

        <AuthorsMini />

        <div style={{ display: "grid", gap: 28, marginTop: 48,
                      gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          {SECTIONS.map((s) => (
            <nav key={s.heading} aria-label={s.heading}>
              <h2 style={{ fontSize: "1rem", marginBottom: 10 }}>{s.heading}</h2>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} style={{ fontWeight: 600 }}>{l.label}</Link>
                    <span style={{ display: "block", color: "var(--muted)", fontSize: ".84rem" }}>
                      {l.hint}
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p style={{ color: "var(--muted)", fontSize: ".88rem", marginTop: 40 }}>
          Looking for a scholar? Their page is{" "}
          <code>semanticauthoring.org/first-last</code> — for example{" "}
          <Link href="/authors">browse the full list</Link>.
        </p>
      </section>
    </PublicShell>
    );
}
