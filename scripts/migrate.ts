import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = readFileSync(join(here, "schema.sql"), "utf8");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    const { rows } = await client.query(
      `SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'`);
    console.log(`Migration applied. ${rows[0].n} tables present.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
