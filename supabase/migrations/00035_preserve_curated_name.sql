-- ============================================================
-- 00035 — add_or_update_map_artist : préserver le nom curé
-- Le peuplement automatique (cron MusicBrainz) ne doit pas
-- écraser un nom déjà corrigé par l'admin ou l'artiste.
-- On ne remplace le nom que s'il est vide en base.
-- ============================================================

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
  -- Validation stricte du payload (exposé à anon) : lat/lng numériques
  -- et dans les bornes géographiques, pour éviter les 500 et les pins absurdes.
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
    platforms, socials, image
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
    NULLIF(p_artist ->> 'image', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Enrichit sans écraser la curation : le nom existant (corrigé par
    -- l'admin ou l'artiste revendiquant) prime sur le nom du candidat.
    name      = COALESCE(NULLIF(public.map_artists.name, ''), EXCLUDED.name),
    genre     = COALESCE(EXCLUDED.genre, public.map_artists.genre),
    city      = COALESCE(EXCLUDED.city, public.map_artists.city),
    country   = COALESCE(EXCLUDED.country, public.map_artists.country),
    flag      = COALESCE(EXCLUDED.flag, public.map_artists.flag),
    lat       = EXCLUDED.lat,
    lng       = EXCLUDED.lng,
    bio       = COALESCE(EXCLUDED.bio, public.map_artists.bio),
    source    = EXCLUDED.source,
    image     = COALESCE(EXCLUDED.image, public.map_artists.image),
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
