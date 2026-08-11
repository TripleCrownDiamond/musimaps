-- ============================================================
-- 00055 — map_artists : colonne followers + RPC enrichi + RESET
--
-- 1. La colonne `followers` (popularité réelle Deezer, ex. « 349699 »)
--    n'existait pas : elle alimente l'anneau de popularité, les stats
--    de cluster et le tri des résultats (parité web + mobile).
-- 2. Le RPC add_or_update_map_artist est enrichi pour la stocker.
-- 3. RESET de la carte : on vide map_artists (et ses dépendances) pour
--    reconstruire la carte avec UNIQUEMENT des artistes populaires
--    (gate Deezer nb_fan >= 10 000 + image HD + morceaux vérifiés).
--    Migration volontairement ponctuelle : elle ne s'exécute qu'une fois.
-- ============================================================

-- 1) Colonne followers (popularité externe, pas le compteur Musimaps).
ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS followers TEXT;

-- 2) RPC enrichi : stocker followers (INSERT + UPDATE).
CREATE OR REPLACE FUNCTION public.add_or_update_map_artist(p_artist jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_inserted boolean;
BEGIN
  v_id := p_artist ->> 'id';
  IF v_id IS NULL
     OR (p_artist ->> 'name') IS NULL
     OR (p_artist ->> 'lat') !~ '^-?[0-9]+(\.[0-9]+)?$'
     OR (p_artist ->> 'lng') !~ '^-?[0-9]+(\.[0-9]+)?$'
     OR (p_artist ->> 'lat')::double precision NOT BETWEEN -90 AND 90
     OR (p_artist ->> 'lng')::double precision NOT BETWEEN -180 AND 180
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  INSERT INTO public.map_artists (
    id, name, genre, city, country, flag, lat, lng, bio, source,
    platforms, socials, image, followers
  )
  VALUES (
    v_id,
    p_artist ->> 'name',
    NULLIF(p_artist ->> 'genre', ''),
    NULLIF(p_artist ->> 'city', ''),
    NULLIF(p_artist ->> 'country', ''),
    NULLIF(p_artist ->> 'flag', ''),
    (p_artist ->> 'lat')::double precision,
    (p_artist ->> 'lng')::double precision,
    NULLIF(p_artist ->> 'bio', ''),
    COALESCE(NULLIF(p_artist ->> 'source', ''), 'musicbrainz'),
    COALESCE(p_artist -> 'platforms', '{}'::jsonb),
    COALESCE(p_artist -> 'socials', '{}'::jsonb),
    NULLIF(p_artist ->> 'image', ''),
    NULLIF(p_artist ->> 'followers', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    name      = EXCLUDED.name,
    genre     = COALESCE(EXCLUDED.genre, public.map_artists.genre),
    city      = COALESCE(EXCLUDED.city, public.map_artists.city),
    country   = COALESCE(EXCLUDED.country, public.map_artists.country),
    flag      = COALESCE(EXCLUDED.flag, public.map_artists.flag),
    lat       = EXCLUDED.lat,
    lng       = EXCLUDED.lng,
    bio       = COALESCE(EXCLUDED.bio, public.map_artists.bio),
    source    = EXCLUDED.source,
    image     = COALESCE(EXCLUDED.image, public.map_artists.image),
    followers = COALESCE(EXCLUDED.followers, public.map_artists.followers),
    platforms = COALESCE(public.map_artists.platforms, '{}'::jsonb)
                || COALESCE(EXCLUDED.platforms, '{}'::jsonb),
    socials   = COALESCE(public.map_artists.socials, '{}'::jsonb)
                || COALESCE(EXCLUDED.socials, '{}'::jsonb)
  RETURNING (xmax = 0) INTO v_inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'updated', NOT v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_or_update_map_artist(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.add_or_update_map_artist(jsonb) TO anon, authenticated;

-- 3) RESET de la carte : vidage complet (une seule fois).
TRUNCATE TABLE public.map_artists CASCADE;
