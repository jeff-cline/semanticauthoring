import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordProblem } from "../src/lib/auth";
import { can, limitFor } from "../src/lib/tiers";
import { leadSchema, subscribeSchema, testimonialSchema, rateLimited } from "../src/lib/validate";
import { ANSWERS, bySlug } from "../src/lib/answers";

describe("passwords", () => {
  it("round-trips a correct password", async () => {
    const h = await hashPassword("Correct-Horse-99");
    expect(await verifyPassword("Correct-Horse-99", h)).toBe(true);
  });
  it("rejects a wrong password", async () => {
    const h = await hashPassword("Correct-Horse-99");
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("produces a different hash each time (salted)", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("enforces password strength", () => {
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("alllowercase123")).toBeTruthy();
    expect(passwordProblem("ALLUPPERCASE123")).toBeTruthy();
    expect(passwordProblem("NoDigitsInHere!")).toBeTruthy();
    expect(passwordProblem("PerfectlyFine12")).toBeNull();
  });
});

describe("tier gating", () => {
  const free = { role: "scholar", tier: "free" };
  const scholar = { role: "scholar", tier: "scholar" };
  const doctoral = { role: "scholar", tier: "doctoral" };
  const god = { role: "god", tier: "free" };

  it("keeps publishing out of the free tier", () => {
    expect(can(free, "publishing")).toBe(false);
    expect(can(scholar, "publishing")).toBe(true);
  });
  it("restricts dissertation features to doctoral", () => {
    expect(can(scholar, "dissertation")).toBe(false);
    expect(can(doctoral, "dissertation")).toBe(true);
  });
  it("lets God bypass every gate regardless of tier", () => {
    expect(can(god, "dissertation")).toBe(true);
    expect(can(god, "publishing")).toBe(true);
  });
  it("denies everything to an anonymous visitor", () => {
    expect(can(null, "profile")).toBe(false);
  });
  it("applies numeric limits by tier and lifts them for God", () => {
    expect(limitFor(free, "contacts")).toBe(25);
    expect(limitFor(scholar, "contacts")).toBeNull();
    expect(limitFor(god, "contacts")).toBeNull();
  });
});

describe("validation", () => {
  it("accepts a well-formed lead", () => {
    expect(leadSchema.safeParse({ name: "A Scholar", email: "a@b.edu" }).success).toBe(true);
  });
  it("rejects a bad email", () => {
    expect(leadSchema.safeParse({ name: "A", email: "not-an-email" }).success).toBe(false);
  });
  it("requires a scholar id to subscribe", () => {
    expect(subscribeSchema.safeParse({ email: "a@b.edu" }).success).toBe(false);
    expect(subscribeSchema.safeParse({ scholarId: 1, email: "a@b.edu" }).success).toBe(true);
  });
  it("requires a testimonial to have substance", () => {
    expect(testimonialSchema.safeParse({
      authorName: "X", authorEmail: "a@b.edu", body: "too short",
    }).success).toBe(false);
  });
  it("rate limits after the threshold", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimited(key, 3)).toBe(false);
    expect(rateLimited(key, 3)).toBe(true);
  });
});

describe("answer pages", () => {
  it("has unique slugs", () => {
    expect(new Set(ANSWERS.map((a) => a.slug)).size).toBe(ANSWERS.length);
  });
  it("gives every page a direct, quotable answer", () => {
    for (const a of ANSWERS) {
      expect(a.answer.length).toBeGreaterThan(120);
      expect(a.answer.length).toBeLessThan(700);
    }
  });
  it("only links related pages that exist", () => {
    for (const a of ANSWERS) for (const r of a.related) expect(bySlug(r)).toBeDefined();
  });
  it("gives every page FAQs and a description", () => {
    for (const a of ANSWERS) {
      expect(a.faqs.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(40);
    }
  });
});

// ── phase 3 ──────────────────────────────────────────────────────────────────
import { promptsFor, INTELLECTUAL, SOMATIC, STATES } from "../src/lib/prompts";
import { allowedType, MAX_BYTES } from "../src/lib/storage";

describe("journal prompts", () => {
  it("is deterministic for a given day", () => {
    const d = new Date("2026-03-14T09:00:00Z");
    expect(promptsFor(d)).toEqual(promptsFor(new Date("2026-03-14T22:00:00Z")));
  });
  it("rotates across days", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      seen.add(promptsFor(d).somatic);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
  it("always returns prompts from the catalogue", () => {
    for (let i = 0; i < 40; i++) {
      const p = promptsFor(new Date(Date.UTC(2026, 0, 1 + i * 9)));
      expect(INTELLECTUAL).toContain(p.intellectual);
      expect(SOMATIC).toContain(p.somatic);
    }
  });
  it("keeps somatic prompts reflective rather than diagnostic", () => {
    for (const s of SOMATIC) expect(s.toLowerCase()).not.toMatch(/should|must|wrong|problem/);
  });
  it("tracks the six optional states", () => {
    expect([...STATES]).toEqual(
      ["energy", "focus", "stress", "curiosity", "confidence", "capacity"]);
  });
});

describe("file storage policy", () => {
  it("accepts scholarly document types", () => {
    expect(allowedType("application/pdf")).toBe(true);
    expect(allowedType("text/markdown")).toBe(true);
  });
  it("rejects executables and images", () => {
    expect(allowedType("application/x-msdownload")).toBe(false);
    expect(allowedType("image/svg+xml")).toBe(false);
    expect(allowedType("application/octet-stream")).toBe(false);
  });
  it("caps uploads at 40 MB", () => {
    expect(MAX_BYTES).toBe(40 * 1024 * 1024);
  });
});

describe("tiers cover phase 3 features", () => {
  const free = { role: "scholar", tier: "free" };
  it("gives every tier the workspace basics", () => {
    for (const f of ["library", "annotations", "capture", "journal", "authoring",
                     "questions", "lifemap", "milestones"] as const) {
      expect(can(free, f)).toBe(true);
    }
  });
  it("limits the free tier by count rather than by feature", () => {
    expect(limitFor(free, "libraryItems")).toBe(50);
    expect(limitFor(free, "authoringDocs")).toBe(3);
  });
});

// ── phases 4 and 5 ───────────────────────────────────────────────────────────
import { slugify, handleProblem, readingTime, RESERVED } from "../src/lib/slug";
import { normalizeDoi } from "../src/lib/scholarly";

describe("handles and slugs", () => {
  it("slugifies titles safely", () => {
    expect(slugify("What Is *Semantic* Authoring?")).toBe("what-is-semantic-authoring");
    expect(slugify("  Trailing — dashes  ")).toBe("trailing-dashes");
    expect(slugify("!!!", "fallback")).toBe("fallback");
  });
  it("rejects handles that would shadow real routes", () => {
    for (const r of ["app", "api", "login", "search", "scholars", "answers"]) {
      expect(RESERVED.has(r)).toBe(true);
      expect(handleProblem(r)).toBeTruthy();
    }
  });
  it("enforces handle shape", () => {
    expect(handleProblem("ab")).toBeTruthy();          // too short
    expect(handleProblem("Has-Capitals")).toBeTruthy();
    expect(handleProblem("has_underscore")).toBeTruthy();
    expect(handleProblem("-leading")).toBeTruthy();
    expect(handleProblem("a-good-handle")).toBeNull();
  });
  it("estimates reading time from words", () => {
    expect(readingTime("")).toBe(1);
    expect(readingTime(new Array(450).fill("word").join(" "))).toBe(2);
  });
});

describe("DOI normalisation", () => {
  it("strips resolver prefixes", () => {
    for (const v of ["10.1038/nature12373", "https://doi.org/10.1038/nature12373",
                     "http://dx.doi.org/10.1038/nature12373", "doi:10.1038/nature12373",
                     "  10.1038/nature12373  "]) {
      expect(normalizeDoi(v)).toBe("10.1038/nature12373");
    }
  });
  it("returns empty for nothing", () => {
    expect(normalizeDoi("")).toBe("");
  });
});

describe("public search is public-only by construction", () => {
  it("constrains every query to published work and public profiles", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/search.ts", "utf8");
    // Each SELECT that reaches publications must filter on published status,
    // and each that reaches profiles must filter on is_public.
    const selects = src.split("SELECT").slice(1);
    const touching = selects.filter((s) => /FROM\s+publications|JOIN\s+profiles/.test(s));
    expect(touching.length).toBeGreaterThan(0);
    for (const s of touching) {
      if (/publications/.test(s)) expect(s).toMatch(/status\s*=\s*'published'/);
      if (/profiles/.test(s)) expect(s).toMatch(/is_public\s*=\s*TRUE/);
    }
  });
  it("never reads private workspace tables", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/search.ts", "utf8");
    // Look at actual table references (FROM / JOIN), not prose in comments.
    // Strip comments first, then match uppercase SQL keywords only.
    const sql = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const referenced = [...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/g)]
      .map((m) => m[1].toLowerCase());
    for (const t of ["journal_entries", "life_experiences", "annotations", "captures",
                     "documents", "claims", "claim_evidence", "contacts", "sources",
                     "questions", "milestones", "shares", "review_comments"]) {
      expect(referenced).not.toContain(t);
    }
    // It may only reach these three.
    expect(new Set(referenced)).toEqual(new Set(["publications", "profiles", "users"]));
  });
});

// ── access tokens ────────────────────────────────────────────────────────────
import { mintToken, TOKEN_PREFIX } from "../src/lib/token";
import { createHash } from "node:crypto";

describe("access tokens", () => {
  it("mints a prefixed token and stores only its hash", () => {
    const t = mintToken();
    expect(t.plain.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.hash).toBe(createHash("sha256").update(t.plain).digest("hex"));
    expect(t.hash).not.toContain(t.plain);
    expect(t.plain.length).toBeGreaterThan(30);
  });
  it("never repeats a token", () => {
    const seen = new Set(Array.from({ length: 50 }, () => mintToken().plain));
    expect(seen.size).toBe(50);
  });
  it("stores a prefix short enough to be non-recoverable", () => {
    const t = mintToken();
    expect(t.prefix.length).toBeLessThan(t.plain.length / 2);
    expect(t.plain.startsWith(t.prefix)).toBe(true);
  });
});

describe("MCP server contract", () => {
  it("marks everything it writes as AI-generated", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("mcp/server.mjs", "utf8");
    // The notes_create path must stamp provenance.
    expect(src).toMatch(/generated_by_ai:\s*true/);
    expect(src).toMatch(/ai_model/);
  });
  it("documents that it never fabricates", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("mcp/server.mjs", "utf8");
    expect(src).toContain("NOT_VERIFIED");
    expect(src.toLowerCase()).toContain("never fabricate");
  });
});
