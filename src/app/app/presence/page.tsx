import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { crossrefByDoi, openAlexByDoi } from "@/lib/scholarly";
import { dataciteSearch, rorSearch } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scholarly presence" };

// Audits whether a scholar's work is discoverable in the places that matter.
// It never posts anywhere, never creates profiles, and never manufactures links —
// the brief forbids all three, and they are how reputations get destroyed rather
// than built. It only reports what is and is not findable.

export default async function Presence() {
  const user = (await currentUser())!;

  const [profile, pubs, deposits, sources] = await Promise.all([
    one<any>(`SELECT * FROM profiles WHERE user_id=$1`, [user.id]),
    q<any>(`SELECT id, title, slug, doi, status FROM publications WHERE owner_id=$1`, [user.id]),
    q<any>(`SELECT title, doi, status, repository FROM deposits WHERE owner_id=$1`, [user.id]),
    q<any>(`SELECT count(*)::int AS n FROM sources WHERE owner_id=$1 AND doi <> ''`, [user.id]),
  ]);

  // Resolve any DOI the scholar claims as their own.
  const withDoi = [...pubs.filter((p: any) => p.doi), ...deposits.filter((d: any) => d.doi)];
  const resolved = await Promise.all(withDoi.slice(0, 15).map(async (w: any) => {
    const [cr, oa] = await Promise.all([
      crossrefByDoi(w.doi).catch(() => null),
      openAlexByDoi(w.doi).catch(() => null),
    ]);
    return {
      title: w.title, doi: w.doi,
      crossref: Boolean(cr), openalex: Boolean(oa),
      citations: oa?.citationCount ?? cr?.citationCount ?? null,
      retracted: Boolean(oa?.isRetracted || cr?.isRetracted),
    };
  }));

  const institution = profile?.institution
    ? await rorSearch(profile.institution, 3).catch(() => [])
    : [];

  const checks = [
    {
      name: "ORCID",
      ok: Boolean(profile?.orcid),
      detail: profile?.orcid
        ? `Recorded as ${profile.orcid}.`
        : "No ORCID recorded. It is the one identifier that follows you across institutions and name changes.",
      fix: "Register free at orcid.org, then add it to your profile.",
      href: "/app/profile",
    },
    {
      name: "Public profile",
      ok: Boolean(profile?.is_public),
      detail: profile?.is_public
        ? `Live at /s/${profile.handle}.`
        : "Your profile is switched off, so nothing you publish here is discoverable.",
      fix: "Turn it on in your profile settings.",
      href: "/app/profile",
    },
    {
      name: "Published work",
      ok: pubs.some((p: any) => p.status === "published"),
      detail: `${pubs.filter((p: any) => p.status === "published").length} published here.`,
      fix: "Publishing gives search engines and answer engines something to index.",
      href: "/app/publications",
    },
    {
      name: "A DOI somewhere",
      ok: withDoi.length > 0,
      detail: withDoi.length > 0
        ? `${withDoi.length} work(s) carry a DOI.`
        : "Nothing of yours has a DOI, so the scholarly indexes cannot see it at all.",
      fix: "Deposit to Zenodo — it mints a DOI, and Crossref and OpenAlex pick it up from there.",
      href: "/app/deposit",
    },
    {
      name: "Institution normalised",
      ok: institution.length > 0,
      detail: institution.length > 0
        ? `Matches ${institution[0].name} in ROR.`
        : profile?.institution
          ? "No ROR match — the name on your profile may not be the canonical one."
          : "No institution recorded.",
      fix: "A ROR-matching name makes your affiliation machine-readable.",
      href: "/app/profile",
    },
  ];

  const done = checks.filter((c) => c.ok).length;

  return (
    <>
      <p className="eyebrow">Publish</p>
      <h1>Scholarly presence</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Whether your work is findable in the places that index scholarship — and where it
        isn&rsquo;t.
      </p>

      <div className="card" style={{ maxWidth: 780, margin: "18px 0",
           borderLeft: "3px solid var(--gold)" }}>
        <p style={{ margin: 0, fontSize: ".93rem" }}>
          <strong>This audits. It never acts.</strong>
        </p>
        <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: "6px 0 0" }}>
          Nothing here posts to a scholarly platform, creates a profile in your name,
          mass-submits a paper, or manufactures a citation. Those are how a scholarly
          reputation gets destroyed rather than built. Presence is earned by depositing real
          work with real identifiers — everything below is a report, and every fix is
          something you do deliberately.
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "22px 0" }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: "2.2rem", color: "var(--current)" }}>
          {done}/{checks.length}
        </div>
        <div style={{ flex: 1, maxWidth: 300, height: 8, background: "var(--line)",
                      borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${(done / checks.length) * 100}%`, height: "100%",
                        background: "var(--current)" }} />
        </div>
      </div>

      {checks.map((c) => (
        <div key={c.name} className="card" style={{ marginBottom: 10, maxWidth: 880,
             borderLeft: `3px solid ${c.ok ? "var(--current)" : "var(--gold)"}` }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong>{c.name}</strong>
            <span className="pill" style={{ color: c.ok ? "var(--current)" : "var(--gold)" }}>
              {c.ok ? "present" : "missing"}
            </span>
            {!c.ok && <Link href={c.href} style={{ marginLeft: "auto", fontSize: ".88rem" }}>
              fix →</Link>}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: ".92rem" }}>{c.detail}</p>
          {!c.ok && (
            <p style={{ color: "var(--muted)", fontSize: ".88rem", margin: "4px 0 0" }}>{c.fix}</p>
          )}
        </div>
      ))}

      {resolved.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.15rem", marginTop: 30 }}>Your DOIs in the indexes</h2>
          {resolved.map((r) => (
            <div key={r.doi} className="card" style={{ marginBottom: 8, padding: 14 }}>
              <strong style={{ fontSize: ".94rem" }}>{r.title}</strong>
              {r.retracted && (
                <span className="pill" style={{ color: "var(--coral)", marginLeft: 8 }}>
                  RETRACTED
                </span>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                <span className="pill" style={{ color: r.crossref ? "var(--current)" : "var(--muted)" }}>
                  Crossref {r.crossref ? "✓" : "not found"}
                </span>
                <span className="pill" style={{ color: r.openalex ? "var(--current)" : "var(--muted)" }}>
                  OpenAlex {r.openalex ? "✓" : "not found"}
                </span>
                {r.citations != null && <span className="pill">{r.citations} citations</span>}
              </div>
              {!r.crossref && !r.openalex && (
                <p style={{ color: "var(--muted)", fontSize: ".86rem", margin: "6px 0 0" }}>
                  Newly minted DOIs can take weeks to propagate. If it stays missing, check the
                  DOI is correct.
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}
