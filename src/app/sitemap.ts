import type { MetadataRoute } from "next";
import { ANSWERS } from "@/lib/answers";

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const core = [
    { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/journey", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/answers", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/mission", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/about", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/join", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { url: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return [
    ...core.map((c) => ({
      url: `${SITE}${c.url}`,
      lastModified: now,
      changeFrequency: c.changeFrequency,
      priority: c.priority,
    })),
    ...ANSWERS.map((a) => ({
      url: `${SITE}/answers/${a.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
  ];
}
