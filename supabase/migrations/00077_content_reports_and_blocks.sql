-- ============================================================
-- 00077 — Signaler une fiche d'artiste, bloquer un artiste
-- Les fiches sont en partie rédigées par les artistes (contenu généré par
-- les utilisateurs) : App Review exige un moyen de signaler un contenu et de
-- bloquer son auteur. Lecture des signalements réservée aux admins.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.content_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  artist_id   TEXT NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('inappropriate', 'impersonation', 'copyright', 'spam', 'other')),
  details     TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reports_open_idx ON public.content_reports (status, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Un utilisateur connecté signale en son nom ; il ne lit pas les signalements
-- des autres. L'équipe (admin) lit et traite tout.
DROP POLICY IF EXISTS "content_reports_insert_own" ON public.content_reports;
CREATE POLICY "content_reports_insert_own"
  ON public.content_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "content_reports_admin_select" ON public.content_reports;
CREATE POLICY "content_reports_admin_select"
  ON public.content_reports FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "content_reports_admin_update" ON public.content_reports;
CREATE POLICY "content_reports_admin_update"
  ON public.content_reports FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.artist_blocks (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id  TEXT NOT NULL REFERENCES public.map_artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

ALTER TABLE public.artist_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_blocks_select_own" ON public.artist_blocks;
CREATE POLICY "artist_blocks_select_own"
  ON public.artist_blocks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_blocks_insert_own" ON public.artist_blocks;
CREATE POLICY "artist_blocks_insert_own"
  ON public.artist_blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "artist_blocks_delete_own" ON public.artist_blocks;
CREATE POLICY "artist_blocks_delete_own"
  ON public.artist_blocks FOR DELETE
  USING (auth.uid() = user_id);
