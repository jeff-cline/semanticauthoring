import { PublicShell } from "@/components/Chrome";
import NotFoundBody from "@/components/NotFoundBody";

// A mistyped handle is the single most likely wrong URL on this site, now that
// every scholar lives at the root. The segment gets its own boundary so the
// 404 body is server-rendered here too: the parent page is force-dynamic, and
// a notFound() thrown from it streams the shell first, leaving the global 404
// to arrive only in the client payload — a blank page until JavaScript runs.
export default function HandleNotFound() {
  return (
    <PublicShell>
      <NotFoundBody />
    </PublicShell>
  );
}
