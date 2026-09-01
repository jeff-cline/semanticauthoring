import { redirect } from "next/navigation";
import { PublicShell } from "@/components/Chrome";
import SignupForm from "@/components/SignupForm";
import { hashPassword, passwordProblem, createSession, currentUser } from "@/lib/auth";
import { one, q, logEvent } from "@/lib/db";
import { welcomeEmail } from "@/lib/email";
import { coreLead } from "@/lib/core";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Start your scholar workspace",
  description:
    "Create a free Semantic Authoring workspace — research library, question tracker, daily journal, and authoring studio. No card, no trial clock.",
};

const TIER_KEYS = ["free", "scholar", "doctoral"];

export default async function Join(
  { searchParams }: { searchParams: Promise<{ error?: string }> },
) {
  const { error } = await searchParams;
  if (await currentUser().catch(() => null)) redirect("/app");

  async function signup(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim().slice(0, 200);
    const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
    const password = String(formData.get("password") ?? "");
    const tier = String(formData.get("tier") ?? "free");
    const interest = String(formData.get("interest") ?? "").slice(0, 120);

    if (String(formData.get("website") ?? "")) redirect("/join?error=unknown"); // honeypot
    if (!name || !email.includes("@")) redirect("/join?error=details");
    if (!TIER_KEYS.includes(tier)) redirect("/join?error=details");
    if (passwordProblem(password)) redirect("/join?error=password");

    const exists = await one(`SELECT id FROM users WHERE lower(email) = $1`, [email]);
    if (exists) redirect("/join?error=exists");

    // Every tier is free right now, so anyone who signs up goes straight in.
    const user = await one<{ id: number }>(
      `INSERT INTO users (email, name, password_hash, role, tier, must_change_password)
       VALUES ($1,$2,$3,'scholar',$4,FALSE) RETURNING id`,
      [email, name, await hashPassword(password), tier],
    );
    if (!user) redirect("/join?error=unknown");

    // Record in the platform CRM as an acquisition, and mirror to the Core.
    await q(
      `INSERT INTO leads (name, email, interest, status, source_page)
       VALUES ($1,$2,$3,'converted','/join')`, [name, email, interest]).catch(() => {});
    coreLead({ name, email, notes: `Signed up — ${tier} tier${interest ? ` · ${interest}` : ""}` })
      .catch(() => {});
    welcomeEmail(email, name, tier).catch(() => {});

    await logEvent("user", "signup", { actorId: user.id, entityId: user.id, detail: tier });
    await createSession(user.id);
    redirect("/app?welcome=1");
  }

  const messages: Record<string, string> = {
    exists: "An account with that email already exists — try signing in instead.",
    password: "Use at least 12 characters, with upper case, lower case, and a number.",
    details: "Please check your name and email.",
    unknown: "Something went wrong. Please try again.",
  };

  return (
    <PublicShell>
      <section className="wrap" style={{ padding: "72px 24px 0" }}>
        <div className="grid grid-2" style={{ alignItems: "start", gap: 44 }}>
          <div>
            <p className="eyebrow">Founding scholars</p>
            <h1>Start your scholar workspace.</h1>
            <p className="lede">
              Every tier is free while we build. Pick the one that fits and you&rsquo;re
              in — no waiting list, no approval step.
            </p>
            <ul style={{ color: "var(--muted)", paddingLeft: 20, lineHeight: 2 }}>
              <li>Research library with annotations and evidence labels</li>
              <li>Question tracker that preserves how your thinking changed</li>
              <li>Daily journal — intellectual, somatic, and an intention</li>
              <li>Authoring studio connected to your sources</li>
              <li>Private by default. Export everything, any time.</li>
            </ul>
            <p style={{ color: "var(--muted)" }}>
              Already have a workspace? <a href="/login">Sign in</a>.
            </p>
          </div>
          <div>
            {error && (
              <p className="error card" style={{ padding: "14px 18px", marginBottom: 16 }}>
                {messages[error] ?? messages.unknown}
              </p>
            )}
            <SignupForm action={signup} />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
