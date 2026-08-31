"use client";
import { useState } from "react";

export default function TestimonialForm({ token, scholar }: { token: string; scholar: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch(`/api/testimonial/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) setState("done");
      else { setState("error"); setMsg(json.error ?? "Something went wrong."); }
    } catch { setState("error"); setMsg("Network error — please try again."); }
  }

  if (state === "done") {
    return (
      <div className="card" role="status">
        <h3 style={{ color: "var(--current)" }}>Thank you.</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Your words have been sent to {scholar}. Nothing is published unless they approve it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <div className="field">
        <label htmlFor="authorName">Your name</label>
        <input id="authorName" name="authorName" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="authorEmail">Your email</label>
        <input id="authorEmail" name="authorEmail" type="email" required autoComplete="email" />
        <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
          Used to verify authorship. Never published.
        </p>
      </div>
      <div className="field">
        <label htmlFor="authorRole">Your role (optional)</label>
        <input id="authorRole" name="authorRole" placeholder="Dissertation chair, colleague, collaborator…" />
      </div>
      <div className="field">
        <label htmlFor="authorInstitution">Institution (optional)</label>
        <input id="authorInstitution" name="authorInstitution" />
      </div>
      <div className="field">
        <label htmlFor="body">Your words</label>
        <textarea id="body" name="body" rows={7} required
                  placeholder={`What has it been like to work with ${scholar}?`} />
      </div>
      <div className="hp" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state === "error" && <p className="error">{msg}</p>}
      <button className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send to " + scholar}
      </button>
    </form>
  );
}
