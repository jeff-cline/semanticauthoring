"use client";

import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/SaveButton";

type Row = {
  id: number; email: string; name: string | null; role: string; tier: string;
  must_change_password: boolean; created_at: string; last_login_at: string | null;
  handle: string | null; display_name: string | null; is_public: boolean | null;
  avatar_url: string | null;
  pubs: string; sources: string; journal: string; inquiry: string;
};

const WHEN = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
const fmt = (d: string | null) => (d ? WHEN.format(new Date(d)) : "never");

export default function MembersTable({ rows, meId }: { rows: Row[]; meId: number }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function viewAs(id: number) {
    setBusy(id); setError(null);
    try {
      const res = await fetch("/api/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setError(json.error || "Could not start."); setBusy(null); return; }
      // Identity changed — every cached client segment is about the wrong
      // person now, so reload rather than soft-navigate.
      window.location.assign("/app");
    } catch {
      setError("Could not start."); setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No members match.</p>;
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const name = r.display_name || r.name || r.email;
          const isMe = r.id === meId;
          return (
            <div key={r.id} className="card"
                 style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              {r.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatar_url} alt="" width={52} height={52}
                     style={{ width: 52, height: 52, borderRadius: "50%",
                              objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <span aria-hidden="true"
                      style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                               display: "grid", placeItems: "center",
                               background: "var(--wash, rgba(0,0,0,.05))",
                               fontFamily: "var(--serif)", fontSize: "1.2rem" }}>
                  {name[0]?.toUpperCase() ?? "?"}
                </span>
              )}

              <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                <strong style={{ display: "block" }}>
                  {name}
                  {isMe && <span className="pill" style={{ marginLeft: 8 }}>you</span>}
                  {r.role === "god" && (
                    <span className="pill" style={{ marginLeft: 8, color: "var(--gold)" }}>God</span>
                  )}
                  <span className="pill" style={{ marginLeft: 8 }}>{r.tier}</span>
                  {r.must_change_password && (
                    <span className="pill" style={{ marginLeft: 8, color: "var(--coral)" }}>
                      must reset
                    </span>
                  )}
                </strong>
                <span style={{ color: "var(--muted)", fontSize: ".86rem", overflowWrap: "anywhere" }}>
                  {r.email}
                  {r.handle && (
                    <> · <Link href={`/${r.handle}`}>/{r.handle}</Link>
                      {r.is_public ? "" : " (private)"}</>
                  )}
                </span>
                <span style={{ display: "block", color: "var(--muted)", fontSize: ".82rem",
                               marginTop: 4 }}>
                  Joined {fmt(r.created_at)} · last seen {fmt(r.last_login_at)}
                  {" · "}{r.pubs} published · {r.sources} sources
                  {" · "}{r.journal} journal · {r.inquiry} inquiry
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/app/members/${r.id}`} className="btn btn-secondary"
                      style={{ minHeight: 40 }}>
                  Manage
                </Link>
                {!isMe && (
                  <button className="btn btn-primary" style={{ minHeight: 40 }}
                          disabled={busy === r.id} onClick={() => viewAs(r.id)}>
                    {busy === r.id
                      ? <><Spinner /> Switching…</>
                      : r.role === "god" ? "View as (God)" : "View as"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
