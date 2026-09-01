import "server-only";

// ── Scholarly provider adapters ──────────────────────────────────────────────
//
// A narrow, honest interface over public scholarly indexes. These are READ-ONLY
// services: Crossref, OpenAlex, and Unpaywall can be queried but never
// submitted to. Nothing here fabricates data — if a record can't be found or a
// field isn't present, that is reported as NOT_FOUND or left empty rather than
// guessed. Never invent a DOI, a title, an author, or a year.
//
// Crossref and Unpaywall ask for a contact email (the "polite pool"), which
// gets better rate limits and is the courteous thing to do.

const CONTACT = process.env.CONTACT_EMAIL ?? "hello@semanticauthoring.org";
const UA = `SemanticAuthoring/1.0 (+https://semanticauthoring.org; mailto:${CONTACT})`;

export interface CanonicalWork {
  title: string;
  authors: string[];
  year: string;
  publication: string;
  publisher: string;
  doi: string;
  url: string;
  openAccessUrl: string;
  citationCount: number | null;
  type: string;
  provider: string;
  providerId: string;
  retrievedAt: string;
  isRetracted: boolean;
  updates: string[];     // corrections, expressions of concern, retractions
}

export type CheckStatus =
  | "VERIFIED_METADATA" | "NOT_FOUND" | "MISMATCH" | "RETRACTED"
  | "CORRECTED" | "EXPRESSION_OF_CONCERN" | "UNVERIFIED" | "ERROR";

async function getJson(url: string, timeoutMs = 10_000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const normalizeDoi = (raw: string): string =>
  raw.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:/i, "").trim();

// ── Crossref ─────────────────────────────────────────────────────────────────
export async function crossrefByDoi(doiRaw: string): Promise<CanonicalWork | null> {
  const doi = normalizeDoi(doiRaw);
  if (!doi) return null;
  const j = await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CONTACT)}`);
  const m = j?.message;
  if (!m) return null;

  const updates: string[] = (m["update-to"] ?? [])
    .map((u: any) => String(u?.type ?? "")).filter(Boolean);

  return {
    title: Array.isArray(m.title) ? (m.title[0] ?? "") : String(m.title ?? ""),
    authors: (m.author ?? []).map((a: any) =>
      [a.given, a.family].filter(Boolean).join(" ") || a.name || "").filter(Boolean),
    year: String(m.issued?.["date-parts"]?.[0]?.[0] ?? ""),
    publication: Array.isArray(m["container-title"]) ? (m["container-title"][0] ?? "") : "",
    publisher: String(m.publisher ?? ""),
    doi: String(m.DOI ?? doi),
    url: String(m.URL ?? `https://doi.org/${doi}`),
    openAccessUrl: "",
    citationCount: typeof m["is-referenced-by-count"] === "number" ? m["is-referenced-by-count"] : null,
    type: String(m.type ?? ""),
    provider: "crossref",
    providerId: String(m.DOI ?? doi),
    retrievedAt: new Date().toISOString(),
    isRetracted: updates.some((u) => /retract/i.test(u)),
    updates,
  };
}

// ── OpenAlex ─────────────────────────────────────────────────────────────────
export async function openAlexByDoi(doiRaw: string): Promise<CanonicalWork | null> {
  const doi = normalizeDoi(doiRaw);
  if (!doi) return null;
  const j = await getJson(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CONTACT)}`);
  if (!j?.id) return null;
  return {
    title: String(j.display_name ?? ""),
    authors: (j.authorships ?? []).map((a: any) => String(a?.author?.display_name ?? "")).filter(Boolean),
    year: String(j.publication_year ?? ""),
    publication: String(j.primary_location?.source?.display_name ?? ""),
    publisher: String(j.primary_location?.source?.host_organization_name ?? ""),
    doi,
    url: String(j.doi ?? `https://doi.org/${doi}`),
    openAccessUrl: String(j.best_oa_location?.pdf_url ?? j.open_access?.oa_url ?? ""),
    citationCount: typeof j.cited_by_count === "number" ? j.cited_by_count : null,
    type: String(j.type ?? ""),
    provider: "openalex",
    providerId: String(j.id ?? ""),
    retrievedAt: new Date().toISOString(),
    isRetracted: Boolean(j.is_retracted),
    updates: j.is_retracted ? ["retraction"] : [],
  };
}

export async function openAlexSearch(query: string, limit = 8): Promise<CanonicalWork[]> {
  if (!query.trim()) return [];
  const j = await getJson(
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&mailto=${encodeURIComponent(CONTACT)}`);
  return (j?.results ?? []).map((r: any) => ({
    title: String(r.display_name ?? ""),
    authors: (r.authorships ?? []).map((a: any) => String(a?.author?.display_name ?? "")).filter(Boolean),
    year: String(r.publication_year ?? ""),
    publication: String(r.primary_location?.source?.display_name ?? ""),
    publisher: "",
    doi: normalizeDoi(String(r.doi ?? "")),
    url: String(r.doi ?? ""),
    openAccessUrl: String(r.best_oa_location?.pdf_url ?? ""),
    citationCount: typeof r.cited_by_count === "number" ? r.cited_by_count : null,
    type: String(r.type ?? ""),
    provider: "openalex",
    providerId: String(r.id ?? ""),
    retrievedAt: new Date().toISOString(),
    isRetracted: Boolean(r.is_retracted),
    updates: [],
  }));
}

// ── Unpaywall (legitimate open-access copies only; never bypasses paywalls) ──
export async function unpaywall(doiRaw: string): Promise<string> {
  const doi = normalizeDoi(doiRaw);
  if (!doi) return "";
  const j = await getJson(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(CONTACT)}`);
  return String(j?.best_oa_location?.url_for_pdf ?? j?.best_oa_location?.url ?? "");
}

// ── Verification ─────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface CheckResult {
  status: CheckStatus;
  provider: string;
  detail: string;
  work: CanonicalWork | null;
}

/**
 * Check a stored source's metadata against authoritative indexes.
 *
 * Deliberately conservative: it reports what the index says and where the
 * stored record disagrees. It does NOT claim a paper supports a claim — that
 * is a judgement only the scholar can make, and asserting it from metadata
 * would be exactly the fabrication this platform exists to prevent.
 */
export async function verifySource(src: { title?: string; year?: string; doi?: string }): Promise<CheckResult> {
  const doi = normalizeDoi(src.doi ?? "");
  if (!doi) {
    return { status: "UNVERIFIED", provider: "", work: null,
             detail: "No DOI recorded, so there is nothing authoritative to check against." };
  }

  const [cr, oa] = await Promise.all([crossrefByDoi(doi), openAlexByDoi(doi)]);
  const work = cr ?? oa;

  if (!work) {
    return { status: "NOT_FOUND", provider: "crossref,openalex", work: null,
             detail: `DOI ${doi} did not resolve at Crossref or OpenAlex. It may be mistyped, very new, or not a registered DOI.` };
  }

  if (work.isRetracted || oa?.isRetracted) {
    return { status: "RETRACTED", provider: work.provider, work,
             detail: "This work is flagged as RETRACTED. Do not cite it as current evidence." };
  }
  if (work.updates.some((u) => /concern/i.test(u))) {
    return { status: "EXPRESSION_OF_CONCERN", provider: work.provider, work,
             detail: "An expression of concern has been issued for this work." };
  }
  if (work.updates.some((u) => /correct|erratum/i.test(u))) {
    return { status: "CORRECTED", provider: work.provider, work,
             detail: "A correction or erratum has been published for this work." };
  }

  const problems: string[] = [];
  if (src.title && work.title) {
    const a = norm(src.title), b = norm(work.title);
    if (!a.includes(b.slice(0, 30)) && !b.includes(a.slice(0, 30))) {
      problems.push(`title differs — the index has "${work.title}"`);
    }
  }
  if (src.year && work.year && src.year.trim() !== work.year) {
    problems.push(`year differs — the index has ${work.year}`);
  }

  if (problems.length) {
    return { status: "MISMATCH", provider: work.provider, work,
             detail: `Your record and the registry disagree: ${problems.join("; ")}.` };
  }

  return {
    status: "VERIFIED_METADATA", provider: work.provider, work,
    detail: `Metadata matches ${work.provider}. This confirms the work exists and your citation details are right — it does not confirm what the paper says.`,
  };
}

/** Live health of each read-only provider. */
export async function providerHealth() {
  const probe = async (name: string, url: string) => {
    const started = Date.now();
    const ok = (await getJson(url, 6000)) !== null;
    return { name, status: ok ? "PUBLIC API" : "DOWN", ms: Date.now() - started };
  };
  return Promise.all([
    probe("Crossref", `https://api.crossref.org/works/10.1038/nature12373?mailto=${encodeURIComponent(CONTACT)}`),
    probe("OpenAlex", `https://api.openalex.org/works?per-page=1&mailto=${encodeURIComponent(CONTACT)}`),
    probe("Unpaywall", `https://api.unpaywall.org/v2/10.1038/nature12373?email=${encodeURIComponent(CONTACT)}`),
  ]);
}
