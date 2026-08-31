import { PublicShell } from "@/components/Chrome";

export const metadata = { title: "Subscription", robots: { index: false } };

export default async function Subscribed(
  { searchParams }: { searchParams: Promise<{ status?: string }> },
) {
  const { status } = await searchParams;
  const ok = status === "ok";
  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "96px 24px 0", textAlign: "center" }}>
        <div className="card" style={{ padding: 44 }}>
          {ok ? (
            <>
              <h1>You&rsquo;re subscribed.</h1>
              <p className="lede">
                You&rsquo;ll be notified when new work is published. Every message includes a
                one-click unsubscribe.
              </p>
            </>
          ) : (
            <>
              <h1>That link didn&rsquo;t work.</h1>
              <p className="lede">
                It may have already been used or expired. You can subscribe again from the
                scholar&rsquo;s profile.
              </p>
            </>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
