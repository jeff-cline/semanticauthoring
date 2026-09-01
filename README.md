# Semantic Authoring

**The operating system for scholarly thinking.**

Private enough for your unfinished thinking. Public enough for your finished ideas to matter.

`READ → CONNECT → SYNTHESIZE → AUTHOR → REVIEW → PUBLISH → CELEBRATE`

Live at **[semanticauthoring.org](https://semanticauthoring.org)**.

---

## What this is

A scholarly platform with two connected environments. A **private workspace** where a
scholar develops research — library, annotations, questions, journal, writing, claims — and a
**public platform** where the work they choose to publish is discovered and read.

The core idea is **intellectual provenance**: preserving the traceable lineage from source to
highlight, annotation, reflection, connection, research question, argument, draft, feedback,
revision, and publication. That lineage is an ordered sequence of timestamped events, so it
cannot be reconstructed later — either it is captured as the work happens, or it is gone.

## Architecture

A standalone Next.js application. Public pages are statically generated; the workspace is
session-gated. Runs on its own port with its own PostgreSQL database, consuming the
R0cketShip Core as a remote API for email, leads, and visitor identification.

| | |
|---|---|
| Domain | semanticauthoring.org |
| Host | 137.220.56.129 |
| Port | 3100 (PM2 process `semanticauthoring`) |
| Database | `semanticauthoring_prod` (PostgreSQL 17) |
| Files | `/var/lib/semanticauthoring/files` — outside the web root |
| Deploy | `./scripts/deploy.sh` on the server |

No ORM and no native crypto: plain SQL over `pg`, and scrypt from `node:crypto`. Both choices
avoid platform-specific binaries, so a build can never diverge from the runtime.

## Getting started

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL at minimum
npm run db:push               # apply schema.sql
npm run db:seed               # seed God accounts + integration shells
npm run dev                   # http://localhost:3100
```

```bash
npm test          # unit tests
npm run typecheck # tsc --noEmit
npm run build     # production build
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SITE_URL` | yes | Canonical origin, used in emails and metadata |
| `SESSION_SECRET` | yes | Session signing |
| `SEED_GOD_TEMP_PASSWORD` | seed only | Temporary password for seeded God accounts |
| `FILE_STORAGE_DIR` | yes | Private upload storage, outside the web root |
| `CORE_API_BASE/KEY/SECRET` | for email | R0cketShip Core credentials (`lead:create`, `email:send`) |
| `NOTIFY_TO` | for email | Comma-separated addresses for lead notifications |
| `TURNSTILE_SITE_KEY/SECRET_KEY` | optional | Spam protection; honeypot + rate limiting until set |
| `CONTACT_EMAIL` | optional | Crossref and Unpaywall polite pool |

`.env` is never committed.

## What is built

**Public** — home with search, mission, journey, pricing, about, privacy, terms, signup,
nine deep answer pages, discovery by topic, scholars directory, public search, scholar
profiles, publication pages.

**Workspace** — research library with private file storage, annotations with evidence labels
and the four reflection prompts, Capture Thought, daily journal with rotating somatic prompts,
authoring studio, question tracker with version history, Life Map, knowledge map, connections,
groups, courses, milestones and timeline.

**Dissertation** — chapters, the frame, proposal status, defense preparation.

**Scholar OS** — claim ledger with seven evidence relations, citation integrity against
Crossref and OpenAlex, publication pipeline, read-only provider adapters.

**Publishing** — public profiles, publication pages with `ScholarlyArticle` metadata,
subscribers with double opt-in, testimonials, share links.

**Back office** — platform CRM, per-scholar CRM, integration health, access tokens.

**Programmatic** — token-authenticated v1 API and an [MCP server](mcp/README.md) with 12
tools, 4 resources, and 4 prompts.

## Not built yet

Institutional SSO and licensing, faculty dashboards, grant and conference discovery,
peer-review management, research analytics, mobile app, browser extension, Word/Docs and
Overleaf integrations, Zenodo and OSF deposit, pgvector semantic search, and AI-assisted
synthesis. The architecture leaves room for all of it; none of it is claimed as present.

## Research integrity

These are enforced in code, not just documented:

1. **Never fabricate** a citation, DOI, page number, finding, or statistic. An unresolvable
   DOI reports `NOT_FOUND`; the MCP server returns `NOT_VERIFIED`. Neither invents a record.
2. **Preserve provenance.** External records carry `provider`, `provider_id`, `source_url`,
   `retrieved_at`, and `confidence`. AI-touched records carry `generated_by_ai`, the model,
   and `human_verified`.
3. **Always distinguish** what the scholar read, what AI suggested, what the scholar thought,
   and what the scholar authored.
4. **Prefer "unable to verify"** over a confident guess.
5. **Citation checking verifies the citation, not the argument.** Whether a paper supports a
   claim is the scholar's judgement; asserting it from metadata would be fabrication.

## Privacy

Private by default, without exception. Analytics and visitor identification run on public
marketing pages only, after consent, and never inside the workspace — the nginx vhost
deliberately omits the proxy-level tracking injection the other sites on this box use, because
it would fire before anyone touched the consent banner.

Public search reads only published work and public profiles. A test asserts the search SQL can
touch nothing but `publications`, `profiles`, and `users`.

Every scholar can export everything as JSON with full version history, plus BibTeX.

## Documentation

- [Design spec](docs/superpowers/specs/2026-08-31-semantic-authoring-design.md)
- [MCP server](mcp/README.md)
