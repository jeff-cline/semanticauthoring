-- Semantic Authoring — schema (phases 1–2)
-- Every table carries created_at / updated_at per spec §13.

CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  email                 TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL DEFAULT '',
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'scholar',   -- god | admin | scholar
  tier                  TEXT NOT NULL DEFAULT 'free',      -- free | scholar | doctoral
  must_change_password  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Platform CRM (God) ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL,
  phone        TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL DEFAULT '',
  interest     TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'new',   -- new|contacted|qualified|converted|archived
  source_page  TEXT NOT NULL DEFAULT '',
  referrer     TEXT NOT NULL DEFAULT '',
  campaign     TEXT NOT NULL DEFAULT '',
  forwarded_to_core BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_notes (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scholar CRM (private, per-scholar) -----------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'other', -- mentor|advisor|committee|peer|collaborator|editor|other
  institution TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_owner_idx ON contacts(owner_id);

-- Testimonials (text only — no ratings anywhere, spec §9) ---------------------
CREATE TABLE IF NOT EXISTS testimonial_requests (
  id             SERIAL PRIMARY KEY,
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  token          TEXT NOT NULL UNIQUE,
  kind           TEXT NOT NULL DEFAULT 'endorsement', -- endorsement|response
  message        TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'sent',  -- sent|opened|submitted|expired
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS treq_owner_idx ON testimonial_requests(owner_id);

CREATE TABLE IF NOT EXISTS testimonials (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER REFERENCES testimonial_requests(id) ON DELETE SET NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT '',
  author_institution TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'endorsement',
  status      TEXT NOT NULL DEFAULT 'pending', -- pending|published|private|withdrawn
  published_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS testimonials_owner_idx ON testimonials(owner_id);

-- Subscribers (per-scholar audience, double opt-in) --------------------------
CREATE TABLE IF NOT EXISTS subscribers (
  id             SERIAL PRIMARY KEY,
  scholar_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending|confirmed|unsubscribed|bounced
  source         TEXT NOT NULL DEFAULT 'visitor',
  source_page    TEXT NOT NULL DEFAULT '',
  frequency      TEXT NOT NULL DEFAULT 'immediate', -- immediate|weekly|monthly
  confirm_token  TEXT UNIQUE,
  confirmed_at   TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  consent_ip     TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scholar_id, email)
);
CREATE INDEX IF NOT EXISTS subs_scholar_idx ON subscribers(scholar_id);

-- Question Tracker (versioned, never overwritten — spec §12) -----------------
CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'emerging', -- emerging|active|refining|answered|parked|retired
  discipline  TEXT NOT NULL DEFAULT '',
  origin      TEXT NOT NULL DEFAULT 'unprompted',
  parent_id   INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS questions_owner_idx ON questions(owner_id);

CREATE TABLE IF NOT EXISTS question_versions (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qversions_q_idx ON question_versions(question_id);

-- Life Map -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS life_experiences (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  narrative    TEXT NOT NULL DEFAULT '',
  period       TEXT NOT NULL DEFAULT '',   -- approximate dating is first-class
  significance TEXT NOT NULL DEFAULT '',
  themes       TEXT NOT NULL DEFAULT '',
  visibility   TEXT NOT NULL DEFAULT 'only_me',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS life_owner_idx ON life_experiences(owner_id);

CREATE TABLE IF NOT EXISTS question_links (
  id            SERIAL PRIMARY KEY,
  question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  experience_id INTEGER NOT NULL REFERENCES life_experiences(id) ON DELETE CASCADE,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, experience_id)
);

-- Integrations ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrations (
  id           SERIAL PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  category     TEXT NOT NULL,  -- payments|social|scholarly
  connected    BOOLEAN NOT NULL DEFAULT FALSE,
  config       TEXT NOT NULL DEFAULT '',   -- encrypted at rest, write-only from UI
  status       TEXT NOT NULL DEFAULT 'NOT CONFIGURED',
  last_checked_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consent + audit ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_records (
  id             SERIAL PRIMARY KEY,
  visitor_id     TEXT NOT NULL DEFAULT '',
  granted        BOOLEAN NOT NULL,
  policy_version TEXT NOT NULL DEFAULT '1.0',
  page           TEXT NOT NULL DEFAULT '',
  ip             TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_log (
  id         SERIAL PRIMARY KEY,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_log_entity_idx ON event_log(entity, entity_id);

-- ═══ PHASE 3 — the scholar workspace ════════════════════════════════════════

-- READ: research library
CREATE TABLE IF NOT EXISTS sources (
  id            SERIAL PRIMARY KEY,
  owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'article',
    -- article|book|chapter|website|lecture|report|video|podcast|course_doc|note
  authors       TEXT NOT NULL DEFAULT '',
  year          TEXT NOT NULL DEFAULT '',
  publication   TEXT NOT NULL DEFAULT '',
  doi           TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL DEFAULT '',
  tags          TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  file_path     TEXT NOT NULL DEFAULT '',   -- private storage, never web-served directly
  file_name     TEXT NOT NULL DEFAULT '',
  file_size     INTEGER NOT NULL DEFAULT 0,
  read_status   TEXT NOT NULL DEFAULT 'unread',  -- unread|reading|read
  -- provenance for anything sourced externally (spec §16)
  provider      TEXT NOT NULL DEFAULT '',
  provider_id   TEXT NOT NULL DEFAULT '',
  source_url    TEXT NOT NULL DEFAULT '',
  retrieved_at  TIMESTAMPTZ,
  confidence    TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sources_owner_idx ON sources(owner_id);

-- Annotations: a highlight or note anchored in a source
CREATE TABLE IF NOT EXISTS annotations (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id    INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  page         TEXT NOT NULL DEFAULT '',
  quote        TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'general',
    -- general|literature|methodological|critical|question|idea|quotation
    -- |finding|limitation|counterargument|definition|future_research
  evidence     TEXT NOT NULL DEFAULT '',
    -- supports|challenges|contradicts|expands|contextualizes
  -- the four reflection prompts
  says         TEXT NOT NULL DEFAULT '',   -- What does this source say?
  think        TEXT NOT NULL DEFAULT '',   -- What do I think?
  matters      TEXT NOT NULL DEFAULT '',   -- Why does this matter?
  connects     TEXT NOT NULL DEFAULT '',   -- What does this connect to?
  tags         TEXT NOT NULL DEFAULT '',
  generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  ai_model     TEXT NOT NULL DEFAULT '',
  human_verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS annotations_owner_idx ON annotations(owner_id);
CREATE INDEX IF NOT EXISTS annotations_source_idx ON annotations(source_id);

-- Capture Thought: the fast inbox
CREATE TABLE IF NOT EXISTS captures (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'idea', -- idea|quote|question|reflection|insight
  processed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS captures_owner_idx ON captures(owner_id);

-- Daily scholar journal (intellectual + somatic + intention + reflection)
CREATE TABLE IF NOT EXISTS journal_entries (
  id             SERIAL PRIMARY KEY,
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  intellectual_prompt TEXT NOT NULL DEFAULT '',
  intellectual   TEXT NOT NULL DEFAULT '',
  somatic_prompt TEXT NOT NULL DEFAULT '',
  somatic        TEXT NOT NULL DEFAULT '',
  intention      TEXT NOT NULL DEFAULT '',
  reflection     TEXT NOT NULL DEFAULT '',
  energy         INTEGER, focus INTEGER, stress INTEGER,
  curiosity      INTEGER, confidence INTEGER, capacity INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, entry_date)
);
CREATE INDEX IF NOT EXISTS journal_owner_idx ON journal_entries(owner_id);

-- AUTHOR: the writing studio
CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'essay',
    -- course_paper|discussion|lit_review|proposal|chapter|manuscript
    -- |abstract|working_paper|research_note|essay
  body        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft', -- draft|in_review|revising|final
  word_count  INTEGER NOT NULL DEFAULT 0,
  visibility  TEXT NOT NULL DEFAULT 'only_me',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id);

-- Version-don't-overwrite for writing (spec §13)
CREATE TABLE IF NOT EXISTS document_versions (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  word_count  INTEGER NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS docversions_doc_idx ON document_versions(document_id);

-- CONNECT: general semantic links between any two workspace entities
CREATE TABLE IF NOT EXISTS connections (
  id         SERIAL PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_type  TEXT NOT NULL,   -- source|annotation|question|document|capture|experience
  from_id    INTEGER NOT NULL,
  to_type    TEXT NOT NULL,
  to_id      INTEGER NOT NULL,
  relation   TEXT NOT NULL DEFAULT 'relates_to',
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, from_type, from_id, to_type, to_id, relation)
);
CREATE INDEX IF NOT EXISTS connections_owner_idx ON connections(owner_id);

-- CELEBRATE: milestones and the scholar timeline
CREATE TABLE IF NOT EXISTS milestones (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL DEFAULT '',      -- '' for custom milestones
  title       TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  reflection  TEXT NOT NULL DEFAULT '',
  visibility  TEXT NOT NULL DEFAULT 'only_me',
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_owner_idx ON milestones(owner_id);

-- ═══ PHASE 3 (remainder) — courses and permissioned review ══════════════════

CREATE TABLE IF NOT EXISTS courses (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  code        TEXT NOT NULL DEFAULT '',
  term        TEXT NOT NULL DEFAULT '',
  year        TEXT NOT NULL DEFAULT '',
  instructor  TEXT NOT NULL DEFAULT '',
  syllabus    TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS courses_owner_idx ON courses(owner_id);

CREATE TABLE IF NOT EXISTS course_items (
  id         SERIAL PRIMARY KEY,
  course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'reading',  -- reading|assignment|discussion|note
  title      TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  due_on     DATE,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  source_id  INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_items_course_idx ON course_items(course_id);

-- Permissioned review. A scholar shares ONE artefact with ONE person.
CREATE TABLE IF NOT EXISTS shares (
  id            SERIAL PRIMARY KEY,
  owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,        -- document|publication
  entity_id     INTEGER NOT NULL,
  reviewer_name  TEXT NOT NULL DEFAULT '',
  reviewer_email TEXT NOT NULL,
  reviewer_role  TEXT NOT NULL DEFAULT 'reviewer', -- mentor|advisor|committee|peer|reviewer
  token         TEXT NOT NULL UNIQUE,
  can_comment   BOOLEAN NOT NULL DEFAULT TRUE,
  status        TEXT NOT NULL DEFAULT 'active',  -- active|revoked|expired
  due_on        DATE,
  expires_at    TIMESTAMPTZ NOT NULL,
  last_opened_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shares_owner_idx ON shares(owner_id);

CREATE TABLE IF NOT EXISTS review_comments (
  id           SERIAL PRIMARY KEY,
  share_id     INTEGER REFERENCES shares(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_id    INTEGER NOT NULL,
  author_name  TEXT NOT NULL,
  author_email TEXT NOT NULL DEFAULT '',
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT NOT NULL,
  anchor       TEXT NOT NULL DEFAULT '',   -- quoted passage the comment refers to
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_comments_entity_idx ON review_comments(entity_type, entity_id);

-- ═══ PHASE 4 — public profiles and publishing ═══════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  handle      TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  headline    TEXT NOT NULL DEFAULT '',
  bio         TEXT NOT NULL DEFAULT '',
  institution TEXT NOT NULL DEFAULT '',
  program     TEXT NOT NULL DEFAULT '',
  degree      TEXT NOT NULL DEFAULT '',
  interests   TEXT NOT NULL DEFAULT '',
  orcid       TEXT NOT NULL DEFAULT '',
  website     TEXT NOT NULL DEFAULT '',
  social      TEXT NOT NULL DEFAULT '',
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  show_timeline BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publications (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  subtitle     TEXT NOT NULL DEFAULT '',
  abstract     TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'essay',
    -- essay|research_note|article|working_paper|commentary|reflection
    -- |explainer|conference_summary
  tags         TEXT NOT NULL DEFAULT '',
  topic        TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft',  -- draft|published|unpublished
  doi          TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  reading_time INTEGER NOT NULL DEFAULT 0,
  word_count   INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);
CREATE INDEX IF NOT EXISTS publications_owner_idx ON publications(owner_id);
CREATE INDEX IF NOT EXISTS publications_status_idx ON publications(status);

-- ═══ PHASE 5 — Scholar OS: claims, evidence, citation integrity ═════════════

CREATE TABLE IF NOT EXISTS claims (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  question_id  INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  document_id  INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  chapter      TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  last_reviewed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claims_owner_idx ON claims(owner_id);

CREATE TABLE IF NOT EXISTS claim_evidence (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id    INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  annotation_id INTEGER REFERENCES annotations(id) ON DELETE SET NULL,
  relation     TEXT NOT NULL DEFAULT 'supports',
    -- supports|contradicts|qualifies|replicates|fails_to_replicate
    -- |provides_context|cites
  location     TEXT NOT NULL DEFAULT '',   -- page / section within the source
  note         TEXT NOT NULL DEFAULT '',
  confidence   TEXT NOT NULL DEFAULT 'stated',  -- stated|inferred|uncertain
  -- provenance of the extraction itself
  generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE,
  ai_model     TEXT NOT NULL DEFAULT '',
  human_verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_evidence_claim_idx ON claim_evidence(claim_id);

-- Result of checking a source's metadata against authoritative indexes.
CREATE TABLE IF NOT EXISTS citation_checks (
  id          SERIAL PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
    -- VERIFIED_METADATA|UNVERIFIED|NOT_FOUND|RETRACTED|CORRECTED
    -- |EXPRESSION_OF_CONCERN|MISMATCH|ERROR
  provider    TEXT NOT NULL DEFAULT '',
  detail      TEXT NOT NULL DEFAULT '',
  raw         TEXT NOT NULL DEFAULT '',
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citation_checks_source_idx ON citation_checks(source_id);

-- Password reset tokens. Single-use, short-lived, hashed at rest so a database
-- read cannot be turned into an account takeover.
CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  requested_ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);

-- ═══ PHASE 5 — dissertation, pipeline, defense ══════════════════════════════

CREATE TABLE IF NOT EXISTS dissertations (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  degree      TEXT NOT NULL DEFAULT 'PhD',   -- PhD|PsyD|EdD|MD-PhD|JD-PhD|Masters
  institution TEXT NOT NULL DEFAULT '',
  program     TEXT NOT NULL DEFAULT '',
  chair       TEXT NOT NULL DEFAULT '',
  committee   TEXT NOT NULL DEFAULT '',
  problem     TEXT NOT NULL DEFAULT '',
  purpose     TEXT NOT NULL DEFAULT '',
  framework   TEXT NOT NULL DEFAULT '',
  methodology TEXT NOT NULL DEFAULT '',
  proposal_status TEXT NOT NULL DEFAULT 'drafting',
    -- drafting|submitted|approved|irb_pending|irb_approved
  defense_on  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dissertations_owner_idx ON dissertations(owner_id);

CREATE TABLE IF NOT EXISTS dissertation_chapters (
  id             SERIAL PRIMARY KEY,
  dissertation_id INTEGER NOT NULL REFERENCES dissertations(id) ON DELETE CASCADE,
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL DEFAULT 0,
  title          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'not_started',
    -- not_started|drafting|in_review|revising|complete
  target_words   INTEGER NOT NULL DEFAULT 0,
  document_id    INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  notes          TEXT NOT NULL DEFAULT '',
  due_on         DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chapters_diss_idx ON dissertation_chapters(dissertation_id);

CREATE TABLE IF NOT EXISTS submissions (
  id             SERIAL PRIMARY KEY,
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id    INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  publication_id INTEGER REFERENCES publications(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  venue          TEXT NOT NULL DEFAULT '',       -- target journal or repository
  stage          TEXT NOT NULL DEFAULT 'idea',
    -- idea|draft|internal_review|citation_audit|ready|submitted|under_review
    -- |revise_resubmit|accepted|published|declined
  coauthors      TEXT NOT NULL DEFAULT '',
  word_limit     INTEGER NOT NULL DEFAULT 0,
  guidelines     TEXT NOT NULL DEFAULT '',
  submitted_on   DATE,
  decision_on    DATE,
  revision_due   DATE,
  reviewer_notes TEXT NOT NULL DEFAULT '',
  doi            TEXT NOT NULL DEFAULT '',
  url            TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submissions_owner_idx ON submissions(owner_id);

-- Defense preparation. Questions are the SCHOLAR'S OWN anticipation work —
-- the platform never presents generated prompts as real committee questions.
CREATE TABLE IF NOT EXISTS defense_questions (
  id             SERIAL PRIMARY KEY,
  owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dissertation_id INTEGER REFERENCES dissertations(id) ON DELETE CASCADE,
  claim_id       INTEGER REFERENCES claims(id) ON DELETE SET NULL,
  category       TEXT NOT NULL DEFAULT 'methodological',
    -- theoretical|methodological|statistical|epistemological|ethical
    -- |literature|limitations|generalizability|contribution|future_research
  question       TEXT NOT NULL,
  response       TEXT NOT NULL DEFAULT '',
  confidence     TEXT NOT NULL DEFAULT 'unprepared', -- unprepared|shaky|ready
  origin         TEXT NOT NULL DEFAULT 'self',       -- self|prompt|advisor
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS defense_owner_idx ON defense_questions(owner_id);

-- ═══ Groups — cohorts, reading circles, writing groups ══════════════════════

CREATE TABLE IF NOT EXISTS groups (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'reading_circle',
    -- cohort|university|research_interest|reading_circle|writing|accountability
    -- |methodology|publication|peer_support
  visibility  TEXT NOT NULL DEFAULT 'private',  -- public|private|institution
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id        SERIAL PRIMARY KEY,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',   -- owner|moderator|member
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id);

CREATE TABLE IF NOT EXISTS group_posts (
  id         SERIAL PRIMARY KEY,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'discussion',
    -- discussion|question|recommendation|milestone|accountability
  -- A member may attach one of their OWN sources as a recommendation.
  -- Private research is never exposed to a group implicitly.
  source_id  INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_posts_group_idx ON group_posts(group_id);

-- Personal access tokens for the MCP server and any future programmatic use.
-- Hashed at rest; the plaintext is shown once at creation and never again.
CREATE TABLE IF NOT EXISTS access_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  token_hash  TEXT NOT NULL UNIQUE,
  prefix      TEXT NOT NULL DEFAULT '',
  scopes      TEXT NOT NULL DEFAULT 'read',   -- comma separated: read,write
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_tokens_user_idx ON access_tokens(user_id);

-- ═══ Syllabus intake, reading plan, and the reading log ═════════════════════

ALTER TABLE courses ADD COLUMN IF NOT EXISTS syllabus_file TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS syllabus_name TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS starts_on DATE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS ends_on DATE;

-- Backward planning: a reading due on the 1st with 5 lead days should surface
-- from the 27th, so the scholar starts in time to arrive prepared.
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS lead_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS start_on DATE;
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS pages TEXT NOT NULL DEFAULT '';
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT '';
ALTER TABLE course_items ADD COLUMN IF NOT EXISTS extracted BOOLEAN NOT NULL DEFAULT FALSE;

-- Questions gain the reflective fields that make a question *yours*.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS beneath TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sensed_on DATE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sensed_note TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS chosen_or_arrived TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS chosen_note TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS counterfactual TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS cost TEXT NOT NULL DEFAULT '';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS given_back TEXT NOT NULL DEFAULT '';

-- MY READING — a reading journal, one entry per reading session or work.
CREATE TABLE IF NOT EXISTS reading_log (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id    INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  read_on      DATE NOT NULL DEFAULT CURRENT_DATE,
  title        TEXT NOT NULL,
  authors      TEXT NOT NULL DEFAULT '',
  year         TEXT NOT NULL DEFAULT '',
  publication  TEXT NOT NULL DEFAULT '',
  publisher    TEXT NOT NULL DEFAULT '',
  volume       TEXT NOT NULL DEFAULT '',
  issue        TEXT NOT NULL DEFAULT '',
  page_range   TEXT NOT NULL DEFAULT '',
  edition      TEXT NOT NULL DEFAULT '',
  doi          TEXT NOT NULL DEFAULT '',
  url          TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'journal_article',
    -- journal_article|book|chapter|website|report|dissertation
  why_matters  TEXT NOT NULL DEFAULT '',
  reaction     TEXT NOT NULL DEFAULT '',
  connections  TEXT NOT NULL DEFAULT '',
  other_sources TEXT NOT NULL DEFAULT '',
  keywords     TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reading_log_owner_idx ON reading_log(owner_id);

CREATE TABLE IF NOT EXISTS reading_quotes (
  id        SERIAL PRIMARY KEY,
  entry_id  INTEGER NOT NULL REFERENCES reading_log(id) ON DELETE CASCADE,
  owner_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote     TEXT NOT NULL,
  page      TEXT NOT NULL DEFAULT '',
  why       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reading_quotes_entry_idx ON reading_quotes(entry_id);
