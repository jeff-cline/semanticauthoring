"use client";

import { useState } from "react";
import { Spinner } from "@/components/SaveButton";

/**
 * Profile photo. Uploads immediately to the Core and keeps the returned URL in
 * a hidden field, so the photo survives even if she never presses Save — and
 * she can see the result before committing the rest of the form.
 */
export default function AvatarUpload({
  defaultUrl, defaultAlt, suggestedAlt,
}: { defaultUrl: string; defaultAlt: string; suggestedAlt: string }) {
  const [url, setUrl] = useState(defaultUrl || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setError(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/avatar", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) setError(json.error || "That image could not be uploaded.");
      else setUrl(json.url);
    } catch {
      setError("That image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor="avatar_file">Profile photo</label>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" width={84} height={84}
               style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover",
                        border: "1px solid var(--line)" }} />
        ) : (
          <div style={{ width: 84, height: 84, borderRadius: "50%", flexShrink: 0,
                        border: "1px dashed var(--line)", display: "grid", placeItems: "center",
                        color: "var(--muted)", fontSize: ".76rem" }}>
            No photo
          </div>
        )}
        <div>
          <input
            id="avatar_file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
          {busy && (
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: ".86rem" }}>
              <Spinner /> Uploading…
            </p>
          )}
          {url && !busy && (
            <button type="button" className="pill"
                    style={{ cursor: "pointer", marginTop: 8, minHeight: 36, padding: "6px 12px" }}
                    onClick={() => setUrl("")}>
              Remove photo
            </button>
          )}
        </div>
      </div>
      {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}

      <input type="hidden" name="avatar_url" value={url} />

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="avatar_alt">Photo description</label>
        <input id="avatar_alt" name="avatar_alt" defaultValue={defaultAlt || suggestedAlt}
               maxLength={300} />
        <p style={{ color: "var(--muted)", fontSize: ".82rem", margin: "6px 0 0" }}>
          Read aloud by screen readers, and the text a search engine associates with the
          image. Your name plus what you study works well.
        </p>
      </div>
    </div>
  );
}
