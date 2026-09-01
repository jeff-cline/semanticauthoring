import "server-only";
import { q } from "./db";

// PUBLIC SEARCH ONLY.
//
// Every query in this file is constrained to material a scholar has
// deliberately made public: publications with status='published' belonging to a
// profile with is_public=TRUE. Private libraries, annotations, journals, Life
// Maps, drafts, and unpublished work are never reachable from here — that
// boundary is enforced in the SQL, not in the caller.

export interface Hit {
  kind: "publication" | "scholar" | "answer";
  title: string;
  subtitle: string;
  url: string;
  meta: string;
  snippet: string;
}

const like = (s: string) => `%${s.replace(/[%_]/g, (m) => "\\" + m)}%`;

/** Keyword search across published publications. */
export async function searchPublications(term: string, limit = 30): Promise<Hit[]> {
  if (!term.trim()) return [];
  const rows = await q<any>(
    `SELECT pub.slug, pub.title, pub.subtitle, pub.abstract, pub.kind, pub.topic, pub.tags,
            pub.reading_time, pub.published_at, pr.handle, pr.display_name, u.name AS user_name
       FROM publications pub
       JOIN profiles pr ON pr.user_id = pub.owner_id AND pr.is_public = TRUE
       JOIN users u ON u.id = pub.owner_id
      WHERE pub.status = 'published'
        AND (pub.title ILIKE $1 OR pub.subtitle ILIKE $1 OR pub.abstract ILIKE $1
             OR pub.body ILIKE $1 OR pub.tags ILIKE $1 OR pub.topic ILIKE $1)
      ORDER BY pub.published_at DESC NULLS LAST LIMIT $2`,
    [like(term), limit]);

  return rows.map((r: any) => ({
    kind: "publication" as const,
    title: r.title,
    subtitle: r.subtitle || "",
    url: `/s/${r.handle}/${r.slug}`,
    meta: [r.display_name || r.user_name, r.topic, `${r.reading_time} min read`]
      .filter(Boolean).join(" · "),
    snippet: (r.abstract || "").slice(0, 220),
  }));
}

/** Combined keyword-or-author search: matches the scholar as well as the work. */
export async function searchByAuthorOrKeyword(term: string, limit = 30): Promise<Hit[]> {
  if (!term.trim()) return [];
  const p = like(term);

  const [scholars, pubs] = await Promise.all([
    q<any>(
      `SELECT pr.handle, pr.display_name, pr.headline, pr.institution, pr.interests,
              pr.program, u.name AS user_name,
              (SELECT count(*) FROM publications pb
                WHERE pb.owner_id = pr.user_id AND pb.status='published') AS pubs
         FROM profiles pr JOIN users u ON u.id = pr.user_id
        WHERE pr.is_public = TRUE
          AND (pr.display_name ILIKE $1 OR u.name ILIKE $1 OR pr.headline ILIKE $1
               OR pr.institution ILIKE $1 OR pr.interests ILIKE $1 OR pr.bio ILIKE $1
               OR pr.program ILIKE $1)
        ORDER BY pubs DESC LIMIT $2`, [p, limit]),
    q<any>(
      `SELECT pub.slug, pub.title, pub.subtitle, pub.abstract, pub.topic, pub.reading_time,
              pr.handle, pr.display_name, u.name AS user_name
         FROM publications pub
         JOIN profiles pr ON pr.user_id = pub.owner_id AND pr.is_public = TRUE
         JOIN users u ON u.id = pub.owner_id
        WHERE pub.status='published'
          AND (pr.display_name ILIKE $1 OR u.name ILIKE $1 OR pub.title ILIKE $1
               OR pub.abstract ILIKE $1 OR pub.body ILIKE $1 OR pub.tags ILIKE $1)
        ORDER BY pub.published_at DESC NULLS LAST LIMIT $2`, [p, limit]),
  ]);

  return [
    ...scholars.map((r: any) => ({
      kind: "scholar" as const,
      title: r.display_name || r.user_name,
      subtitle: r.headline || "",
      url: `/s/${r.handle}`,
      meta: [r.program, r.institution, `${r.pubs} published`].filter(Boolean).join(" · "),
      snippet: r.interests || "",
    })),
    ...pubs.map((r: any) => ({
      kind: "publication" as const,
      title: r.title,
      subtitle: r.subtitle || "",
      url: `/s/${r.handle}/${r.slug}`,
      meta: [r.display_name || r.user_name, r.topic, `${r.reading_time} min read`]
        .filter(Boolean).join(" · "),
      snippet: (r.abstract || "").slice(0, 220),
    })),
  ];
}

/** Topics currently in use — dynamic, never hard-coded. */
export async function liveTopics(limit = 14) {
  return q<any>(
    `SELECT pub.topic, count(*)::int AS n
       FROM publications pub
       JOIN profiles pr ON pr.user_id = pub.owner_id AND pr.is_public = TRUE
      WHERE pub.status='published' AND pub.topic <> ''
      GROUP BY pub.topic ORDER BY n DESC LIMIT $1`, [limit]);
}
