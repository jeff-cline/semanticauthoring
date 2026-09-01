import Link from "next/link";
import { redirect } from "next/navigation";
import { login, currentUser } from "@/lib/auth";
import { Mark } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({
  searchParams,
}: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error } = await searchParams;

  const existing = await currentUser().catch(() => null);
  if (existing) redirect(existing.mustChangePassword ? "/change-password" : "/app");

  async function submit(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const user = await login(email, password);
    if (!user) redirect("/login?error=1");
    redirect(user.mustChangePassword ? "/change-password" : "/app");
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center",
                   background: "var(--midnight)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", color: "#fff", marginBottom: 26 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <Mark size={44} />
          </div>
          <div style={{ fontFamily: "var(--serif)", letterSpacing: ".14em",
                        textTransform: "uppercase" }}>
            Semantic Authoring
          </div>
        </div>
        <form action={submit} className="card">
          <h1 style={{ fontSize: "1.5rem" }}>Sign in</h1>
          {error && <p className="error">Those details didn&rsquo;t match. Please try again.</p>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required
                   autoComplete="current-password" />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }}>Sign in</button>
          <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            <Link href="/forgot" style={{ fontSize: ".9rem" }}>Forgot your password?</Link>
          </p>
        </form>
        <p style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/" style={{ color: "#8fa3c0", fontSize: ".9rem" }}>← Back to site</Link>
        </p>
      </div>
    </main>
  );
}
