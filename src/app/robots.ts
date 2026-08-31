import type { MetadataRoute } from "next";

const SITE = process.env.SITE_URL ?? "https://semanticauthoring.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Answer engines and crawlers are welcome on public pages.
        userAgent: "*",
        allow: "/",
        // The authenticated workspace and API are never indexed.
        disallow: ["/app/", "/api/", "/login", "/logout"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
