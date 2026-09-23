"use client";

import { useEffect } from "react";

// ---------------------------------------------------------------------------
// Client half of the form guard. Mounted once in the root layout.
//
// It attaches a reCAPTCHA v3 token to every POST this app makes to one of its
// guarded form endpoints, so an individual form needs no changes — including
// forms written later. Without this, switching RECAPTCHA_MODE to "enforce"
// would reject every real submission as "missing-token".
//
// Scope is deliberately narrow: same-origin POSTs, JSON string bodies, and only
// the paths the server reports in RECAPTCHA_FORM_ENDPOINTS. Everything else —
// admin calls, uploads, analytics — is untouched.
//
// Keep identical across apps. Fix in the Core copy and re-sync.
// ---------------------------------------------------------------------------

type PublicConfig = { siteKey: string; enabled: boolean; endpoints: string[] };

declare global {
  interface Window {
    __formGuardPatched?: boolean;
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export default function RecaptchaProvider() {
  useEffect(() => {
    if (window.__formGuardPatched) return;
    window.__formGuardPatched = true;

    let cfg: PublicConfig | null = null;
    let ready = false;

    const matches = (pathname: string) =>
      !!cfg?.endpoints.some((e) => pathname === e || pathname.startsWith(e + "/"));

    const actionFor = (pathname: string) =>
      pathname.replace(/^\/api\//, "").replace(/[^a-zA-Z0-9_]/g, "_");

    const setup = async () => {
      try {
        const res = await fetch("/api/recaptcha/config", { cache: "no-store" });
        cfg = (await res.json()) as PublicConfig;
      } catch { return; }
      if (!cfg?.enabled || !cfg.siteKey || !cfg.endpoints?.length) return;
      await new Promise<void>((resolve) => {
        const el = document.createElement("script");
        el.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(cfg!.siteKey)}`;
        el.async = true;
        el.defer = true;
        el.onload = () => { ready = true; resolve(); };
        el.onerror = () => resolve();   // leave unpatched; the server's failure
        document.head.appendChild(el);  // policy allows a missing token through
      });
    };

    const token = async (action: string): Promise<string> => {
      if (!ready || !cfg?.siteKey || !window.grecaptcha) return "";
      try {
        return await new Promise<string>((resolve) => {
          window.grecaptcha!.ready(() => {
            window.grecaptcha!.execute(cfg!.siteKey, { action }).then(resolve).catch(() => resolve(""));
          });
        });
      } catch { return ""; }
    };

    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
        if (method !== "POST" || !url) return nativeFetch(input, init);

        const u = new URL(url, window.location.origin);
        if (u.origin !== window.location.origin || !matches(u.pathname)) return nativeFetch(input, init);

        // Only JSON string bodies are rewritten; FormData/Blob are left alone.
        const body = init?.body;
        if (typeof body !== "string") return nativeFetch(input, init);
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch { return nativeFetch(input, init); }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return nativeFetch(input, init);

        const t = await token(actionFor(u.pathname));
        if (!t) return nativeFetch(input, init);

        return nativeFetch(input, {
          ...init,
          body: JSON.stringify({ ...(parsed as Record<string, unknown>), recaptchaToken: t }),
        });
      } catch {
        // This wrapper must never be the reason a request fails.
        return nativeFetch(input, init);
      }
    };

    void setup();
  }, []);

  return null;
}
