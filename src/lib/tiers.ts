// Tier + feature gating (spec §7). Flags resolve FROM the tier — never stored
// per user — so tiers can be re-cut without a migration. God bypasses all gates.

export type Tier = "free" | "scholar" | "doctoral";

export const TIERS: { key: Tier; name: string; price: string; blurb: string }[] = [
  { key: "free", name: "Free", price: "$0", blurb: "Begin your scholarly workspace." },
  { key: "scholar", name: "Scholar", price: "$0", blurb: "Research, write, and publish publicly." },
  { key: "doctoral", name: "Doctoral", price: "$0", blurb: "Coursework, dissertation, committee review." },
];

export type Feature =
  | "profile" | "library" | "annotations" | "capture" | "journal" | "authoring"
  | "publishing" | "semantic" | "groups" | "review" | "courses" | "dissertation"
  | "pipeline" | "milestones" | "questions" | "lifemap" | "scholarCrm"
  | "testimonials" | "subscribers" | "export" | "timeline";

const MATRIX: Record<Feature, Tier[]> = {
  profile:      ["free", "scholar", "doctoral"],
  library:      ["free", "scholar", "doctoral"],
  annotations:  ["free", "scholar", "doctoral"],
  capture:      ["free", "scholar", "doctoral"],
  journal:      ["free", "scholar", "doctoral"],
  authoring:    ["free", "scholar", "doctoral"],
  milestones:   ["free", "scholar", "doctoral"],
  questions:    ["free", "scholar", "doctoral"],
  lifemap:      ["free", "scholar", "doctoral"],
  scholarCrm:   ["free", "scholar", "doctoral"],
  testimonials: ["free", "scholar", "doctoral"],
  export:       ["free", "scholar", "doctoral"],
  semantic:     ["free", "scholar", "doctoral"],
  timeline:     ["free", "scholar", "doctoral"],
  groups:       ["free", "scholar", "doctoral"],
  publishing:   ["scholar", "doctoral"],
  subscribers:  ["scholar", "doctoral"],
  review:       ["doctoral"],
  courses:      ["doctoral"],
  dissertation: ["doctoral"],
  pipeline:     ["doctoral"],
};

/** Numeric limits by tier. null = unlimited. */
export const LIMITS: Record<string, Record<Tier, number | null>> = {
  libraryItems:        { free: 50, scholar: null, doctoral: null },
  authoringDocs:       { free: 3, scholar: null, doctoral: null },
  contacts:            { free: 25, scholar: null, doctoral: null },
  testimonialRequests: { free: 5, scholar: null, doctoral: null },
};

export function can(user: { role: string; tier: string } | null, feature: Feature): boolean {
  if (!user) return false;
  if (user.role === "god") return true;           // God bypasses every gate
  return MATRIX[feature].includes(user.tier as Tier);
}

export function limitFor(
  user: { role: string; tier: string } | null,
  key: keyof typeof LIMITS,
): number | null {
  if (!user || user.role === "god") return null;
  return LIMITS[key][user.tier as Tier] ?? null;
}
