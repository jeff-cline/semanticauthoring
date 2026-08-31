"use client";
import { useEffect, useState } from "react";

// Consent gate for tracking + visitor identification (spec §5).
// Default is OFF. Nothing loads until the visitor actively accepts.
// Never rendered inside /app — the authenticated workspace is never tracked.

const KEY = "sa_consent_v1";

export default function Consent() {
  const [decided, setDecided] = useState(true);

  useEffect(() => {
    setDecided(Boolean(localStorage.getItem(KEY)));
  }, []);

  function record(granted: boolean) {
    localStorage.setItem(KEY, granted ? "granted" : "declined");
    setDecided(true);
    if (granted) loadTracking();
    // Persist the consent record server-side (timestamp, page, policy version).
    fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ granted, page: location.pathname }),
    }).catch(() => {});
  }

  useEffect(() => {
    if (localStorage.getItem(KEY) === "granted") loadTracking();
  }, []);

  if (decided) return null;

  return (
    <div className="consent" role="region" aria-label="Privacy choices">
      <div className="inner">
        <p>
          We use analytics on our public pages to understand what brings scholars here.
          Nothing runs inside your private workspace, ever. See our{" "}
          <a href="/privacy">privacy policy</a>.
        </p>
        <button className="btn btn-primary" onClick={() => record(true)}>Accept</button>
        <button className="btn btn-secondary" style={{ color: "#dbe4f0", borderColor: "#3a4c66" }}
                onClick={() => record(false)}>Decline</button>
      </div>
    </div>
  );
}

function loadTracking() {
  if (document.getElementById("sa-pc")) return;
  const s = document.createElement("script");
  s.id = "sa-pc";
  s.src = "https://quuik.com/api/pc.js";
  s.defer = true;
  document.head.appendChild(s);
}
