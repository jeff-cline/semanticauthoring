import { PublicShell } from "@/components/Chrome";

export const metadata = {
  title: "Privacy",
  description:
    "How Semantic Authoring handles scholarly data: private by default, analytics on public pages only, and full export at any time.",
};

export default function Privacy() {
  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "72px 24px 0" }}>
        <p className="eyebrow">Policy version 1.0</p>
        <h1>Privacy</h1>
        <p className="lede">
          Your unfinished thinking is the most sensitive thing you will put in this
          platform. We treat it that way.
        </p>

        <h2>Private by default</h2>
        <p style={{ color: "var(--muted)" }}>
          Drafts, notes, annotations, journal entries, your Life Map, research questions,
          and mentor feedback default to <strong>Only Me</strong>. Nothing becomes public,
          visible to a group, or visible to a mentor unless you deliberately share it.
          Administrators do not browse your private contacts, journal, or Life Map.
        </p>

        <h2>Analytics and visitor identification</h2>
        <p style={{ color: "var(--muted)" }}>
          On our <strong>public pages only</strong>, and <strong>only after you accept</strong>,
          we use analytics and a visitor-identification service that may associate your visit
          with business-contact information. This helps us understand which scholars our work
          reaches. You can decline, and the site works identically either way.
        </p>
        <p style={{ color: "var(--muted)" }}>
          <strong>None of this runs inside the authenticated workspace.</strong> Once you are
          signed in and working, you are not tracked or identified. That boundary is
          structural, not a setting.
        </p>

        <h2>What we record when you consent</h2>
        <p style={{ color: "var(--muted)" }}>
          A timestamp, the page you consented on, and the policy version — retained as proof
          of consent. You can withdraw by clearing site data or contacting us.
        </p>

        <h2>Email</h2>
        <p style={{ color: "var(--muted)" }}>
          Subscribing to a scholar requires confirming your address first (double opt-in).
          Every notification carries a one-click unsubscribe, honored immediately. We do not
          sell or share subscriber lists, and one scholar cannot see another&rsquo;s audience.
        </p>

        <h2>Your rights</h2>
        <p style={{ color: "var(--muted)" }}>
          You may export your research library, notes, annotations, journal entries,
          manuscripts, questions, Life Map, and profile at any time. You may request deletion
          of your account and its contents. If you are in the EU or UK, these rights are
          yours under GDPR; we extend them to everyone.
        </p>

        <h2>Copyright</h2>
        <p style={{ color: "var(--muted)" }}>
          Materials you upload to your private library stay private. We never make publisher
          PDFs publicly accessible, and we do not circumvent paywalls.
        </p>

        <h2>Contact</h2>
        <p style={{ color: "var(--muted)" }}>
          Questions about this policy: <a href="mailto:privacy@semanticauthoring.org">privacy@semanticauthoring.org</a>
        </p>
      </section>
    </PublicShell>
  );
}
