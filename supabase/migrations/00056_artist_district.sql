-- ============================================================
-- 00056 — Quartier / district des artistes
--
-- 1. Colonne `district` sur map_artists : le quartier (ex. « Yopougon »,
--    « Bastille », « Almadies ») ancre la localisation réelle de l'artiste
--    et disperse les pins d'une même ville (géocodage par quartier au lieu
--    du centre-ville). Saisi dans les formulaires de référencement (web,
--    mobile) et éditable dans l'admin (Artistes découverts).
-- 2. Le RPC add_or_update_map_artist est enrichi pour la stocker.
-- 3. Colonne `district` sur waitlist : conservée lors du référencement,
--    l'admin la voit dans la liste d'attente avant validation.
-- ============================================================

-- 1) map_artists.district
ALTER TABLE public.map_artists
  ADD COLUMN IF NOT EXISTS district TEXT;

-- 2) RPC enrichi : stocker district (INSERT + UPDATE).
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
    id, name, genre, city, district, country, flag, lat, lng, bio, source,
    platforms, socials, image, followers
  )
  VALUES (
    v_id,
    p_artist ->> 'name',
    NULLIF(p_artist ->> 'genre', ''),
    NULLIF(p_artist ->> 'city', ''),
    NULLIF(p_artist ->> 'district', ''),
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
    district  = COALESCE(EXCLUDED.district, public.map_artists.district),
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

-- 3) waitlist.district : le quartier saisi au référencement accompagne la
--    demande (l'admin le voit et le reporte sur le pin à la validation).
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS district TEXT;
