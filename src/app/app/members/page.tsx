import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import MembersTable from "@/components/MembersTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members" };

// Every account on the platform. God only.
//
// /app/leads is the marketing CRM — people who filled in a form. This is the
// members list: people who have an account. They were being conflated.
export default async function Members({
  searchParams,
}: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const user = await requireUser();
  if (user.role !== "god") redirect("/app");

  const { q: search, filter } = await searchParams;
  const term = (search ?? "").trim();

  const where: string[] = [];
  const args: any[] = [];
  if (term) {
    args.push(`%${term.toLowerCase()}%`);
    where.push(`(lower(u.email) LIKE $${args.length} OR lower(coalesce(u.name,'')) LIKE $${args.length}
                 OR lower(coalesce(p.handle,'')) LIKE $${args.length})`);
  }
  if (filter === "public") where.push(`p.is_public = TRUE`);
  if (filter === "god") where.push(`u.role = 'god'`);

  const rows = await q<any>(
    `SELECT u.id, u.email, u.name, u.role, u.tier, u.must_change_password,
            u.created_at, u.last_login_at,
            p.handle, p.display_name, p.is_public, p.avatar_url,
            (SELECT count(*) FROM publications pb WHERE pb.owner_id=u.id) AS pubs,
            (SELECT count(*) FROM sources sc WHERE sc.owner_id=u.id)      AS sources,
            (SELECT count(*) FROM journal_entries je WHERE je.owner_id=u.id) AS journal,
            (SELECT count(*) FROM inquiry_entries ie WHERE ie.owner_id=u.id) AS inquiry
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY u.created_at ASC`, args).catch(() => []);

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1 style={{ marginBottom: 6 }}>Members</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: 0 }}>
        Every account on the platform — {rows.length} in total. Looking for people who
        filled in a form rather than created an account?{" "}
        <Link href="/app/leads">That is the Leads CRM</Link>.
      </p>

      <form style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0" }}>
        <input name="q" defaultValue={term} placeholder="Search name, email or handle"
               style={{ flex: "1 1 260px", minHeight: 44 }} />
        <select name="filter" defaultValue={filter ?? ""} style={{ minHeight: 44 }}>
          <option value="">Everyone</option>
          <option value="public">Public profiles</option>
          <option value="god">God accounts</option>
        </select>
        <button className="btn btn-secondary" style={{ minHeight: 44 }}>Search</button>
      </form>

      <MembersTable rows={rows as any} meId={user.id} />
    </>
  );
}
