"use client";
import { useState } from "react";

// Share links only. Direct posting to X and LinkedIn requires paid, restricted
// API access, so we hand the reader a correct link rather than pretend.

export default function ShareRow({ url, title, author }:
  { url: string; title: string; author: string }) {
  const [copied, setCopied] = useState(false);
  const t = encodeURIComponent(`${title} — by ${author}`);
  const u = encodeURIComponent(url);

  const links: [string, string][] = [
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["X", `https://x.com/intent/tweet?text=${t}&url=${u}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["Threads", `https://www.threads.net/intent/post?text=${t}%20${u}`],
    ["Bluesky", `https://bsky.app/intent/compose?text=${t}%20${u}`],
  ];

  return (
    <div style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
                  padding: "16px 0", display: "flex", gap: 12, flexWrap: "wrap",
                  alignItems: "center" }}>
      <span style={{ color: "var(--muted)", fontSize: ".88rem" }}>Share</span>
      {links.map(([label, href]) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
           className="pill" style={{ textDecoration: "none" }}>{label}</a>
      ))}
      <button className="pill" style={{ cursor: "pointer", border: "1px solid var(--line)",
                                        background: "transparent", font: "inherit" }}
              onClick={() => {
                navigator.clipboard?.writeText(url).then(() => {
                  setCopied(true); setTimeout(() => setCopied(false), 1800);
                }).catch(() => {});
              }}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
