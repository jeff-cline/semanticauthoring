import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicShell } from "@/components/Chrome";
import { ANSWERS, bySlug } from "@/lib/answers";

export function generateStaticParams() {
  return ANSWERS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const a = bySlug(slug);
  if (!a) return {};
  return {
    title: a.question,
    description: a.description,
    alternates: { canonical: `/answers/${a.slug}` },
    openGraph: {
      type: "article",
      title: a.question,
      description: a.description,
      url: `/answers/${a.slug}`,
    },
    twitter: { card: "summary_large_image", title: a.question, description: a.description },
  };
}

export default async function AnswerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = bySlug(slug);
  if (!a) notFound();

  const site = "https://semanticauthoring.org";

  // Structured data: the answer itself, the FAQs, and the breadcrumb trail.
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.question,
      description: a.description,
      articleBody: a.answer,
      mainEntityOfPage: { "@type": "WebPage", "@id": `${site}/answers/${a.slug}` },
      publisher: { "@type": "Organization", name: "Semantic Authoring", url: site },
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: a.question,
          acceptedAnswer: { "@type": "Answer", text: a.answer } },
        ...a.faqs.map((f) => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site },
        { "@type": "ListItem", position: 2, name: "Answers", item: `${site}/answers` },
        { "@type": "ListItem", position: 3, name: a.question, item: `${site}/answers/${a.slug}` },
      ],
    },
  ];

  return (
    <PublicShell>
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <article className="wrap narrow" style={{ padding: "64px 24px 0" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: ".85rem", marginBottom: 18 }}>
          <Link href="/">Home</Link> <span style={{ color: "var(--muted)" }}>/</span>{" "}
          <Link href="/answers">Answers</Link>
        </nav>

        <h1>{a.question}</h1>

        {/* The direct answer — the unit an answer engine extracts. */}
        <div className={`stage ${a.stage ?? "stage-connect"}`}
             style={{ margin: "26px 0 40px", background: "var(--card)",
                      border: "1px solid var(--line)", borderLeftWidth: 3,
                      borderRadius: "0 12px 12px 0", padding: "22px 24px" }}>
          <p style={{ margin: 0, fontSize: "1.14rem", lineHeight: 1.6 }}>{a.answer}</p>
        </div>

        {a.sections.map((s) => (
          <section key={s.h} style={{ marginBottom: 34 }}>
            <h2>{s.h}</h2>
            {s.p.map((p, i) => (
              <p key={i} style={{ color: "var(--muted)" }}>{p}</p>
            ))}
          </section>
        ))}

        <section style={{ marginTop: 48 }}>
          <h2>Common questions</h2>
          {a.faqs.map((f) => (
            <details key={f.q} className="card" style={{ marginBottom: 12, padding: "16px 20px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.q}</summary>
              <p style={{ color: "var(--muted)", marginBottom: 0, marginTop: 10 }}>{f.a}</p>
            </details>
          ))}
        </section>

        <section style={{ marginTop: 48 }}>
          <h2>Related</h2>
          <ul style={{ paddingLeft: 20 }}>
            {a.related.map((r) => {
              const rel = bySlug(r);
              return rel ? (
                <li key={r} style={{ marginBottom: 8 }}>
                  <Link href={`/answers/${rel.slug}`}>{rel.question}</Link>
                </li>
              ) : null;
            })}
          </ul>
        </section>

        <aside className="card" style={{ margin: "52px 0 0", padding: 32, textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>Semantic Authoring</h2>
          <p style={{ color: "var(--muted)" }}>
            A workspace built around exactly this: your reading, your questions, and the
            connections between them.
          </p>
          <Link href="/join" className="btn btn-primary">Start your scholar workspace</Link>
        </aside>
      </article>
    </PublicShell>
  );
}
