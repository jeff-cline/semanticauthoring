import { PublicShell } from "@/components/Chrome";

export const metadata = {
  title: "Mission, vision, and values",
  description:
    "Semantic Authoring exists to help scholars turn what they read into what they think, and what they think into contributions that move knowledge forward.",
};

const VALUES = [
  ["Curiosity", "Ask better questions", "Great scholarship begins with curiosity. We encourage exploration, questioning, discovery, and the courage to challenge what is already known."],
  ["Integrity", "Protect the lineage of thought", "Human authorship matters. We value academic integrity, intellectual ownership, transparency, proper attribution, and the ability to understand how an idea evolved from source to contribution."],
  ["Connection", "Knowledge grows through relationship", "Ideas do not exist in isolation. We connect sources to ideas, ideas to other ideas, and scholars to mentors, communities, and one another."],
  ["Courage", "Contribute what only you can", "Original scholarship requires the courage to question, develop a point of view, receive feedback, revise, and ultimately allow your work to be seen."],
  ["Humanity", "Honor the scholar behind the scholarship", "Scholars are human beings, not productivity machines. We value reflection, embodied awareness, sustainable progress, belonging, and the person who is becoming through the scholarly journey."],
  ["Contribution", "Knowledge should move forward", "Research shouldn't disappear when an assignment, dissertation, or degree is complete. We help scholars turn their work into contributions that educate, influence, and inspire."],
  ["Celebration", "Progress deserves to be seen", "Scholarship can take years. We recognize the readings completed, questions discovered, drafts rewritten, proposals approved, and papers published — not only the degree at the end."],
];

export default function Mission() {
  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "72px 24px 0" }}>
        <p className="eyebrow">Why we exist</p>
        <h1>Mission</h1>
        <p className="lede">
          To empower scholars to transform what they read into what they think, what they
          think into what they author, and what they author into meaningful contributions
          to the world.
        </p>
        <p style={{ color: "var(--muted)" }}>
          Semantic Authoring connects research, reflection, writing, collaboration, and
          publishing in one human-centered environment — making the scholarly journey more
          organized, connected, visible, and fulfilling.
        </p>

        <h2 style={{ marginTop: 56 }}>Vision</h2>
        <p className="lede">
          To become the trusted home for the world&rsquo;s scholarly thinking — where
          knowledge is connected, original ideas are cultivated, and every scholar has the
          tools and community to turn curiosity into contribution.
        </p>
        <p style={{ color: "var(--muted)" }}>
          We envision a future where scholarship isn&rsquo;t fragmented across disconnected
          systems or hidden inside dissertations and institutions, but evolves as a living
          body of knowledge that can be developed, shared, discovered, and built upon.
        </p>
      </section>

      <section className="wrap" style={{ padding: "64px 24px 0" }}>
        <h2 style={{ textAlign: "center", marginBottom: 34 }}>Core values</h2>
        <div className="grid grid-2">
          {VALUES.map(([name, sub, body], i) => (
            <div key={name} className="card">
              <p className="eyebrow" style={{ color: "var(--gold)" }}>{String(i + 1).padStart(2, "0")}</p>
              <h3>{name} — {sub}</h3>
              <p style={{ color: "var(--muted)", margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap narrow" style={{ padding: "72px 24px 0", textAlign: "center" }}>
        <div className="card" style={{ padding: 44 }}>
          <p className="eyebrow">Brand philosophy</p>
          <h2 style={{ fontStyle: "italic" }}>
            Think deeply. Connect meaningfully. Author courageously. Contribute generously.
          </h2>
          <p className="lede" style={{ marginBottom: 0 }}>
            We don&rsquo;t replace the scholar&rsquo;s thinking. We create a place for it to grow.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
