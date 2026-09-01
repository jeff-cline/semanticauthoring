import "server-only";
import { coreEmail } from "./core";

// ── Email routing (spec §14) ─────────────────────────────────────────────────
// The Core describes Zapmail as COLD/MARKETING infrastructure on seasoned
// mailboxes. Sending password resets and confirmations through it causes spam
// placement and locks users out of their own accounts.
//
// The provider choice is made HERE, not by callers, so it cannot drift:
//
//   transactional  → google_workspace   (reset, invite, confirm, security)
//   announcement   → zapmail            (platform marketing)
//   broadcast      → Klaviyo            (opted-in subscriber content; §10)
//
// Klaviyo is reached through the Core's integration rather than directly.

const NOTIFY_TO = process.env.NOTIFY_TO ?? "";

const shell = (title: string, inner: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
            background:#F7F4EE;color:#292B30;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;
              border:1px solid #e6e0d6">
    <h1 style="font-family:Georgia,serif;color:#17243A;font-size:22px;margin:0 0 16px">${title}</h1>
    ${inner}
    <hr style="border:0;border-top:1px solid #e6e0d6;margin:28px 0 16px">
    <p style="color:#61708a;font-size:12px;margin:0">
      Semantic Authoring — the operating system for scholarly thinking.
    </p>
  </div>
</div>`;

export const esc = (v: unknown) =>
  v == null || v === ""
    ? "—"
    : String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Transactional — always google_workspace. Never Zapmail. */
export function sendTransactional(to: string, subject: string, title: string, inner: string) {
  return coreEmail({ to, subject, html: shell(title, inner), provider: "google_workspace" });
}

/** Platform announcement — Zapmail is appropriate here. */
export function sendAnnouncement(to: string, subject: string, title: string, inner: string) {
  return coreEmail({ to, subject, html: shell(title, inner), provider: "zapmail" });
}

export function notifyGods(subject: string, title: string, inner: string) {
  if (!NOTIFY_TO) return Promise.resolve({ ok: false, error: "NOTIFY_TO unset" });
  return sendTransactional(NOTIFY_TO, subject, title, inner);
}

export function subscriberConfirmEmail(to: string, scholarName: string, confirmUrl: string) {
  return sendTransactional(
    to,
    `Confirm your subscription to ${scholarName}`,
    "Confirm your subscription",
    `<p>You asked to follow <strong>${esc(scholarName)}</strong> on Semantic Authoring.
        Confirm below and you'll be notified when new work is published.</p>
     <p style="margin:24px 0">
       <a href="${confirmUrl}" style="background:#D96C59;color:#fff;text-decoration:none;
          padding:12px 22px;border-radius:8px;display:inline-block">Confirm subscription</a>
     </p>
     <p style="color:#61708a;font-size:13px">
       If you didn't request this, ignore this message — no subscription is created
       until you confirm.</p>`,
  );
}

export function testimonialRequestEmail(
  to: string,
  fromName: string,
  personalMessage: string,
  url: string,
) {
  return sendTransactional(
    to,
    `${fromName} asked you for a few words`,
    "A request for your words",
    `<p><strong>${esc(fromName)}</strong> has asked whether you'd write a short endorsement
        of their scholarly work.</p>
     ${personalMessage ? `<blockquote style="border-left:3px solid #8FB8AE;margin:16px 0;
        padding:4px 0 4px 16px;color:#41506a">${esc(personalMessage)}</blockquote>` : ""}
     <p style="margin:24px 0">
       <a href="${url}" style="background:#176B73;color:#fff;text-decoration:none;
          padding:12px 22px;border-radius:8px;display:inline-block">Write a few words</a>
     </p>
     <p style="color:#61708a;font-size:13px">
       Nothing you write is published unless ${esc(fromName)} approves it first.</p>`,
  );
}

export function welcomeEmail(to: string, name: string, tier: string) {
  const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
  return sendTransactional(
    to,
    "Welcome to Semantic Authoring",
    `Welcome, ${esc(name)}`,
    `<p>Your scholar workspace is open. You're on the <strong>${esc(tier)}</strong> tier —
        free, with no card and no trial clock.</p>
     <p style="color:#41506a">A good first move is to write down the question you're
        actually trying to answer. Everything else in the workspace hangs off your
        questions — readings, notes, connections, and eventually your writing.</p>
     <p style="margin:26px 0">
       <a href="${base}/app/questions" style="background:#D96C59;color:#fff;text-decoration:none;
          padding:12px 22px;border-radius:8px;display:inline-block">Start with a question</a>
     </p>
     <p style="color:#61708a;font-size:13px">
       Your research, notes, journal, and Life Map are private by default. Nothing becomes
       public unless you deliberately publish it, and you can export everything at any time.</p>`,
  );
}

export function milestoneEmail(to: string, name: string, title: string) {
  return sendTransactional(
    to, `Milestone reached — ${title}`, "You did it.",
    `<p>${esc(name)}, you just recorded a milestone:</p>
     <p style="font-family:Georgia,serif;font-size:20px;color:#C6A15B;margin:18px 0">${esc(title)}</p>
     <p style="color:#41506a">Scholarship takes years. This is part of your original
        contribution to your field, and it deserved more than passing unnoticed.</p>`,
  );
}

export function reviewInviteEmail(
  to: string, fromName: string, title: string, role: string, url: string, due?: string,
) {
  return sendTransactional(
    to,
    `${fromName} asked you to review "${title}"`,
    "A review request",
    `<p><strong>${esc(fromName)}</strong> has shared one piece of work with you as
        ${esc(role)}: <strong>${esc(title)}</strong>.</p>
     ${due ? `<p style="color:#41506a">They have asked for comments by <strong>${esc(due)}</strong>.</p>` : ""}
     <p style="margin:24px 0">
       <a href="${url}" style="background:#5A6B80;color:#fff;text-decoration:none;
          padding:12px 22px;border-radius:8px;display:inline-block">Open and comment</a>
     </p>
     <p style="color:#61708a;font-size:13px">
       This link opens only this one document. It does not give access to their research
       library, journal, or any other work.</p>`,
  );
}

export function reviewCommentEmail(to: string, reviewer: string, title: string, url: string) {
  return sendTransactional(
    to, `New comment on "${title}"`, "New review comment",
    `<p><strong>${esc(reviewer)}</strong> left a comment on <strong>${esc(title)}</strong>.</p>
     <p style="margin:24px 0">
       <a href="${url}" style="background:#176B73;color:#fff;text-decoration:none;
          padding:12px 22px;border-radius:8px;display:inline-block">Read the comment</a>
     </p>`,
  );
}

/**
 * New-publication notification to a confirmed subscriber.
 *
 * Opted-in broadcast — the Core lists Klaviyo as "opted-in marketing automation",
 * which is the correct pipe. Until that integration is wired here it routes
 * transactionally rather than through Zapmail's cold mailboxes, because
 * subscriber broadcasts must never touch cold-email infrastructure.
 */
export function publishedEmail(
  to: string, author: string, title: string, url: string, abstract?: string,
) {
  const base = process.env.SITE_URL ?? "https://semanticauthoring.org";
  return sendTransactional(
    to,
    `${author} published "${title}"`,
    esc(title) as string,
    `<p style="color:#61708a;margin:0 0 14px">New from <strong>${esc(author)}</strong></p>
     ${abstract ? `<p style="color:#41506a">${esc(abstract)}</p>` : ""}
     <p style="margin:26px 0">
       <a href="${url}" style="background:#D96C59;color:#fff;text-decoration:none;
          padding:12px 22px;border-radius:8px;display:inline-block">Read it</a>
     </p>
     <p style="color:#61708a;font-size:12px">
       You subscribed to ${esc(author)} on Semantic Authoring.
       <a href="${base}/unsubscribe">Unsubscribe</a> at any time.</p>`,
  );
}

export function passwordResetEmail(to: string, name: string, url: string) {
  return sendTransactional(
    to,
    "Reset your Semantic Authoring password",
    "Reset your password",
    `<p>${esc(name) === "—" ? "Hello" : `Hello ${esc(name)}`}, someone asked to reset the
        password for this account.</p>
     <p style="margin:26px 0">
       <a href="${url}" style="background:#176B73;color:#fff;text-decoration:none;
          padding:12px 22px;border-radius:8px;display:inline-block">Choose a new password</a>
     </p>
     <p style="color:#61708a;font-size:13px">
       This link works once and expires in one hour. If you didn't ask for it, you can ignore
       this message — your password has not changed.</p>`,
  );
}
