import { NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
} from "docx";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { STATES } from "@/lib/prompts";
import { parseSelection, describeSelection, selectionSuffix } from "@/lib/inquiry-export";
import { recordExport, DOCX_MIME } from "@/lib/saved-exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The daily scholar journal as a Word document.
//
// Same rule as the inquiry journal: her words and her dates are reproduced
// exactly. The only thing decided here is which days to include.

const prompt = (text: string) =>
  new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text, italics: true, color: "61708A", size: 20 })],
  });

const answer = (text: string) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: text || "—", size: 22 })],
  });

const STATE_LABEL: Record<string, string> = {
  energy: "Energy", focus: "Focus", stress: "Stress",
  curiosity: "Curiosity", confidence: "Confidence", capacity: "Capacity",
};

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = new URL(req.url).searchParams;
  const selection = parseSelection(sp);

  const [settings, rows] = await Promise.all([
    one<any>(`SELECT * FROM inquiry_settings WHERE owner_id=$1`, [user.id]),
    q<any>(`SELECT * FROM journal_entries WHERE owner_id=$1 ORDER BY entry_date`, [user.id]),
  ]);

  // "Semester to date" means from the first day she wrote, resolved here
  // because only this route knows the data.
  const earliest = rows.length
    ? String(rows[0].entry_date).slice(0, 10)
    : null;
  const sel = selection.kind === "semester"
    ? { ...selection, from: earliest, to: new Date().toISOString().slice(0, 10) }
    : selection;

  const entries = rows.filter((r: any) => {
    if (sel.kind === "all" || sel.kind === "weeks") return true; // weeks are not a journal concept
    const d = String(r.entry_date).slice(0, 10);
    if (sel.from && d < sel.from) return false;
    if (sel.to && d > sel.to) return false;
    return true;
  });

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 200 },
      children: [new TextRun({ text: "Daily Scholar Journal", bold: true, size: 44 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
      children: [new TextRun({
        text: settings?.scholar_name || user.name || user.email, size: 28,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 320 },
      children: [new TextRun({
        text: sel.kind === "weeks" ? "Complete journal" : describeSelection(sel),
        size: 22, italics: true, color: "61708A",
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  for (const e of entries) {
    const d = new Date(`${String(e.entry_date).slice(0, 10)}T00:00:00Z`)
      .toLocaleDateString("en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: d, bold: true, size: 30 })],
    }));

    // The prompt she actually answered is stored alongside the answer, because
    // prompts rotate daily — showing today's prompt over an old answer would
    // misrepresent what she was asked.
    if (e.intellectual) {
      children.push(prompt(e.intellectual_prompt || "Intellectual"), answer(e.intellectual));
    }
    if (e.somatic) {
      children.push(prompt(e.somatic_prompt || "Somatic"), answer(e.somatic));
    }
    if (e.intention) children.push(prompt("Intention for today"), answer(e.intention));
    if (e.reflection) children.push(prompt("Reflection"), answer(e.reflection));

    const scored = STATES.filter((s) => e[s] != null);
    if (scored.length) {
      children.push(new Paragraph({
        spacing: { before: 160, after: 120 },
        children: [new TextRun({
          text: scored.map((s) => `${STATE_LABEL[s]} ${e[s]}/5`).join("   ·   "),
          size: 20, color: "61708A",
        })],
      }));
    }
  }

  if (entries.length === 0) {
    children.push(answer(rows.length === 0
      ? "No daily journal entries have been written yet."
      : "Nothing was written in the range selected for this export."));
  }

  const doc = new Document({
    creator: settings?.scholar_name || user.name || "Semantic Authoring",
    title: "Daily Scholar Journal",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [{ properties: {}, children }],
  });

  const buf = await Packer.toBuffer(doc);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `daily-scholar-journal-${selectionSuffix(sel)}-${stamp}.docx`;

  await recordExport({
    ownerId: user.id, kind: "journal", title: "Daily Scholar Journal",
    scope: sel.kind === "weeks" ? "Complete journal" : describeSelection(sel),
    filename: name, content: buf,
  }).catch(() => {});   // never fail the download because the archive write failed

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": DOCX_MIME,
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
