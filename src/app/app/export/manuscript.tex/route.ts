import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q, one } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LaTeX export, for Overleaf and any TeX workflow. Ships the manuscript plus a
// .bib-ready bibliography reference, escaped so a stray ampersand in a title
// cannot break the document.

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const id = new URL(req.url).searchParams.get("document");
  const doc = id
    ? await one<any>(`SELECT * FROM documents WHERE id=$1 AND owner_id=$2`, [Number(id), user.id])
    : await one<any>(`SELECT * FROM documents WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 1`,
        [user.id]);
  if (!doc) return new NextResponse("No document found", { status: 404 });

  const profile = await one<any>(`SELECT * FROM profiles WHERE user_id=$1`, [user.id]);
  const sources = await q<any>(
    `SELECT * FROM sources WHERE owner_id=$1 AND doi <> '' ORDER BY year DESC`, [user.id]);

  // Paragraphs survive; single newlines do not become line breaks in TeX.
  const body = String(doc.body ?? "").split(/\n{2,}/)
    .map((p) => esc(p.replace(/\n/g, " ").trim()))
    .filter(Boolean).join("\n\n");

  const tex = `% Exported from Semantic Authoring on ${new Date().toISOString().slice(0, 10)}
% Paste into Overleaf, or compile locally with pdflatex + bibtex.
\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{setspace}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}
\\doublespacing

\\title{${esc(doc.title)}}
\\author{${esc(profile?.display_name || user.name || "")}${
  profile?.institution ? `\\\\ \\small ${esc(profile.institution)}` : ""}}
\\date{\\today}

\\begin{document}
\\maketitle

${body || "% (this document is still empty)"}

\\bibliographystyle{apalike}
% ${sources.length} source(s) with DOIs are available from
% /app/export/library.bib — save it beside this file as references.bib
\\bibliography{references}

\\end{document}
`;

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = String(doc.title ?? "manuscript").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "manuscript";

  return new NextResponse(tex, {
    headers: {
      "content-type": "application/x-tex; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-${stamp}.tex"`,
      "cache-control": "private, no-store",
    },
  });
}
