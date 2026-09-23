import { permanentRedirect, notFound } from "next/navigation";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

// The profile moved to semanticauthoring.org/first-last. This keeps every
// link that was ever shared working, and tells crawlers where authority now
// lives rather than serving the same page at two addresses.
export default async function LegacyProfile({
  params,
}: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(handle)) notFound();
  const row = await one<{ handle: string }>(
    `SELECT handle FROM profiles WHERE handle=$1 AND is_public = TRUE`, [handle],
  ).catch(() => null);
  if (!row) notFound();
  permanentRedirect(`/${row.handle}`);
}
