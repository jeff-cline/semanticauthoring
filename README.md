# Semantic Authoring

**The operating system for scholarly thinking.**

Private enough for your unfinished thinking. Public enough for your finished ideas to matter.

`READ → CONNECT → SYNTHESIZE → AUTHOR → REVIEW → PUBLISH → CELEBRATE`

## Status

Pre-implementation. The Phase 1–2 design spec is at
[`docs/superpowers/specs/2026-08-31-semantic-authoring-design.md`](docs/superpowers/specs/2026-08-31-semantic-authoring-design.md).

## Architecture

Standalone Next.js application. Public brand pages are statically generated; the
authenticated back office is session-gated. Runs on its own port with its own PostgreSQL
database, consuming the R0cketShip Core as a remote API for email, leads, and visitor
identification.

| | |
|---|---|
| Domain | semanticauthoring.org |
| Host | 137.220.56.129 |
| Port | 3100 |
| Database | `semanticauthoring_prod` |

## Phases

1. **Public brand site** — marketing pages, waitlist, tracking, visitor ID
2. **Back office** — auth, God accounts, tiers, CRM, integration tabs
3. Scholar workspace — library, annotation, journal, authoring studio
4. Public publishing — profiles, publication pages, discovery
5. Scholar OS — claim ledger, citation integrity, provider adapters, MCP server

## Research integrity

Never fabricate a citation, DOI, page number, finding, or statistic. Always distinguish what
the scholar read, what AI suggested, what the scholar thought, and what the scholar authored.
Prefer "unable to verify" over a confident guess.
