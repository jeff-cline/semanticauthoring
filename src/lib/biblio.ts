import "server-only";

// ── Bibliographic import and export ──────────────────────────────────────────
//
// Parsers are strict about what they claim. A field that is not present in the
// input is left empty rather than inferred, and an entry that cannot be parsed
// is reported as a failure rather than imported half-formed. Silently importing
// a mangled citation is how a bibliography ends up wrong.

export interface Ref {
  title: string;
  authors: string;
  year: string;
  publication: string;
  publisher: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  url: string;
  kind: string;
  tags: string;
  abstract: string;
}

export const emptyRef = (): Ref => ({
  title: "", authors: "", year: "", publication: "", publisher: "", volume: "", issue: "",
  pages: "", doi: "", url: "", kind: "article", tags: "", abstract: "",
});

const TYPE_FROM_BIBTEX: Record<string, string> = {
  article: "article", book: "book", inbook: "chapter", incollection: "chapter",
  inproceedings: "article", conference: "article", phdthesis: "report",
  mastersthesis: "report", techreport: "report", misc: "note", online: "website",
};

/** BibTeX. Handles nested braces and quoted values. */
export function parseBibtex(input: string): { refs: Ref[]; failed: number } {
  const refs: Ref[] = [];
  let failed = 0;

  const entries = input.split(/(?=@\w+\s*\{)/g).filter((e) => /^@\w+\s*\{/.test(e.trim()));
  for (const raw of entries) {
    const typeMatch = /^@(\w+)\s*\{/.exec(raw.trim());
    if (!typeMatch) { failed++; continue; }
    const type = typeMatch[1].toLowerCase();

    const body = raw.slice(raw.indexOf("{") + 1);
    const ref = emptyRef();
    ref.kind = TYPE_FROM_BIBTEX[type] ?? "article";

    // field = {value} | "value" | bareword
    const fieldRe = /(\w+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[^,}\s]+)/g;
    let m: RegExpExecArray | null;
    let found = 0;
    while ((m = fieldRe.exec(body))) {
      const key = m[1].toLowerCase();
      let val = m[2].trim();
      if (val.startsWith("{") && val.endsWith("}")) val = val.slice(1, -1);
      else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      val = val.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
      if (!val) continue;
      found++;
      switch (key) {
        case "title": ref.title = val; break;
        case "author": ref.authors = val.replace(/\s+and\s+/gi, ", "); break;
        case "year": ref.year = val; break;
        case "journal": case "booktitle": ref.publication = val; break;
        case "publisher": case "school": case "institution": ref.publisher = val; break;
        case "volume": ref.volume = val; break;
        case "number": ref.issue = val; break;
        case "pages": ref.pages = val.replace(/--/g, "-"); break;
        case "doi": ref.doi = val.replace(/^https?:\/\/doi\.org\//i, ""); break;
        case "url": ref.url = val; break;
        case "keywords": ref.tags = val; break;
        case "abstract": ref.abstract = val; break;
      }
    }
    if (!ref.title || found === 0) { failed++; continue; }
    refs.push(ref);
  }
  return { refs, failed };
}

const RIS_TYPE: Record<string, string> = {
  JOUR: "article", BOOK: "book", CHAP: "chapter", CONF: "article", THES: "report",
  RPRT: "report", ELEC: "website", GEN: "note",
};

/** RIS. Tag-per-line format used by EndNote, Zotero, and most databases. */
export function parseRis(input: string): { refs: Ref[]; failed: number } {
  const refs: Ref[] = [];
  let failed = 0;
  const blocks = input.split(/^ER\s+-.*$/m).map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const ref = emptyRef();
    const authors: string[] = [];
    let sawTag = false;
    let lastTag = "";

    for (const line of block.split(/\r?\n/)) {
      const m = /^([A-Z][A-Z0-9])\s+-\s?(.*)$/.exec(line);
      if (!m) {
        // Continuation of the previous field.
        if (lastTag === "AB" && line.trim()) ref.abstract += " " + line.trim();
        continue;
      }
      sawTag = true;
      const [, tag, valRaw] = m;
      const val = valRaw.trim();
      lastTag = tag;
      if (!val) continue;
      switch (tag) {
        case "TY": ref.kind = RIS_TYPE[val.toUpperCase()] ?? "article"; break;
        case "TI": case "T1": ref.title ||= val; break;
        case "AU": case "A1": authors.push(val); break;
        case "PY": case "Y1": ref.year ||= (val.match(/\d{4}/)?.[0] ?? val); break;
        case "JO": case "JF": case "T2": ref.publication ||= val; break;
        case "PB": ref.publisher ||= val; break;
        case "VL": ref.volume ||= val; break;
        case "IS": ref.issue ||= val; break;
        case "SP": ref.pages = ref.pages ? `${val}-${ref.pages}` : val; break;
        case "EP": ref.pages = ref.pages ? `${ref.pages}-${val}` : val; break;
        case "DO": ref.doi ||= val.replace(/^https?:\/\/doi\.org\//i, ""); break;
        case "UR": ref.url ||= val; break;
        case "KW": ref.tags = ref.tags ? `${ref.tags}, ${val}` : val; break;
        case "AB": case "N2": ref.abstract ||= val; break;
      }
    }
    if (authors.length) ref.authors = authors.join(", ");
    if (!sawTag) continue;
    if (!ref.title) { failed++; continue; }
    refs.push(ref);
  }
  return { refs, failed };
}

/** CSL JSON, as exported by Zotero and produced by Crossref. */
export function parseCslJson(input: string): { refs: Ref[]; failed: number } {
  let data: any;
  try { data = JSON.parse(input); } catch { return { refs: [], failed: 1 }; }
  const items = Array.isArray(data) ? data : [data];
  const refs: Ref[] = [];
  let failed = 0;

  for (const it of items) {
    const ref = emptyRef();
    ref.title = String(it.title ?? "").trim();
    if (!ref.title) { failed++; continue; }
    ref.authors = (it.author ?? [])
      .map((a: any) => a.literal ?? [a.family, a.given].filter(Boolean).join(", "))
      .filter(Boolean).join("; ");
    ref.year = String(
      it.issued?.["date-parts"]?.[0]?.[0] ?? it.issued?.literal ?? "").slice(0, 4);
    ref.publication = String(it["container-title"] ?? "");
    ref.publisher = String(it.publisher ?? "");
    ref.volume = String(it.volume ?? "");
    ref.issue = String(it.issue ?? "");
    ref.pages = String(it.page ?? "");
    ref.doi = String(it.DOI ?? "").replace(/^https?:\/\/doi\.org\//i, "");
    ref.url = String(it.URL ?? "");
    ref.abstract = String(it.abstract ?? "");
    ref.kind = it.type === "book" ? "book"
      : it.type === "chapter" || it.type === "chapter-book" ? "chapter"
      : it.type === "webpage" ? "website"
      : it.type === "report" || it.type === "thesis" ? "report" : "article";
    refs.push(ref);
  }
  return { refs, failed };
}

/** Detect the format so the scholar does not have to say which it is. */
export function detectFormat(input: string): "bibtex" | "ris" | "csl" | "unknown" {
  const t = input.trim();
  if (/^@\w+\s*\{/m.test(t)) return "bibtex";
  if (/^TY\s+-\s/m.test(t)) return "ris";
  if (t.startsWith("[") || t.startsWith("{")) return "csl";
  return "unknown";
}

export function parseAny(input: string): { refs: Ref[]; failed: number; format: string } {
  const format = detectFormat(input);
  const r = format === "bibtex" ? parseBibtex(input)
    : format === "ris" ? parseRis(input)
    : format === "csl" ? parseCslJson(input)
    : { refs: [], failed: 0 };
  return { ...r, format };
}

// ── Export ───────────────────────────────────────────────────────────────────

const esc = (s: unknown) => String(s ?? "").replace(/[{}]/g, "").replace(/\\/g, "");

export function toRis(rows: any[]): string {
  const TY: Record<string, string> = {
    article: "JOUR", book: "BOOK", chapter: "CHAP", website: "ELEC",
    report: "RPRT", note: "GEN", lecture: "GEN", video: "GEN", podcast: "GEN",
    course_doc: "GEN",
  };
  return rows.map((s) => {
    const lines = [`TY  - ${TY[s.kind] ?? "GEN"}`];
    for (const a of String(s.authors ?? "").split(/[;,]\s*(?=[A-Z])/).filter(Boolean)) {
      lines.push(`AU  - ${a.trim()}`);
    }
    if (s.title) lines.push(`TI  - ${s.title}`);
    if (s.year) lines.push(`PY  - ${s.year}`);
    if (s.publication) lines.push(`JO  - ${s.publication}`);
    if (s.doi) lines.push(`DO  - ${s.doi}`);
    if (s.url) lines.push(`UR  - ${s.url}`);
    if (s.tags) lines.push(...String(s.tags).split(",").map((k: string) => `KW  - ${k.trim()}`));
    if (s.notes) lines.push(`N1  - ${String(s.notes).replace(/\r?\n/g, " ")}`);
    lines.push("ER  - ", "");
    return lines.join("\n");
  }).join("\n");
}

export function toCslJson(rows: any[]): string {
  return JSON.stringify(rows.map((s, i) => {
    const authors = String(s.authors ?? "").split(/[;,]\s*(?=[A-Z])/).filter(Boolean)
      .map((a: string) => {
        const parts = a.trim().split(/\s+/);
        return parts.length > 1
          ? { family: parts.pop(), given: parts.join(" ") }
          : { literal: a.trim() };
      });
    return {
      id: `sa-${s.id ?? i}`,
      type: s.kind === "book" ? "book" : s.kind === "chapter" ? "chapter"
        : s.kind === "website" ? "webpage" : "article-journal",
      title: s.title ?? "",
      author: authors.length ? authors : undefined,
      issued: s.year ? { "date-parts": [[Number(s.year)]] } : undefined,
      "container-title": s.publication || undefined,
      publisher: s.publisher || undefined,
      DOI: s.doi || undefined,
      URL: s.url || undefined,
      keyword: s.tags || undefined,
    };
  }), null, 2);
}
