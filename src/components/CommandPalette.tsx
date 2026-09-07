"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ⌘K / Ctrl-K. Navigation and quick capture, no server round trip to open.

interface Cmd { label: string; hint?: string; href?: string; action?: "capture" }

const COMMANDS: Cmd[] = [
  { label: "Capture a thought", hint: "quick", action: "capture" },
  { label: "Dashboard", href: "/app" },
  { label: "Research library", href: "/app/library", hint: "read" },
  { label: "My reading", href: "/app/reading", hint: "read" },
  { label: "Import references", href: "/app/import", hint: "DOI, BibTeX, RIS" },
  { label: "Courses", href: "/app/courses", hint: "read" },
  { label: "Calendar", href: "/app/calendar", hint: "plan" },
  { label: "Questions", href: "/app/questions", hint: "connect" },
  { label: "Knowledge map", href: "/app/map", hint: "connect" },
  { label: "Find related", href: "/app/related", hint: "vector search" },
  { label: "Literature map", href: "/app/literature", hint: "synthesize" },
  { label: "Life Map", href: "/app/life-map", hint: "connect" },
  { label: "Groups", href: "/app/groups", hint: "connect" },
  { label: "Collaborate", href: "/app/collaborate", hint: "connect" },
  { label: "Authoring studio", href: "/app/studio", hint: "author" },
  { label: "Claim ledger", href: "/app/claims", hint: "author" },
  { label: "Citation integrity", href: "/app/integrity", hint: "author" },
  { label: "Dissertation", href: "/app/dissertation" },
  { label: "Defense preparation", href: "/app/defense" },
  { label: "Mentor & committee review", href: "/app/review", hint: "review" },
  { label: "Peer review", href: "/app/peer-review", hint: "review" },
  { label: "Advisees", href: "/app/faculty", hint: "faculty" },
  { label: "Publications", href: "/app/publications", hint: "publish" },
  { label: "Publication pipeline", href: "/app/pipeline", hint: "publish" },
  { label: "Publication readiness", href: "/app/readiness", hint: "publish" },
  { label: "Journal discovery", href: "/app/journals", hint: "publish" },
  { label: "Repository deposit", href: "/app/deposit", hint: "publish" },
  { label: "Grants", href: "/app/grants", hint: "publish" },
  { label: "Citation watch", href: "/app/citations", hint: "celebrate" },
  { label: "Scholarly presence", href: "/app/presence", hint: "publish" },
  { label: "Milestones", href: "/app/timeline", hint: "celebrate" },
  { label: "Daily journal", href: "/app/journal" },
  { label: "Embodied Inquiry", href: "/app/inquiry" },
  { label: "Notifications", href: "/app/notifications" },
  { label: "Export your work", href: "/app/export" },
  { label: "Public profile", href: "/app/profile" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [capture, setCapture] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setTerm(""); setCapture(false); setSel(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open, capture]);

  const results = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return COMMANDS.slice(0, 9);
    return COMMANDS.filter((c) =>
      c.label.toLowerCase().includes(t) || (c.hint ?? "").toLowerCase().includes(t)).slice(0, 10);
  }, [term]);

  async function run(c: Cmd) {
    if (c.action === "capture") { setCapture(true); setTerm(""); return; }
    if (c.href) { setOpen(false); router.push(c.href); }
  }

  async function saveCapture() {
    const body = term.trim();
    if (!body) return;
    await fetch("/api/capture", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, kind: "idea" }),
    }).catch(() => {});
    setOpen(false); setCapture(false); setTerm("");
    router.refresh();
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette"
         onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
         style={{ position: "fixed", inset: 0, background: "rgba(10,16,26,.55)",
                  zIndex: 200, display: "flex", alignItems: "flex-start",
                  justifyContent: "center", paddingTop: "12vh" }}>
      <div style={{ width: "min(620px, 92vw)", background: "var(--card)",
                    border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden",
                    boxShadow: "0 24px 60px rgba(10,16,26,.4)" }}>
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (capture) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveCapture(); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && results[sel]) { e.preventDefault(); void run(results[sel]); }
          }}
          placeholder={capture ? "What are you thinking?  (⌘↵ to save)" : "Search the workspace…"}
          style={{ border: 0, borderRadius: 0, fontSize: "1.05rem", padding: "18px 20px" }}
        />
        {capture ? (
          <div style={{ padding: "12px 20px 18px", display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={() => void saveCapture()}>Capture</button>
            <button className="btn btn-secondary" onClick={() => setCapture(false)}>Back</button>
          </div>
        ) : (
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {results.length === 0 && (
              <p style={{ padding: "16px 20px", color: "var(--muted)", margin: 0 }}>
                Nothing matches.
              </p>
            )}
            {results.map((c, i) => (
              <button key={c.label} onMouseEnter={() => setSel(i)} onClick={() => void run(c)}
                      style={{ display: "flex", width: "100%", textAlign: "left", gap: 10,
                               alignItems: "center", padding: "12px 20px", border: 0,
                               cursor: "pointer", font: "inherit",
                               background: i === sel ? "rgba(23,107,115,.10)" : "transparent",
                               color: "var(--fg)" }}>
                <span>{c.label}</span>
                {c.hint && (
                  <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: ".8rem" }}>
                    {c.hint}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--line)",
                      color: "var(--muted)", fontSize: ".78rem" }}>
          ↑↓ to move · ↵ to open · esc to close
        </div>
      </div>
    </div>
  );
}
