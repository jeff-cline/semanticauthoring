"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  synthesis: "Weekly synthesis saved.",
  week: "Week details saved.",
  entry: "Entry saved.",
  settings: "Course details saved.",
};

/**
 * Confirms a save actually landed.
 *
 * Server actions revalidate in place, so a successful save looked exactly like
 * doing nothing — the fields already held what you typed. Each action now
 * redirects back with ?saved=<what>, and this says so out loud, then removes
 * the parameter so a refresh or a shared link does not re-announce it.
 */
export default function SavedNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const saved = params.get("saved");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!saved) return;
    setVisible(true);
    // Drop the query string immediately so the badge cannot reappear on reload.
    router.replace(pathname, { scroll: false });
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [saved, pathname, router]);

  if (!visible || !saved) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        insetInlineEnd: 20,
        insetBlockStart: 20,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 18px",
        borderRadius: 10,
        background: "var(--ink, #17243A)",
        color: "#fff",
        boxShadow: "0 10px 30px rgba(0,0,0,.22)",
        fontWeight: 600,
        fontSize: ".94rem",
        maxWidth: "min(92vw, 380px)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "1.05rem", lineHeight: 1 }}>✓</span>
      <span>{MESSAGES[saved] ?? "Saved."}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        style={{
          marginInlineStart: "auto", background: "none", border: 0, color: "inherit",
          opacity: 0.7, cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
