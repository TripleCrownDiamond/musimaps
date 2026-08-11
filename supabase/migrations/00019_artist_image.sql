-- ============================================================
-- 00019 — Photo HD des artistes découverts
-- Ajoute une colonne `image` à map_artists et étend le RPC
-- add_or_update_map_artist (00018) pour l'enregistrer.
-- ============================================================

ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS image text;

-- Re-définition du RPC : l'upsert enregistre aussi la photo HD.
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
    id, name, genre, city, country, flag, lat, lng, bio, image, source,
    platforms, socials
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
    NULLIF(p_artist ->> 'image', ''),
    COALESCE(NULLIF(p_artist ->> 'source', ''), 'musicbrainz'),
    COALESCE(p_artist -> 'platforms', '{}'::jsonb),
    COALESCE(p_artist -> 'socials', '{}'::jsonb)
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
    image     = COALESCE(EXCLUDED.image, public.map_artists.image),
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
