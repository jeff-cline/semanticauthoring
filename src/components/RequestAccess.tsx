"use client";

import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/SaveButton";

type Status = "pending" | "approved" | "declined" | "revoked" | null;

/**
 * Shown in place of the body when a piece is not open to everyone.
 *
 * The abstract above stays visible — this is about reading the full text, not
 * about hiding that the work exists.
 */
export default function RequestAccess({
  publicationId, title, author, signedIn, status,
}: {
  publicationId: number;
  title: string;
  author: string;
  signedIn: boolean;
  status: Status;
}) {
  const [state, setState] = useState<Status>(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = String(new FormData(e.currentTarget).get("message") ?? "");
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/document-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicationId, message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) setError(json.error || "That didn't send. Please try again.");
      else { setState("pending"); setOpen(false); }
    } catch {
      setError("That didn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="card stage stage-connect" style={{ margin: "30px 0", maxWidth: 640 }}>
      {children}
    </div>
  );

  if (state === "pending") {
    return shell(
      <>
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Request sent</h2>
        <p style={{ marginBottom: 0, color: "var(--muted)" }}>
          {author} will decide whether to share the full text. You will be able to read it
          here once they do.
        </p>
      </>,
    );
  }

  if (state === "declined" || state === "revoked") {
    return shell(
      <>
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Full text not available</h2>
        <p style={{ marginBottom: 0, color: "var(--muted)" }}>
          {author} has not shared the full text of this piece with you. The abstract above
          is the published summary.
        </p>
      </>,
    );
  }

  if (!signedIn) {
    return shell(
      <>
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>The full text is shared on request</h2>
        <p style={{ color: "var(--muted)" }}>
          {author} shares the whole of &ldquo;{title}&rdquo; with readers who ask. Sign in or
          create an account, and your request goes to them directly.
        </p>
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 0 }}>
          <Link className="btn btn-primary" href="/login" style={{ minHeight: 44 }}>Sign in</Link>
          <Link className="btn btn-secondary" href="/join" style={{ minHeight: 44 }}>
            Create an account
          </Link>
        </p>
      </>,
    );
  }

  return shell(
    <>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Read the full text</h2>
      <p style={{ color: "var(--muted)" }}>
        {author} shares the whole of this piece with readers who ask. Tell them briefly why
        you are interested — it helps them decide.
      </p>
      {!open ? (
        <button type="button" className="btn btn-primary" style={{ minHeight: 44 }}
                onClick={() => setOpen(true)}>
          Request access
        </button>
      ) : (
        <form onSubmit={send}>
          <div className="field">
            <label htmlFor="message">Why you would like to read it</label>
            <textarea id="message" name="message" rows={4} maxLength={1500}
                      placeholder="What you are working on, and how this connects." />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={busy} aria-busy={busy}
                  style={{ minHeight: 44 }}>
            {busy ? <><Spinner /> Sending…</> : "Send request"}
          </button>
          <button type="button" className="btn btn-secondary"
                  style={{ marginLeft: 10, minHeight: 44 }} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      )}
    </>,
  );
}
