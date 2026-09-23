"use client";

import { useState } from "react";
import { Spinner } from "@/components/SaveButton";

type Kind = "contact" | "collaborate";

/**
 * "Contact me" and "Collaborate with me" on a public profile.
 *
 * The form only opens when asked for, so the profile reads as a scholar's page
 * rather than a lead-capture funnel.
 */
export default function ProfileContact({
  handle, name, contactEnabled, openToCollaboration, collaborationNote,
}: {
  handle: string;
  name: string;
  contactEnabled: boolean;
  openToCollaboration: boolean;
  collaborationNote: string;
}) {
  const [open, setOpen] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!contactEnabled && !openToCollaboration) return null;

  const firstName = name.split(" ")[0] || name;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/profile-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, handle, kind: open }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setError(json.error || "That didn't send. Please try again.");
      } else {
        setDone(open === "collaborate"
          ? `Sent. ${firstName} will see your collaboration note.`
          : `Sent. ${firstName} will see your message.`);
        setOpen(null);
        form.reset();
      }
    } catch {
      setError("That didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ margin: "22px 0 4px" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {contactEnabled && (
          <button type="button" className="btn btn-secondary"
                  style={{ minHeight: 44 }}
                  onClick={() => { setOpen(open === "contact" ? null : "contact"); setDone(null); }}>
            Contact {firstName}
          </button>
        )}
        {openToCollaboration && (
          <button type="button" className="btn btn-primary"
                  style={{ minHeight: 44 }}
                  onClick={() => { setOpen(open === "collaborate" ? null : "collaborate"); setDone(null); }}>
            Collaborate with {firstName}
          </button>
        )}
      </div>

      {done && (
        <p role="status" style={{ color: "var(--current)", fontWeight: 600, marginTop: 12 }}>
          ✓ {done}
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="card" style={{ marginTop: 14, maxWidth: 560 }}>
          <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>
            {open === "collaborate" ? `Collaborate with ${firstName}` : `Contact ${firstName}`}
          </h2>
          {open === "collaborate" && collaborationNote && (
            <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>{collaborationNote}</p>
          )}

          {/* Bots fill every field they find. A real person never sees this. */}
          <div aria-hidden="true"
               style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
            <label htmlFor="website2">Website</label>
            <input id="website2" name="website2" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="field">
            <label htmlFor="from_name">Your name</label>
            <input id="from_name" name="from_name" required maxLength={160} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="from_email">Your email</label>
            <input id="from_email" name="from_email" type="email" required maxLength={200}
                   autoComplete="email" />
          </div>
          {open === "contact" && (
            <div className="field">
              <label htmlFor="subject">Subject</label>
              <input id="subject" name="subject" maxLength={200} />
            </div>
          )}
          <div className="field">
            <label htmlFor="body">
              {open === "collaborate"
                ? "What would you like to work on together?"
                : "Your message"}
            </label>
            <textarea id="body" name="body" rows={5} required maxLength={4000} />
          </div>

          {error && <p className="error">{error}</p>}

          <button className="btn btn-primary" disabled={busy} aria-busy={busy}
                  style={{ minHeight: 44 }}>
            {busy ? <><Spinner /> Sending…</> : "Send"}
          </button>
          <button type="button" className="btn btn-secondary"
                  style={{ marginLeft: 10, minHeight: 44 }}
                  onClick={() => setOpen(null)}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
