import Link from "next/link";
import { PublicShell } from "@/components/Chrome";
import { ANSWERS } from "@/lib/answers";

export const metadata = {
  title: "Answers for scholars",
  description:
    "Direct answers to the questions doctoral scholars actually ask — about research questions, literature synthesis, dissertation organization, defense preparation, and AI integrity.",
  alternates: { canonical: "/answers" },
};

export default function AnswersIndex() {
  const site = "https://semanticauthoring.org";
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Answers for scholars",
    url: `${site}/answers`,
    hasPart: ANSWERS.map((a) => ({
      "@type": "Article",
      headline: a.question,
      url: `${site}/answers/${a.slug}`,
      description: a.description,
    })),
  };

  return (
    <PublicShell>
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="wrap narrow" style={{ padding: "72px 24px 0" }}>
        <p className="eyebrow">Answers</p>
        <h1>Questions scholars actually ask.</h1>
        <p className="lede">
          Direct answers on research practice — organizing a doctorate, synthesizing
          literature, preparing a defense, and using AI without compromising integrity.
        </p>
      </section>
      <section className="wrap" style={{ padding: "44px 24px 0" }}>
        <div className="grid grid-2">
          {ANSWERS.map((a) => (
            <Link key={a.slug} href={`/answers/${a.slug}`} className={`card stage ${a.stage ?? ""}`}
                  style={{ color: "inherit", textDecoration: "none" }}>
              <h3 style={{ color: "var(--accent, var(--midnight))" }}>{a.question}</h3>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: ".96rem" }}>
                {a.answer.slice(0, 155)}…
              </p>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
