"use client";

import { useMemo, useState } from "react";
import { condenseWeeks } from "@/lib/inquiry-export";
import { Spinner } from "@/components/SaveButton";

type WeekOption = { week: number; theme: string; entries: number; synthesis: boolean };

type Scope = "all" | "weeks" | "semester" | "ytd" | "range";

const SCOPES: { key: Scope; label: string; hint: string }[] = [
  { key: "all", label: "Whole journal", hint: "Everything written, every week" },
  { key: "weeks", label: "Choose weeks", hint: "One week, or any combination" },
  { key: "semester", label: "Semester to date", hint: "From your first entry until today" },
  { key: "ytd", label: "Year to date", hint: "From 1 January until today" },
  { key: "range", label: "Date range", hint: "Between two dates you pick" },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Picks which part of the journal to export. Builds a query string and hands
 * off to the .docx route — no text is touched here or there, only filtered.
 */
export default function ExportPicker({ weeks }: { weeks: WeekOption[] }) {
  const written = weeks.filter((w) => w.entries > 0 || w.synthesis);
  const [scope, setScope] = useState<Scope>("all");
  const [picked, setPicked] = useState<number[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);

  const href = useMemo(() => {
    const p = new URLSearchParams();
    if (scope === "weeks" && picked.length) p.set("weeks", [...picked].sort((a, b) => a - b).join(","));
    else if (scope === "semester" || scope === "ytd") p.set("scope", scope);
    else if (scope === "range") {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    const qs = p.toString();
    return `/app/inquiry/export/journal.docx${qs ? `?${qs}` : ""}`;
  }, [scope, picked, from, to]);

  const blocked =
    (scope === "weeks" && picked.length === 0) ||
    (scope === "range" && !from && !to);

  const summary =
    scope === "all" ? "the complete journal"
    : scope === "weeks"
      ? picked.length ? `week${picked.length > 1 ? "s" : ""} ${condenseWeeks([...picked].sort((a, b) => a - b))}`
                      : "no weeks chosen yet"
    : scope === "semester" ? "everything from your first entry to today"
    : scope === "ytd" ? "everything since 1 January"
    : from && to ? `${from} to ${to}` : from ? `from ${from}` : to ? `through ${to}` : "no dates chosen yet";

  const toggle = (w: number) =>
    setPicked((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]);

  return (
    <div className="card stage stage-celebrate" style={{ maxWidth: 680 }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: 4 }}>What would you like to export?</h2>
      <p style={{ color: "var(--muted)", fontSize: ".92rem", marginTop: 0 }}>
        Each export is a Word document laid out as a journal — your prompts and your answers,
        in the order you wrote them.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 6px" }}>
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setScope(s.key)}
            aria-pressed={scope === s.key}
            className="pill"
            style={{
              cursor: "pointer",
              minHeight: 40, padding: "8px 14px",
              border: `1px solid ${scope === s.key ? "var(--current)" : "transparent"}`,
              background: scope === s.key ? "var(--current)" : undefined,
              color: scope === s.key ? "#fff" : undefined,
              fontWeight: scope === s.key ? 600 : undefined,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "0 0 14px" }}>
        {SCOPES.find((s) => s.key === scope)?.hint}
      </p>

      {scope === "weeks" && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <button type="button" className="pill"
                    style={{ cursor: "pointer", minHeight: 40, padding: "8px 14px" }}
                    onClick={() => setPicked(written.map((w) => w.week))}>
              Select all written
            </button>
            <button type="button" className="pill"
                    style={{ cursor: "pointer", minHeight: 40, padding: "8px 14px" }}
                    onClick={() => setPicked([])}>
              Clear
            </button>
          </div>
          {written.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              No weeks have anything written in them yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {written.map((w) => (
                <label
                  key={w.week}
                  style={{
                    // Grid, not flex: the checkbox column is a fixed width, so
                    // every box lines up however long the week's theme runs.
                    display: "grid",
                    gridTemplateColumns: "22px 1fr",
                    alignItems: "start",
                    columnGap: 12,
                    // A 44px row is the minimum comfortable tap target on iPhone.
                    minHeight: 44,
                    padding: "9px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: ".92rem",
                    background: picked.includes(w.week) ? "var(--wash, rgba(0,0,0,.035))" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(w.week)}
                    onChange={() => toggle(w.week)}
                    style={{ width: 20, height: 20, margin: "1px 0 0", flexShrink: 0 }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <strong>Week {w.week}</strong>
                    {w.theme ? ` — ${w.theme}` : ""}
                    {/* Counts go on their own line so a long theme cannot push
                        them off the edge of a phone screen. */}
                    <span style={{ display: "block", color: "var(--muted)", fontSize: ".84rem",
                                   marginTop: 2 }}>
                      {w.entries} {w.entries === 1 ? "entry" : "entries"}
                      {w.synthesis ? " · synthesis written" : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {scope === "range" && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
          <div className="field" style={{ flex: "1 1 180px", minWidth: 150 }}>
            <label htmlFor="from">From</label>
            <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "1 1 180px", minWidth: 150 }}>
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
        <a className="btn btn-primary" href={href} download aria-busy={busy}
           onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 4000); }}>
          {busy ? <><Spinner /> Preparing…</> : "Download Word document"}
        </a>
      )}

      <p style={{ color: "var(--muted)", fontSize: ".88rem", marginTop: 16, marginBottom: 0 }}>
        Your original language and dates are preserved exactly. Nothing is rewritten,
        summarised, or edited on the way out — this is your submitted work, and changing it
        during export would be changing your submission. A copy is kept in{" "}
        <a href="/app/documents">Saved documents</a> so you can download it again later.
      </p>
    </div>
  );
}
