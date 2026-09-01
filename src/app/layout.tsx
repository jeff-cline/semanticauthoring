import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://semanticauthoring.org"),
  title: {
    default: "Semantic Authoring — The operating system for scholarly thinking",
    template: "%s · Semantic Authoring",
  },
  description:
    "Read deeply. Connect ideas. Develop original scholarship. Collaborate with mentors. Publish what matters.",
  openGraph: {
    type: "website",
    siteName: "Semantic Authoring",
    title: "Semantic Authoring",
    description: "The operating system for scholarly thinking.",
  },
  robots: { index: true, follow: true },
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Semantic Authoring",
    url: "https://semanticauthoring.org",
    slogan: "The operating system for scholarly thinking.",
    description:
      "A scholarly platform where research is developed privately and published publicly.",
  };
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
        {children}
      </body>
    </html>
  );
}
