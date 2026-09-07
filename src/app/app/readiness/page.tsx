import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publication readiness" };

// Reporting guidelines are named, linked, and NEVER auto-ticked. Claiming
// CONSORT or PRISMA compliance that has not actually been followed would be a
// false statement in a submission, so the platform only ever offers the
// checklist — the scholar confirms each item themselves, at the journal.

const GUIDELINES = [
  ["CONSORT", "Randomised controlled trials", "https://www.equator-network.org/reporting-guidelines/consort/"],
  ["PRISMA", "Systematic reviews and meta-analyses", "https://www.equator-network.org/reporting-guidelines/prisma/"],
  ["STROBE", "Observational studies", "https://www.equator-network.org/reporting-guidelines/strobe/"],
  ["COREQ", "Qualitative research (interviews and focus groups)", "https://www.equator-network.org/reporting-guidelines/coreq/"],
  ["CARE", "Case reports", "https://www.equator-network.org/reporting-guidelines/care/"],
  ["SRQR", "Qualitative research (general)", "https://www.equator-network.org/reporting-guidelines/srqr/"],
];

export default async function Readiness(
  { searchParams }: { searchParams: Promise<{ id?: string }> },
) {
  const user = (await currentUser())!;
  const { id } = await searchParams;

  const submissions = await q<any>(
    `SELECT s.*, d.body, d.word_count, d.title AS doc_title
       FROM submissions s LEFT JOIN documents d ON d.id = s.document_id
      WHERE s.owner_id=$1 ORDER BY s.updated_at DESC`, [user.id]);

  const chosen = id ? submissions.find((s: any) => String(s.id) === id) : submissions[0];

  const [profile, claims, shortlist] = await Promise.all([
    one<any>(`SELECT orcid, institution FROM profiles WHERE user_id=$1`, [user.id]),
    chosen ? q<any>(
      `SELECT c.id, c.text,
              (SELECT count(*)::int FROM claim_evidence e WHERE e.claim_id=c.id) AS ev
         FROM claims c WHERE c.owner_id=$1`, [user.id]) : Promise.resolve([]),
    chosen ? q<any>(`SELECT name, status FROM journal_shortlist
                      WHERE owner_id=$1 AND (submission_id=$2 OR submission_id IS NULL)`,
      [user.id, chosen.id]) : Promise.resolve([]),
  ]);

  const unsupported = claims.filter((c: any) => c.ev === 0);
  const words = chosen?.word_count ?? 0;
  const limit = chosen?.word_limit ?? 0;

  const checks = chosen ? [
    { name: "Manuscript attached", ok: Boolean(chosen.document_id),
      detail: chosen.document_id ? `${words} words.` : "No document linked to this entry.",
      href: "/app/pipeline" },
    { name: "Within the word limit",
      ok: limit === 0 ? true : words > 0 && words <= limit,
      detail: limit === 0 ? "No limit recorded — add one from the journal's guidelines."
        : words <= limit ? `${words} of ${limit}.` : `${words} words, over the ${limit} limit.`,
      href: "/app/pipeline" },
    { name: "Target venue chosen", ok: Boolean(chosen.venue),
      detail: chosen.venue || "No venue recorded.", href: "/app/journals" },
    { name: "Submission guidelines recorded", ok: Boolean(chosen.guidelines),
      detail: chosen.guidelines ? "Recorded." : "Paste them from the journal so they are to hand.",
      href: "/app/pipeline" },
    { name: "Every claim has evidence", ok: unsupported.length === 0,
      detail: unsupported.length === 0 ? `All ${claims.length} claims carry evidence.`
        : `${unsupported.length} claim(s) still have none.`, href: "/app/claims" },
    { name: "Citations verified", ok: false,
      detail: "Run the integrity check so no retracted or unresolvable DOI reaches a reviewer.",
      href: "/app/integrity" },
    { name: "ORCID recorded", ok: Boolean(profile?.orcid),
      detail: profile?.orcid || "Most journals now ask for it at submission.",
      href: "/app/profile" },
    { name: "Affiliation recorded", ok: Boolean(profile?.institution),
      detail: profile?.institution || "Not recorded.", href: "/app/profile" },
    { name: "Co-authors listed", ok: Boolean(chosen.coauthors),
      detail: chosen.coauthors || "None recorded — confirm authorship order before submitting.",
      href: "/app/pipeline" },
  ] : [];

  const done = checks.filter((c) => c.ok).length;

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Publication readiness</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        What a journal will ask for, checked against what you actually have.
      </p>

      {submissions.length === 0 ? (
        <p style={{ color: "var(--muted)", marginTop: 20 }}>
          Nothing in the pipeline yet. <Link href="/app/pipeline">Track a manuscript →</Link>
        </p>
      ) : (
        <>
          <form style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0" }}>
            <select name="id" defaultValue={String(chosen?.id ?? "")} style={{ maxWidth: 340 }}>
              {submissions.map((s: any) => (
                <option key={s.id} value={s.id}>{s.title.slice(0, 60)}</option>
              ))}
            </select>
            <button className="btn btn-secondary">Check this one</button>
          </form>

          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: "2.2rem", color: "var(--current)" }}>
              {done}/{checks.length}
            </div>
            <div style={{ flex: 1, maxWidth: 300, height: 8, background: "var(--line)",
                          borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${(done / Math.max(1, checks.length)) * 100}%`,
                            height: "100%", background: "var(--current)" }} />
            </div>
          </div>

          {checks.map((c) => (
            <div key={c.name} className="card" style={{ marginBottom: 8, padding: 14,
                 maxWidth: 880,
                 borderLeft: `3px solid ${c.ok ? "var(--current)" : "var(--gold)"}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: ".95rem" }}>{c.name}</strong>
                <span className="pill" style={{ color: c.ok ? "var(--current)" : "var(--gold)" }}>
                  {c.ok ? "ready" : "check"}
                </span>
                <Link href={c.href} style={{ marginLeft: "auto", fontSize: ".86rem" }}>open →</Link>
              </div>
              <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "4px 0 0" }}>
                {c.detail}
              </p>
            </div>
          ))}
        </>
      )}

      <h2 style={{ fontSize: "1.15rem", marginTop: 30 }}>Reporting guidelines</h2>
      <div className="card" style={{ maxWidth: 820, borderLeft: "3px solid var(--coral)" }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}>
          <strong>These are not ticked for you.</strong>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          Claiming CONSORT or PRISMA compliance that was not actually followed is a false
          statement in a submission. The platform can point you at the right checklist; only
          you can complete it, and you should do so at the source.
        </p>
      </div>
      <div className="grid grid-2" style={{ marginTop: 12 }}>
        {GUIDELINES.map(([name, what, url]) => (
          <div key={name} className="card" style={{ padding: 14 }}>
            <strong>{name}</strong>
            <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "4px 0 6px" }}>{what}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: ".88rem" }}>
              Open the checklist ↗
            </a>
          </div>
        ))}
      </div>
    </>
  );
}
