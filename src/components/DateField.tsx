"use client";
import { useId } from "react";

/**
 * The one date input used everywhere in the platform.
 *
 * Scholarly dates are frequently approximate — "sometime in my twenties",
 * "spring of my second year" — so an exact picker alone would force false
 * precision. This pairs a real date picker with an optional free-text note, and
 * neither is required. Precision you don't have is worse than no date at all.
 */
export default function DateField({
  name, label, defaultValue, noteName, noteValue, notePlaceholder, hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  noteName?: string;
  noteValue?: string | null;
  notePlaceholder?: string;
  hint?: string;
}) {
  const id = useId();
  const iso = defaultValue ? String(defaultValue).slice(0, 10) : "";

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input id={id} name={name} type="date" defaultValue={iso}
               style={{ maxWidth: 190 }} />
        {noteName && (
          <input name={noteName} defaultValue={noteValue ?? ""}
                 placeholder={notePlaceholder ?? "…or describe it approximately"}
                 style={{ flex: "1 1 220px" }} />
        )}
      </div>
      {hint && (
        <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>{hint}</p>
      )}
    </div>
  );
}
