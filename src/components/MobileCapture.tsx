"use client";
import { useEffect, useState } from "react";

// Capture must work with no signal. If the post fails, the thought goes into
// IndexedDB on the device and is replayed on reconnect — losing an idea because
// a train went into a tunnel is not acceptable.

const KINDS = ["idea", "quote", "question", "reflection", "insight"] as const;

export default function MobileCapture() {
  const [kind, setKind] = useState<string>("idea");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "queued">("idle");
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void countQueue();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setState("saving");
    const payload = { body: text, kind };
    try {
      const res = await fetch("/api/capture", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      setState("saved");
      setBody("");
    } catch {
      await queue(payload);
      setState("queued");
      setBody("");
      await countQueue();
    }
    setTimeout(() => setState("idle"), 2200);
  }

  // Dictation, where the browser supports it. Hands-free capture is the whole
  // point of a phone in a pocket.
  function dictate() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (ev: any) => {
      const said = Array.from(ev.results).map((x: any) => x[0].transcript).join(" ");
      setBody((b) => (b ? `${b} ${said}` : said));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  const hasSpeech = typeof window !== "undefined" &&
    Boolean((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);

  return (
    <>
      {!online && (
        <div style={{ background: "var(--gold)", color: "#17243A", padding: "10px 14px",
                      borderRadius: 10, marginBottom: 14, fontSize: ".9rem" }}>
          Offline — captures are saved on this device and send when you reconnect.
        </div>
      )}
      {queued > 0 && (
        <div style={{ color: "var(--muted)", fontSize: ".88rem", marginBottom: 12 }}>
          {queued} waiting to send.{" "}
          <button onClick={() => void flush().then(countQueue)}
                  style={{ background: "none", border: 0, color: "var(--current)",
                           cursor: "pointer", font: "inherit", textDecoration: "underline" }}>
            try now
          </button>
        </div>
      )}

      <form onSubmit={submit}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          autoFocus
          placeholder="What are you thinking?"
          style={{ fontSize: "1.05rem", lineHeight: 1.6, padding: "16px 18px" }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          {KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
                    className="pill"
                    style={{ cursor: "pointer", font: "inherit", border: "1px solid var(--line)",
                             background: kind === k ? "rgba(23,107,115,.16)" : "transparent",
                             color: kind === k ? "var(--current-d)" : "var(--muted)" }}>
              {k}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, padding: "16px" }}
                  disabled={state === "saving" || !body.trim()}>
            {state === "saving" ? "Saving…"
              : state === "saved" ? "Captured ✓"
              : state === "queued" ? "Saved on device ✓"
              : "Capture"}
          </button>
          {hasSpeech && (
            <button type="button" className="btn btn-secondary" onClick={dictate}
                    style={{ padding: "16px 20px" }} aria-label="Dictate">
              {listening ? "●" : "🎤"}
            </button>
          )}
        </div>
      </form>
    </>
  );
}

// ── offline queue ────────────────────────────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sa-offline", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("captures", { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queue(payload: unknown) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("captures", "readwrite");
      tx.objectStore("captures").add({ payload, at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    const reg = await navigator.serviceWorker?.ready;
    await (reg as any)?.sync?.register("sa-capture-sync").catch(() => {});
  } catch { /* device storage unavailable; nothing more we can do */ }
}

async function countQueue(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction("captures", "readonly");
      const req = tx.objectStore("captures").count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch { return 0; }
}

async function flush() {
  try {
    const db = await openDb();
    const items: any[] = await new Promise((resolve) => {
      const tx = db.transaction("captures", "readonly");
      const req = tx.objectStore("captures").getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    });
    for (const it of items) {
      const res = await fetch("/api/capture", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(it.payload),
      }).catch(() => null);
      if (!res?.ok) break;
      await new Promise<void>((resolve) => {
        const tx = db.transaction("captures", "readwrite");
        tx.objectStore("captures").delete(it.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch { /* ignore */ }
}
