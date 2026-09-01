# Semantic Authoring — MCP server

Connects an AI assistant to a scholar's Semantic Authoring workspace and to the
public scholarly indexes, over stdio.

## Setup

```bash
cd mcp && npm install
```

Create a personal access token at
[`/app/tokens`](https://semanticauthoring.org/app/tokens). Grant **write** only
if you want the assistant to be able to create sources, notes, questions, or
claims — read is enough for search and audit work.

Register with Claude Code:

```bash
claude mcp add semanticauthoring \
  --env SEMANTIC_AUTHORING_TOKEN=sa_pat_… \
  -- node /path/to/semanticauthoring/mcp/server.mjs
```

Check `claude mcp --help` for the syntax your installed CLI expects; it changes
between versions.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `SEMANTIC_AUTHORING_URL` | `https://semanticauthoring.org` | Instance to talk to |
| `SEMANTIC_AUTHORING_TOKEN` | — | Personal access token (required) |

## Tools

| Tool | Scope | What it does |
|---|---|---|
| `scholar_whoami` | read | Verify the token and report workspace counts |
| `scholar_search_works` | read | Search OpenAlex for real published works |
| `citation_verify` | read | Resolve a DOI at Crossref and OpenAlex; flag retractions and mismatches |
| `library_list` | read | List sources in the private library |
| `library_add_source` | write | Add a source |
| `notes_list` | read | List annotations |
| `notes_create` | write | Annotate a source (marked AI-assisted) |
| `questions_list` | read | List research questions |
| `questions_create` | write | Record a question |
| `claims_list` | read | Claims with their evidence |
| `claims_create` | write | Record a claim with evidence |
| `claims_audit` | read | Unsupported and contested claims |

## Resources

`scholar://profile` · `scholar://library` · `scholar://questions` · `scholar://claims`

## Prompts

`citation-integrity-review` · `claim-evidence-audit` · `defense-preparation` ·
`literature-gap-scan`

## Research integrity

Two rules are built into every tool:

**Never fabricate.** If a DOI does not resolve or a record cannot be found, the
tool returns `NOT_VERIFIED`. It does not invent citations, DOIs, titles,
authors, years, or page numbers.

**Preserve provenance.** Anything written through this server is stored with
`generated_by_ai = true`, the model that produced it, and
`human_verified = false`, so the scholar can always separate their own thinking
from a machine's suggestion.

`citation_verify` confirms that a citation is real and correctly recorded. It
never claims that a paper supports an argument — that judgement belongs to the
scholar, and asserting it from metadata would be the exact failure this
platform exists to prevent.
