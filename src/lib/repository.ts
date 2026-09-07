import "server-only";

// ── Repository deposit: Zenodo and OSF ───────────────────────────────────────
//
// Depositing is reversible until you publish. PUBLISHING IS NOT: Zenodo mints a
// DOI and the record becomes permanent and citable. So publish is a separate,
// explicitly confirmed action, never a side effect of saving, and the UI shows
// a full preview of exactly what will be minted first.
//
// Sandbox is the default. A scholar should be able to rehearse the whole flow
// without putting a permanent DOI into the world by accident.

export interface RepoResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

const zenodoBase = (sandbox: boolean) =>
  sandbox ? "https://sandbox.zenodo.org/api" : "https://zenodo.org/api";

function zenodoToken(sandbox: boolean): string | undefined {
  return sandbox
    ? process.env.ZENODO_SANDBOX_TOKEN ?? process.env.ZENODO_ACCESS_TOKEN
    : process.env.ZENODO_ACCESS_TOKEN;
}

export function repoConfigured(repo: string, sandbox: boolean): boolean {
  if (repo === "zenodo") return Boolean(zenodoToken(sandbox));
  if (repo === "osf") return Boolean(process.env.OSF_TOKEN);
  return false;
}

async function call(url: string, init: RequestInit, token: string): Promise<RepoResult> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 400) }; }
    if (!res.ok) {
      return {
        ok: false, status: res.status,
        error: data?.message ?? data?.errors?.[0]?.message ?? `http ${res.status}`,
        data,
      };
    }
    return { ok: true, data, status: res.status };
  } catch (e) {
    return { ok: false, error: String((e as Error).message).slice(0, 200) };
  }
}

export interface DepositMeta {
  title: string;
  description: string;
  creators: string;        // one per line, "Family, Given"
  keywords: string;
  uploadType: string;      // publication|dataset|software|presentation|thesis
  license: string;
  doi?: string;
}

/** Exactly what will be sent — shown to the scholar before anything is created. */
export function zenodoPayload(m: DepositMeta) {
  return {
    metadata: {
      title: m.title,
      upload_type: m.uploadType || "publication",
      publication_type: m.uploadType === "publication" ? "article" : undefined,
      description: m.description || m.title,
      creators: m.creators.split("\n").map((c) => c.trim()).filter(Boolean)
        .map((name) => ({ name })),
      keywords: m.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      license: m.license || "cc-by-4.0",
      access_right: "open",
    },
  };
}

/** Create a DRAFT deposition. Reversible — nothing is public and no DOI is minted. */
export async function zenodoCreateDraft(m: DepositMeta, sandbox: boolean): Promise<RepoResult> {
  const token = zenodoToken(sandbox);
  if (!token) {
    return { ok: false, error: `No ${sandbox ? "ZENODO_SANDBOX_TOKEN" : "ZENODO_ACCESS_TOKEN"} configured.` };
  }
  return call(`${zenodoBase(sandbox)}/deposit/depositions`, {
    method: "POST", body: JSON.stringify(zenodoPayload(m)),
  }, token);
}

export async function zenodoUploadFile(
  depositionId: string, filename: string, bytes: Uint8Array, sandbox: boolean,
): Promise<RepoResult> {
  const token = zenodoToken(sandbox);
  if (!token) return { ok: false, error: "No Zenodo token configured." };

  // Fetch the bucket link, which is the modern upload target.
  const dep = await call(`${zenodoBase(sandbox)}/deposit/depositions/${depositionId}`,
    { method: "GET" }, token);
  if (!dep.ok) return dep;
  const bucket = dep.data?.links?.bucket;
  if (!bucket) return { ok: false, error: "Zenodo did not return an upload bucket." };

  try {
    const res = await fetch(`${bucket}/${encodeURIComponent(filename)}`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" },
      body: new Blob([new Uint8Array(bytes)]),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: `upload failed: http ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error).message).slice(0, 200) };
  }
}

/**
 * PUBLISH — irreversible. Mints a DOI and makes the record permanent.
 * Requires confirm: true; there is no way to trigger this implicitly.
 */
export async function zenodoPublish(
  depositionId: string, sandbox: boolean, confirm: boolean,
): Promise<RepoResult> {
  if (!confirm) {
    return { ok: false, error: "Publishing requires explicit confirmation. Nothing was sent." };
  }
  const token = zenodoToken(sandbox);
  if (!token) return { ok: false, error: "No Zenodo token configured." };
  return call(`${zenodoBase(sandbox)}/deposit/depositions/${depositionId}/actions/publish`,
    { method: "POST" }, token);
}

/** OSF: create a private project. Nothing becomes public without a further step. */
export async function osfCreateProject(m: DepositMeta): Promise<RepoResult> {
  const token = process.env.OSF_TOKEN;
  if (!token) return { ok: false, error: "No OSF_TOKEN configured." };
  return call("https://api.osf.io/v2/nodes/", {
    method: "POST",
    headers: { "content-type": "application/vnd.api+json" },
    body: JSON.stringify({
      data: {
        type: "nodes",
        attributes: {
          title: m.title,
          category: "project",
          description: m.description || m.title,
          public: false,   // private by default, always
          tags: m.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        },
      },
    }),
  }, token);
}

export async function repositoryHealth() {
  const probe = async (name: string, url: string, token?: string) => {
    if (!token) return { name, status: "KEY REQUIRED", detail: "" };
    try {
      const r = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12_000),
      });
      return {
        name,
        status: r.ok ? "CONNECTED" : r.status === 401 || r.status === 403
          ? "BAD CREDENTIALS" : "DOWN",
        detail: r.ok ? "" : `http ${r.status}`,
      };
    } catch (e) {
      return { name, status: "DOWN", detail: String((e as Error).message).slice(0, 80) };
    }
  };
  return Promise.all([
    probe("Zenodo (live)", "https://zenodo.org/api/deposit/depositions?size=1",
      process.env.ZENODO_ACCESS_TOKEN),
    probe("Zenodo (sandbox)", "https://sandbox.zenodo.org/api/deposit/depositions?size=1",
      process.env.ZENODO_SANDBOX_TOKEN ?? process.env.ZENODO_ACCESS_TOKEN),
    probe("OSF", "https://api.osf.io/v2/users/me/", process.env.OSF_TOKEN),
  ]);
}
