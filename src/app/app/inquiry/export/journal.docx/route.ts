import { NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
} from "docx";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { ARRIVE, REQUIRED, CONNECTION, SYNTHESIS } from "@/lib/inquiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The semester journal as a Word document.
//
// The scholar's own language and dates are reproduced verbatim. Nothing is
// rewritten, summarised, or "improved" on the way out — this is submitted work,
// and altering it during export would be altering their submission.

const P = (text: string, opts: any = {}) =>
  new Paragraph({ children: [new TextRun({ text, ...opts.run })], ...opts.para });

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

export async function GET() {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [settings, weeks, entries, syntheses] = await Promise.all([
    one<any>(`SELECT * FROM inquiry_settings WHERE owner_id=$1`, [user.id]),
    q<any>(`SELECT * FROM inquiry_weeks WHERE owner_id=$1 ORDER BY week`, [user.id]),
    q<any>(`SELECT * FROM inquiry_entries WHERE owner_id=$1 ORDER BY week, entry_date, id`,
      [user.id]),
    q<any>(`SELECT * FROM inquiry_synthesis WHERE owner_id=$1`, [user.id]),
  ]);

  const synthByWeek = new Map(syntheses.map((s: any) => [s.week, s]));
  const children: Paragraph[] = [];

  // ── Title page ──
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 200 },
      children: [new TextRun({ text: "Embodied Inquiry Journal", bold: true, size: 44 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 120 },
      children: [new TextRun({ text: settings?.scholar_name || user.name || user.email, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 60 },
      children: [new TextRun({
        text: `${settings?.course_title ?? ""} — ${settings?.course_code ?? ""}`.trim(),
        size: 24,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: settings?.term ?? "", size: 24 })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  for (const w of weeks) {
    const weekEntries = entries.filter((e: any) => e.week === w.week);
    const syn = synthByWeek.get(w.week);
    if (weekEntries.length === 0 && !syn) continue;   // omit weeks with nothing written

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 },
      children: [new TextRun({
        text: `Week ${w.week}${w.theme ? ` — ${w.theme}` : ""}`, bold: true, size: 32,
      })],
    }));

    if (w.readings) {
      children.push(prompt("Reading(s)"));
      for (const r of String(w.readings).split("\n").filter(Boolean)) {
        children.push(answer(r.trim()));
      }
    }
    if (w.discussion) {
      children.push(prompt("Discussion question"));
      children.push(answer(w.discussion));
    }
    if (w.instruction) {
      children.push(prompt("Instruction"));
      children.push(answer(w.instruction));
    }

    for (const e of weekEntries) {
      const d = new Date(e.entry_date).toLocaleDateString("en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 80 },
        children: [new TextRun({
          text: `${d}${e.context ? ` · ${e.context}` : ""}`, bold: true, size: 26,
        })],
      }));
      if (e.reading_ref) children.push(answer(`Reading: ${e.reading_ref}`));

      children.push(new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: "Arrive in your body", bold: true, size: 24 })],
      }));
      for (const a of ARRIVE) {
        children.push(prompt(`${a.n}. ${a.label}`), answer(e[a.key]));
      }

      children.push(new Paragraph({
        spacing: { before: 220, after: 60 },
        children: [new TextRun({ text: "Embodied inquiry", bold: true, size: 24 })],
      }));
      for (const r of REQUIRED) {
        children.push(prompt(`${r.n}. ${r.label}`), answer(e[r.key]));
      }

      const hasConnection = e.trigger_author || e.trigger_concept || e.trigger_quote ||
        CONNECTION.some((c) => e[c.key]);
      if (hasConnection) {
        children.push(new Paragraph({
          spacing: { before: 220, after: 60 },
          children: [new TextRun({ text: "Reading → body connection", bold: true, size: 24 })],
        }));
        const cite = [e.trigger_author, e.trigger_concept,
          e.trigger_page ? `p. ${e.trigger_page}` : ""].filter(Boolean).join(" · ");
        if (cite) children.push(answer(cite));
        if (e.trigger_quote) {
          children.push(new Paragraph({
            spacing: { after: 120 }, indent: { left: 480 },
            children: [new TextRun({ text: `"${e.trigger_quote}"`, italics: true, size: 22 })],
          }));
        }
        for (const c of CONNECTION) {
          if (e[c.key]) children.push(prompt(c.label), answer(e[c.key]));
        }
      }
    }

    if (syn) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 80 },
        children: [new TextRun({ text: "Weekly embodied synthesis", bold: true, size: 26 })],
      }));
      for (const s of SYNTHESIS) {
        if (syn[s.key]) children.push(prompt(s.label), answer(syn[s.key]));
      }
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  if (entries.length === 0) {
    children.push(answer("No journal entries have been written yet."));
  }

  const doc = new Document({
    creator: settings?.scholar_name || user.name || "Semantic Authoring",
    title: "Embodied Inquiry Journal",
    description: `${settings?.course_code ?? ""} ${settings?.term ?? ""}`.trim(),
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [{ properties: {}, children }],
  });

  const buf = await Packer.toBuffer(doc);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `embodied-inquiry-journal-${(settings?.course_code ?? "journal")
    .toLowerCase().replace(/\s+/g, "-")}-${stamp}.docx`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
