import "server-only";

// ── Grant discovery ──────────────────────────────────────────────────────────
//
// Three public funder APIs, none requiring a key:
//   Grants.gov  — open federal funding opportunities (the ones you can apply to)
//   NIH RePORTER — funded projects (what actually got money, and to whom)
//   NSF Awards   — funded awards
//
// RePORTER and NSF return AWARDS, not open calls. That distinction matters: they
// tell you what a funder has backed and who is working nearby, which is how you
// find a program officer or a collaborator — but you cannot apply to them.
// The UI labels each result accordingly rather than implying everything is open.

const UA = `SemanticAuthoring/1.0 (+https://semanticauthoring.org; mailto:${
  process.env.CONTACT_EMAIL ?? "hello@semanticauthoring.org"})`;

export interface Opportunity {
  provider: "grants_gov" | "nih" | "nsf";
  providerId: string;
  title: string;
  agency: string;
  url: string;
  closeDate: string | null;
  amount: string;
  summary: string;
  /** open = you can apply; awarded = already funded, for intelligence only. */
  kind: "open" | "awarded";
  retrievedAt: string;
}

const iso = (s?: string | null): string | null => {
  if (!s || !String(s).trim()) return null;
  const t = String(s).trim();
  // Grants.gov returns MM/DD/YYYY (and forecasts often return an empty string).
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const money = (n: unknown): string => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? `$${v.toLocaleString()}` : "";
};

async function post(url: string, body: unknown, ms = 15_000): Promise<any | null> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": UA },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
      cache: "no-store",
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function get(url: string, ms = 15_000): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(ms), cache: "no-store",
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Grants.gov Search2 — open opportunities you can actually apply to. */
export async function grantsGov(keyword: string, rows = 15): Promise<Opportunity[]> {
  const j = await post("https://api.grants.gov/v1/api/search2",
    { keyword, rows, oppStatuses: "forecasted|posted" });
  const hits = j?.data?.oppHits ?? [];
  return hits.map((h: any): Opportunity => ({
    provider: "grants_gov",
    providerId: String(h.id ?? h.number ?? ""),
    title: String(h.title ?? "").trim(),
    agency: String(h.agency ?? h.agencyCode ?? "").trim(),
    url: `https://www.grants.gov/search-results-detail/${h.id}`,
    closeDate: iso(h.closeDate),
    amount: "",
    // A forecast has no close date yet; say so rather than showing a blank.
    summary: [
      h.oppStatus === "forecasted"
        ? "Forecast — not yet open, no close date published"
        : h.oppStatus && `Status: ${h.oppStatus}`,
      h.openDate && `Opens ${iso(h.openDate) ?? h.openDate}`,
      h.number && `No. ${h.number}`,
      Array.isArray(h.cfdaList) && h.cfdaList.length && `CFDA ${h.cfdaList.join(", ")}`,
    ].filter(Boolean).join(" · "),
    kind: "open",
    retrievedAt: new Date().toISOString(),
  })).filter((o: Opportunity) => o.title);
}

/** NIH RePORTER — funded projects. Intelligence, not an open call. */
export async function nihReporter(keyword: string, limit = 15): Promise<Opportunity[]> {
  const j = await post("https://api.reporter.nih.gov/v2/projects/search", {
    criteria: { advanced_text_search: { operator: "and", search_field: "projecttitle,abstracttext,terms", search_text: keyword } },
    include_fields: ["ProjectTitle", "ProjectNum", "AwardAmount", "Organization",
                     "AgencyIcAdmin", "ProjectStartDate", "ProjectEndDate", "AbstractText"],
    limit, offset: 0,
  });
  const rows = j?.results ?? [];
  return rows.map((r: any): Opportunity => ({
    provider: "nih",
    providerId: String(r.project_num ?? ""),
    title: String(r.project_title ?? "").trim(),
    agency: String(r.agency_ic_admin?.name ?? r.organization?.org_name ?? "NIH").trim(),
    url: `https://reporter.nih.gov/project-details/${r.project_num ?? ""}`,
    closeDate: iso(r.project_end_date),
    amount: money(r.award_amount),
    summary: String(r.abstract_text ?? "").replace(/\s+/g, " ").slice(0, 300),
    kind: "awarded",
    retrievedAt: new Date().toISOString(),
  })).filter((o: Opportunity) => o.title);
}

/** NSF Awards — funded awards. Intelligence, not an open call. */
export async function nsfAwards(keyword: string, rows = 15): Promise<Opportunity[]> {
  const j = await get(
    `https://api.nsf.gov/services/v1/awards.json?keyword=${encodeURIComponent(keyword)}` +
    `&rpp=${rows}&printFields=id,title,agency,awardeeName,date,expDate,estimatedTotalAmt,abstractText`);
  const rowsOut = j?.response?.award ?? [];
  return rowsOut.map((a: any): Opportunity => ({
    provider: "nsf",
    providerId: String(a.id ?? ""),
    title: String(a.title ?? "").trim(),
    agency: String(a.agency ?? "NSF").trim(),
    url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${a.id ?? ""}`,
    closeDate: iso(a.expDate),
    amount: money(a.estimatedTotalAmt),
    summary: [a.awardeeName, String(a.abstractText ?? "").replace(/\s+/g, " ").slice(0, 240)]
      .filter(Boolean).join(" — "),
    kind: "awarded",
    retrievedAt: new Date().toISOString(),
  })).filter((o: Opportunity) => o.title);
}

/** All three, concurrently. A provider that fails contributes nothing rather than breaking the search. */
export async function searchGrants(keyword: string): Promise<{
  open: Opportunity[]; awarded: Opportunity[]; failed: string[];
}> {
  if (!keyword.trim()) return { open: [], awarded: [], failed: [] };
  const [gg, nih, nsf] = await Promise.all([
    grantsGov(keyword).catch(() => null),
    nihReporter(keyword).catch(() => null),
    nsfAwards(keyword).catch(() => null),
  ]);
  const failed: string[] = [];
  if (gg === null) failed.push("Grants.gov");
  if (nih === null) failed.push("NIH RePORTER");
  if (nsf === null) failed.push("NSF");
  return {
    open: (gg ?? []),
    awarded: [...(nih ?? []), ...(nsf ?? [])],
    failed,
  };
}

export async function grantProviderHealth() {
  const probe = async (name: string, fn: () => Promise<Opportunity[]>) => {
    const t = Date.now();
    try {
      await fn();
      return { name, status: "PUBLIC API", ms: Date.now() - t };
    } catch {
      return { name, status: "DOWN", ms: Date.now() - t };
    }
  };
  return Promise.all([
    probe("Grants.gov", () => grantsGov("health", 1)),
    probe("NIH RePORTER", () => nihReporter("health", 1)),
    probe("NSF", () => nsfAwards("health", 1)),
  ]);
}
