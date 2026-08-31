import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { coreConfigured, corePing } from "@/lib/core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

// Health page per spec §15/§42. Every integration reports one of:
// CONNECTED · PUBLIC API · KEY REQUIRED · RATE LIMITED · DOWN · NOT CONFIGURED

const CATALOG = [
  { key: "stripe", label: "Stripe", category: "payments",
    provides: "Payments and subscription billing. Dormant until keys are supplied — no billing logic runs.", env: ["STRIPE_SECRET_KEY"] },
  { key: "linkedin", label: "LinkedIn", category: "social", provides: "Share links today; direct posting requires partner API access.", env: [] },
  { key: "x", label: "X", category: "social", provides: "Share links today; the posting API is paid and restricted.", env: [] },
  { key: "facebook", label: "Facebook", category: "social", provides: "Share links and Pages insights via the Core's Meta integration.", env: [] },
  { key: "threads", label: "Threads", category: "social", provides: "Share links.", env: [] },
  { key: "bluesky", label: "Bluesky", category: "social", provides: "Share links; AT Protocol posting is available.", env: [] },
  { key: "zenodo", label: "Zenodo", category: "scholarly",
    provides: "Real deposit and publish API — mints a DOI. Publishing always requires explicit confirmation.", env: ["ZENODO_ACCESS_TOKEN"] },
  { key: "osf", label: "OSF", category: "scholarly", provides: "Projects and preprints where policy permits.", env: ["OSF_TOKEN"] },
  { key: "orcid", label: "ORCID", category: "scholarly", provides: "Persistent researcher identity. Write access needs member credentials.", env: ["ORCID_CLIENT_ID"] },
  { key: "crossref", label: "Crossref", category: "scholarly", provides: "Authoritative DOI metadata. READ ONLY — cannot be submitted to.", env: [] },
  { key: "openalex", label: "OpenAlex", category: "scholarly", provides: "Global scholarly graph. READ ONLY — cannot be submitted to.", env: [] },
  { key: "semanticscholar", label: "Semantic Scholar", category: "scholarly", provides: "Citation intelligence. READ ONLY.", env: ["SEMANTIC_SCHOLAR_API_KEY"] },
];

function statusOf(i: (typeof CATALOG)[number]): string {
  if (i.env.length === 0) return i.category === "scholarly" ? "PUBLIC API" : "NOT CONFIGURED";
  return i.env.every((e) => process.env[e]) ? "CONNECTED" : "KEY REQUIRED";
}

const COLOR: Record<string, string> = {
  CONNECTED: "var(--current)", "PUBLIC API": "var(--seaglass)",
  "KEY REQUIRED": "var(--gold)", "NOT CONFIGURED": "var(--muted)",
  DOWN: "var(--coral-ink)", "RATE LIMITED": "var(--gold)",
};

export default async function Integrations() {
  const user = (await currentUser())!;
  if (user.role !== "god") redirect("/app");

  let dbStatus = "DOWN";
  try { await q("SELECT 1"); dbStatus = "CONNECTED"; } catch {}

  const core = coreConfigured() ? ((await corePing()).ok ? "CONNECTED" : "DOWN") : "KEY REQUIRED";
  const turnstile = process.env.TURNSTILE_SECRET_KEY ? "CONNECTED" : "KEY REQUIRED";

  const groups = ["payments", "social", "scholarly"] as const;

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>Integrations</h1>
      <p style={{ color: "var(--muted)", maxWidth: 660 }}>
        Every integration is a configured shell — drop keys into the server environment and
        the status flips to connected. Credentials are never rendered back to the browser.
      </p>

      <h2 style={{ fontSize: "1.15rem", marginTop: 30 }}>Platform</h2>
      <div className="grid grid-3">
        {[["Database", dbStatus, "PostgreSQL — this platform's own database."],
          ["R0cketShip Core", core, "Leads, transactional email, and visitor identification."],
          ["Cloudflare Turnstile", turnstile, "Spam protection on public forms. Honeypot + rate limiting until configured."],
        ].map(([label, st, desc]) => (
          <div key={label as string} className="card">
            <h3 style={{ fontSize: "1rem" }}>{label}</h3>
            <p style={{ color: COLOR[st as string] ?? "var(--muted)", fontWeight: 600, fontSize: ".85rem",
                        letterSpacing: ".06em", margin: "0 0 8px" }}>{st}</p>
            <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g}>
          <h2 style={{ fontSize: "1.15rem", marginTop: 34, textTransform: "capitalize" }}>{g}</h2>
          <div className="grid grid-3">
            {CATALOG.filter((i) => i.category === g).map((i) => {
              const st = statusOf(i);
              return (
                <div key={i.key} className="card">
                  <h3 style={{ fontSize: "1rem" }}>{i.label}</h3>
                  <p style={{ color: COLOR[st] ?? "var(--muted)", fontWeight: 600, fontSize: ".85rem",
                              letterSpacing: ".06em", margin: "0 0 8px" }}>{st}</p>
                  <p style={{ color: "var(--muted)", fontSize: ".9rem", margin: 0 }}>{i.provides}</p>
                  {i.env.length > 0 && (
                    <p style={{ color: "var(--muted)", fontSize: ".8rem", marginTop: 8,
                                fontFamily: "ui-monospace, monospace" }}>
                      {i.env.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 34 }}>
        <h3 style={{ fontSize: "1rem" }}>A note on scholarly indexes</h3>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: ".93rem" }}>
          Crossref, OpenAlex, PubMed, and Semantic Scholar are read-only indexes — there is no
          endpoint to push summaries into them. The legitimate route to being indexed is
          depositing real research objects with DOIs through Zenodo or OSF and letting the
          indexes discover them.
        </p>
      </div>
    </>
  );
}
