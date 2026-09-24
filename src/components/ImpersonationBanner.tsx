"use client";

import { useState } from "react";
import { Spinner } from "@/components/SaveButton";

/**
 * Always visible while viewing as someone else.
 *
 * The whole app behaves as that member — their nav, their tier, their content
 * — which is the point. The one thing that must never be ambiguous is whose
 * account you are looking at, and the way back.
 */
export default function ImpersonationBanner({
  memberName, memberEmail, godName,
}: { memberName: string; memberEmail: string; godName: string }) {
  const [busy, setBusy] = useState(false);

  async function stop() {
    setBusy(true);
    try {
      await fetch("/api/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      // Hard navigation, not router.refresh(): identity changed, so every
      // cached segment on the client is now about the wrong person.
      window.location.assign("/app/members");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      style={{
        position: "sticky", top: 0, zIndex: 90,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "10px 18px",
        background: "#8A2B2B", color: "#fff",
        fontSize: ".9rem", fontWeight: 600,
      }}
    >
      <span>
        Viewing as <strong>{memberName || memberEmail}</strong>
        <span style={{ fontWeight: 400, opacity: 0.85 }}> — you are {godName}</span>
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={busy}
        style={{
          marginInlineStart: "auto", minHeight: 36, padding: "6px 14px",
          borderRadius: 999, border: "1px solid rgba(255,255,255,.6)",
          background: "transparent", color: "#fff", font: "inherit", cursor: "pointer",
        }}
      >
        {busy ? <><Spinner /> Returning…</> : "Return to my account"}
      </button>
    </div>
  );
}
