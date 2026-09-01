"use client";
import { useState } from "react";

export default function SubscribeForm({ scholarId, scholarName }:
  { scholarId: number; scholarName: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, scholarId, sourcePage: location.pathname }),
      });
      const json = await res.json();
      if (json.ok) setState("done");
      else { setState("error"); setMsg(json.error ?? "Something went wrong."); }
    } catch { setState("error"); setMsg("Network error — please try again."); }
  }

  if (state === "done") {
    return (
      <div className="card stage stage-publish" role="status">
        <h3 style={{ fontSize: "1.02rem" }}>Check your email.</h3>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: ".93rem" }}>
          We&rsquo;ve sent a confirmation link. You won&rsquo;t receive anything until you
          confirm.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card stage stage-publish">
      <h3 style={{ fontSize: "1.02rem", marginBottom: 4 }}>Follow {scholarName}</h3>
      <p style={{ color: "var(--muted)", fontSize: ".92rem", marginTop: 0 }}>
        Be notified when new work is published.
      </p>
      <div className="field">
        <label htmlFor="sub-name">Name</label>
        <input id="sub-name" name="name" autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="sub-email">Email</label>
        <input id="sub-email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="hp" aria-hidden="true"><input name="website" tabIndex={-1} /></div>
      {state === "error" && <p className="error">{msg}</p>}
      <button className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Subscribe"}
      </button>
      <p style={{ color: "var(--muted)", fontSize: ".82rem", marginTop: 12, marginBottom: 0 }}>
        Double opt-in. One-click unsubscribe in every message. Your address is never shared.
      </p>
    </form>
  );
}
