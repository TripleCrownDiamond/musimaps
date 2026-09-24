-- ============================================================
-- 00075 — add_or_update_map_artist : transporte la ville de naissance
--
-- 00074 ajoute la colonne birthplace (ville de naissance documentée,
-- distincte de la ville du pin : Blaaz est né à Kano et rappe à
-- Cotonou). Cette migration reprend la DERNIÈRE définition du RPC
-- (00066, protections de curation intactes) avec trois ajouts :
--   • INSERT : birthplace repris du payload s'il est fourni ;
--   • mise à jour : rempli seulement s'il est vide (jamais écrasé),
--     sauf admin_override ;
--   • rien d'autre ne change : nom, localisation et modération restent
--     protégés exactement comme dans 00066.
-- Le garde-fou scripts/map-artist-rpc.test.mjs doit continuer à passer.
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
  v_privileged boolean;
  v_override boolean;
  v_claimed_by uuid;
  v_take_location boolean;
BEGIN
  v_id := p_artist ->> 'id';
  -- Validation stricte du payload (exposé à anon) : lat/lng numériques et
  -- dans les bornes, liens en objets JSON (un tableau concaténé par `||`
  -- corromprait les liens existants), claimed_by au format uuid.
  IF v_id IS NULL
     OR (p_artist ->> 'name') IS NULL
     OR (p_artist ->> 'lat') !~ '^-?[0-9]+(\.[0-9]+)?$'
     OR (p_artist ->> 'lng') !~ '^-?[0-9]+(\.[0-9]+)?$'
     OR COALESCE(jsonb_typeof(p_artist -> 'platforms'), 'null') NOT IN ('object', 'null')
     OR COALESCE(jsonb_typeof(p_artist -> 'socials'), 'null') NOT IN ('object', 'null')
     OR COALESCE(p_artist ->> 'claimed_by', '')
          !~* '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$'
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;
  IF (p_artist ->> 'lat')::double precision NOT BETWEEN -90 AND 90
     OR (p_artist ->> 'lng')::double precision NOT BETWEEN -180 AND 180
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  v_privileged := COALESCE(public.is_admin(), false)
                  OR COALESCE(auth.role(), '') = 'service_role';
  v_override := COALESCE((p_artist ->> 'admin_override') = 'true', false);

  IF v_override AND NOT v_privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'override_forbidden');
  END IF;

  v_claimed_by := NULLIF(p_artist ->> 'claimed_by', '')::uuid;
  IF v_claimed_by IS NOT NULL AND NOT v_privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'claimed_by_forbidden');
  END IF;

  -- Bloc localisation : repris du payload sur override, ou si la ligne
  -- existante n'a pas de coordonnées. Aucune ligne → NULL → sans objet
  -- (c'est une insertion).
  SELECT (m.lat IS NULL OR m.lng IS NULL) INTO v_take_location
    FROM public.map_artists m
   WHERE m.id = v_id;
  v_take_location := v_override OR COALESCE(v_take_location, true);

  INSERT INTO public.map_artists (
    id, name, genre, city, district, birthplace, country, flag, lat, lng, bio, source,
    platforms, socials, image, followers, claimed_by, claimed_at
  )
  VALUES (
    v_id,
    p_artist ->> 'name',
    NULLIF(p_artist ->> 'genre', ''),
    NULLIF(p_artist ->> 'city', ''),
    NULLIF(p_artist ->> 'district', ''),
    NULLIF(p_artist ->> 'birthplace', ''),
    NULLIF(p_artist ->> 'country', ''),
    NULLIF(p_artist ->> 'flag', ''),
    (p_artist ->> 'lat')::double precision,
    (p_artist ->> 'lng')::double precision,
    NULLIF(p_artist ->> 'bio', ''),
    COALESCE(NULLIF(p_artist ->> 'source', ''), 'musicbrainz'),
    COALESCE(p_artist -> 'platforms', '{}'::jsonb),
    COALESCE(p_artist -> 'socials', '{}'::jsonb),
    NULLIF(p_artist ->> 'image', ''),
    NULLIF(p_artist ->> 'followers', ''),
    v_claimed_by,
    CASE WHEN v_claimed_by IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Identité : le nom existant prime, sauf override.
    name      = CASE WHEN v_override THEN EXCLUDED.name
                     ELSE COALESCE(NULLIF(public.map_artists.name, ''), EXCLUDED.name) END,
    source    = CASE WHEN v_override THEN EXCLUDED.source
                     ELSE COALESCE(public.map_artists.source, EXCLUDED.source) END,

    -- Localisation : bloc indivisible (voir v_take_location).
    lat       = CASE WHEN v_take_location THEN EXCLUDED.lat
                     ELSE public.map_artists.lat END,
    lng       = CASE WHEN v_take_location THEN EXCLUDED.lng
                     ELSE public.map_artists.lng END,
    city      = CASE WHEN v_take_location THEN COALESCE(EXCLUDED.city, public.map_artists.city)
                     ELSE public.map_artists.city END,
    district  = CASE WHEN v_take_location THEN COALESCE(EXCLUDED.district, public.map_artists.district)
                     ELSE public.map_artists.district END,
    -- Naissance : champ de curation, rempli seulement s'il est vide
    -- (jamais écrasé par une redécouverte publique).
    birthplace = CASE WHEN v_override THEN COALESCE(EXCLUDED.birthplace, public.map_artists.birthplace)
                      ELSE COALESCE(NULLIF(public.map_artists.birthplace, ''), EXCLUDED.birthplace) END,
    country   = CASE WHEN v_take_location THEN COALESCE(EXCLUDED.country, public.map_artists.country)
                     ELSE public.map_artists.country END,
    flag      = CASE WHEN v_take_location THEN COALESCE(EXCLUDED.flag, public.map_artists.flag)
                     ELSE public.map_artists.flag END,

    -- Profil : le neuf remplace sur override, ne remplit que les vides sinon.
    genre     = CASE WHEN v_override THEN COALESCE(EXCLUDED.genre, public.map_artists.genre)
                     ELSE COALESCE(NULLIF(public.map_artists.genre, ''), EXCLUDED.genre) END,
    bio       = CASE WHEN v_override THEN COALESCE(EXCLUDED.bio, public.map_artists.bio)
                     ELSE COALESCE(NULLIF(public.map_artists.bio, ''), EXCLUDED.bio) END,
    image     = CASE WHEN v_override THEN COALESCE(EXCLUDED.image, public.map_artists.image)
                     ELSE COALESCE(NULLIF(public.map_artists.image, ''), EXCLUDED.image) END,
    followers = CASE WHEN v_override THEN COALESCE(EXCLUDED.followers, public.map_artists.followers)
                     ELSE COALESCE(NULLIF(public.map_artists.followers, ''), EXCLUDED.followers) END,

    -- Liens : `a || b` garde les clés de b en cas de collision.
    platforms = CASE WHEN v_override
                     THEN COALESCE(public.map_artists.platforms, '{}'::jsonb)
                          || COALESCE(EXCLUDED.platforms, '{}'::jsonb)
                     ELSE COALESCE(EXCLUDED.platforms, '{}'::jsonb)
                          || COALESCE(public.map_artists.platforms, '{}'::jsonb) END,
    socials   = CASE WHEN v_override
                     THEN COALESCE(public.map_artists.socials, '{}'::jsonb)
                          || COALESCE(EXCLUDED.socials, '{}'::jsonb)
                     ELSE COALESCE(EXCLUDED.socials, '{}'::jsonb)
                          || COALESCE(public.map_artists.socials, '{}'::jsonb) END,

    -- Revendication : v_claimed_by n'est non NULL que pour un rôle privilégié.
    claimed_by = CASE WHEN v_override THEN COALESCE(v_claimed_by, public.map_artists.claimed_by)
                      ELSE COALESCE(public.map_artists.claimed_by, v_claimed_by) END,
    claimed_at = CASE
                   WHEN v_claimed_by IS NOT NULL
                    AND v_claimed_by IS DISTINCT FROM public.map_artists.claimed_by
                    AND (v_override OR public.map_artists.claimed_by IS NULL)
                   THEN now()
                   ELSE public.map_artists.claimed_at
                 END
  RETURNING (xmax = 0) INTO v_inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'updated', NOT v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_or_update_map_artist(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.add_or_update_map_artist(jsonb) TO anon, authenticated, service_role;
