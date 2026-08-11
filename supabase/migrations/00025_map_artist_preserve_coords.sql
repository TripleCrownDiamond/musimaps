-- ============================================================
-- 00025 — Ne jamais écraser les coordonnées d'un artiste existant
-- Le RPC add_or_update_map_artist faisait `lat = EXCLUDED.lat`,
-- donc un payload avec lat=0/lng=0 (ex. backfill d'images)
-- déplaçait les pins existants au point 0,0. On conserve les
-- coordonnées déjà en base quand l'artiste existe.
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
  v_lat double precision;
  v_lng double precision;
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

  v_lat := (p_artist ->> 'lat')::double precision;
  v_lng := (p_artist ->> 'lng')::double precision;

  INSERT INTO public.map_artists (
    id, name, genre, city, country, flag, lat, lng, bio, source,
    platforms, socials
  )
  VALUES (
    v_id,
    p_artist ->> 'name',
    NULLIF(p_artist ->> 'genre', ''),
    NULLIF(p_artist ->> 'city', ''),
    NULLIF(p_artist ->> 'country', ''),
    NULLIF(p_artist ->> 'flag', ''),
    v_lat,
    v_lng,
    NULLIF(p_artist ->> 'bio', ''),
    COALESCE(NULLIF(p_artist ->> 'source', ''), 'musicbrainz'),
    COALESCE(p_artist -> 'platforms', '{}'::jsonb),
    COALESCE(p_artist -> 'socials', '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    -- On enrichit sans perdre l'existant : les champs vides du candidat
    -- conservent la valeur déjà en base. lat/lng aussi : 0/0 ne doit
    -- jamais remplacer un pin déjà positionné.
    name      = EXCLUDED.name,
    genre     = COALESCE(EXCLUDED.genre, public.map_artists.genre),
    city      = COALESCE(EXCLUDED.city, public.map_artists.city),
    country   = COALESCE(EXCLUDED.country, public.map_artists.country),
    flag      = COALESCE(EXCLUDED.flag, public.map_artists.flag),
    lat       = CASE WHEN EXCLUDED.lat = 0 AND public.map_artists.lat <> 0
                     THEN public.map_artists.lat ELSE EXCLUDED.lat END,
    lng       = CASE WHEN EXCLUDED.lng = 0 AND public.map_artists.lng <> 0
                     THEN public.map_artists.lng ELSE EXCLUDED.lng END,
    bio       = COALESCE(EXCLUDED.bio, public.map_artists.bio),
    source    = EXCLUDED.source,
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
