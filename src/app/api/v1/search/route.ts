import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/token";
import { openAlexSearch, crossrefByDoi, verifySource, unpaywall, normalizeDoi } from "@/lib/scholarly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Scholarly lookup through the read-only indexes. Requires a token so the
// endpoint isn't an open proxy, but reads nothing from the scholar's workspace.

export async function GET(req: Request) {
  const u = await userFromRequest(req);
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const doi = sp.get("doi");
  const query = sp.get("q");

  if (doi) {
    const work = await crossrefByDoi(doi);
    if (!work) {
      return NextResponse.json({
        ok: true, status: "NOT_VERIFIED", result: null, sources: [],
        provider: ["crossref"], retrieved_at: new Date().toISOString(),
        warnings: [`DOI ${normalizeDoi(doi)} did not resolve.`],
      });
    }
    const [check, oa] = await Promise.all([
      verifySource({ doi, title: sp.get("title") ?? undefined }),
      unpaywall(doi),
    ]);
    return NextResponse.json({
      ok: true, result: { ...work, openAccessUrl: oa || work.openAccessUrl },
      status: check.status, provider: [work.provider], confidence: check.status,
      warnings: check.status === "VERIFIED_METADATA" ? [] : [check.detail],
      retrieved_at: new Date().toISOString(),
      provenance: [{ provider: work.provider, id: work.providerId, url: work.url }],
    });
  }

  if (query) {
    const results = await openAlexSearch(query, Math.min(20, Number(sp.get("limit") ?? 8)));
    return NextResponse.json({
      ok: true, result: results, provider: ["openalex"],
      retrieved_at: new Date().toISOString(),
      warnings: results.length === 0 ? ["No matches found."] : [],
    });
  }

  return NextResponse.json({ error: "provide ?q= or ?doi=" }, { status: 400 });
}
