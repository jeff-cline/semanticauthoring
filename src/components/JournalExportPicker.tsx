"use client";

import { useMemo, useState } from "react";
import { Spinner } from "@/components/SaveButton";

type Scope = "all" | "semester" | "ytd" | "range";

const SCOPES: { key: Scope; label: string; hint: string }[] = [
  { key: "all", label: "Everything", hint: "Every day you have written" },
  { key: "semester", label: "Since you started", hint: "From your first entry until today" },
  { key: "ytd", label: "Year to date", hint: "From 1 January until today" },
  { key: "range", label: "Date range", hint: "Between two dates you pick" },
];

const pretty = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined,
    { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function JournalExportPicker({
  total, first, last,
}: { total: number; first: string | null; last: string | null }) {
  const [scope, setScope] = useState<Scope>("all");
  const [from, setFrom] = useState(first ?? "");
  const [to, setTo] = useState(last ?? new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const href = useMemo(() => {
    const p = new URLSearchParams();
    if (scope === "semester" || scope === "ytd") p.set("scope", scope);
    else if (scope === "range") {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    const qs = p.toString();
    return `/app/journal/export.docx${qs ? `?${qs}` : ""}`;
  }, [scope, from, to]);

  const blocked = scope === "range" && !from && !to;

  const summary =
    scope === "all" ? `all ${total} ${total === 1 ? "day" : "days"}`
    : scope === "semester" ? first ? `everything since ${pretty(first)}` : "everything"
    : scope === "ytd" ? "everything since 1 January"
    : from && to ? `${pretty(from)} to ${pretty(to)}`
    : from ? `from ${pretty(from)}` : to ? `through ${pretty(to)}` : "no dates chosen yet";

  return (
    <div className="card stage stage-celebrate" style={{ maxWidth: 680, marginTop: 22 }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: 4 }}>What would you like to export?</h2>
      <p style={{ color: "var(--muted)", fontSize: ".92rem", marginTop: 0 }}>
        {total} {total === 1 ? "day" : "days"} written
        {first && last ? `, ${pretty(first)} – ${pretty(last)}` : ""}.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 6px" }}>
        {SCOPES.map((s) => (
          <button key={s.key} type="button" onClick={() => setScope(s.key)}
                  aria-pressed={scope === s.key} className="pill"
                  style={{
                    cursor: "pointer",
                    border: `1px solid ${scope === s.key ? "var(--current)" : "transparent"}`,
                    background: scope === s.key ? "var(--current)" : undefined,
                    color: scope === s.key ? "#fff" : undefined,
                    fontWeight: scope === s.key ? 600 : undefined,
                  }}>
            {s.label}
          </button>
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "0 0 14px" }}>
        {SCOPES.find((s) => s.key === scope)?.hint}
      </p>

      {scope === "range" && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
          <div className="field" style={{ flex: "0 1 180px" }}>
            <label htmlFor="from">From</label>
            <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "0 1 180px" }}>
            <label htmlFor="to">To</label>
            <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      <p style={{ fontSize: ".9rem", marginBottom: 14 }}>
        Exporting <strong>{summary}</strong>.
      </p>

      {blocked ? (
        <button className="btn btn-primary" disabled aria-disabled="true">
          Download Word document
        </button>
      ) : (
        <a
          className="btn btn-primary"
          href={href}
          download
          aria-busy={busy}
          onClick={() => {
            // The browser gives no signal while a download is being generated,
            // so say so for a few seconds rather than leaving her wondering.
            setBusy(true);
            setTimeout(() => setBusy(false), 4000);
          }}
        >
          {busy ? <><Spinner /> Preparing…</> : "Download Word document"}
        </a>
      )}

      <p style={{ color: "var(--muted)", fontSize: ".88rem", marginTop: 16, marginBottom: 0 }}>
        Your words and dates are reproduced exactly, along with the prompt you were actually
        given that day. Nothing is rewritten or summarised. A copy is kept in{" "}
        <a href="/app/documents">Saved documents</a> so you can download it again later.
      </p>
    </div>
  );
}
