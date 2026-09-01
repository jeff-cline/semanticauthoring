import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = {
  article: "article", book: "book", chapter: "incollection", website: "misc",
  lecture: "misc", report: "techreport", video: "misc", podcast: "misc",
  course_doc: "misc", note: "misc",
};

const esc = (s: string) => String(s ?? "").replace(/[{}]/g, "").replace(/\\/g, "");

export async function GET() {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await q<any>(
    `SELECT * FROM sources WHERE owner_id=$1 ORDER BY year DESC, title`, [user.id]);

  const used = new Set<string>();
  const entries = rows.map((s: any) => {
    const first = String(s.authors ?? "").split(/,| and /)[0]?.trim().split(/\s+/).pop() ?? "ref";
    let key = `${first.toLowerCase().replace(/[^a-z]/g, "") || "ref"}${s.year || ""}`;
    while (used.has(key)) key += "a";
    used.add(key);

    const fields: [string, string][] = [
      ["title", esc(s.title)],
      ["author", esc(String(s.authors ?? "").replace(/,\s*/g, " and "))],
      ["year", esc(s.year)],
      ["journal", esc(s.publication)],
      ["doi", esc(s.doi)],
      ["url", esc(s.url || s.source_url)],
      ["keywords", esc(s.tags)],
      ["note", esc(s.notes).slice(0, 400)],
    ].filter((f): f is [string, string] => Boolean(f[1]));

    return `@${TYPE[s.kind] ?? "misc"}{${key},\n` +
      fields.map(([k, v]) => `  ${k} = {${v}}`).join(",\n") + "\n}";
  });

  const body =
    `% Exported from Semantic Authoring on ${new Date().toISOString().slice(0, 10)}\n` +
    `% ${rows.length} entries\n\n` + entries.join("\n\n") + "\n";

  return new NextResponse(body, {
    headers: {
      "content-type": "application/x-bibtex; charset=utf-8",
      "content-disposition": `attachment; filename="library-${new Date().toISOString().slice(0, 10)}.bib"`,
      "cache-control": "private, no-store",
    },
  });
}
