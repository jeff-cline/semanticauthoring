import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Mark } from "@/components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// Server-side guard. Enforced HERE rather than in the UI, so a user who is
// required to change their password cannot reach any other route by navigating
// directly — the check runs before any child page renders.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const god = user.role === "god";

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Workspace">
        <Link href="/app" className="brand" style={{ padding: "4px 24px 18px", fontSize: ".82rem" }}>
          <Mark size={26} /> Semantic Authoring
        </Link>

        <div className="grouplabel">Workspace</div>
        <Link href="/app">Dashboard</Link>
        <Link href="/app/capture">Capture thought</Link>
        <Link href="/app/journal">Daily journal</Link>

        <div className="grouplabel">Read</div>
        <Link href="/app/library">Research library</Link>
        <Link href="/app/courses">Courses</Link>

        <div className="grouplabel">Connect</div>
        <Link href="/app/questions">Questions</Link>
        <Link href="/app/map">Knowledge map</Link>
        <Link href="/app/connect">Connections</Link>
        <Link href="/app/life-map">Life Map</Link>

        <div className="grouplabel">Author</div>
        <Link href="/app/studio">Authoring studio</Link>
        <Link href="/app/claims">Claim ledger</Link>
        <Link href="/app/integrity">Citation integrity</Link>

        <div className="grouplabel">Dissertation</div>
        <Link href="/app/dissertation">Dissertation</Link>
        <Link href="/app/defense">Defense prep</Link>

        <div className="grouplabel">Review</div>
        <Link href="/app/review">Mentor &amp; committee</Link>

        <div className="grouplabel">Publish</div>
        <Link href="/app/profile">Public profile</Link>
        <Link href="/app/publications">Publications</Link>
        <Link href="/app/pipeline">Publication pipeline</Link>

        <div className="grouplabel">Celebrate</div>
        <Link href="/app/timeline">Milestones</Link>

        <div className="grouplabel">Relationships</div>
        <Link href="/app/contacts">My contacts</Link>
        <Link href="/app/testimonials">Testimonials</Link>
        <Link href="/app/subscribers">Subscribers</Link>

        {god && (
          <>
            <div className="grouplabel">Administration</div>
            <Link href="/app/leads">Leads CRM</Link>
            <Link href="/app/integrations">Integrations</Link>
          </>
        )}

        <div className="grouplabel">Account</div>
        <Link href="/app/export">Export your work</Link>
        <Link href="/change-password">Change password</Link>
        <Link href="/logout">Sign out</Link>
        <p style={{ color: "#6d8099", fontSize: ".74rem", padding: "18px 24px 0", margin: 0 }}>
          {user.email}<br />
          <span style={{ color: god ? "var(--gold)" : "#6d8099" }}>
            {god ? "God" : user.tier}
          </span>
        </p>
      </nav>
      <div className="main">{children}</div>
    </div>
  );
}
