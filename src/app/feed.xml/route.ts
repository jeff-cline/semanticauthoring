import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 900;

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// RSS over published scholarship only. Aggregators, readers, and answer
// engines all consume this; private work is never included.
export async function GET() {
  const rows = await q<any>(
    `SELECT pub.slug, pub.title, pub.subtitle, pub.abstract, pub.topic, pub.tags,
            pub.published_at, pr.handle, pr.display_name, u.name AS user_name
       FROM publications pub
       JOIN profiles pr ON pr.user_id = pub.owner_id AND pr.is_public = TRUE
       JOIN users u ON u.id = pub.owner_id
      WHERE pub.status = 'published'
      ORDER BY pub.published_at DESC NULLS LAST LIMIT 50`).catch(() => []);

  const items = rows.map((p: any) => {
    const url = `${SITE}/s/${p.handle}/${p.slug}`;
    const author = p.display_name || p.user_name;
    return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <dc:creator>${esc(author)}</dc:creator>
      <description>${esc(p.abstract || p.subtitle || p.title)}</description>
      ${p.topic ? `<category>${esc(p.topic)}</category>` : ""}
      ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ""}
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Semantic Authoring — published scholarship</title>
    <link>${SITE}/discover</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Essays, research notes, and working papers published by scholars on Semantic Authoring.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=900",
    },
  });
}
