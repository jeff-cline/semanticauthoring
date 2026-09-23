import { publicGuardConfig } from "@/lib/form-guard";

export const dynamic = "force-dynamic";

// Public by design: the site key belongs in the page source. The secret key is
// never read here.
//
// MUST NOT be HTTP-cached — this is the switch telling every form whether to
// attach a token. A cached "disabled" answer is silent, and the moment
// enforcement is turned on those token-less submissions get dropped.
export async function GET() {
  return Response.json(publicGuardConfig(), {
    headers: { "cache-control": "no-store, must-revalidate" },
  });
}
