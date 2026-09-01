"use client";
import { useState } from "react";
import { TIERS } from "@/lib/tiers";

export default function SignupForm({ action }: { action: (fd: FormData) => Promise<void> }) {
  const [tier, setTier] = useState("free");
  const [busy, setBusy] = useState(false);

  return (
    <form action={async (fd) => { setBusy(true); await action(fd); setBusy(false); }} className="card">
      <h2 style={{ fontSize: "1.2rem" }}>Create your workspace</h2>

      <fieldset style={{ border: 0, padding: 0, margin: "0 0 20px" }}>
        <legend className="hp">Choose a tier</legend>
        <p style={{ fontSize: ".85rem", fontWeight: 600, marginBottom: 8 }}>Choose your tier</p>
        <div style={{ display: "grid", gap: 8 }}>
          {TIERS.map((t) => (
            <label key={t.key}
                   style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer",
                            border: `1px solid ${tier === t.key ? "var(--current)" : "var(--line)"}`,
                            borderRadius: 10, padding: "12px 14px", fontWeight: 400 }}>
              <input type="radio" name="tier" value={t.key} checked={tier === t.key}
                     onChange={() => setTier(t.key)} style={{ width: "auto", marginTop: 4 }} />
              <span>
                <strong>{t.name}</strong>{" "}
                <span style={{ color: "var(--gold)", fontWeight: 600 }}>{t.price}</span>
                <br />
                <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>{t.blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="password">Choose a password</label>
        <input id="password" name="password" type="password" required
               autoComplete="new-password" minLength={12} />
        <p style={{ color: "var(--muted)", fontSize: ".84rem", margin: "6px 0 0" }}>
          At least 12 characters, with upper case, lower case, and a number.
        </p>
      </div>
      <div className="field">
        <label htmlFor="interest">Where are you in your journey? (optional)</label>
        <select id="interest" name="interest" defaultValue="">
          <option value="">Prefer not to say</option>
          <option>Considering doctoral study</option>
          <option>Coursework</option>
          <option>Comprehensive exams / candidacy</option>
          <option>Dissertation</option>
          <option>Postdoctoral</option>
          <option>Faculty</option>
          <option>Independent researcher</option>
        </select>
      </div>
      <div className="hp" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Creating…" : "Create workspace and sign in"}
      </button>
      <p style={{ color: "var(--muted)", fontSize: ".84rem", marginTop: 14, marginBottom: 0 }}>
        No card, no trial clock. By creating an account you agree to our{" "}
        <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.
      </p>
    </form>
  );
}
