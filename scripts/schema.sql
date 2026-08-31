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
