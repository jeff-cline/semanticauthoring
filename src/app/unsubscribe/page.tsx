import { PublicShell } from "@/components/Chrome";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function Unsubscribe(
  { searchParams }: { searchParams: Promise<{ email?: string; done?: string }> },
) {
  const { email, done } = await searchParams;

  async function unsubscribe(formData: FormData) {
    "use server";
    const addr = String(formData.get("email") ?? "").trim().toLowerCase();
    if (addr) {
      // Honoured immediately, across every scholar the address follows.
      await q(`UPDATE subscribers SET status='unsubscribed', unsubscribed_at=now(),
                      updated_at=now() WHERE lower(email)=$1`, [addr]).catch(() => {});
    }
    const { redirect } = await import("next/navigation");
    redirect("/unsubscribe?done=1");
  }

  return (
    <PublicShell>
      <section className="wrap narrow" style={{ padding: "88px 24px 0" }}>
        <div className="card" style={{ padding: 40 }}>
          {done ? (
            <>
              <h1>You&rsquo;re unsubscribed.</h1>
              <p className="lede" style={{ marginBottom: 0 }}>
                You won&rsquo;t receive further notifications. If you subscribed to more than
                one scholar, all of them have been stopped.
              </p>
            </>
          ) : (
            <>
              <h1>Unsubscribe</h1>
              <p style={{ color: "var(--muted)" }}>
                Enter the address you subscribed with. This takes effect immediately.
              </p>
              <form action={unsubscribe}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required defaultValue={email ?? ""} />
                </div>
                <button className="btn btn-primary">Unsubscribe</button>
              </form>
            </>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
