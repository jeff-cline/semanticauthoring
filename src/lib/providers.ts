import "server-only";
import { cached } from "./cache";
import type { CanonicalWork } from "./scholarly";
import { crossrefByDoi, openAlexByDoi, openAlexSearch, normalizeDoi } from "./scholarly";

// ── Additional read-only scholarly providers ─────────────────────────────────
//
// All public, none requiring a key. Every one is READ ONLY: none of these can be
// submitted to, and the platform never pretends otherwise.
//
// Semantic Scholar throttles anonymous callers hard (HTTP 429). It is included,
// but a rate-limited response is reported as RATE LIMITED rather than silently
// returning nothing, so an empty result is never mistaken for "no such paper".

const CONTACT = process.env.CONTACT_EMAIL ?? "hello@semanticauthoring.org";
const UA = `SemanticAuthoring/1.0 (+https://semanticauthoring.org; mailto:${CONTACT})`;

async function getJson(url: string, ms = 12_000): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(ms), cache: "no-store",
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function getText(url: string, ms = 12_000): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "user-agent": UA }, signal: AbortSignal.timeout(ms), cache: "no-store",
    });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

const blank = (over: Partial<CanonicalWork>): CanonicalWork => ({
  title: "", authors: [], year: "", publication: "", publisher: "", doi: "", url: "",
  openAccessUrl: "", citationCount: null, type: "", provider: "", providerId: "",
  retrievedAt: new Date().toISOString(), isRetracted: false, updates: [], ...over,
});

// ── PubMed ───────────────────────────────────────────────────────────────────
export async function pubmedSearch(term: string, limit = 10): Promise<CanonicalWork[]> {
  return cached("pubmed", `search:${term}:${limit}`, 3600, async () => {
    const s = await getJson(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed` +
      `&term=${encodeURIComponent(term)}&retmode=json&retmax=${limit}`);
    const ids: string[] = s?.esearchresult?.idlist ?? [];
    if (!ids.length) return [];
    const sum = await getJson(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed` +
      `&id=${ids.join(",")}&retmode=json`);
    const result = sum?.result ?? {};
    return ids.map((id) => {
      const r = result[id] ?? {};
      const doi = (r.articleids ?? []).find((a: any) => a.idtype === "doi")?.value ?? "";
      return blank({
        title: String(r.title ?? "").replace(/<[^>]+>/g, "").trim(),
        authors: (r.authors ?? []).map((a: any) => String(a.name ?? "")).filter(Boolean),
        year: String(r.pubdate ?? "").slice(0, 4),
        publication: String(r.fulljournalname ?? r.source ?? ""),
        doi: normalizeDoi(doi),
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        type: "journal-article", provider: "pubmed", providerId: id,
      });
    }).filter((w) => w.title);
  });
}

// ── Europe PMC ───────────────────────────────────────────────────────────────
export async function europePmcSearch(term: string, limit = 10): Promise<CanonicalWork[]> {
  return cached("europepmc", `search:${term}:${limit}`, 3600, async () => {
    const j = await getJson(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(term)}` +
      `&format=json&pageSize=${limit}`);
    return (j?.resultList?.result ?? []).map((r: any) => blank({
      title: String(r.title ?? "").trim(),
      authors: String(r.authorString ?? "").split(",").map((a: string) => a.trim()).filter(Boolean),
      year: String(r.pubYear ?? ""),
      publication: String(r.journalTitle ?? ""),
      doi: normalizeDoi(String(r.doi ?? "")),
      url: r.doi ? `https://doi.org/${r.doi}`
        : `https://europepmc.org/article/${r.source}/${r.id}`,
      citationCount: typeof r.citedByCount === "number" ? r.citedByCount : null,
      openAccessUrl: r.isOpenAccess === "Y" && r.pmcid
        ? `https://europepmc.org/article/PMC/${r.pmcid}` : "",
      type: String(r.pubType ?? ""), provider: "europepmc", providerId: String(r.id ?? ""),
    })).filter((w: CanonicalWork) => w.title);
  });
}

// ── arXiv (Atom XML, so parsed with regex rather than a DOM) ─────────────────
export async function arxivSearch(term: string, limit = 10): Promise<CanonicalWork[]> {
  return cached("arxiv", `search:${term}:${limit}`, 3600, async () => {
    const xml = await getText(
      `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(term)}` +
      `&max_results=${limit}`);
    if (!xml) return [];
    const entries = xml.split("<entry>").slice(1);
    return entries.map((e) => {
      const pick = (tag: string) =>
        (new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(e)?.[1] ?? "")
          .replace(/\s+/g, " ").trim();
      const id = pick("id");
      const authors = [...e.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1].trim());
      const doiMatch = /<arxiv:doi[^>]*>([^<]+)</.exec(e)?.[1] ?? "";
      return blank({
        title: pick("title"), authors, year: pick("published").slice(0, 4),
        publication: "arXiv preprint", doi: normalizeDoi(doiMatch),
        url: id, openAccessUrl: id.replace("/abs/", "/pdf/"),
        type: "preprint", provider: "arxiv", providerId: id.split("/abs/")[1] ?? id,
      });
    }).filter((w) => w.title);
  });
}

// ── DataCite (datasets, software, theses) ────────────────────────────────────
export async function dataciteSearch(term: string, limit = 10): Promise<CanonicalWork[]> {
  return cached("datacite", `search:${term}:${limit}`, 3600, async () => {
    const j = await getJson(
      `https://api.datacite.org/dois?query=${encodeURIComponent(term)}&page[size]=${limit}`);
    return (j?.data ?? []).map((d: any) => {
      const a = d.attributes ?? {};
      return blank({
        title: String(a.titles?.[0]?.title ?? "").trim(),
        authors: (a.creators ?? []).map((c: any) => String(c.name ?? "")).filter(Boolean),
        year: String(a.publicationYear ?? ""),
        publisher: String(a.publisher ?? ""),
        doi: normalizeDoi(String(a.doi ?? "")),
        url: String(a.url ?? `https://doi.org/${a.doi}`),
        citationCount: typeof a.citationCount === "number" ? a.citationCount : null,
        type: String(a.types?.resourceTypeGeneral ?? ""),
        provider: "datacite", providerId: String(a.doi ?? ""),
      });
    }).filter((w: CanonicalWork) => w.title);
  });
}

// ── ROR (institution normalisation) ──────────────────────────────────────────
export async function rorSearch(name: string, limit = 8) {
  return cached("ror", `search:${name}`, 86_400, async () => {
    const j = await getJson(`https://api.ror.org/organizations?query=${encodeURIComponent(name)}`);
    return (j?.items ?? []).slice(0, limit).map((o: any) => ({
      id: String(o.id ?? ""), name: String(o.name ?? ""),
      country: String(o.country?.country_name ?? ""),
      types: (o.types ?? []).join(", "),
      links: (o.links ?? [])[0] ?? "",
    }));
  });
}

// ── OpenCitations ────────────────────────────────────────────────────────────
export async function citationCount(doi: string): Promise<number | null> {
  const d = normalizeDoi(doi);
  if (!d) return null;
  return cached("opencitations", `count:${d}`, 21_600, async () => {
    const j = await getJson(
      `https://api.opencitations.net/index/v2/citation-count/doi:${encodeURIComponent(d)}`);
    const n = Number(j?.[0]?.count);
    return Number.isFinite(n) ? n : null;
  });
}

// ── Semantic Scholar (throttled without a key) ───────────────────────────────
export async function semanticScholarSearch(
  term: string, limit = 10,
): Promise<{ works: CanonicalWork[]; rateLimited: boolean }> {
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY;
  try {
    const r = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(term)}` +
      `&limit=${limit}&fields=title,year,authors,venue,externalIds,citationCount,openAccessPdf`,
      {
        headers: { accept: "application/json", "user-agent": UA,
                   ...(key ? { "x-api-key": key } : {}) },
        signal: AbortSignal.timeout(12_000),
      });
    if (r.status === 429) return { works: [], rateLimited: true };
    if (!r.ok) return { works: [], rateLimited: false };
    const j = await r.json();
    return {
      works: (j?.data ?? []).map((p: any) => blank({
        title: String(p.title ?? "").trim(),
        authors: (p.authors ?? []).map((a: any) => String(a.name ?? "")).filter(Boolean),
        year: String(p.year ?? ""), publication: String(p.venue ?? ""),
        doi: normalizeDoi(String(p.externalIds?.DOI ?? "")),
        url: p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : "",
        openAccessUrl: String(p.openAccessPdf?.url ?? ""),
        citationCount: typeof p.citationCount === "number" ? p.citationCount : null,
        provider: "semanticscholar", providerId: String(p.paperId ?? ""),
      })).filter((w: CanonicalWork) => w.title),
      rateLimited: false,
    };
  } catch {
    return { works: [], rateLimited: false };
  }
}

// ── search_everywhere ────────────────────────────────────────────────────────

const dedupeKey = (w: CanonicalWork) =>
  w.doi ? `doi:${w.doi.toLowerCase()}`
    : `t:${w.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70)}|${w.year}`;

export interface EverywhereResult {
  works: (CanonicalWork & { sources: string[] })[];
  providersQueried: string[];
  notes: string[];
}

/**
 * Query every index concurrently and merge. Duplicates across providers are
 * collapsed by DOI first, then by normalised title and year — a paper indexed
 * five times is one paper, and showing it five times would misrepresent the
 * literature.
 */
export async function searchEverywhere(term: string, limit = 10): Promise<EverywhereResult> {
  if (!term.trim()) return { works: [], providersQueried: [], notes: [] };

  const [oa, pm, epmc, ax, dc, ss] = await Promise.all([
    openAlexSearch(term, limit).catch(() => []),
    pubmedSearch(term, limit).catch(() => []),
    europePmcSearch(term, limit).catch(() => []),
    arxivSearch(term, limit).catch(() => []),
    dataciteSearch(term, limit).catch(() => []),
    semanticScholarSearch(term, limit).catch(() => ({ works: [], rateLimited: false })),
  ]);

  const notes: string[] = [];
  if (ss.rateLimited) {
    notes.push("Semantic Scholar rate-limited this request; its results are missing rather than empty.");
  }

  const merged = new Map<string, CanonicalWork & { sources: string[] }>();
  const add = (list: CanonicalWork[]) => {
    for (const w of list) {
      if (!w.title) continue;
      const k = dedupeKey(w);
      const existing = merged.get(k);
      if (!existing) {
        merged.set(k, { ...w, sources: [w.provider] });
      } else {
        if (!existing.sources.includes(w.provider)) existing.sources.push(w.provider);
        // Prefer the record that actually has the field.
        existing.doi ||= w.doi;
        existing.publication ||= w.publication;
        existing.openAccessUrl ||= w.openAccessUrl;
        existing.url ||= w.url;
        if (existing.citationCount == null && w.citationCount != null) {
          existing.citationCount = w.citationCount;
        }
        existing.isRetracted = existing.isRetracted || w.isRetracted;
      }
    }
  };

  add(oa); add(pm); add(epmc); add(ax); add(dc); add(ss.works);

  const works = [...merged.values()].sort((a, b) => {
    if (b.sources.length !== a.sources.length) return b.sources.length - a.sources.length;
    return (b.citationCount ?? 0) - (a.citationCount ?? 0);
  });

  return {
    works,
    providersQueried: ["openalex", "pubmed", "europepmc", "arxiv", "datacite",
                       ...(ss.rateLimited ? [] : ["semanticscholar"])],
    notes,
  };
}

export async function allProviderHealth() {
  const probe = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      const r = await fn();
      const empty = Array.isArray(r) && r.length === 0;
      return { name, status: empty ? "REACHABLE" : "PUBLIC API", ms: Date.now() - t };
    } catch { return { name, status: "DOWN", ms: Date.now() - t }; }
  };
  const ss = await semanticScholarSearch("test", 1).catch(() => ({ works: [], rateLimited: true }));
  return [
    ...(await Promise.all([
      probe("OpenAlex", () => openAlexSearch("test", 1)),
      probe("PubMed", () => pubmedSearch("test", 1)),
      probe("Europe PMC", () => europePmcSearch("test", 1)),
      probe("arXiv", () => arxivSearch("test", 1)),
      probe("DataCite", () => dataciteSearch("test", 1)),
      probe("ROR", () => rorSearch("stanford", 1)),
      probe("OpenCitations", () => citationCount("10.1038/nature12373")),
    ])),
    { name: "Semantic Scholar", status: ss.rateLimited ? "RATE LIMITED" : "PUBLIC API", ms: 0 },
  ];
}
