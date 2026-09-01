import "server-only";

// ── Syllabus parsing ─────────────────────────────────────────────────────────
//
// Deterministic extraction, not inference. This reads a syllabus and proposes
// readings, assignments, and dates; it never invents a book that is not on the
// page, and everything it finds is shown to the scholar for review before a
// single row is written. Anything it gets wrong is a wrong *suggestion*, not a
// wrong record — which is the only acceptable failure mode for material a
// doctorate depends on.

export interface Extracted {
  kind: "reading" | "assignment" | "discussion" | "note";
  title: string;
  author: string;
  pages: string;
  dueOn: string | null;   // ISO date
  detail: string;
  isBook: boolean;
  confidence: "high" | "medium" | "low";
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse the date forms that actually appear on syllabi. */
export function parseDate(raw: string, fallbackYear: number): string | null {
  const s = raw.trim();

  // Day-first is unambiguous, so try it before month-first: "12 March 2026".
  let m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:,?\s*(\d{4}))?/.exec(s);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) return iso(Number(m[3] ?? fallbackYear), mo, Number(m[1]));
  }
  // "March 12, 2026" / "Mar 12". The (?!\d) stops the day capturing the first
  // two digits of a bare year, which turned "March 2026" into March 20th.
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/.exec(s);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return iso(Number(m[3] ?? fallbackYear), mo, Number(m[2]));
  }
  // 3/12/2026 or 3-12-26
  m = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/.exec(s);
  if (m) {
    let y = m[3] ? Number(m[3]) : fallbackYear;
    if (y < 100) y += 2000;
    return iso(y, Number(m[1]), Number(m[2]));
  }
  // 2026-03-12
  m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const ASSIGNMENT_WORDS =
  /\b(assignment|paper|essay|exam|midterm|final|quiz|presentation|proposal|project|reflection|response|annotated bibliography)\b/i;
const DISCUSSION_WORDS = /\b(discussion|forum|post|respond to|peer response)\b/i;
const READING_WORDS = /\b(read|reading|chapter|ch\.|pp\.|pages?)\b/i;
const BOOK_SIGNALS =
  /\b(required text|required reading|textbook|isbn|press|publishing|publisher|\(\d{4}\)\.)\b/i;

const NOISE =
  /^(page \d+|syllabus|course|instructor|office hours?|email|phone|university|department|policy|policies|grading|attendance|academic integrity|disability|contents?|schedule)\b/i;

/** Pull a page range like "pp. 12-40" or "ch. 3" out of a line. */
function pages(line: string): string {
  const m = /\b(?:pp?\.|pages?)\s*([\divxlIVXL]+\s*[-–—]\s*[\divxlIVXL]+|\d+)/i.exec(line)
    ?? /\b(?:ch(?:apter|\.)?)\s*(\d+(?:\s*[-–—]\s*\d+)?)/i.exec(line);
  return m ? m[0].trim() : "";
}

/** APA-ish author heads: "Smith, J." or "Smith & Jones" or "Smith (2019)". */
function author(line: string): string {
  const m =
    /\b([A-Z][a-zA-Z’'\-]+(?:,\s*[A-Z]\.(?:\s*[A-Z]\.)?)?(?:\s*(?:&|and)\s*[A-Z][a-zA-Z’'\-]+(?:,\s*[A-Z]\.)?)*)\s*\(?(?:19|20)\d{2}\)?/
      .exec(line);
  return m ? m[1].trim().replace(/\s+/g, " ") : "";
}

function clean(line: string): string {
  return line
    .replace(/^\s*(?:[-–—•*·]|\d+[.)])\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Read a syllabus and propose course items.
 * Returns candidates in document order, each with a confidence the reviewer can weigh.
 */
export function parseSyllabus(text: string, fallbackYear = new Date().getFullYear()): {
  items: Extracted[];
  books: Extracted[];
  termStart: string | null;
  termEnd: string | null;
} {
  const lines = text.split("\n").map(clean).filter((l) => l.length > 3 && l.length < 400);
  const items: Extracted[] = [];
  const dates: string[] = [];

  // A "Required texts" heading turns the following lines into book candidates.
  let inBookBlock = false;

  for (const line of lines) {
    if (/^(required|recommended)\s+(texts?|readings?|books?|materials?)\b/i.test(line)) {
      inBookBlock = true;
      continue;
    }
    if (inBookBlock && /^(course schedule|schedule|weekly|week \d|grading|policies|assignments)\b/i.test(line)) {
      inBookBlock = false;
    }
    if (NOISE.test(line)) continue;

    const due = parseDate(line, fallbackYear);
    if (due) dates.push(due);

    const looksBook = inBookBlock || BOOK_SIGNALS.test(line);
    const isAssignment = ASSIGNMENT_WORDS.test(line);
    const isDiscussion = DISCUSSION_WORDS.test(line);
    const isReading = READING_WORDS.test(line) || looksBook;

    if (!due && !looksBook && !isAssignment && !isReading) continue;

    // Title: strip the date fragment and any page range so the title reads cleanly.
    let title = line;
    if (due) {
      title = title.replace(
        /\b([A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})\b/,
        "").trim();
    }
    const pg = pages(line);
    if (pg) title = title.replace(pg, "").trim();
    title = title.replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, "");
    if (title.length < 4) continue;

    const kind: Extracted["kind"] =
      isDiscussion ? "discussion" : isAssignment ? "assignment" : isReading ? "reading" : "note";

    const confidence: Extracted["confidence"] =
      due && (isAssignment || isReading) ? "high"
      : due || looksBook ? "medium"
      : "low";

    items.push({
      kind, title: title.slice(0, 300), author: author(line), pages: pg,
      dueOn: due, detail: line.slice(0, 500), isBook: looksBook, confidence,
    });
  }

  // De-duplicate: syllabi repeat readings between the schedule and the reading list.
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    const k = `${i.kind}|${i.title.toLowerCase().slice(0, 60)}|${i.dueOn ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  dates.sort();
  return {
    items: deduped.filter((i) => !i.isBook || i.dueOn),
    books: deduped.filter((i) => i.isBook && !i.dueOn),
    termStart: dates[0] ?? null,
    termEnd: dates[dates.length - 1] ?? null,
  };
}
