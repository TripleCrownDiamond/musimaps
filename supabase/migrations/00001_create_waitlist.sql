CREATE TABLE IF NOT EXISTS waitlist (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email     TEXT NOT NULL UNIQUE,
  profile   TEXT NOT NULL CHECK (profile IN ('artiste', 'amateur')),
  artist_name TEXT,
  city      TEXT,
  genre     TEXT,
  link      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les recherches par email
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist (email);