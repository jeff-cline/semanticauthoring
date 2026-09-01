import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Full portable export. Includes version history and provenance, because an
// export that loses how the work developed is not really the scholar's work.

export async function GET() {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const id = user.id;

  const table = (name: string, extra = "") =>
    q<any>(`SELECT * FROM ${name} WHERE owner_id=$1 ${extra}`, [id]).catch(() => []);

  const [sources, annotations, questions, questionVersions, documents, documentVersions,
         journal, experiences, links, connections, claims, evidence, milestones, captures,
         contacts, courses, courseItems, checks] = await Promise.all([
    table("sources"), table("annotations"), table("questions"),
    q<any>(`SELECT v.* FROM question_versions v JOIN questions qq ON qq.id=v.question_id
             WHERE qq.owner_id=$1`, [id]).catch(() => []),
    table("documents"),
    q<any>(`SELECT v.* FROM document_versions v JOIN documents d ON d.id=v.document_id
             WHERE d.owner_id=$1`, [id]).catch(() => []),
    table("journal_entries"), table("life_experiences"),
    q<any>(`SELECT l.* FROM question_links l JOIN questions qq ON qq.id=l.question_id
             WHERE qq.owner_id=$1`, [id]).catch(() => []),
    table("connections"), table("claims"), table("claim_evidence"), table("milestones"),
    table("captures"), table("contacts"), table("courses"), table("course_items"),
    table("citation_checks"),
  ]);

  const archive = {
    exportedAt: new Date().toISOString(),
    format: "semanticauthoring.archive/1",
    scholar: { email: user.email, name: user.name, tier: user.tier },
    note: "Uploaded files are not included; download them individually from each source.",
    library: { sources, annotations, citationChecks: checks },
    thinking: {
      questions, questionVersions, captures,
      lifeExperiences: experiences, questionLinks: links, connections,
    },
    writing: { documents, documentVersions },
    argument: { claims, evidence },
    journal,
    courses: { courses, items: courseItems },
    people: { contacts },
    milestones,
  };

  return new NextResponse(JSON.stringify(archive, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="semanticauthoring-archive-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
