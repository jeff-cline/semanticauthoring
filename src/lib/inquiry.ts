import "server-only";
import { q, one } from "./db";

// ── Embodied Inquiry Journal — ITPS 7182 ─────────────────────────────────────

/** The four questions the syllabus requires in every entry. Fixed, not configurable. */
export const REQUIRED = [
  { key: "noticed", n: 1, label: "What did I notice?" },
  { key: "changed", n: 2, label: "What changed?" },
  { key: "surprised", n: 3, label: "What surprised me?" },
  { key: "alive_constricted", n: 4,
    label: "What felt alive, constricted, unfamiliar, or meaningful?" },
] as const;

export const ARRIVE = [
  { key: "sensations", n: 1, label: "What sensations are present in my body right now?" },
  { key: "location", n: 2, label: "Where do I notice them?" },
  { key: "emotions", n: 3, label: "What emotions are present?" },
  { key: "breath_body", n: 4,
    label: "What do I notice about my breath, posture, movement, tension, openness, energy, or impulse?" },
  { key: "precognitive", n: 5,
    label: "Is there anything my body seems to be communicating before I put meaning to it?" },
] as const;

export const CONNECTION = [
  { key: "body_where", label: "Where did I experience this in my body?" },
  { key: "accompaniment",
    label: "What emotion, image, memory, movement, impulse, or sensation accompanied it?" },
  { key: "meaning", label: "What meaning am I making from this experience?" },
  { key: "deepens",
    label: "How does my embodied experience support, complicate, challenge, or deepen my intellectual understanding of the reading?",
    note: "The rubric rewards reflection where embodied observation actually informs meaning-making, rather than staying descriptive." },
] as const;

export const SYNTHESIS = [
  { key: "patterns", label: "What patterns did I notice in my body this week?" },
  { key: "resonance", label: "Where did I experience resonance?" },
  { key: "resistance", label: "Where did I experience resistance?" },
  { key: "shift", label: "How has my embodied understanding shifted?" },
  { key: "influence",
    label: "What concept, author, or tradition is beginning to influence my own emerging understanding of somatic psychology?" },
  { key: "carrying", label: "What question am I carrying forward?" },
] as const;

export const CONTEXTS = [
  "Reading", "Movement Practice", "Class Experience", "Meditation", "Other",
] as const;

/**
 * The weeks confirmed from the syllabus. Everything else is created empty and
 * clearly marked as not yet loaded — a placeholder reading would be worse than
 * an obviously blank one, because it would look authoritative and be wrong.
 */
const KNOWN: Record<number, {
  theme?: string; readings?: string; discussion?: string; instruction?: string;
  kind?: string;
}> = {
  2: {
    readings: "Johnson\nMehling",
    discussion:
      "Which component of embodied experience is most neglected in contemporary Western culture and education?",
    kind: "reading",
  },
  5: {
    readings: "Hanna\nMan's Right to Know (film)\nGeuter et al.",
    discussion:
      "What remains clinically useful in Reich's work, and what should be reconsidered?",
    kind: "reading",
  },
  9: {
    instruction:
      "Experiential week. Rather than a reading reflection, take notes on your somatic experiences during class.",
    kind: "experiential",
  },
  12: {
    readings: "Queering the Body",
    instruction:
      "Try the exercises from Queering the Body and record your experience in the journal.",
    kind: "practice",
  },
};

/** Create the 15 week rows on first use. Idempotent. */
export async function ensureWeeks(ownerId: number) {
  const existing = await q<any>(`SELECT week FROM inquiry_weeks WHERE owner_id=$1`, [ownerId]);
  if (existing.length >= 15) return;
  const have = new Set(existing.map((r: any) => r.week));
  for (let w = 1; w <= 15; w++) {
    if (have.has(w)) continue;
    const k = KNOWN[w] ?? {};
    await q(
      `INSERT INTO inquiry_weeks (owner_id, week, theme, readings, discussion, instruction, kind)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (owner_id, week) DO NOTHING`,
      [ownerId, w, k.theme ?? "", k.readings ?? "", k.discussion ?? "",
       k.instruction ?? "", k.kind ?? "reading"]);
  }
  await one(
    `INSERT INTO inquiry_settings (owner_id) VALUES ($1) ON CONFLICT (owner_id) DO NOTHING
     RETURNING owner_id`, [ownerId]).catch(() => null);
}

/** Weeks that came preloaded from the syllabus, for honest UI labelling. */
export const PRELOADED_WEEKS = Object.keys(KNOWN).map(Number);

// ── Pattern surfacing ────────────────────────────────────────────────────────
//
// This organises the scholar's OWN words. It counts what recurs and quotes
// their sentences back to them. It never generates reflective prose — the
// syllabus requires submitted work to be the student's own, and a tool that
// drafts reflection would quietly violate that.

const STOP = new Set(`a an and are as at be been being but by can did do does for from had has have
he her hers him his how i if in into is it its me my not of on or our out she so some that the their
them then there these they this to too us was we were what when where which while who why will with
you your would could should more most very just really felt feel feeling felt`.split(/\s+/));

const BODY_WORDS = `chest throat belly stomach gut shoulders jaw neck spine back hips pelvis chest
heart hands feet legs arms head face eyes breath ribs diaphragm skin`.split(/\s+/);

const EMOTION_WORDS = `anger angry fear afraid sad sadness grief joy joyful shame guilt calm anxious
anxiety tender warmth heavy light restless still curious curiosity ache longing relief tight`
  .split(/\s+/);

export interface Patterns {
  recurring: { word: string; n: number }[];
  bodyLocations: { word: string; n: number }[];
  emotions: { word: string; n: number }[];
  echoes: { date: string; week: number; sentence: string }[];
  entryCount: number;
}

export function findPatterns(entries: any[]): Patterns {
  const text = entries.map((e) =>
    [e.sensations, e.location, e.emotions, e.breath_body, e.precognitive, e.noticed,
     e.changed, e.surprised, e.alive_constricted, e.body_where, e.accompaniment,
     e.meaning, e.deepens].filter(Boolean).join(" ")).join(" ").toLowerCase();

  const words = text.match(/[a-z][a-z'-]{2,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) {
    if (STOP.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);

  const pick = (list: string[]) =>
    list.map((w) => ({ word: w, n: counts.get(w) ?? 0 }))
      .filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 8);

  // Sentences the scholar wrote that contain their most recurrent word —
  // quoted verbatim, never paraphrased.
  const top = ranked[0]?.[0];
  const echoes: Patterns["echoes"] = [];
  if (top) {
    for (const e of entries) {
      const blob = [e.noticed, e.changed, e.surprised, e.alive_constricted, e.meaning, e.deepens]
        .filter(Boolean).join(" ");
      const sentence = blob.split(/(?<=[.!?])\s+/)
        .find((s: string) => s.toLowerCase().includes(top));
      if (sentence) {
        echoes.push({
          date: String(e.entry_date).slice(0, 10),
          week: e.week,
          sentence: sentence.trim().slice(0, 260),
        });
      }
      if (echoes.length >= 6) break;
    }
  }

  return {
    recurring: ranked.slice(0, 12).map(([word, n]) => ({ word, n })),
    bodyLocations: pick(BODY_WORDS),
    emotions: pick(EMOTION_WORDS),
    echoes,
    entryCount: entries.length,
  };
}
