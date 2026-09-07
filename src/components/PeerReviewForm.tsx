"use client";
import { useState } from "react";

export default function PeerReviewForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch(`/api/peer-review/${token}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.ok) { setState("done"); setTimeout(() => location.reload(), 900); }
      else { setState("error"); setMsg(j.error ?? "Something went wrong."); }
    } catch { setState("error"); setMsg("Network error — please try again."); }
  }

  async function decline() {
    await fetch(`/api/peer-review/${token}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ decline: true }),
    }).catch(() => {});
    location.reload();
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: "1.1rem" }}>Your review</h2>
      <div className="field">
        <label htmlFor="recommendation">Recommendation</label>
        <select id="recommendation" name="recommendation" defaultValue="" required
                style={{ maxWidth: 260 }}>
          <option value="" disabled>Choose…</option>
          <option value="accept">Accept</option>
          <option value="minor_revisions">Minor revisions</option>
          <option value="major_revisions">Major revisions</option>
          <option value="reject">Reject</option>
          <option value="unsure">Unsure</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="summary">Summary — what is this work doing?</label>
        <textarea id="summary" name="summary" rows={4} required />
      </div>
      <div className="field">
        <label htmlFor="strengths">Strengths</label>
        <textarea id="strengths" name="strengths" rows={4} />
      </div>
      <div className="field">
        <label htmlFor="concerns">Concerns and suggestions</label>
        <textarea id="concerns" name="concerns" rows={5} />
      </div>
      <div className="field">
        <label htmlFor="confidential">Confidential note to the author (optional)</label>
        <textarea id="confidential" name="confidential" rows={2} />
      </div>
      {state === "error" && <p className="error">{msg}</p>}
      {state === "done" && <p className="success">Review sent. Thank you.</p>}
      <button className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Submit review"}
      </button>
      <button type="button" className="btn btn-secondary" style={{ marginLeft: 12 }}
              onClick={decline}>
        Decline to review
      </button>
    </form>
  );
}
