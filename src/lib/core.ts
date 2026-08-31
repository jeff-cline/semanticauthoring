import "server-only";

// ── R0cketShip Core API client ───────────────────────────────────────────────
// The shared services layer this standalone site sits on. Leads and email go
// THROUGH the Core so integrations (Zapmail, Google Workspace, Twilio, CRM,
// PredictiveData) live in ONE place.
//
// This file is server-only: importing it from a client component is a build
// error, which structurally guarantees the Core secret cannot reach the browser.

const BASE = process.env.CORE_API_BASE ?? "https://medigap.plus";
const KEY = process.env.CORE_API_KEY;
const SECRET = process.env.CORE_API_SECRET;

export function coreConfigured(): boolean {
  return Boolean(KEY && SECRET);
}

type CoreResult = { ok: boolean; error?: string; [k: string]: unknown };

async function call(path: string, body: unknown): Promise<CoreResult> {
  if (!coreConfigured()) return { ok: false, error: "core api not configured" };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-core-key": KEY!,
        "x-core-secret": SECRET!,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as CoreResult;
    return res.ok && json.ok !== false
      ? { ...json, ok: true }
      : { ...json, ok: false, error: json.error ?? `http ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

export interface CoreLead {
  name: string;
  email: string;
  phone?: string;
  creatorRef?: string;
  notes?: string;
}

/** Push a lead into the Core CRM (enriched + attributed). Scope: lead:create. */
export function coreLead(lead: CoreLead): Promise<CoreResult> {
  return call("/api/core/lead", { ...lead, creatorRef: lead.creatorRef ?? "semanticauthoring.org" });
}

export interface CoreEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  provider?: "zapmail" | "google_workspace" | "smtp";
}

/** Raw email send. Prefer the typed helpers in lib/email.ts — they pick the provider. */
export function coreEmail(msg: CoreEmail): Promise<CoreResult> {
  return call("/api/core/email", msg);
}

export async function corePing(): Promise<CoreResult> {
  if (!coreConfigured()) return { ok: false, error: "not configured" };
  try {
    const res = await fetch(`${BASE}/api/core/ping`, {
      headers: { "x-core-key": KEY!, "x-core-secret": SECRET! },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return res.ok ? { ...(await res.json().catch(() => ({}))), ok: true } : { ok: false, error: `http ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 120) };
  }
}
