-- ============================================================
-- 00072 — Comptage en masse des abonnés Musimaps (cartes de partage).
--
-- inject-og grave une carte sociale par artiste au build. La carte annonce
-- « ville, pays · N abonnés sur Musimaps » : il faut donc les abonnés de
-- TOUS les artistes d'un coup. Appeler count_artist_followers 121 fois via
-- PostgREST est 121 allers-retours ; ce RPC renvoie la table entière en un.
--
-- Même logique de comptage que count_artist_followers (00027) : utilisateurs
-- DISTINCT, favoris de l'artiste. Les artistes sans favori ne reviennent pas
-- dans le résultat — côté appelant, absence = 0.
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_artist_followers_bulk(p_artist_ids text[])
RETURNS TABLE(artist_id text, followers bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.artist_id, count(DISTINCT f.user_id)::bigint AS followers
  FROM public.favorites f
  WHERE f.artist_id = ANY (p_artist_ids)
  GROUP BY f.artist_id;
$$;

REVOKE ALL ON FUNCTION public.count_artist_followers_bulk(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.count_artist_followers_bulk(text[]) TO anon, authenticated;
