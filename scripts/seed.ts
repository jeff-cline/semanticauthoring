import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import { Client } from "pg";

const scrypt = promisify(_scrypt) as (p: string, s: string, l: number) => Promise<Buffer>;

async function hash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await scrypt(password, salt, 64)).toString("hex")}`;
}

// The two God accounts. The temporary password comes from the environment and
// is never committed. Both accounts are forced to change it on first login.
const GODS = [
  { email: "krystalore@thecrewscoach.com", name: "Krystal" },
  { email: "jeff.cline@me.com", name: "Jeff Cline" },
];

const INTEGRATIONS = [
  ["stripe", "Stripe", "payments"],
  ["linkedin", "LinkedIn", "social"], ["x", "X", "social"],
  ["facebook", "Facebook", "social"], ["threads", "Threads", "social"],
  ["bluesky", "Bluesky", "social"],
  ["zenodo", "Zenodo", "scholarly"], ["osf", "OSF", "scholarly"],
  ["orcid", "ORCID", "scholarly"], ["crossref", "Crossref", "scholarly"],
  ["openalex", "OpenAlex", "scholarly"], ["semanticscholar", "Semantic Scholar", "scholarly"],
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const temp = process.env.SEED_GOD_TEMP_PASSWORD;
  if (!temp) throw new Error("SEED_GOD_TEMP_PASSWORD is not set");

  const client = new Client({ connectionString: url });
  await client.connect();

  for (const g of GODS) {
    const pw = await hash(temp);
    const { rowCount } = await client.query(
      `INSERT INTO users (email, name, password_hash, role, tier, must_change_password)
       VALUES ($1,$2,$3,'god','doctoral',TRUE)
       ON CONFLICT (email) DO NOTHING`,
      [g.email, g.name, pw],
    );
    console.log(rowCount ? `created God account ${g.email}` : `${g.email} already exists — left untouched`);
  }

  for (const [key, label, category] of INTEGRATIONS) {
    await client.query(
      `INSERT INTO integrations (key, label, category) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO NOTHING`, [key, label, category]);
  }
  console.log(`${INTEGRATIONS.length} integration shells present.`);

  await client.end();
  console.log("Seed complete. Both God accounts must change password at first login.");
}

main().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
