import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { coreConfigured, corePing } from "@/lib/core";
import { emailProviderHealth } from "@/lib/email";
import { smtpConfigured, verifySmtp, mailDnsHealth, mailFrom } from "@/lib/mailer";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await q("SELECT 1");
    checks.database = "CONNECTED";
  } catch {
    checks.database = "DOWN";
  }

  if (!coreConfigured()) {
    checks.core = "KEY REQUIRED";
  } else {
    const p = await corePing();
    checks.core = p.ok ? "CONNECTED" : "DOWN";
  }

  checks.turnstile = process.env.TURNSTILE_SECRET_KEY ? "CONNECTED" : "KEY REQUIRED";

  // Email is checked per provider: the Core key can be valid while an
  // individual provider's own credentials are not.
  if (checks.core === "CONNECTED") {
    const providers = await emailProviderHealth().catch(() => []);
    for (const p of providers) checks[`email:${p.provider}`] = p.status;
  }

  // Own SMTP, and the DNS that decides whether anything actually lands.
  let mail: Record<string, unknown> = { sender: "core (no SMTP configured)" };
  if (smtpConfigured()) {
    const v = await verifySmtp().catch(() => ({ ok: false, detail: "check failed" }));
    checks["email:smtp"] = v.ok ? "CONNECTED" : "BAD CREDENTIALS";
    mail = { sender: "smtp", from: mailFrom(), detail: v.detail };
  }
  const dns = await mailDnsHealth().catch(() => null);
  if (dns) {
    mail = { ...mail, dns: {
      spf: dns.spf.present, dkim: dns.dkim.present, dmarc: dns.dmarc.present,
      safeToSendAsDomain: dns.safeToSendAsDomain,
    } };
    checks["email:dns"] = dns.safeToSendAsDomain ? "AUTHENTICATED" : "NOT AUTHENTICATED";
  }

  // A backup that quietly stopped running is worse than no backup, because you
  // believe you have one. Surface its age here so silence is visible.
  let backup: Record<string, unknown> = { status: "NEVER RUN" };
  try {
    const raw = await readFile("/var/lib/semanticauthoring/backup-status.json", "utf8");
    const s = JSON.parse(raw);
    const ageHours = (Date.now() - new Date(s.at).getTime()) / 3_600_000;
    backup = {
      status: !s.ok ? "FAILED" : ageHours > 36 ? "STALE" : "OK",
      at: s.at,
      ageHours: Math.round(ageHours),
      verifiedByRestore: Boolean(s.verified),
      offsite: Boolean(s.offsite),
      ...(s.error ? { error: String(s.error).slice(0, 200) } : {}),
    };
  } catch { /* status file absent — reported as NEVER RUN */ }
  checks.backup = String(backup.status);

  const ok = checks.database === "CONNECTED";
  return NextResponse.json({ ok, checks, backup, mail, at: new Date().toISOString() },
    { status: ok ? 200 : 503 });
}
