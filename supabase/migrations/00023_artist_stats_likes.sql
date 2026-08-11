-- ============================================================
-- 00023 — Statistiques artistes + likes web
-- - artist_stats : compteurs de vues profil / vues pin par
--   artiste (incrémentés par RPC, lecture publique).
-- - favorites : policies déjà présentes (00002) pour le mobile ;
--   on garantit aussi le SELECT/INSERT pour le web connecté.
-- ============================================================

-- 1. Statistiques par artiste
CREATE TABLE IF NOT EXISTS public.artist_stats (
  artist_id    TEXT PRIMARY KEY,
  profile_views BIGINT NOT NULL DEFAULT 0,
  pin_views    BIGINT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artist_stats_select_public" ON public.artist_stats;
CREATE POLICY "artist_stats_select_public"
  ON public.artist_stats FOR SELECT USING (true);

-- 2. RPC : incrémente une vue (profil ou pin), idempotent par artiste.
CREATE OR REPLACE FUNCTION public.record_artist_view(
  p_artist_id text,
  p_kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_kind NOT IN ('profile', 'pin') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;
  INSERT INTO public.artist_stats (artist_id, profile_views, pin_views, updated_at)
  VALUES (
    p_artist_id,
    CASE WHEN p_kind = 'profile' THEN 1 ELSE 0 END,
    CASE WHEN p_kind = 'pin' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (artist_id) DO UPDATE
    SET profile_views = public.artist_stats.profile_views + CASE WHEN p_kind = 'profile' THEN 1 ELSE 0 END,
        pin_views     = public.artist_stats.pin_views + CASE WHEN p_kind = 'pin' THEN 1 ELSE 0 END,
        updated_at    = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_artist_view(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_artist_view(text, text) TO anon, authenticated;

-- 3. Favoris web : SELECT/INSERT réservés à l'utilisateur connecté
-- (la table favorites vient de 00002 ; on s'assure des policies web).
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_read_own" ON public.favorites;
CREATE POLICY "favorites_read_own"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
CREATE POLICY "favorites_insert_own"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
CREATE POLICY "favorites_delete_own"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);
