// Choosing WHICH of the journal to export.
//
// This module only ever decides what to *include*. It never touches the text
// itself — the scholar's words reach the Word document exactly as she typed
// them. Filtering is the one transformation permitted on the way out.

export type SelectionKind = "all" | "weeks" | "range" | "ytd" | "semester";

export type Selection = {
  kind: SelectionKind;
  /** Week numbers, when kind === "weeks". */
  weeks: number[];
  /** Inclusive ISO dates (YYYY-MM-DD), when the selection is date-based. */
  from: string | null;
  to: string | null;
};

export const MAX_WEEK = 15;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Read a selection off the query string. Anything unrecognised falls back to
 * the whole journal, because exporting too much is recoverable and exporting
 * too little silently loses work from a submission.
 */
export function parseSelection(sp: URLSearchParams): Selection {
  const base: Selection = { kind: "all", weeks: [], from: null, to: null };

  const weeksRaw = sp.get("weeks");
  if (weeksRaw) {
    const weeks = [...new Set(
      weeksRaw.split(",")
        .map((w) => Number(w.trim()))
        .filter((w) => Number.isInteger(w) && w >= 1 && w <= MAX_WEEK),
    )].sort((a, b) => a - b);
    if (weeks.length) return { ...base, kind: "weeks", weeks };
  }

  const scope = sp.get("scope");
  if (scope === "ytd") {
    return { ...base, kind: "ytd", from: `${new Date().getUTCFullYear()}-01-01`, to: null };
  }
  if (scope === "semester") {
    // Resolved against the earliest entry by the caller, which knows the data.
    return { ...base, kind: "semester" };
  }

  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (isIso(from) || isIso(to)) {
    const a = isIso(from) ? from : null;
    const b = isIso(to) ? to : null;
    // Tolerate a backwards range rather than returning an empty document.
    const [lo, hi] = a && b && a > b ? [b, a] : [a, b];
    return { ...base, kind: "range", from: lo, to: hi };
  }

  return base;
}

/** Resolve "semester" once the earliest entry date is known. */
export function resolveSemester(sel: Selection, earliestEntryDate: string | null): Selection {
  if (sel.kind !== "semester") return sel;
  return { ...sel, from: earliestEntryDate, to: iso(new Date()) };
}

/** Does this entry belong in the export? */
export function includesEntry(sel: Selection, entry: { week: number; entry_date: any }): boolean {
  if (sel.kind === "all") return true;
  if (sel.kind === "weeks") return sel.weeks.includes(entry.week);
  const d = typeof entry.entry_date === "string"
    ? entry.entry_date.slice(0, 10)
    : new Date(entry.entry_date).toISOString().slice(0, 10);
  if (sel.from && d < sel.from) return false;
  if (sel.to && d > sel.to) return false;
  return true;
}

/**
 * Does this week's synthesis belong in the export?
 *
 * A synthesis carries no entry date of its own, so for a date-based selection
 * it is included when the week contributed an entry, OR when the synthesis
 * itself was last written inside the range. Without the second rule, a week
 * she synthesised but never wrote daily entries for would vanish from a date
 * range — losing work from a submission, which is the one outcome worth
 * designing against.
 */
export function includesSynthesis(
  sel: Selection,
  syn: { week: number; updated_at?: any },
  weeksWithIncludedEntries: Set<number>,
): boolean {
  if (sel.kind === "all") return true;
  if (sel.kind === "weeks") return sel.weeks.includes(syn.week);
  if (weeksWithIncludedEntries.has(syn.week)) return true;
  if (!syn.updated_at) return false;
  const d = new Date(syn.updated_at).toISOString().slice(0, 10);
  if (sel.from && d < sel.from) return false;
  if (sel.to && d > sel.to) return false;
  return true;
}

const pretty = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** One line describing the selection, printed on the title page. */
export function describeSelection(sel: Selection): string {
  switch (sel.kind) {
    case "weeks":
      if (sel.weeks.length === 1) return `Week ${sel.weeks[0]}`;
      return `Weeks ${condenseWeeks(sel.weeks)}`;
    case "ytd":
      return `Year to date — since ${sel.from ? pretty(sel.from) : "the start of the year"}`;
    case "semester":
      return sel.from ? `Semester to date — since ${pretty(sel.from)}` : "Semester to date";
    case "range":
      if (sel.from && sel.to) return `${pretty(sel.from)} – ${pretty(sel.to)}`;
      if (sel.from) return `From ${pretty(sel.from)}`;
      if (sel.to) return `Through ${pretty(sel.to)}`;
      return "Complete journal";
    default:
      return "Complete journal";
  }
}

/** "1, 2, 3, 7" → "1–3, 7" */
export function condenseWeeks(weeks: number[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < weeks.length) {
    let j = i;
    while (j + 1 < weeks.length && weeks[j + 1] === weeks[j] + 1) j++;
    out.push(j > i + 1 ? `${weeks[i]}–${weeks[j]}` : weeks.slice(i, j + 1).join(", "));
    i = j + 1;
  }
  return out.join(", ");
}

/** Filename fragment, so downloads do not all collide in the Downloads folder. */
export function selectionSuffix(sel: Selection): string {
  switch (sel.kind) {
    case "weeks": return `week${sel.weeks.length > 1 ? "s" : ""}-${sel.weeks.join("-")}`;
    case "ytd": return "year-to-date";
    case "semester": return "semester-to-date";
    case "range": return [sel.from, sel.to].filter(Boolean).join("_to_") || "complete";
    default: return "complete";
  }
}
