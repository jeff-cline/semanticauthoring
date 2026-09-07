import "server-only";
import { cached } from "./cache";
import type { CanonicalWork } from "./scholarly";
import { searchEverywhere } from "./providers";

const CONTACT = process.env.CONTACT_EMAIL ?? "hello@semanticauthoring.org";
const UA = `SemanticAuthoring/1.0 (+https://semanticauthoring.org; mailto:${CONTACT})`;

async function getJson(url: string, ms = 15_000): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(ms), cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// ── Literature map ───────────────────────────────────────────────────────────
//
// Everything here is DERIVED AND STATED, never asserted. "Seminal" is not a
// judgement this platform is entitled to make, so highly-cited works are
// labelled by their citation count and the criterion is shown. A scholar can
// disagree with a count; they cannot argue with an unexplained verdict.

export interface LiteratureMap {
  query: string;
  mostCited: CanonicalWork[];
  recent: CanonicalWork[];
  reviews: CanonicalWork[];
  authors: { name: string; works: number; citations: number }[];
  venues: { name: string; works: number }[];
  byYear: { year: string; n: number }[];
  criteria: string[];
  retrieved: string;
}

export async function buildLiteratureMap(query: string): Promise<LiteratureMap> {
  return cached("litmap", `map:${query}`, 3600, async () => {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
      `&per-page=100&mailto=${encodeURIComponent(CONTACT)}`;
    const j = await getJson(url);
    const rows: any[] = j?.results ?? [];

    const toWork = (r: any): CanonicalWork => ({
      title: String(r.display_name ?? ""),
      authors: (r.authorships ?? []).slice(0, 6)
        .map((a: any) => String(a?.author?.display_name ?? "")).filter(Boolean),
      year: String(r.publication_year ?? ""),
      publication: String(r.primary_location?.source?.display_name ?? ""),
      publisher: "",
      doi: String(r.doi ?? "").replace(/^https?:\/\/doi\.org\//i, ""),
      url: String(r.doi ?? ""),
      openAccessUrl: String(r.best_oa_location?.pdf_url ?? ""),
      citationCount: typeof r.cited_by_count === "number" ? r.cited_by_count : null,
      type: String(r.type ?? ""),
      provider: "openalex", providerId: String(r.id ?? ""),
      retrievedAt: new Date().toISOString(),
      isRetracted: Boolean(r.is_retracted), updates: [],
    });

    const works = rows.map(toWork).filter((w) => w.title);

    const authorCount = new Map<string, { works: number; citations: number }>();
    for (const r of rows) {
      for (const a of r.authorships ?? []) {
        const n = String(a?.author?.display_name ?? "");
        if (!n) continue;
        const cur = authorCount.get(n) ?? { works: 0, citations: 0 };
        cur.works++; cur.citations += Number(r.cited_by_count ?? 0);
        authorCount.set(n, cur);
      }
    }

    const venueCount = new Map<string, number>();
    for (const r of rows) {
      const v = String(r.primary_location?.source?.display_name ?? "");
      if (v) venueCount.set(v, (venueCount.get(v) ?? 0) + 1);
    }

    const yearCount = new Map<string, number>();
    for (const w of works) if (w.year) yearCount.set(w.year, (yearCount.get(w.year) ?? 0) + 1);

    const isReview = (r: any) =>
      /review|meta-analys|systematic/i.test(String(r.display_name ?? "")) ||
      String(r.type ?? "") === "review";

    return {
      query,
      mostCited: [...works].sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
        .slice(0, 10),
      recent: [...works].sort((a, b) => Number(b.year || 0) - Number(a.year || 0)).slice(0, 10),
      reviews: rows.filter(isReview).map(toWork).slice(0, 10),
      authors: [...authorCount.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.works - a.works || b.citations - a.citations).slice(0, 12),
      venues: [...venueCount.entries()].map(([name, works]) => ({ name, works }))
        .sort((a, b) => b.works - a.works).slice(0, 10),
      byYear: [...yearCount.entries()].map(([year, n]) => ({ year, n }))
        .sort((a, b) => a.year.localeCompare(b.year)),
      criteria: [
        "Drawn from the top 100 OpenAlex matches for this query — a sample of the literature, not all of it.",
        "“Most cited” is ordered by OpenAlex citation count. It is not a claim about importance.",
        "“Reviews” matches titles containing review, systematic, or meta-analysis, plus works OpenAlex types as reviews.",
        "Author and venue counts are within this sample only.",
      ],
      retrieved: new Date().toISOString(),
    };
  });
}

// ── Journal discovery ────────────────────────────────────────────────────────

export interface Venue {
  name: string; publisher: string; issn: string; isOa: boolean | null;
  worksCount: number | null; id: string; url: string; matchedWorks: number;
}

/**
 * Suggest venues by looking at where work like this is actually published.
 *
 * NOTE: no impact factors, acceptance rates, or indexing claims. Those are
 * either proprietary or unverifiable from public data, and inventing them —
 * which the brief explicitly forbids — would be worse than omitting them.
 */
export async function findJournals(topic: string, limit = 15): Promise<Venue[]> {
  return cached("journals", `find:${topic}`, 3600, async () => {
    const j = await getJson(
      `https://api.openalex.org/works?search=${encodeURIComponent(topic)}` +
      `&per-page=200&mailto=${encodeURIComponent(CONTACT)}`);
    const rows: any[] = j?.results ?? [];

    const tally = new Map<string, { n: number; src: any }>();
    for (const r of rows) {
      const s = r.primary_location?.source;
      if (!s?.display_name) continue;
      const cur = tally.get(s.id ?? s.display_name) ?? { n: 0, src: s };
      cur.n++;
      tally.set(s.id ?? s.display_name, cur);
    }

    const top = [...tally.values()].sort((a, b) => b.n - a.n).slice(0, limit);

    // Enrich the leaders with source-level detail.
    return Promise.all(top.map(async (t): Promise<Venue> => {
      const id = String(t.src.id ?? "");
      let detail: any = null;
      if (id.includes("openalex.org/S")) {
        detail = await getJson(`${id}?mailto=${encodeURIComponent(CONTACT)}`);
      }
      return {
        name: String(t.src.display_name ?? ""),
        publisher: String(detail?.host_organization_name ?? t.src.host_organization_name ?? ""),
        issn: (detail?.issn ?? t.src.issn ?? [])[0] ?? "",
        isOa: typeof (detail?.is_oa ?? t.src.is_oa) === "boolean"
          ? (detail?.is_oa ?? t.src.is_oa) : null,
        worksCount: typeof detail?.works_count === "number" ? detail.works_count : null,
        id,
        url: String(detail?.homepage_url ?? ""),
        matchedWorks: t.n,
      };
    }));
  });
}

// ── Research gaps ────────────────────────────────────────────────────────────
//
// These are HYPOTHESES. Each is labelled "potential", carries the evidence that
// produced it, and says what would confirm it. A gap engine that asserts gaps
// would be inventing findings.

export interface Gap {
  kind: string;
  statement: string;
  evidence: string;
  confirmBy: string;
}

export async function findGaps(topic: string): Promise<{ gaps: Gap[]; sampleSize: number }> {
  const map = await buildLiteratureMap(topic);
  const gaps: Gap[] = [];

  const years = map.byYear;
  const recentYears = years.filter((y) => Number(y.year) >= new Date().getFullYear() - 5);
  const recentTotal = recentYears.reduce((s, y) => s + y.n, 0);
  const total = years.reduce((s, y) => s + y.n, 0);

  if (total > 0 && recentTotal / total < 0.2) {
    gaps.push({
      kind: "Temporal",
      statement: "Potential temporal gap — most work in this sample predates the last five years.",
      evidence: `${recentTotal} of ${total} sampled works are from the last five years.`,
      confirmBy: "Check whether the question has been settled, abandoned, or renamed. A renamed field looks identical to a dead one from citation counts alone.",
    });
  }

  if (map.reviews.length === 0 && total >= 20) {
    gaps.push({
      kind: "Synthesis",
      statement: "Potential synthesis gap — no review or meta-analysis surfaced in this sample.",
      evidence: `0 reviews among ${total} sampled works.`,
      confirmBy: "Search review-specific databases before concluding none exists; this sample only covers the top matches.",
    });
  }

  const dominant = map.authors[0];
  if (dominant && total > 0 && dominant.works / total > 0.25) {
    gaps.push({
      kind: "Concentration",
      statement: `Potential concentration — ${dominant.name} appears on a large share of this sample.`,
      evidence: `${dominant.works} of ${total} sampled works.`,
      confirmBy: "A field carried by one group may be under-replicated. Look for independent replications specifically.",
    });
  }

  if (map.venues.length > 0 && map.venues[0].works / Math.max(1, total) > 0.3) {
    gaps.push({
      kind: "Venue",
      statement: `Potential venue concentration — much of this sample sits in ${map.venues[0].name}.`,
      evidence: `${map.venues[0].works} of ${total} sampled works.`,
      confirmBy: "Consider whether the conversation is happening in adjacent fields under different vocabulary.",
    });
  }

  return { gaps, sampleSize: total };
}
