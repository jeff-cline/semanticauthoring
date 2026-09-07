import "server-only";
import { createHash } from "node:crypto";
import { q, one } from "./db";

// ── Embeddings ───────────────────────────────────────────────────────────────
//
// Two embedders, chosen at runtime:
//
//   1. A REAL model, when EMBEDDING_API_URL and EMBEDDING_API_KEY are set. This
//      produces true semantic vectors — "somatic awareness" lands near
//      "interoception" even with no shared words.
//
//   2. A deterministic local embedder otherwise. It is NOT a language model and
//      does not understand meaning. It hashes word and character trigrams into a
//      384-dimension space, so it finds material that shares vocabulary and
//      morphology — genuinely better than ILIKE at surfacing related work, and
//      genuinely worse than a model at conceptual similarity.
//
// The distinction is surfaced in the UI. Calling lexical vectors "semantic AI"
// would be the kind of overclaim this platform exists to avoid.

export const DIMS = 384;

export const embedderName = (): string =>
  process.env.EMBEDDING_API_URL && process.env.EMBEDDING_API_KEY
    ? `model:${process.env.EMBEDDING_MODEL ?? "remote"}`
    : "local-lexical-v1";

export const usingRealModel = (): boolean =>
  Boolean(process.env.EMBEDDING_API_URL && process.env.EMBEDDING_API_KEY);

const STOP = new Set(`a an and are as at be by for from has have in is it its of on or that the to
was were will with this these those i my we our you your they them he she his her not but if then
than so such can could would should may might do does did been being had`.split(/\s+/));

/** Deterministic hash of a token into a bucket, with a stable sign. */
function bucket(token: string, salt: string): { i: number; sign: number } {
  const h = createHash("sha1").update(salt + token).digest();
  const i = ((h[0] << 16) | (h[1] << 8) | h[2]) % DIMS;
  return { i, sign: h[3] & 1 ? 1 : -1 };
}

/** Local lexical embedding: hashed words + character trigrams, L2-normalised. */
export function localEmbed(text: string): number[] {
  const v = new Array(DIMS).fill(0);
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = clean.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

  // Term frequency, damped so one repeated word cannot dominate.
  const tf = new Map<string, number>();
  for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1);

  for (const [w, n] of tf) {
    const weight = 1 + Math.log(n);
    const { i, sign } = bucket(w, "w:");
    v[i] += sign * weight;

    // Character trigrams give partial credit for morphology — "embodied" and
    // "embodiment" share most of their trigrams.
    const padded = `  ${w}  `;
    for (let k = 0; k < padded.length - 2; k++) {
      const g = padded.slice(k, k + 3);
      const b = bucket(g, "g:");
      v[b.i] += b.sign * weight * 0.35;
    }
  }

  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

/** Call a remote embedding model when configured, else fall back locally. */
export async function embed(text: string): Promise<number[]> {
  const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!trimmed) return new Array(DIMS).fill(0);

  if (usingRealModel()) {
    try {
      const res = await fetch(process.env.EMBEDDING_API_URL!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`,
        },
        body: JSON.stringify({
          input: trimmed,
          model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
          dimensions: DIMS,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const j = await res.json();
        const vec = j?.data?.[0]?.embedding ?? j?.embedding;
        if (Array.isArray(vec) && vec.length === DIMS) return vec;
      }
    } catch { /* fall through to local */ }
  }
  return localEmbed(trimmed);
}

const literal = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;

/** Index one entity. Safe to call repeatedly; it upserts. */
export async function indexEntity(
  ownerId: number, entityType: string, entityId: number, content: string,
) {
  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return;
  const vec = await embed(text);
  await q(
    `INSERT INTO embeddings (owner_id, entity_type, entity_id, content, embedding, model)
     VALUES ($1,$2,$3,$4,$5::vector,$6)
     ON CONFLICT (owner_id, entity_type, entity_id) DO UPDATE
       SET content=EXCLUDED.content, embedding=EXCLUDED.embedding,
           model=EXCLUDED.model, updated_at=now()`,
    [ownerId, entityType, entityId, text.slice(0, 4000), literal(vec), embedderName()],
  ).catch(() => {});
}

export interface Related {
  entity_type: string;
  entity_id: number;
  content: string;
  similarity: number;
}

/** Nearest neighbours across everything the scholar owns. */
export async function findRelated(
  ownerId: number, text: string,
  opts: { limit?: number; exclude?: { type: string; id: number }; minSimilarity?: number } = {},
): Promise<Related[]> {
  const vec = await embed(text);
  const rows = await q<any>(
    `SELECT entity_type, entity_id, content,
            1 - (embedding <=> $2::vector) AS similarity
       FROM embeddings
      WHERE owner_id = $1 AND embedding IS NOT NULL
        AND NOT (entity_type = $3 AND entity_id = $4)
      ORDER BY embedding <=> $2::vector
      LIMIT $5`,
    [ownerId, literal(vec), opts.exclude?.type ?? "", opts.exclude?.id ?? -1,
     opts.limit ?? 10],
  ).catch(() => []);

  const floor = opts.minSimilarity ?? 0.15;
  return rows
    .map((r: any) => ({ ...r, similarity: Number(r.similarity) }))
    .filter((r: Related) => r.similarity >= floor);
}

/** Rebuild the index for one scholar. Returns how many rows were written. */
export async function reindexAll(ownerId: number): Promise<number> {
  const sources = [
    { type: "source", sql: `SELECT id, concat_ws(' ', title, authors, publication, tags, notes) AS c FROM sources WHERE owner_id=$1` },
    { type: "question", sql: `SELECT id, concat_ws(' ', text, discipline, beneath, counterfactual) AS c FROM questions WHERE owner_id=$1` },
    { type: "claim", sql: `SELECT id, concat_ws(' ', text, chapter, notes) AS c FROM claims WHERE owner_id=$1` },
    { type: "annotation", sql: `SELECT id, concat_ws(' ', quote, says, think, matters, connects, tags) AS c FROM annotations WHERE owner_id=$1` },
    { type: "document", sql: `SELECT id, concat_ws(' ', title, body) AS c FROM documents WHERE owner_id=$1` },
    { type: "reading", sql: `SELECT id, concat_ws(' ', title, authors, why_matters, reaction, connections, keywords) AS c FROM reading_log WHERE owner_id=$1` },
    { type: "experience", sql: `SELECT id, concat_ws(' ', title, narrative, significance, themes) AS c FROM life_experiences WHERE owner_id=$1` },
    { type: "capture", sql: `SELECT id, body AS c FROM captures WHERE owner_id=$1` },
  ];

  let n = 0;
  for (const s of sources) {
    const rows = await q<any>(s.sql, [ownerId]).catch(() => []);
    for (const r of rows) {
      if (!String(r.c ?? "").trim()) continue;
      await indexEntity(ownerId, s.type, r.id, String(r.c));
      n++;
    }
  }
  return n;
}

export const LABELS: Record<string, string> = {
  source: "Source", question: "Question", claim: "Claim", annotation: "Annotation",
  document: "Document", reading: "Reading entry", experience: "Life experience",
  capture: "Captured thought",
};

export const HREFS: Record<string, (id: number) => string> = {
  source: (id) => `/app/library/${id}`,
  question: (id) => `/app/questions/${id}`,
  claim: (id) => `/app/claims/${id}`,
  annotation: () => `/app/library`,
  document: (id) => `/app/studio/${id}`,
  reading: (id) => `/app/reading/${id}`,
  experience: () => `/app/life-map`,
  capture: () => `/app/capture`,
};
