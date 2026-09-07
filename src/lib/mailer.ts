import "server-only";

// ── Direct mail sending ──────────────────────────────────────────────────────
//
// The platform can send its own transactional mail rather than routing through
// the R0cketShip Core. That is the better architecture for anything a user is
// waiting on — a password reset should not depend on a shared marketing system
// whose credentials can lapse without anyone noticing.
//
// Precedence, highest first:
//   1. SMTP configured here          → sends as semanticauthoring.org
//   2. Core, google_workspace        → business mail, if its credentials work
//   3. Core, zapmail                 → cold-outreach mailboxes, last resort
//
// A DELIVERABILITY WARNING, because the code is the easy half:
// sending as a domain with no SPF, DKIM, or DMARC records is worse than sending
// from a warmed third-party domain. Mail providers treat an unauthenticated
// domain with no history as spam by default. Configure the DNS records BEFORE
// switching this on, or password resets will silently stop arriving.

import nodemailer from "nodemailer";

export type Sender = "smtp" | "core_google" | "core_zapmail" | "none";

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailFrom(): string {
  return process.env.MAIL_FROM
    ?? `Semantic Authoring <no-reply@${(process.env.SITE_URL ?? "semanticauthoring.org")
        .replace(/^https?:\/\//, "")}>`;
}

let cached: nodemailer.Transporter | null = null;

function transporter(): nodemailer.Transporter | null {
  if (!smtpConfigured()) return null;
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    requireTLS: port !== 465,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
  });
  return cached;
}

export interface MailResult {
  ok: boolean;
  sender: Sender;
  messageId?: string;
  error?: string;
}

/** Send directly over SMTP. Returns ok:false rather than throwing. */
export async function sendSmtp(
  to: string, subject: string, html: string, text?: string,
): Promise<MailResult> {
  const t = transporter();
  if (!t) return { ok: false, sender: "none", error: "SMTP is not configured" };
  try {
    const info = await t.sendMail({
      from: mailFrom(),
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      headers: {
        // One-click unsubscribe is required for bulk mail and harmless here.
        "X-Entity-Ref-ID": "semanticauthoring",
      },
    });
    return { ok: true, sender: "smtp", messageId: info.messageId };
  } catch (e) {
    return { ok: false, sender: "smtp", error: String((e as Error).message).slice(0, 240) };
  }
}

/** Verify the SMTP credentials without sending anything. */
export async function verifySmtp(): Promise<{ ok: boolean; detail: string }> {
  const t = transporter();
  if (!t) return { ok: false, detail: "SMTP is not configured" };
  try {
    await t.verify();
    return { ok: true, detail: `Authenticated to ${process.env.SMTP_HOST} as ${mailFrom()}` };
  } catch (e) {
    return { ok: false, detail: String((e as Error).message).slice(0, 200) };
  }
}

/**
 * Check the DNS records that actually decide whether mail arrives.
 * Reported honestly: "configured" here means the record exists, not that it is
 * correct for your provider — only a test send proves that.
 */
export async function mailDnsHealth(domain?: string) {
  const host = (domain ?? (process.env.SITE_URL ?? "https://semanticauthoring.org"))
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const dns = await import("node:dns/promises");
  const lookup = async (name: string, kind: "TXT" | "MX") => {
    try {
      if (kind === "MX") return (await dns.resolveMx(name)).map((m) => m.exchange);
      return (await dns.resolveTxt(name)).map((r) => r.join(""));
    } catch { return []; }
  };

  const [txt, mx, dmarc] = await Promise.all([
    lookup(host, "TXT"), lookup(host, "MX"), lookup(`_dmarc.${host}`, "TXT"),
  ]);

  const spf = txt.find((t) => /^v=spf1/i.test(t)) ?? "";

  // Common selectors; a provider-specific one may exist that this misses.
  const selectors = ["google", "default", "s1", "s2", "k1", "resend", "pm", "mail"];
  const dkim = (await Promise.all(
    selectors.map(async (s) => ((await lookup(`${s}._domainkey.${host}`, "TXT")).length
      ? s : null)))).filter(Boolean) as string[];

  return {
    domain: host,
    spf: { present: Boolean(spf), value: spf },
    dkim: { present: dkim.length > 0, selectors: dkim },
    dmarc: { present: dmarc.length > 0, value: dmarc[0] ?? "" },
    mx: { present: mx.length > 0, hosts: mx },
    // Sending as this domain is only safe once SPF and DKIM both exist.
    safeToSendAsDomain: Boolean(spf) && dkim.length > 0,
  };
}
