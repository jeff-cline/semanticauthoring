import type { Metadata } from "next";
import { PublicShell } from "@/components/Chrome";
import NotFoundBody from "@/components/NotFoundBody";

// The page a visitor lands on when a URL is wrong.
//
// It still returns HTTP 404, which is the part that matters for search: a
// "helpful" 404 that returns 200 is a soft 404, and a site full of them reads
// to Google as a site full of thin pages. The status stays honest; only the
// body is useful.

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "That page does not exist. Search published scholarship, browse our authors, "
    + "or start from the beginning.",
  // Nothing to index here, but crawlers should still follow the links out.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundBody />
    </PublicShell>
  );
}
