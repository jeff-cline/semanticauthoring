"use client";

import { useState } from "react";
import { Spinner } from "@/components/SaveButton";

type Row = {
  id: number;
  reader_id: number;
  status: "pending" | "approved" | "declined" | "revoked";
  origin: string;
  message: string;
  name: string;
  email: string;
  handle: string | null;
  avatar_url: string | null;
};

const POLICIES: { key: string; label: string; hint: string }[] = [
  { key: "public", label: "Open to everyone",
    hint: "Anyone can read the full text. No account needed." },
  { key: "abstract", label: "Abstract only, full text on request",
    hint: "Everyone sees the abstract. Readers ask you for the rest." },
  { key: "full", label: "Approved readers only",
    hint: "Same as above, but nobody new can ask — you invite them." },
];

/**
 * Who may read this piece. Policy, pending requests, the cohort, and invites —
 * in one place, because they are one decision viewed from four angles.
 */
export default function CohortManager({
  publicationId, policy: initialPolicy, rows: initialRows,
}: { publicationId: number; policy: string; rows: Row[] }) {
  const [policy, setPolicy] = useState(initialPolicy || "public");
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState("");

  async function call(payload: Record<string, unknown>, key: string) {
    setBusy(key); setError(null);
    try {
      const res = await fetch("/api/document-access/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicationId, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.error || "That didn't work."); return null; }
      if (json.rows) setRows(json.rows);
      return json;
    } catch {
      setError("That didn't work.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const closed = rows.filter((r) => r.status === "declined" || r.status === "revoked");

  return (
    <div className="card" style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Who can read this</h2>

      <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
        {POLICIES.map((p) => (
          <label key={p.key}
                 style={{ display: "grid", gridTemplateColumns: "22px 1fr", columnGap: 12,
                          alignItems: "start", minHeight: 44, padding: "8px 10px",
                          borderRadius: 8, cursor: "pointer", fontWeight: 400,
                          background: policy === p.key ? "var(--wash, rgba(0,0,0,.035))" : "transparent" }}>
            <input type="radio" name="reader_access" value={p.key}
                   checked={policy === p.key}
                   disabled={busy === "policy"}
                   onChange={async () => {
                     const prev = policy;
                     setPolicy(p.key);
                     const ok = await call({ action: "policy", policy: p.key }, "policy");
                     if (!ok) setPolicy(prev);   // put the control back if it failed
                   }}
                   style={{ width: 20, height: 20, marginTop: 2 }} />
            <span>
              <strong>{p.label}</strong>
              <span style={{ display: "block", color: "var(--muted)", fontSize: ".86rem" }}>
                {p.hint}
              </span>
            </span>
          </label>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {policy !== "public" && (
        <>
          {pending.length > 0 && (
            <>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                Waiting on you ({pending.length})
              </p>
              {pending.map((r) => (
                <div key={r.id} className="card" style={{ marginBottom: 10 }}>
                  <strong>{r.name || r.email}</strong>
                  {r.message && (
                    <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0", fontSize: ".93rem" }}>
                      {r.message}
                    </p>
                  )}
                  <p style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0 0" }}>
                    <button className="btn btn-primary" style={{ minHeight: 40 }}
                            disabled={busy === `a${r.id}`}
                            onClick={() => call({ action: "approve", readerId: r.reader_id },
                              `a${r.id}`)}>
                      {busy === `a${r.id}` ? <><Spinner /> Approving…</> : "Approve"}
                    </button>
                    <button className="btn btn-secondary" style={{ minHeight: 40 }}
                            disabled={busy === `d${r.id}`}
                            onClick={() => call({ action: "decline", readerId: r.reader_id },
                              `d${r.id}`)}>
                      Decline
                    </button>
                  </p>
                </div>
              ))}
            </>
          )}

          <p className="eyebrow" style={{ margin: "18px 0 8px" }}>
            Cohort ({approved.length})
          </p>
          {approved.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: ".92rem" }}>
              Nobody yet. Approved readers can see each other here and on the piece itself.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {approved.map((r) => (
                <div key={r.id}
                     style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 200px" }}>{r.name || r.email}</span>
                  <button className="btn btn-secondary" style={{ minHeight: 38 }}
                          disabled={busy === `r${r.id}`}
                          onClick={() => call({ action: "revoke", readerId: r.reader_id },
                            `r${r.id}`)}>
                    {busy === `r${r.id}` ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="invite">Invite someone by email</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input id="invite" type="email" value={invite} placeholder="them@university.edu"
                     onChange={(e) => setInvite(e.target.value)}
                     style={{ flex: "1 1 220px" }} />
              <button className="btn btn-primary" style={{ minHeight: 44 }}
                      disabled={!invite || busy === "invite"}
                      onClick={async () => {
                        const r = await call({ action: "invite", email: invite }, "invite");
                        if (r) setInvite("");
                      }}>
                {busy === "invite" ? <><Spinner /> Inviting…</> : "Invite"}
              </button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "6px 0 0" }}>
              They need an account here. If they already have one, access is granted straight
              away.
            </p>
          </div>

          {closed.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: ".9rem" }}>
                Declined and revoked ({closed.length})
              </summary>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {closed.map((r) => (
                  <div key={r.id}
                       style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 200px" }}>
                      {r.name || r.email}{" "}
                      <span className="pill">{r.status}</span>
                    </span>
                    <button className="btn btn-secondary" style={{ minHeight: 38 }}
                            disabled={busy === `g${r.id}`}
                            onClick={() => call({ action: "approve", readerId: r.reader_id },
                              `g${r.id}`)}>
                      Grant access
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
