import Link from "next/link";
import { PublicShell } from "@/components/Chrome";

export const metadata = {
  title: "Pricing",
  description:
    "Semantic Authoring has three tiers — Free, Scholar, and Doctoral. Every tier is currently free while the platform is being built.",
};

const ROWS: [string, boolean | string, boolean | string, boolean | string][] = [
  ["Public scholar profile", true, true, true],
  ["Research library", "50 items", "Unlimited", "Unlimited"],
  ["Annotations & notes", true, true, true],
  ["Capture Thought", true, true, true],
  ["Daily scholar journal", true, true, true],
  ["Authoring studio", "3 documents", "Unlimited", "Unlimited"],
  ["Question Tracker", true, true, true],
  ["Life Map", true, true, true],
  ["Semantic connections", "Basic", "Full", "Full"],
  ["Groups", "Join", "Join + create", "Join + create"],
  ["Scholar CRM (contacts)", "25", "Unlimited", "Unlimited"],
  ["Testimonial requests", "5", "Unlimited", "Unlimited"],
  ["Public publishing", false, true, true],
  ["Subscribers & notifications", false, true, true],
  ["Mentor / committee review", false, false, true],
  ["Course organization", false, false, true],
  ["Dissertation workspace", false, false, true],
  ["Publication pipeline", false, false, true],
  ["Milestones & timeline", true, true, true],
  ["Export & portability", true, true, true],
];

const cell = (v: boolean | string) =>
  v === true ? <span style={{ color: "var(--current)" }} aria-label="included">✓</span>
  : v === false ? <span style={{ color: "var(--line)" }} aria-label="not included">—</span>
  : <span>{v}</span>;

export default function Pricing() {
  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "72px 24px 0", textAlign: "center" }}>
        <p className="eyebrow">Membership</p>
        <h1>Every tier is free right now.</h1>
        <p className="lede">
          We&rsquo;re building in the open with founding scholars. Pricing arrives later —
          and founding members will be told well before anything changes.
        </p>
      </section>

      <section className="wrap" style={{ padding: "48px 24px 0", overflowX: "auto" }}>
        <table>
          <caption className="hp">Feature comparison across Free, Scholar, and Doctoral tiers</caption>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free<br /><span style={{ color: "var(--gold)" }}>$0</span></th>
              <th scope="col">Scholar<br /><span style={{ color: "var(--gold)" }}>$0</span></th>
              <th scope="col">Doctoral<br /><span style={{ color: "var(--gold)" }}>$0</span></th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]}>
                <th scope="row" style={{ fontWeight: 400, textTransform: "none",
                                         letterSpacing: 0, fontSize: ".93rem", color: "var(--fg)" }}>
                  {r[0]}
                </th>
                <td>{cell(r[1])}</td>
                <td>{cell(r[2])}</td>
                <td>{cell(r[3])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ textAlign: "center", marginTop: 34 }}>
          <Link href="/join" className="btn btn-primary">Request early access</Link>
        </p>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: ".92rem" }}>
          Institutional and Research Pro tiers are planned for universities, doctoral
          programs, and research groups.
        </p>
      </section>
    </PublicShell>
  );
}
