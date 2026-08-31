import { PublicShell } from "@/components/Chrome";
import JoinForm from "@/components/JoinForm";

export const metadata = {
  title: "Request early access",
  description:
    "Join the founding scholars building Semantic Authoring — the operating system for scholarly thinking.",
};

export default function Join() {
  return (
    <PublicShell>
      <section className="wrap" style={{ padding: "72px 24px 0" }}>
        <div className="grid grid-2" style={{ alignItems: "start", gap: 44 }}>
          <div>
            <p className="eyebrow">Founding scholars</p>
            <h1>Start your scholar workspace.</h1>
            <p className="lede">
              We&rsquo;re opening workspaces to a small group of scholars first, so we can
              build this alongside the people who will actually use it.
            </p>
            <ul style={{ color: "var(--muted)", paddingLeft: 20, lineHeight: 2 }}>
              <li>Every tier is free during this period</li>
              <li>Your research and journals stay private, always</li>
              <li>Export everything, any time — no lock-in</li>
              <li>Direct line to the people building it</li>
            </ul>
          </div>
          <JoinForm />
        </div>
      </section>
    </PublicShell>
  );
}
