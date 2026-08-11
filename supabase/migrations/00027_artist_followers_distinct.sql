-- ============================================================
-- 00027 — Abonnés MusiMaps : comptage par utilisateur distinct
-- Le compteur « abonnés » doit refléter le nombre d'utilisateurs
-- qui suivent l'artiste, pas le nombre de lignes favorites (une
-- ligne par utilisateur est attendue, mais on se protège des
-- doublons éventuels).
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_artist_followers(p_artist_id text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT user_id)::bigint
  FROM public.favorites
  WHERE artist_id = p_artist_id;
$$;

REVOKE ALL ON FUNCTION public.count_artist_followers(text) FROM public;
GRANT EXECUTE ON FUNCTION public.count_artist_followers(text) TO anon, authenticated;
