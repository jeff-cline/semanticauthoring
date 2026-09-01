import "server-only";
import { q, one } from "./db";

const TABLES: Record<string, string> = {
  source: "sources", question: "questions", claim: "claims",
  document: "documents", experience: "life_experiences", reading: "reading_log",
};

/** Ownership is verified on BOTH ends before any connection is written. */
export async function saveConnection(ownerId: number, formData: FormData) {
  const fromType = String(formData.get("fromType") ?? "");
  const fromId = Number(formData.get("fromId"));
  const [toType, toIdRaw] = String(formData.get("to") ?? "").split(":");
  const toId = Number(toIdRaw);

  if (!TABLES[fromType] || !TABLES[toType] || !fromId || !toId) return;
  if (fromType === toType && fromId === toId) return;

  const okFrom = await one(
    `SELECT 1 FROM ${TABLES[fromType]} WHERE id=$1 AND owner_id=$2`, [fromId, ownerId]);
  const okTo = await one(
    `SELECT 1 FROM ${TABLES[toType]} WHERE id=$1 AND owner_id=$2`, [toId, ownerId]);
  if (!okFrom || !okTo) return;

  await q(
    `INSERT INTO connections (owner_id, from_type, from_id, to_type, to_id, relation, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
    [ownerId, fromType, fromId, toType, toId,
     String(formData.get("relation") ?? "relates_to"),
     String(formData.get("note") ?? "").slice(0, 500)]);
}
