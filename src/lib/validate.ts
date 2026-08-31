import { z } from "zod";

export const emailSchema = z.string().trim().email().max(200);

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: emailSchema,
  interest: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().max(4000).optional().default(""),
  sourcePage: z.string().trim().max(300).optional().default(""),
  referrer: z.string().trim().max(500).optional().default(""),
  website: z.string().optional().default(""),   // honeypot
});

export const subscribeSchema = z.object({
  scholarId: z.coerce.number().int().positive(),
  name: z.string().trim().max(200).optional().default(""),
  email: emailSchema,
  sourcePage: z.string().trim().max(300).optional().default(""),
  website: z.string().optional().default(""),
});

export const testimonialSchema = z.object({
  authorName: z.string().trim().min(1).max(200),
  authorEmail: emailSchema,
  authorRole: z.string().trim().max(200).optional().default(""),
  authorInstitution: z.string().trim().max(200).optional().default(""),
  body: z.string().trim().min(20).max(4000),
  website: z.string().optional().default(""),
});

// ── Rate limiting ────────────────────────────────────────────────────────────
// In-memory sliding window. Adequate for a single-process deployment; swap for
// a shared store if this ever runs multi-instance.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();      // crude cap; prevents unbounded growth
  return arr.length > max;
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// ── Turnstile ────────────────────────────────────────────────────────────────
// Falls back to honeypot + rate limiting until keys are configured (spec §4).
export async function turnstileOk(token?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;               // not configured — fallback protections apply
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}
