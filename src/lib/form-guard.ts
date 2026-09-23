// ---------------------------------------------------------------------------
// Portable form guard — Google reCAPTCHA + content heuristics, in ONE file
// with no dependencies and no database.
//
// The network runs nine apps on four different data layers (Prisma, Drizzle,
// pg, none). Rather than wire a settings table into each, this reads the same
// four environment variables everywhere:
//
//   RECAPTCHA_SITE_KEY        public key, also served to the browser
//   RECAPTCHA_SECRET_KEY      private key, siteverify only
//   RECAPTCHA_MODE            monitor (default) | enforce
//   RECAPTCHA_ALLOWED_HOSTS   comma separated; our own origin check
//   RECAPTCHA_FORM_ENDPOINTS  comma separated paths the browser should attach
//                             a token to, e.g. /api/lead,/api/contact
//
// Usage in any POST route:
//
//   const gate = await guardForm(req, "lead", body, {
//     names: [body.name], texts: [body.message], email: body.email, phone: body.phone,
//   });
//   if (gate.blocked) return gate.response;   // silent { ok: true }
//
// Keep this file identical across apps. Fix bugs in the Core copy
// (/var/www/medigap/src/lib/) and re-sync — do not fork it per app.
// ---------------------------------------------------------------------------

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

// ---- config ---------------------------------------------------------------

export type GuardConfig = {
  siteKey: string;
  secretKey: string;
  mode: "monitor" | "enforce";
  minScore: number;
  allowedHosts: string[];
};

export function guardConfig(): GuardConfig {
  const min = Number(process.env.RECAPTCHA_MIN_SCORE);
  return {
    siteKey: (process.env.RECAPTCHA_SITE_KEY ?? "").trim(),
    secretKey: (process.env.RECAPTCHA_SECRET_KEY ?? "").trim(),
    mode: process.env.RECAPTCHA_MODE === "enforce" ? "enforce" : "monitor",
    minScore: Number.isFinite(min) && min > 0 && min < 1 ? min : 0.5,
    allowedHosts: (process.env.RECAPTCHA_ALLOWED_HOSTS ?? "")
      .split(/[\s,]+/)
      .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean),
  };
}

export const recaptchaEnabled = (c: GuardConfig) => Boolean(c.siteKey && c.secretKey);

/** Paths the client should attach a token to. Must match the guarded routes. */
export function formEndpoints(): string[] {
  return (process.env.RECAPTCHA_FORM_ENDPOINTS ?? "")
    .split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
}

/** What the browser is allowed to see. Served by /api/recaptcha/config. */
export function publicGuardConfig(): { siteKey: string; enabled: boolean; endpoints: string[] } {
  const c = guardConfig();
  return { siteKey: c.siteKey, enabled: recaptchaEnabled(c), endpoints: formEndpoints() };
}

/** Exact host, or a subdomain of an allowed parent. Never a naive suffix match. */
export function hostAllowed(hostname: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  const h = String(hostname ?? "").toLowerCase().replace(/\.$/, "");
  if (!h) return false;
  return allowed.some((a) => h === a || h.endsWith("." + a));
}

// ---- content heuristics ---------------------------------------------------
// These run even when reCAPTCHA is only monitoring, and they are what actually
// stopped the live attack: bots do not run JS, so they never carry a token,
// but their payloads are unmistakable.

const VOWELS = new Set("aeiouAEIOU");
const URLISH = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|ru|cn|xyz|top|info|biz|app|link|site|online|shop|club|live|vip)\b)/i;
const SYMBOLS = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}№]/u;

function isGibberishToken(raw: string): boolean {
  const a = raw.replace(/[^A-Za-z]/g, "");
  if (a.length < 5) return false;
  const vowels = [...a].filter((c) => VOWELS.has(c)).length;
  const ratio = vowels / a.length;
  let run = 0, maxRun = 0;
  for (const c of a) { if (!VOWELS.has(c)) { run++; if (run > maxRun) maxRun = run; } else run = 0; }
  let flips = 0;
  for (let i = 1; i < a.length; i++) if (/[A-Z]/.test(a[i]) !== /[A-Z]/.test(a[i - 1])) flips++;
  if (vowels === 0) return true;
  if (a.length >= 8 && ratio < 0.18) return true;
  if (maxRun >= 6) return true;
  if (a.length >= 8 && flips >= 4) return true;
  if (a.length >= 14 && ratio < 0.38) return true;
  return false;
}

export function textLooksSpammy(text: string | undefined | null): boolean {
  return String(text ?? "").split(/[\s,._/\\|-]+/).filter(Boolean).some(isGibberishToken);
}

/** A NAME field carrying a link, an emoji, or 70+ characters is spam, full stop. */
export function nameLooksSpammy(text: string | undefined | null): string | null {
  const t = String(text ?? "");
  if (!t.trim()) return null;
  if (URLISH.test(t)) return "url-in-name";
  if (SYMBOLS.test(t)) return "symbol-in-name";
  if (t.length > 70) return "overlong-name";
  return null;
}

// ---- rate limit -----------------------------------------------------------

const hits = new Map<string, number[]>();
export function rateLimited(ip: string, max = 8, windowMs = 60_000): boolean {
  if (!ip) return false;
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "";
}

// ---- circuit breaker ------------------------------------------------------
// A wrong secret key rejects everything and looks exactly like a bot flood.
// Either way, refusing every submission is the wrong answer.

const BREAK_AFTER = 20, BREAK_WINDOW_MS = 600_000;
let fails = 0, firstFail = 0, breakerOpen = false;

function noteVerdict(passed: boolean) {
  if (passed) { fails = 0; firstFail = 0; breakerOpen = false; return; }
  const now = Date.now();
  if (!fails || now - firstFail > BREAK_WINDOW_MS) { firstFail = now; fails = 0; }
  if (++fails >= BREAK_AFTER) breakerOpen = true;
}
export const breakerState = () => ({ open: breakerOpen, fails });

// ---- reCAPTCHA ------------------------------------------------------------

export type CaptchaResult = { ok: boolean; skipped: boolean; enforcing: boolean; score?: number; reason: string };

export async function verifyRecaptcha(
  token: string | undefined | null,
  opts: { ip?: string; action?: string } = {},
): Promise<CaptchaResult> {
  const cfg = guardConfig();
  const enforcing = () => cfg.mode === "enforce" && !breakerOpen;
  if (!recaptchaEnabled(cfg)) return { ok: true, skipped: true, enforcing: false, reason: "not-configured" };

  const t = String(token ?? "").trim();
  if (!t) { noteVerdict(false); return { ok: false, skipped: false, enforcing: enforcing(), reason: "missing-token" }; }

  const body = new URLSearchParams({ secret: cfg.secretKey, response: t });
  if (opts.ip) body.set("remoteip", opts.ip);

  let data: { success?: boolean; score?: number; action?: string; hostname?: string; "error-codes"?: string[] };
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: true, skipped: true, enforcing: false, reason: `siteverify-http-${res.status}` };
    data = await res.json();
  } catch {
    // A Google outage must never cost us every lead on the network.
    return { ok: true, skipped: true, enforcing: false, reason: "siteverify-unreachable" };
  }

  if (!data.success) {
    // NB: Google does NOT distinguish a wrong secret from a bad token — a
    // garbage secret, an empty secret and a SITE key in the secret field all
    // return invalid-input-response. The circuit breaker is what covers that.
    noteVerdict(false);
    return { ok: false, skipped: false, enforcing: enforcing(), reason: (data["error-codes"] ?? []).join(",") || "rejected" };
  }

  if (!hostAllowed(data.hostname ?? "", cfg.allowedHosts)) {
    noteVerdict(true); // the key is fine; the caller is not
    return { ok: false, skipped: false, enforcing: enforcing(), score: data.score, reason: `host-not-allowed(${data.hostname ?? "unknown"})` };
  }

  const score = typeof data.score === "number" ? data.score : undefined;
  if (score !== undefined && score < cfg.minScore) {
    noteVerdict(true); // a low score is the defence working, not a broken key
    return { ok: false, skipped: false, enforcing: enforcing(), score, reason: `low-score(${score})` };
  }
  if (opts.action && data.action && data.action !== opts.action) {
    noteVerdict(true);
    return { ok: false, skipped: false, enforcing: enforcing(), score, reason: `action-mismatch(${data.action})` };
  }

  noteVerdict(true);
  return { ok: true, skipped: false, enforcing: enforcing(), score, reason: "ok" };
}

// ---- the one call routes make --------------------------------------------

export type GuardOptions = {
  honeypot?: unknown;
  names?: (string | undefined | null)[];
  texts?: (string | undefined | null)[];
  email?: string | null;
  phone?: string | null;
  action?: string;
  threshold?: number;
  rateMax?: number;
  /** Override the body returned to a blocked caller (e.g. a 303 redirect). */
  blockedResponse?: Response;
};

export type GuardVerdict = { blocked: boolean; reason: string; response: Response };

export async function guardForm(
  req: Request,
  form: string,
  body: Record<string, unknown>,
  opts: GuardOptions = {},
): Promise<GuardVerdict> {
  const silent = opts.blockedResponse ?? Response.json({ ok: true });
  const ip = clientIp(req);

  // --- layer 1: reCAPTCHA --------------------------------------------------
  const cap = await verifyRecaptcha(body?.recaptchaToken as string | undefined, {
    ip,
    action: opts.action || form.replace(/[^a-zA-Z0-9_]/g, "_"),
  });
  if (!cap.ok && cap.enforcing) {
    log(form, "recaptcha", cap.reason, ip, cap.score);
    return { blocked: true, reason: `recaptcha:${cap.reason}`, response: silent };
  }
  if (!cap.ok) log(form, "recaptcha-monitor", cap.reason, ip, cap.score);

  // --- layer 2: content heuristics ----------------------------------------
  const reasons: string[] = [];
  let score = 0;

  if (typeof opts.honeypot === "string" && opts.honeypot.trim()) { score += 100; reasons.push("honeypot"); }
  if (opts.phone && String(opts.phone).replace(/[^A-Za-z]/g, "").length >= 3) { score += 100; reasons.push("alpha-phone"); }

  for (const n of opts.names ?? []) {
    const hit = nameLooksSpammy(n);
    if (hit) { score += 100; reasons.push(hit); break; }
  }

  let gib = 0;
  for (const t of [...(opts.texts ?? []), ...(opts.names ?? [])]) if (textLooksSpammy(t)) gib++;
  if (gib >= 2) { score += 100; reasons.push(`gibberish x${gib}`); }
  else if (gib === 1) { score += 50; reasons.push("gibberish x1"); }

  if (opts.email) {
    const lp = String(opts.email).split("@")[0] || "";
    if ((lp.match(/\./g) || []).length >= 3) { score += 50; reasons.push("dotted-email"); }
  }

  if (rateLimited(ip, opts.rateMax ?? 8)) {
    log(form, "rate-limit", "rate-limit", ip);
    return { blocked: true, reason: "rate-limit", response: silent };
  }

  if (score >= (opts.threshold ?? 100)) {
    log(form, "heuristic", reasons.join(","), ip);
    return { blocked: true, reason: `heuristic:${reasons.join(",")}`, response: silent };
  }

  return { blocked: false, reason: cap.skipped ? "recaptcha-skipped" : "pass", response: silent };
}

/** One line per block, greppable in pm2 logs. No database required. */
function log(form: string, source: string, reason: string, ip: string, score?: number) {
  console.log(`[form-guard] blocked form=${form} source=${source} reason=${reason} ip=${ip}${score !== undefined ? ` score=${score}` : ""}`);
}
