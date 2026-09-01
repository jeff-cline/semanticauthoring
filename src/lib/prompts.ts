// Daily journal prompts. Rotated deterministically by day-of-year so every
// scholar sees the same prompt on a given day and it changes each morning.

export const INTELLECTUAL = [
  "What am I thinking about today?",
  "What idea or question is emerging?",
  "What challenged my thinking today?",
  "What connection did I notice?",
  "What did I read that I can't stop turning over?",
  "Where did I change my mind, even slightly?",
  "What am I avoiding thinking about?",
];

// Reflective rather than diagnostic, by design.
export const SOMATIC = [
  "What are you noticing in your body as you approach your work today?",
  "Where do you notice curiosity in your body?",
  "What sensations arise when you think about the work you've been avoiding?",
  "Where are you holding tension today?",
  "What does your body seem to need before continuing?",
  "Which part of today's work makes you feel energized or alive?",
  "What happens in your body when the work is going well?",
  "Where do you feel steady right now?",
];

export const STATES = ["energy", "focus", "stress", "curiosity", "confidence", "capacity"] as const;

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 864e5);
}

export function promptsFor(date: Date) {
  const n = dayOfYear(date);
  return {
    intellectual: INTELLECTUAL[n % INTELLECTUAL.length],
    somatic: SOMATIC[n % SOMATIC.length],
  };
}
