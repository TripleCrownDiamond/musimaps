-- ============================================================
-- 00026 — Abonnés MusiMaps d'un artiste
-- Le compteur « abonnés » affiché sur les profils doit refléter
-- les vrais followers de l'artiste SUR MusiMaps (favoris). La
-- table favorites est protégée par RLS (lecture seule par le
-- propriétaire), on expose donc un comptage via une fonction
-- SECURITY DEFINER accessible publiquement.
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_artist_followers(p_artist_id text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.favorites
  WHERE artist_id = p_artist_id;
$$;

REVOKE ALL ON FUNCTION public.count_artist_followers(text) FROM public;
GRANT EXECUTE ON FUNCTION public.count_artist_followers(text) TO anon, authenticated;
