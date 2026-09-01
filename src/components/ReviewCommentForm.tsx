"use client";
import { useState } from "react";

export default function ReviewCommentForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setState("sending");
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) { setState("done"); form.reset(); setTimeout(() => location.reload(), 900); }
      else { setState("error"); setMsg(json.error ?? "Something went wrong."); }
    } catch { setState("error"); setMsg("Network error — please try again."); }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: "1rem" }}>Leave a comment</h3>
      <div className="field">
        <label htmlFor="anchor">Quote the passage you&rsquo;re responding to (optional)</label>
        <textarea id="anchor" name="anchor" rows={2} />
      </div>
      <div className="field">
        <label htmlFor="body">Your comment</label>
        <textarea id="body" name="body" rows={4} required />
      </div>
      {state === "error" && <p className="error">{msg}</p>}
      {state === "done" && <p className="success">Comment sent.</p>}
      <button className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send comment"}
      </button>
    </form>
  );
}
