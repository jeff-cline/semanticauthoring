"use client";
import { useState } from "react";

export default function JoinForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, sourcePage: location.pathname, referrer: document.referrer }),
      });
      const json = await res.json();
      if (json.ok) { setState("done"); }
      else { setState("error"); setMsg(json.error ?? "Something went wrong."); }
    } catch {
      setState("error");
      setMsg("Network error — please try again.");
    }
  }

  if (state === "done") {
    return (
      <div className="card" role="status">
        <h3 style={{ color: "var(--current)" }}>Thank you — you&rsquo;re on the list.</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          We&rsquo;ll be in touch as founding scholar workspaces open up. Nothing else will
          arrive in your inbox in the meantime.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="interest">Where are you in your scholarly journey?</label>
        <select id="interest" name="interest" defaultValue="">
          <option value="">Prefer not to say</option>
          <option>Considering doctoral study</option>
          <option>Coursework</option>
          <option>Comprehensive exams / candidacy</option>
          <option>Dissertation</option>
          <option>Postdoctoral</option>
          <option>Faculty</option>
          <option>Independent researcher</option>
          <option>Institution or program</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="message">What are you working on? (optional)</label>
        <textarea id="message" name="message" rows={4} />
      </div>
      {/* honeypot — real people never fill this */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state === "error" && <p className="error">{msg}</p>}
      <button className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Request early access"}
      </button>
      <p style={{ color: "var(--muted)", fontSize: ".85rem", marginBottom: 0, marginTop: 14 }}>
        We use your details only to contact you about early access.
      </p>
    </form>
  );
}
