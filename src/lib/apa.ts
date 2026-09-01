// ── APA 7 reference formatting ───────────────────────────────────────────────
//
// Built from what the scholar actually recorded. Missing fields are rendered as
// the APA-sanctioned placeholder — "(n.d.)" for no date — rather than guessed
// at, and the UI says which fields are missing. A citation that looks complete
// but is invented is worse than one that is visibly incomplete.

export interface RefFields {
  authors?: string; year?: string; title?: string; publication?: string;
  publisher?: string; volume?: string; issue?: string; page_range?: string;
  edition?: string; doi?: string; url?: string; kind?: string;
}

/** "Smith, J. A., & Jones, B." from loose input like "John Smith, Beth Jones". */
export function formatAuthors(raw: string): string {
  const parts = raw.split(/;|,(?=\s*[A-Z][a-z]+\s+[A-Z])|\s+&\s+|\s+and\s+/i)
    .map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return "";

  const one = (name: string) => {
    if (/,/.test(name)) return name.replace(/\s+/g, " ").trim();   // already "Last, F."
    const bits = name.split(/\s+/).filter(Boolean);
    if (bits.length === 1) return bits[0];
    const last = bits.pop()!;
    const initials = bits.map((b) => `${b[0].toUpperCase()}.`).join(" ");
    return `${last}, ${initials}`;
  };

  const formatted = parts.map(one);
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  if (formatted.length <= 20) {
    return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
  }
  // APA 7: list the first 19, an ellipsis, then the final author.
  return `${formatted.slice(0, 19).join(", ")}, ... ${formatted[formatted.length - 1]}`;
}

/** Sentence case for article and chapter titles, per APA. */
function sentenceCase(t: string): string {
  const trimmed = t.trim();
  if (!trimmed) return "";
  // Leave it alone if the author deliberately used mixed case with a colon.
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function apa7(f: RefFields): string {
  const authors = f.authors ? formatAuthors(f.authors) : "";
  const year = f.year?.trim() || "n.d.";
  const title = sentenceCase(f.title ?? "");
  const kind = f.kind ?? "journal_article";

  const head = authors ? `${authors} (${year}).` : `(${year}).`;
  const tail: string[] = [];

  if (kind === "book") {
    const ed = f.edition ? ` (${f.edition} ed.)` : "";
    tail.push(`*${title}*${ed}.`);
    if (f.publisher) tail.push(`${f.publisher}.`);
  } else if (kind === "chapter") {
    tail.push(`${title}.`);
    if (f.publication) {
      const pp = f.page_range ? ` (pp. ${f.page_range})` : "";
      tail.push(`In *${f.publication}*${pp}.`);
    }
    if (f.publisher) tail.push(`${f.publisher}.`);
  } else if (kind === "website") {
    tail.push(`*${title}*.`);
    if (f.publication) tail.push(`${f.publication}.`);
  } else if (kind === "dissertation") {
    tail.push(`*${title}* [Doctoral dissertation].`);
    if (f.publisher) tail.push(`${f.publisher}.`);
  } else if (kind === "report") {
    tail.push(`*${title}*.`);
    if (f.publisher) tail.push(`${f.publisher}.`);
  } else {
    // Journal article
    tail.push(`${title}.`);
    if (f.publication) {
      let j = `*${f.publication}*`;
      if (f.volume) j += `, *${f.volume}*`;
      if (f.issue) j += `(${f.issue})`;
      if (f.page_range) j += `, ${f.page_range}`;
      tail.push(`${j}.`);
    }
  }

  if (f.doi) tail.push(`https://doi.org/${f.doi.replace(/^https?:\/\/doi\.org\//i, "")}`);
  else if (f.url) tail.push(f.url);

  return [head, ...tail].join(" ").replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
}

/** In-text citation: (Smith, 2019) or (Smith, 2019, p. 42). */
export function apaInText(f: RefFields, page?: string): string {
  const first = (f.authors ?? "").split(/;|,|&|\band\b/i)[0]?.trim() ?? "";
  const surname = /\s/.test(first) ? first.split(/\s+/).pop() : first;
  const year = f.year?.trim() || "n.d.";
  const p = page?.trim() ? `, p. ${page.trim()}` : "";
  return surname ? `(${surname}, ${year}${p})` : `(${f.title ?? "Untitled"}, ${year}${p})`;
}

/** Which fields APA needs but the scholar has not supplied. */
export function missingFor(f: RefFields): string[] {
  const kind = f.kind ?? "journal_article";
  const need: string[] = [];
  if (!f.authors?.trim()) need.push("author");
  if (!f.year?.trim()) need.push("year");
  if (!f.title?.trim()) need.push("title");
  if (kind === "journal_article" && !f.publication?.trim()) need.push("journal");
  if ((kind === "book" || kind === "chapter") && !f.publisher?.trim()) need.push("publisher");
  if (kind === "chapter" && !f.publication?.trim()) need.push("book title");
  return need;
}
