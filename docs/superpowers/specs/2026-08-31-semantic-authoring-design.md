# Semantic Authoring — Design Spec (Phase 1 + 2)

**Date:** 2026-08-31
**Status:** Draft for review
**Scope:** Public brand site + authenticated back office
**Domain:** semanticauthoring.org
**Repo:** github.com/jeff-cline/semanticauthoring

---

## 1. Purpose and scope

Semantic Authoring is a scholarly platform with two connected environments: a **public
publishing site** where scholarship is discovered, and a **private workspace** where it is
developed. This spec covers only the first two sub-projects of five.

### In scope

1. **Public brand site** — statically generated marketing and brand pages, waitlist capture,
   tracking, visitor identification, social/SEO metadata.
2. **Back office** — authentication, two God (superuser) accounts, three subscription tiers,
   CRM for clients and leads, and integration tabs for Stripe, social, and scholarly APIs.

### Explicitly out of scope (later phases)

| Phase | Sub-project | Notes |
|---|---|---|
| 3 | Scholar workspace — library, PDF reader/annotation, Capture Thought, journal, authoring studio, **Life Map**, **Question Tracker** | Prototype before engineering |
| 4 | Public publishing — scholar profiles, publication pages, discovery, **public testimonials** | Depends on phase 3 |
| 5 | Scholar OS research layer — claim ledger, citation integrity, provider adapters, MCP server | Multi-quarter |

Phase 5 corresponds to the "Scholar OS" brief. It is the same product — the research engine
inside the private back office — not a separate platform. Nothing in phases 1–2 may
foreclose it; see §11 for the forward-compatibility constraints.

### Non-goals

This release does not process payments, does not host scholar content, does not store
copyrighted PDFs, and does not publish to any external platform.

---

## 2. Brand system

Taken from the approved brand board.

### Palette

| Token | Hex | Role |
|---|---|---|
| Midnight Scholar | `#17243A` | Navigation, headers, logo |
| Deep Current | `#176B73` | Semantic connections, links, active states |
| Sea Glass | `#8FB8AE` | Soft secondary UI |
| Warm Coral | `#D96C59` | CTAs, publishing moments |
| Champagne Gold | `#C6A15B` | Celebrations, milestones, premium touches |
| Paper | `#F7F4EE` | Main background |
| Ink | `#292B30` | Body copy |

Gold is **restrained** — reserved for milestones. If everything is gold, nothing is.

### Journey accents

Each stage of `READ → CONNECT → SYNTHESIZE → AUTHOR → REVIEW → PUBLISH → CELEBRATE` carries a
subtle accent within the one system, so a user knows where they are without a colorful UI.

| Stage | Accent |
|---|---|
| READ | Midnight Scholar |
| CONNECT | Deep Current |
| SYNTHESIZE | Sea Glass |
| AUTHOR | Ink / editorial neutral |
| REVIEW | Muted blue-gray (derived, `#5A6B80`) |
| PUBLISH | Warm Coral |
| CELEBRATE | Champagne Gold |

### Typography

- **Playfair Display** — headlines, publishing surfaces
- **Inter** — UI, navigation, body

Both self-hosted as WOFF2. No external font CDN (privacy + performance).

### Voice

Tagline: *The operating system for scholarly thinking.*
Promise: *Your ideas. Connected. Developed. Published.*
Closing line: *Private enough for your unfinished thinking. Public enough for your finished ideas to matter.*

Feel: premium, calm, intelligent, editorial, human. Avoid graduation caps, chalkboards,
diplomas, generic school visuals, and gamification.

**Asset correction:** the brand board footer currently reads `BEAD · CONNECT · …`. It must read
`READ`. Fix before the asset is distributed.

---

## 3. Architecture

Approach A: one standalone Next.js application; public routes statically generated.

```
                    semanticauthoring.org
                             │
                        nginx (Core box 137.220.56.129)
                             │
              ┌──────────────┴──────────────┐
              │                             │
     static public routes            /app/* authenticated
     (SSG, cached)                   (SSR, session-gated)
              │                             │
              └──────────────┬──────────────┘
                             │
                   Next.js on port 3100 (PM2)
                             │
              ┌──────────────┴──────────────┐
              │                             │
     Postgres semanticauthoring_prod   R0cketShip Core API
     (own database, isolated)          (email, leads, visitor ID)
```

### Placement

| Concern | Decision |
|---|---|
| Host | `r0cketship` / 137.220.56.129 (the Core box) |
| Port | 3100 (verified free) |
| Process manager | PM2, matching the 13 apps already running |
| Node | 20.20.2 (installed) |
| Package manager | pnpm (to be installed) |
| Database | `semanticauthoring_prod` on existing Postgres 17 |
| Deploy path | `/var/www/semanticauthoring` |
| nginx | `proxy_pass` to 127.0.0.1:3100, replacing the interim static vhost |

**Standalone means standalone.** Own repo, own database, own process. The Core is consumed as
a remote API only. No shared schema, no shared process, no host-based tenancy.

### Deployment

Git-backed. `github.com/jeff-cline/semanticauthoring` is the source of truth; the server
deploys by pulling. A `post-commit` hook auto-pushes so local commits mirror to GitHub
automatically. Server-side deploy script: pull → install → build → PM2 reload.

---

## 4. Public site

### Page inventory

| Route | Rendering | Purpose |
|---|---|---|
| `/` | SSG | Hero, promise, journey, featured scholarship placeholder, tiers, waitlist CTA |
| `/mission` | SSG | Mission, vision, seven core values |
| `/journey` | SSG | READ → … → CELEBRATE explained, with accent system |
| `/pricing` | SSG | Three tiers, all $0 |
| `/about` | SSG | Team, philosophy, the "we don't replace the scholar's thinking" line |
| `/privacy` | SSG | Privacy policy incl. visitor identification disclosure |
| `/terms` | SSG | Terms of use |
| `/join` | SSG + form | Waitlist / early access capture |

Public routes are pre-rendered at build time. No database call, no session, no Node work on a
cache hit.

Publication pages (phase 4) additionally display approved responses and the author's
endorsements, per §9.

### SEO and discovery

- `schema.org` structured data: `Organization` now, `ScholarlyArticle` + `Person` in phase 4
- Open Graph and Twitter card images per page, generated at build
- `sitemap.xml` and `robots.txt`
- Canonical URLs
- Per §24 of the brief: no search-engine manipulation, no manufactured backlinks

### Waitlist form

Posts to an internal route, never directly to the Core (the Core secret stays server-side).

```
browser → POST /api/lead (this app, server-side)
              ├→ Core POST /api/core/lead        (CRM, attributed)
              ├→ local Lead row                  (own CRM)
              └→ Core POST /api/core/email       (notify God accounts, google_workspace)
```

Spam protection: **Cloudflare Turnstile**. Nothing exists in the Core to reuse — verified by
grep across the Core and worldchangers for `recaptcha|turnstile|hcaptcha` (zero hits). Requires
site keys. Until keys are supplied, the form uses a honeypot + rate limit and logs a health
warning.

---

## 5. Visitor identification and consent

**Decision: public marketing pages only. Never inside the authenticated workspace.**

Rationale: visitor identification is standard for lead generation but carries real risk for a
scholarly audience — EU/UK visitors trigger GDPR, and universities scrutinize it during
procurement. Identifying a scholar inside their own private workspace would contradict the
platform's core promise about private thinking.

| Surface | Visitor ID | Tracking script |
|---|---|---|
| Public marketing pages | Yes, after consent | Yes |
| Auth pages (login, reset) | No | No |
| `/app/*` authenticated workspace | **Never** | First-party analytics only |

### Implementation

- `quuik.com/api/pc.js` injected via nginx `sub_filter` on public routes only
- Identity resolution through the Core's PredictiveData integration
- **Consent banner** gates both. Default state is *off* until the visitor accepts.
- Consent stored in a first-party cookie with a recorded timestamp and policy version
- Disclosed plainly in `/privacy`

---

## 6. Authentication and God accounts

### Accounts seeded at first deploy

| Email | Role |
|---|---|
| krystalore@thecrewscoach.com | God |
| jeff.cline@me.com | God |

"God" is the Core's existing term for superuser; adopted here for consistency.

### First-login flow

```
seed account (must_change_password = true)
   → login with temporary credential
   → forced redirect to /app/change-password  (all other routes blocked)
   → new password set, must_change_password = false
   → session issued, redirect to dashboard
```

The forced change is enforced in middleware, not in the UI, so it cannot be bypassed by
navigating directly.

### Credential handling

The temporary password is supplied at deploy time via `SEED_GOD_TEMP_PASSWORD` in the server
environment. **It is never committed to the repo.** Passwords are stored as argon2id hashes.

**Recommendation on record:** one-time expiring invite links, unique per account, are safer
than a shared temporary password — a shared credential defeats the audit trail and the value
has already traveled through chat. The shared-password flow is implemented as requested; the
credential should be rotated immediately after first login.

### Session security

Sessions are httpOnly, Secure, SameSite=Lax, server-side, with idle and absolute timeouts.
Rate limiting and lockout on repeated failures. Password reset over
`provider: "google_workspace"` (see §9).

---

## 7. Subscription tiers

Three tiers now, all priced **$0**. The architecture supports the five-tier model in §29 of the
brief; Research Pro and Institutional are defined but not exposed.

| Feature | Free | Scholar | Doctoral |
|---|---|---|---|
| Public scholar profile | ✓ | ✓ | ✓ |
| Research library | 50 items | Unlimited | Unlimited |
| Annotations & notes | ✓ | ✓ | ✓ |
| Capture Thought | ✓ | ✓ | ✓ |
| Daily scholar journal | ✓ | ✓ | ✓ |
| Authoring studio | 3 documents | Unlimited | Unlimited |
| Public publishing | — | ✓ | ✓ |
| Semantic connections | Basic | Full | Full |
| Groups | Join | Join + create | Join + create |
| Mentor / committee review | — | — | ✓ |
| Course organization | — | — | ✓ |
| Dissertation workspace | — | — | ✓ |
| Publication pipeline | — | — | ✓ |
| Milestones & timeline | ✓ | ✓ | ✓ |
| Question Tracker | ✓ | ✓ | ✓ |
| Life Map | ✓ | ✓ | ✓ |
| Scholar CRM (contacts) | 25 contacts | Unlimited | Unlimited |
| Testimonial requests | 5 | Unlimited | Unlimited |
| Export & portability | ✓ | ✓ | ✓ |

Gating is by **feature flag resolved from the account's tier**, never hard-coded per user, so
tiers can be re-cut without a migration. God accounts bypass all gates.

Most gated features belong to phases 3–5. The tier system and its enforcement ship now; the
features light up as they are built.

---

## 8. CRM — two levels

There are two distinct CRMs, and conflating them would be a privacy failure.

### 8.1 Platform CRM (God accounts)

Manages the business: waitlist signups, inbound leads, and accounts.

Entities: `Lead`, `LeadNote`, `LeadActivity`, `Client`. Modeled on the Core's proven
`Lead`/`LeadNote`/`LeadDoc` shape so the concepts stay aligned.

- List, filter, search by status, source, tier interest, date
- Lead detail with timeline, notes, visitor-ID enrichment when consented
- Pipeline: `new → contacted → qualified → converted → archived`
- Convert lead to account; CSV export
- Attribution: page, campaign, referrer

Leads are written locally **and** forwarded to the Core CRM so they appear in the existing
God-level view. Local is authoritative for this platform.

### 8.2 Scholar CRM (per-scholar, private)

Each scholar gets their own private relationship record — mentors, committee members,
collaborators, testimonial givers, and future professional contacts. This is the scholar's
data, not the platform's.

Entities: `Contact`, `ContactNote`, `ContactActivity`, `TestimonialRequest`.

- Contacts typed: mentor, advisor, committee, peer, collaborator, editor, other
- Notes and interaction history, every entry timestamped
- Follow-up reminders — explicitly supporting the long arc: a contact met in year one is
  still there at graduation and beyond
- Testimonials received land here automatically (§9)
- Export with the rest of the scholar's data

**Isolation rule:** God accounts administer the platform; they do **not** browse a scholar's
private contacts. Scholar CRM records are excluded from God-level views by default. Any
support access is explicit, consented, and written to the audit log.

---

## 9. Testimonials and endorsements

A scholar can request, collect, and display endorsements of their work and their scholarship.

### Flow

```
scholar composes request
   → unique tokenized link (expiring, single-recipient)
   → sent via Core (google_workspace — transactional, not Zapmail)
   → recipient opens public form, no account required
   → writes testimonial + optional rating
   → scholar reviews it privately
   → scholar chooses: publish · keep private · decline
   → contact + testimonial land in the Scholar CRM (§8.2)
```

Nothing appears publicly without the scholar's explicit approval. Silence is not consent.

### Two kinds, deliberately separated

Conflating these is an academic-integrity problem, so the model keeps them distinct:

| Type | Subject | Rating | Public display |
|---|---|---|---|
| **Endorsement** | the *scholar* — mentorship, collaboration, teaching | ★ 1–5 | Scholar profile |
| **Response** | a *published work* — reader reaction, commentary | none | Publication page |

**Design position:** star ratings apply to people-facing endorsements, not to scholarship.
Rating a dissertation chapter 3/5 is not how scholarly evaluation works, and shipping it would
cost credibility with exactly the academic audience the platform is courting — while also
creating a harassment surface aimed at early-career researchers. Peer critique belongs in the
review workflow (phase 3), which is permissioned and attributed.

This is a recommendation, not a decision already made — see open question 2. If you want stars
on publications too, the model supports it with one flag.

### Integrity controls

- Verified email required for the testimonial giver; the token binds it to one recipient
- Attribution shown: name, role, institution — no anonymous public endorsements
- Self-testimonial prevented (giver cannot equal subject)
- Scholar may unpublish at any time; the record is retained, flagged withdrawn
- Reporting path for abusive content; moderation queue for God accounts
- Rate limiting on request sends to prevent the feature becoming a spam vector

### Phasing

| Piece | Phase |
|---|---|
| Request, collect, approve, store in Scholar CRM | **2 (now)** |
| Display on public profile and publication pages | 4 |

Collection ships early so testimonials accumulate before the public surface exists.

---

## 10. Life Map

A private tool connecting lived experience to the scholar's driving questions. This is a
differentiator — it operationalizes the brief's Humanity value ("honor the scholar behind the
scholarship") and pairs with the somatic journal prompts.

### Model

A scholar records **life experiences** — formative events, turning points, encounters, losses,
work, places — and links them to **questions** (§11). The link is the point: it makes visible
*why* a scholar is asking what they are asking.

Each experience carries: title, narrative, approximate date or period, significance, themes,
optional emotional register, and privacy level. Approximate dating is first-class — "sometime
in my twenties" must be expressible without inventing false precision.

### Views

- **Timeline** — experiences across a life
- **Constellation** — experiences and questions as a connected graph, using the same visual
  language as the semantic knowledge map
- **Thread** — trace one question back through every experience feeding it

### Privacy

The most sensitive data in the platform. **Default `Only Me`.** Never surfaced to mentors,
groups, or the public unless deliberately shared, item by item. Excluded from all God-level
views. Never used for AI training. Included in export.

Defined now, built in phase 3.

---

## 11. Question Tracker

Research questions are the spine of the platform — they connect readings, claims, life
experiences, chapters, and future work. They get first-class treatment rather than living as
free text inside documents.

### Model

`Question { text, status, discipline, origin, parentId, createdAt, … }`

- **Status:** `emerging → active → refining → answered → parked → retired`
- **Origin:** where it came from — a reading, an annotation, a life experience, a conversation, a gap, or unprompted
- **Hierarchy:** questions beget sub-questions; the tree is preserved
- **Evolution:** questions are *versioned, never overwritten*. How a question changed over five
  years is itself scholarly evidence, and the original phrasing is often the interesting part.
- **Future bank:** anything not currently pursued is parked with a note, not deleted — the
  explicit "add new ones for future research" requirement

### Connections

A question links to readings, annotations, claims, notes, life experiences, manuscript
sections, dissertation chapters, and collaborators. In phase 5 it becomes the join point for
the claim ledger.

### Views

Active questions dashboard · full tree · evolution history for a single question · the future
bank · unanswered-questions report.

Defined now, built in phase 3.

---

## 12. Timestamping and temporal integrity

**Yes — timestamp everything.** This is not bookkeeping; it is the mechanism that makes the
platform's central promise possible. "Intellectual provenance" and the scholar timeline are
only real if the temporal record is complete and trustworthy.

### Rules

1. Every table carries `created_at` and `updated_at`. No exceptions.
2. Every timestamp is stored in **UTC** with timezone, rendered in the viewer's locale.
3. Records that represent thinking — questions, annotations, notes, claims, life experiences,
   drafts, feedback — are **versioned, not overwritten**. Edits create a new version with its
   own timestamp; prior versions remain retrievable.
4. Meaningful actions append to an immutable event log: created, edited, linked, shared,
   published, unpublished, approved, withdrawn.
5. Externally sourced records additionally carry `retrieved_at` and `last_verified_at`, so
   metadata age is always visible.
6. AI-touched records carry the generation timestamp alongside `generated_by_ai` and `model`.
7. Soft-delete with `deleted_at` for scholarly content. Hard delete is reserved for the
   right-to-erasure path, which is honored completely.

### Why it matters

The core differentiator is preserving the lineage of thought — source → highlight →
annotation → reflection → connection → question → argument → draft → feedback → revision →
publication. That lineage *is* an ordered sequence of timestamped events. Without complete
temporal data the feature cannot be built later; with it, the timeline, the question-evolution
view, and the provenance export all fall out of data already captured.

Cost is modest: a few columns and an append-only table. Retrofitting is impossible — you
cannot recover timestamps you never wrote.

---

## 13. Core API integration

The Core (`R0cketShip Core`, 137.220.56.129) is consumed as a remote authenticated API.
Credentials live only in server environment variables, in a `server-only` module — importing it
from a client component is a build error, which structurally prevents leaking the secret.

| Need | Endpoint | Scope |
|---|---|---|
| Push lead to CRM | `POST /api/core/lead` | `lead:create` |
| Transactional email | `POST /api/core/email` (`google_workspace`) | `email:send` |
| Marketing email | `POST /api/core/email` (`zapmail`) | `email:send` |
| Health check | `GET /api/core/ping` | any |

### Email routing rule (important)

The Core describes Zapmail as *"cold/marketing email (seasoned mailboxes)."* Sending account
invites and password resets through cold-email infrastructure causes spam placement and locks
users out of their own accounts.

| Message type | Provider |
|---|---|
| Password reset, invite, verification, security alert | `google_workspace` |
| Newsletter, announcement, campaign | `zapmail` |

This split is enforced in the email helper, not left to the caller.

### Required credential

A Core API key pair (`x-core-key` / `x-core-secret`) scoped `lead:create` + `email:send`, issued
by a God account at `/core-api`. **Blocking for lead capture and outbound email.** Until it is
supplied, the app builds and runs; the integration health page reports `KEY REQUIRED`, and the
waitlist form persists leads locally and queues notifications.

---

## 14. Integration tabs

A generic integration framework, so future keys are dropped in without a code change — per the
brief's "just drop in the keys."

Model: `Integration { key, label, category, connected, config (encrypted), status, lastCheckedAt }`

Config values are encrypted at rest and write-only from the UI — never rendered back to the
browser after saving.

| Category | Integrations | Status now |
|---|---|---|
| Payments | Stripe | Shell — dormant until keys, no billing logic |
| Social | LinkedIn, X, Facebook, Threads, Bluesky | Shell + share-link fallback |
| Scholarly | Zenodo, OSF, ORCID, Crossref, OpenAlex, Semantic Scholar | Shell + health check |

Each integration exposes a health status per §42 of the brief:
`CONNECTED · PUBLIC API · KEY REQUIRED · RATE LIMITED · DOWN · NOT CONFIGURED`

### Correction to the requirement: "API summaries into scholarly platforms"

OpenAlex, Crossref, PubMed, and Semantic Scholar are **read-only indexes**. They have no
submission endpoint; you cannot push summaries into them. The legitimate path to being indexed
is depositing real research objects with DOIs and letting the indexes discover them.

| Platform | Direction | Reality |
|---|---|---|
| Zenodo | Write | Real deposit + publish API; DOI minted |
| OSF | Write | Preprints/projects where policy permits |
| ORCID | Write | Requires member credentials for write access |
| Crossref, OpenAlex, PubMed, Semantic Scholar | **Read only** | Discover via deposited DOIs |

Irreversible publish actions require explicit `confirm: true` and a preview, per §27 of the
brief. Never auto-publish.

Social auto-posting: X and LinkedIn APIs are restricted and largely paid. Share links and
copy-ready content are the default; direct posting only where an API is genuinely available,
and only with scholar approval per §5 of the brief.

---

## 15. Data model (phases 1–2)

```
User ── Account ── Tier
 │        │
 │        └── FeatureFlag (resolved, not stored per user)
 ├── Session
 ├── PasswordReset
 └── AuditLog

PLATFORM CRM (God)                SCHOLAR CRM (private, per-scholar)
Lead ── LeadNote                  Contact ── ContactNote
 │   └── LeadActivity              │      └── ContactActivity
 └── Client                        └── TestimonialRequest ── Testimonial

Question ── QuestionVersion       LifeExperience
 └── QuestionLink ────────────────┘   (experience ↔ question connections)

Integration (key, category, encrypted config, status)
ConsentRecord (visitor consent, timestamp, policy version)
EventLog (append-only: actor, entity, action, at)
```

`Question`, `QuestionVersion`, `LifeExperience`, and `QuestionLink` are **defined and migrated
now**, populated in phase 3. Creating the tables early costs nothing and keeps the phase-3
workspace from needing a disruptive migration against live scholar data.

### Forward compatibility with Scholar OS

Phase 5 introduces `Source`, `Claim`, `Evidence`, `Note`, `Citation`, `Manuscript`, and a
provenance graph. Two constraints on phases 1–2 so that work is not blocked:

1. **Provenance fields from day one.** Any record that will ever hold external data carries
   `provider`, `provider_id`, `source_url`, `retrieved_at`, `confidence`.
2. **AI provenance from day one.** Any AI-touched record carries `generated_by_ai`, `model`,
   `prompt_hash`, `human_verified`. The distinction between what a scholar wrote and what a
   machine suggested is foundational and cannot be retrofitted honestly.
3. **Complete temporal record from day one** (§12). Timestamps and version history cannot be
   reconstructed after the fact.

`pgvector` is not installed in this phase but the database is provisioned to accept it.

---

## 16. Security and privacy

- Private by default. Nothing is public unless deliberately published.
- RBAC: `god`, `admin`, `scholar`. God bypasses tier gates; scholars never see CRM.
- Argon2id password hashing; secrets only in environment variables; `.env.example` committed,
  `.env` never.
- Encryption at rest for integration config.
- Audit log for God actions: login, integration change, lead export, account changes.
- Input validation at every boundary (zod), CSRF protection, rate limiting.
- Export-my-data and account deletion, per §24 and §34 of the brief.
- Copyright: the schema separates private library from public research objects. Publisher PDFs
  are never public. Enforced at the storage layer, not by convention.

### Compliance to design for now

FERPA (once universities adopt), GDPR/UK GDPR (export, deletion, consent, lawful basis for
visitor ID), CCPA, and an AI-use disclosure policy. Cheaper to architect than retrofit.

---

## 17. Accessibility

Target **WCAG 2.1 AA** — required for university procurement, and a VPAT will be requested.

- Keyboard navigation throughout; visible focus states
- Screen-reader semantics; correct landmarks and headings
- Adjustable text size; contrast verified against the palette
- `prefers-reduced-motion` respected
- Light and dark reading modes

Contrast note: Warm Coral `#D96C59` and Champagne Gold `#C6A15B` do **not** meet 4.5:1 on Paper
`#F7F4EE` for body text. They are restricted to large text, icons, and non-text UI, or paired
with a darkened variant for body copy. To be verified during implementation.

---

## 18. Testing

| Layer | Tool | Coverage |
|---|---|---|
| Unit | Vitest | Tier resolution, email routing, lead normalization, consent |
| Integration | Vitest | Auth flows, forced password change, CRM operations |
| E2E | Playwright | First-login → forced change → dashboard; waitlist submission; consent banner |
| Accessibility | axe via Playwright | Every public page |
| Build | CI | Type check, lint, production build |

Core API calls are mocked in tests. Per §46 of the brief, the system must prefer
"unable to verify" over fabrication — asserted in tests for any degraded integration.

---

## 19. Operations

- PM2 process `semanticauthoring`, port 3100, restart on failure, boot persistence
- nginx `proxy_pass`, existing Let's Encrypt cert (valid to 2026-11-29, auto-renew active)
- Structured logs; integration health page at `/app/integrations`
- Nightly `pg_dump` of `semanticauthoring_prod`

### DNS still required

| Record | Value | Status |
|---|---|---|
| `@` A | 137.220.56.129 | ✅ done |
| `www` A | 137.220.56.129 | ❌ **still points to dead `cname.blabaway.com`** — same IP as apex |
| `app` A (optional) | 137.220.56.129 | Only if the app moves to a subdomain |

Certificate currently covers the apex only. Once `www` resolves, re-run certbot to add it.

---

## 20. Open questions

1. **Tier names and buckets** — §7 proposes Free / Scholar / Doctoral, mapping to the brief's
   five-tier future. Confirm the names and the feature split.
2. **Star ratings on publications** — §9 recommends stars for scholar endorsements only, not for
   published work, on academic-credibility and harassment grounds. Confirm or override.
3. **Turnstile keys** — needed for spam protection on public forms.
4. **Core API key pair** — blocking for lead capture and outbound email.
5. **App subdomain** — keep the back office at `semanticauthoring.org/app`, or move to
   `app.semanticauthoring.org`? Subdomain keeps session cookies off the cacheable marketing
   domain.
6. **Trademark** — "semantic authoring" is an established generic term in structured-docs
   (DITA). Does not block launch; affects defensibility and SEO.

*Resolved:* "Scholar Kastle" — dropped, not used anywhere.

---

## 21. Acceptance criteria

Phase 1–2 is complete when:

1. `https://semanticauthoring.org` serves the statically generated brand site
2. All public pages pass axe with zero critical violations
3. Consent banner gates tracking and visitor ID; declining suppresses both
4. Waitlist submission creates a local lead, forwards to the Core, and notifies God accounts
5. Both God accounts log in with the temporary credential
6. First login is forced to change password; no other route is reachable until it is
7. After change, both reach the dashboard with full access
8. CRM lists, filters, annotates, and exports leads
9. All three integration tabs render with accurate health status
10. Tier gating is enforced server-side; a Free account cannot reach Doctoral features
11. Password reset arrives via `google_workspace`, not Zapmail
12. A scholar sends a testimonial request; the recipient submits without an account; the
    testimonial arrives for approval and lands in that scholar's private CRM
13. An unapproved testimonial is never publicly visible
14. God accounts cannot browse a scholar's private contacts or Life Map
15. Every table has `created_at` / `updated_at`; editing a question creates a new version and
    preserves the original
16. `pnpm build` and the full test suite pass
17. Deploy-by-pull works end to end; PM2 survives reboot

---

## 22. Next step

On approval, the implementation plan is produced with the `writing-plans` skill, then executed
test-first.
