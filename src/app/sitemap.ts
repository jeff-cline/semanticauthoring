import type { MetadataRoute } from "next";
import { ANSWERS } from "@/lib/answers";
import { q } from "@/lib/db";

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const core = [
    { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/discover", priority: 0.95, changeFrequency: "daily" as const },
    { url: "/scholars", priority: 0.9, changeFrequency: "daily" as const },
    { url: "/search", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/journey", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/answers", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/mission", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/about", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/join", priority: 0.85, changeFrequency: "monthly" as const },
    { url: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { url: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  // Only public profiles and published work are ever listed.
  const [profiles, pubs] = await Promise.all([
    q<any>(`SELECT handle, updated_at FROM profiles WHERE is_public = TRUE`).catch(() => []),
    q<any>(`SELECT pr.handle, pub.slug, pub.updated_at
              FROM publications pub
              JOIN profiles pr ON pr.user_id = pub.owner_id AND pr.is_public = TRUE
             WHERE pub.status = 'published'`).catch(() => []),
  ]);

  return [
    ...core.map((c) => ({
      url: `${SITE}${c.url}`, lastModified: now,
      changeFrequency: c.changeFrequency, priority: c.priority,
    })),
    ...ANSWERS.map((a) => ({
      url: `${SITE}/answers/${a.slug}`, lastModified: now,
      changeFrequency: "monthly" as const, priority: 0.85,
    })),
    ...profiles.map((p: any) => ({
      url: `${SITE}/s/${p.handle}`, lastModified: new Date(p.updated_at),
      changeFrequency: "weekly" as const, priority: 0.8,
    })),
    ...pubs.map((p: any) => ({
      url: `${SITE}/s/${p.handle}/${p.slug}`, lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const, priority: 0.9,
    })),
  ];
}
