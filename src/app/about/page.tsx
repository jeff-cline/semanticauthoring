import Link from "next/link";
import { PublicShell } from "@/components/Chrome";

export const metadata = {
  title: "About",
  description:
    "Semantic Authoring is built on a simple conviction: the scholar's thinking is the thing worth protecting, and software should make its evolution visible.",
};

export default function About() {
  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "72px 24px 0" }}>
        <p className="eyebrow">About</p>
        <h1>A place for thinking to grow.</h1>
        <p className="lede">
          Scholarship today is scattered — readings in one tool, notes in another, drafts
          somewhere else, and the reasoning that connected them living only in the
          scholar&rsquo;s memory. When the degree ends, most of it disappears.
        </p>
        <p style={{ color: "var(--muted)" }}>
          Semantic Authoring exists because that loss is avoidable. The path from a
          highlighted passage to an original contribution is a real, traceable sequence —
          and if you preserve it, a scholar can see how their own thinking evolved across
          years of study.
        </p>

        <h2 style={{ marginTop: 56 }}>What makes it different</h2>
        <p style={{ color: "var(--muted)" }}>
          Semantic Authoring is not &ldquo;everything for your PhD in one place.&rdquo;
          Plenty of tools promise that. The deeper value is that we preserve and develop
          the scholar&rsquo;s intellectual journey — connecting what you read, what you
          noticed, what you questioned, what you experienced, what you concluded, what
          others challenged, what you revised, and what you ultimately contributed.
        </p>

        <h2 style={{ marginTop: 48 }}>How we think about AI</h2>
        <p style={{ color: "var(--muted)" }}>
          AI here is a research assistant, never a ghostwriter. It can surface connections
          you forgot, compare how authors disagree, and find contradictions in your own
          library. It does not write your scholarship. The platform always preserves the
          difference between what you read, what a machine suggested, what you thought, and
          what you authored — because academic integrity depends on that line staying
          visible.
        </p>

        <h2 style={{ marginTop: 48 }}>How we think about privacy</h2>
        <p style={{ color: "var(--muted)" }}>
          Private by default, without exception. Drafts, journals, reflections, your Life
          Map, and mentor feedback are yours alone unless you deliberately share them. We
          do not run analytics or visitor identification inside the workspace. And you can
          export everything — a scholar who cannot leave is not really a member.
        </p>

        <p style={{ marginTop: 48 }}>
          <Link href="/join" className="btn btn-primary">Request early access</Link>
        </p>
      </section>
    </PublicShell>
  );
}
