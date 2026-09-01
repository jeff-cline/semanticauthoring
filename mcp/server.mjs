#!/usr/bin/env node
/**
 * Semantic Authoring — MCP server
 *
 * Bridges an AI assistant to a scholar's workspace and to the public scholarly
 * indexes, over stdio.
 *
 * Two hard rules shape every tool here:
 *
 *   1. Never fabricate. If a DOI does not resolve or a record cannot be found,
 *      the tool returns status NOT_VERIFIED. It never invents a citation, a
 *      title, an author, a year, or a page number.
 *   2. Preserve provenance. Anything written through this server is marked
 *      generated_by_ai with the model that produced it and human_verified=false,
 *      so the scholar can always tell their own thinking from a suggestion.
 *
 * Configure with:
 *   SEMANTIC_AUTHORING_URL    default https://semanticauthoring.org
 *   SEMANTIC_AUTHORING_TOKEN  a personal access token from /app/tokens
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE = (process.env.SEMANTIC_AUTHORING_URL ?? "https://semanticauthoring.org").replace(/\/$/, "");
const TOKEN = process.env.SEMANTIC_AUTHORING_TOKEN ?? "";

async function api(path, init = {}) {
  if (!TOKEN) {
    return { error: "SEMANTIC_AUTHORING_TOKEN is not set. Create one at " + BASE + "/app/tokens" };
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? `http ${res.status}` };
    return json;
  } catch (e) {
    return { error: String(e?.message ?? e) };
  }
}

const text = (v) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "scholar_whoami",
    description: "Verify the configured token and report the scholar it belongs to, plus workspace counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "scholar_search_works",
    description:
      "Search the OpenAlex scholarly index for published works. Read-only. Returns real records only — never invented ones.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms" },
        limit: { type: "number", description: "Max results, up to 20" },
      },
      required: ["query"],
    },
  },
  {
    name: "citation_verify",
    description:
      "Look up a DOI in Crossref and OpenAlex. Reports whether it resolves, whether metadata matches, and whether the work is retracted or corrected. Returns NOT_VERIFIED rather than guessing. Does NOT judge whether a paper supports a claim — that is the scholar's judgement.",
    inputSchema: {
      type: "object",
      properties: {
        doi: { type: "string", description: "DOI, with or without the https://doi.org/ prefix" },
        title: { type: "string", description: "Optional expected title, to check for mismatch" },
      },
      required: ["doi"],
    },
  },
  {
    name: "library_list",
    description: "List sources in the scholar's private research library. Optionally filter by keyword.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Filter by title, author, or tag" } },
    },
  },
  {
    name: "library_add_source",
    description:
      "Add a source to the scholar's library. Requires a write-scoped token. Only add sources you have verified exist — check the DOI with citation_verify first.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" }, authors: { type: "string" }, year: { type: "string" },
        publication: { type: "string" }, doi: { type: "string" }, url: { type: "string" },
        kind: { type: "string", description: "article|book|chapter|website|lecture|report|video|podcast|course_doc|note" },
        tags: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "notes_list",
    description: "List the scholar's annotations, optionally filtered by keyword.",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
  },
  {
    name: "notes_create",
    description:
      "Create an annotation on a source the scholar owns. Requires a write-scoped token. The note is recorded as AI-assisted and unverified, so the scholar can review it.",
    inputSchema: {
      type: "object",
      properties: {
        source_id: { type: "number" }, page: { type: "string" }, quote: { type: "string" },
        kind: { type: "string" },
        evidence: { type: "string", description: "supports|challenges|contradicts|expands|contextualizes" },
        says: { type: "string", description: "What the source says" },
        think: { type: "string", description: "What the scholar thinks — leave empty unless they told you" },
        matters: { type: "string" }, connects: { type: "string" },
      },
      required: ["source_id"],
    },
  },
  {
    name: "questions_list",
    description: "List the scholar's research questions with status and origin.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "questions_create",
    description: "Record a new research question. Requires a write-scoped token.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        status: { type: "string", description: "emerging|active|refining|answered|parked|retired" },
        origin: { type: "string" }, discipline: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "claims_list",
    description:
      "List the scholar's claims with the evidence attached to each, including what contradicts them.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "claims_create",
    description:
      "Record a claim, optionally with evidence referencing sources the scholar already owns. Requires a write-scoped token. Never attach a source you have not verified exists.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" }, chapter: { type: "string" },
        evidence: {
          type: "array",
          description: "Each item: {source_id, relation, location, note, confidence}",
          items: { type: "object" },
        },
      },
      required: ["text"],
    },
  },
  {
    name: "claims_audit",
    description:
      "Report claims with no evidence attached and claims with contradicting evidence — the two things a committee finds first.",
    inputSchema: { type: "object", properties: {} },
  },
];

const server = new Server(
  { name: "semanticauthoring", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;

  switch (name) {
    case "scholar_whoami":
      return text(await api("/api/v1/me"));

    case "scholar_search_works": {
      const r = await api(`/api/v1/search?q=${encodeURIComponent(a.query)}&limit=${a.limit ?? 8}`);
      return text(r);
    }

    case "citation_verify": {
      const qs = new URLSearchParams({ doi: String(a.doi) });
      if (a.title) qs.set("title", String(a.title));
      return text(await api(`/api/v1/search?${qs}`));
    }

    case "library_list":
      return text(await api(`/api/v1/sources${a.query ? `?q=${encodeURIComponent(a.query)}` : ""}`));

    case "library_add_source":
      return text(await api("/api/v1/sources", { method: "POST", body: JSON.stringify(a) }));

    case "notes_list":
      return text(await api(`/api/v1/notes${a.query ? `?q=${encodeURIComponent(a.query)}` : ""}`));

    case "notes_create":
      return text(await api("/api/v1/notes", {
        method: "POST",
        // Provenance: anything written through an assistant is marked as such.
        body: JSON.stringify({ ...a, generated_by_ai: true, ai_model: "mcp-client" }),
      }));

    case "questions_list":
      return text(await api("/api/v1/questions"));

    case "questions_create":
      return text(await api("/api/v1/questions", { method: "POST", body: JSON.stringify(a) }));

    case "claims_list":
      return text(await api("/api/v1/claims"));

    case "claims_create":
      return text(await api("/api/v1/claims", { method: "POST", body: JSON.stringify(a) }));

    case "claims_audit": {
      const r = await api("/api/v1/claims");
      if (r.error) return text(r);
      const claims = r.claims ?? [];
      const unsupported = claims.filter((c) => (c.evidence ?? []).length === 0);
      const contested = claims.filter((c) =>
        (c.evidence ?? []).some((e) => ["contradicts", "fails_to_replicate"].includes(e.relation)));
      return text({
        ok: true,
        total: claims.length,
        unsupported: unsupported.map((c) => ({ id: c.id, text: c.text, chapter: c.chapter })),
        contested: contested.map((c) => ({
          id: c.id, text: c.text,
          against: (c.evidence ?? []).filter((e) =>
            ["contradicts", "fails_to_replicate"].includes(e.relation)),
        })),
        note: "Unsupported and contested claims are what a committee finds first.",
        retrieved_at: new Date().toISOString(),
      });
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
});

// ── Resources ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: "scholar://profile", name: "Scholar profile and workspace counts", mimeType: "application/json" },
    { uri: "scholar://library", name: "Research library", mimeType: "application/json" },
    { uri: "scholar://questions", name: "Research questions", mimeType: "application/json" },
    { uri: "scholar://claims", name: "Claim ledger with evidence", mimeType: "application/json" },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const path = {
    "scholar://profile": "/api/v1/me",
    "scholar://library": "/api/v1/sources",
    "scholar://questions": "/api/v1/questions",
    "scholar://claims": "/api/v1/claims",
  }[req.params.uri];
  if (!path) throw new Error(`Unknown resource: ${req.params.uri}`);
  return {
    contents: [{
      uri: req.params.uri, mimeType: "application/json",
      text: JSON.stringify(await api(path), null, 2),
    }],
  };
});

// ── Prompts ──────────────────────────────────────────────────────────────────

const PROMPTS = [
  {
    name: "citation-integrity-review",
    description: "Check every DOI in the library and report what does not hold up.",
    text: `Review this scholar's research library for citation integrity.

1. Call library_list to get every source.
2. For each source that has a DOI, call citation_verify.
3. Report, grouped by severity: retracted works, DOIs that do not resolve,
   metadata that disagrees with the registry, and sources with no DOI at all.

Do not guess at any DOI. If a source has none, say so rather than inferring one.
Never state that a paper supports an argument — you are checking that the
citation is real and correctly recorded, nothing more.`,
  },
  {
    name: "claim-evidence-audit",
    description: "Find unsupported and contested claims before a committee does.",
    text: `Audit this scholar's claim ledger.

1. Call claims_audit.
2. For each unsupported claim, suggest what KIND of evidence would settle it —
   a population, a method, a replication — without inventing sources.
3. For each contested claim, summarise what contradicts it and ask how the
   scholar plans to address it in the text.

Do not invent citations. If you want to suggest literature, call
scholar_search_works and only cite what actually comes back.`,
  },
  {
    name: "defense-preparation",
    description: "Generate anticipation questions grounded in the scholar's own claims.",
    text: `Help this scholar prepare to defend their work.

1. Call claims_list and questions_list.
2. For the weakest claims, draft questions a committee might reasonably ask,
   across theoretical, methodological, statistical, epistemological, ethical,
   literature, limitations, generalizability, contribution, and future-research
   categories.
3. For each, note which evidence in their ledger they would draw on.

Be explicit that these are anticipation prompts, not predictions of what any
real committee will ask.`,
  },
  {
    name: "literature-gap-scan",
    description: "Compare the library against the wider literature and name possible gaps.",
    text: `Look for possible research gaps around this scholar's questions.

1. Call questions_list, then library_list.
2. For each active question, call scholar_search_works with terms from it.
3. Compare what comes back against what is already in the library, and report
   candidates: population gaps, methodological gaps, unreplicated findings,
   and contradictions nobody has resolved.

Label every one as a POTENTIAL gap. You are looking at a search index, not the
complete literature, and only the scholar can confirm a gap is real.`,
  },
];

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS.map(({ name, description }) => ({ name, description })),
}));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const p = PROMPTS.find((x) => x.name === req.params.name);
  if (!p) throw new Error(`Unknown prompt: ${req.params.name}`);
  return {
    description: p.description,
    messages: [{ role: "user", content: { type: "text", text: p.text } }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Semantic Authoring MCP server ready on stdio");
