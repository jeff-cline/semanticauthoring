import { PublicShell } from "@/components/Chrome";
import { JOURNEY } from "@/components/Brand";

export const metadata = { title: "The scholarly journey" };

const DETAIL: Record<string, string[]> = {
  read: ["Research library for PDFs, articles, books, chapters, lectures, and podcasts",
         "Highlight and annotate with page numbers and citation metadata preserved",
         "Label evidence: supports, challenges, contradicts, expands, contextualizes"],
  connect: ["Semantic knowledge map across authors, concepts, theories, and methods",
            "Cohorts, reading circles, writing groups, and research communities",
            "Your Life Map — link formative experiences to the questions driving you"],
  synthesize: ["Thematic clustering and literature review matrices",
               "Compare authors, theories, and methodologies side by side",
               "Track contradictions, emerging themes, and research gaps"],
  author: ["A distraction-free scholarly writing environment",
           "Sources, quotes, citations, and contradictory research within reach",
           "Course papers through dissertation chapters and journal manuscripts"],
  review: ["Invite mentors, advisors, committee members, and peer reviewers",
           "Permission-based: share one chapter without exposing your journal",
           "Inline comments, version history, and resolution tracking"],
  publish: ["Move finished work into the public platform, deliberately",
            "Scholar profile readers can follow and subscribe to",
            "Share to LinkedIn, X, Facebook, Threads, and Bluesky"],
  celebrate: ["Milestones from your first reading to your first citation",
              "A scholar timeline recording your intellectual evolution",
              "You decide which moments are public and which stay yours"],
};

export default function Journey() {
  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "72px 24px 0" }}>
        <p className="eyebrow">The journey</p>
        <h1>Read → Connect → Synthesize → Author → Review → Publish → Celebrate</h1>
        <p className="lede">
          Every stage carries its own accent, so you always know where you are in your work
          without the interface shouting at you.
        </p>
      </section>
      <section className="wrap narrow" style={{ padding: "48px 24px 0" }}>
        {JOURNEY.map((s) => (
          <div key={s.key} className={`stage ${s.cls}`} style={{ marginBottom: 44 }}>
            <h2 style={{ color: "var(--accent)" }}>{s.label}</h2>
            <p style={{ color: "var(--muted)", fontSize: "1.06rem" }}>{s.line}</p>
            <ul style={{ color: "var(--muted)", paddingLeft: 20 }}>
              {DETAIL[s.key].map((d) => <li key={d} style={{ marginBottom: 6 }}>{d}</li>)}
            </ul>
          </div>
        ))}
      </section>
    </PublicShell>
  );
}
